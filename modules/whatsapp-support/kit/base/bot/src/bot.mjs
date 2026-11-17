// O robô: recebe o aviso do Chatwoot, confere a assinatura com o segredo da conta, responde 200 na hora
// e trabalha depois, uma conversa por vez. Toda falha vira passagem para a equipe. Cada passagem vai para
// o relatório das lacunas do sistema; cada conversa passada à equipe e resolvida pode virar sugestão de
// conhecimento, que alguém aprova no sistema antes de valer. A cada leva de mensagens, o perfil de quem
// escreve vem do projeto (rota contact, com cache curto) e muda o modo, o limite, o time e o prompt.

import { providerFor } from "./ai/index.mjs";
import { runAgent } from "./agent.mjs";
import { chatwootClient } from "./chatwoot.mjs";
import { silentLogger } from "./log.mjs";
import { createMemory, createSeenSet } from "./memory.mjs";
import { NO_PROFILE, contactProfile, conversationConfig, handoffMessage, handoffSummary, ruleHandoff } from "./conversation.mjs";
import { callsBot, isGroupContact, normalizeConfig } from "./policy.mjs";
import { scrub } from "./privacy.mjs";
import { projectClient } from "./project.mjs";
import { buildSuggestionPrompt, buildSystemPrompt, parseSuggestions, SUGGESTION_SCHEMA, toMessages } from "./prompt.mjs";
import { createMedia, projectTranscriber } from "./media.mjs";
import { createConversationQueue } from "./queue.mjs";
import { verifyChatwoot } from "./signature.mjs";

export const VERSION = "1.0.0";

const SUGGESTION_PREFIX = "Sugestão do robô, revise antes de enviar:";
const ROLE_LABEL = { cliente: "Cliente", robo: "Robô", equipe: "Equipe" };
/** A etiqueta das conversas de grupo, que o provisionamento cria na conta para a equipe filtrar. */
export const GROUP_LABEL = "grupo";
/** A etiqueta da conversa que recebeu resposta pelo celular do número. */
export const PHONE_LABEL = "celular";
/** A nota, uma vez por conversa: o celular não diz quem digitou, então alguém da equipe registra. */
export const PHONE_NOTE = "Esta conversa recebeu resposta pelo celular do número, que não diz quem escreveu. Quem respondeu, registre aqui numa nota.";

/**
 * Resposta de uma pessoa da equipe, pelo painel ou pelo celular do número (o adaptador do OpenWA a põe no
 * painel com a pessoa de repasse). Fora: o robô, automações e campanhas, como em human_response? do
 * Chatwoot (app/models/message.rb).
 */
function humanReply(payload) {
  return (
    payload?.sender?.type === "user" &&
    !payload?.content_attributes?.automation_rule_id &&
    !payload?.additional_attributes?.campaign_id
  );
}

function header(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function firstName(name) {
  const first = String(name ?? "").trim().split(/\s+/)[0];
  return first && /\p{L}/u.test(first) ? first.slice(0, 40) : null;
}

function contactOf(payload) {
  const sender = payload?.sender ?? payload?.conversation?.meta?.sender ?? payload?.meta?.sender ?? {};
  return {
    id: sender.id ?? null,
    name: sender.name ?? null,
    phone_number: sender.phone_number ?? null,
    identifier: sender.identifier ?? null,
    email: sender.email ?? null,
  };
}

const EMPTY_MEDIA = { images: [], texts: [], notes: [], skipped: [], documents: 0 };

/** Depois de uma falha da rota contact, quando o robô pergunta de novo; até lá vale o perfil que se conhecia. */
const PROFILE_RETRY_MS = 60000;
const MAX_PROFILES = 2000;

/**
 * Põe as imagens (fotos, prints e a grade do vídeo) na última mensagem da pessoa, em partes neutras
 * ({ type: "text" } e { type: "image", mime, data }) que cada adaptador de IA traduz para o seu formato.
 */
export function attachImages(messages, images) {
  let index = messages.length - 1;
  while (index >= 0 && messages[index].role !== "user") index -= 1;
  if (index < 0) {
    messages.push({ role: "user", content: "" });
    index = messages.length - 1;
  }
  const current = messages[index].content;
  const parts = typeof current === "string" ? (current.trim() ? [{ type: "text", text: current }] : []) : [...current];
  for (const image of images) {
    if (image.caption) parts.push({ type: "text", text: image.caption });
    parts.push({ type: "image", mime: image.mime, data: image.data });
  }
  messages[index] = { ...messages[index], content: parts };
  return messages;
}

export function createBot({ env, fetchImpl = fetch, now = () => Date.now(), logger = silentLogger, chatwootFactory = chatwootClient, mediaFactory = createMedia }) {
  const mediaTools = mediaFactory({ env, fetchImpl });
  let mediaReady = null;
  let pdfReady = null;
  const project = projectClient({ baseUrl: env.projectUrl, secret: env.secret, fetchImpl });
  const memory = createMemory({ now });
  const seen = createSeenSet();
  const configs = new Map();
  // O perfil de cada conversa: { info, at, ttl }. Fica guardado depois de vencer, para mandar previous_profile.
  const profiles = new Map();
  const profileTtl = Number.isFinite(env.profileTtlMs) ? env.profileTtlMs : 300000;

  function rememberProfile(key, info, ttl) {
    profiles.delete(key);
    profiles.set(key, { info, at: now(), ttl });
    while (profiles.size > MAX_PROFILES) profiles.delete(profiles.keys().next().value);
  }

  /** Uma consulta pode confirmar quem é a pessoa: a próxima leva pergunta o perfil de novo ao projeto. */
  function forgetProfile(key) {
    const entry = profiles.get(key);
    if (entry) entry.ttl = 0;
  }

  /**
   * O perfil de quem escreve, pela rota contact, com cache curto por conversa. 404 ou profile null: sem
   * perfil. Outra falha: fica o perfil que se conhecia (ou nenhum) e o robô pergunta de novo em um minuto,
   * para uma falha passageira não tirar o modo desligado de um perfil bloqueado.
   */
  async function profileFor(key, { accountId, conversationId, inboxId, contact }) {
    const cached = profiles.get(key);
    if (cached && now() - cached.at < cached.ttl) return cached.info;
    const previous = cached?.info ?? null;
    let info;
    let ttl = profileTtl;
    try {
      info = contactProfile(
        await project.contact({
          account_id: accountId,
          conversation_id: conversationId,
          inbox_id: inboxId,
          contact: { id: contact.id, name: contact.name, phone: contact.phone_number, identifier: contact.identifier },
          previous_profile: previous?.key ?? null,
        }),
      );
    } catch (error) {
      if (error?.status === 404) info = NO_PROFILE;
      else {
        info = previous ?? NO_PROFILE;
        ttl = Math.min(PROFILE_RETRY_MS, profileTtl);
        logger.warn({ event: "profile_failed", account: accountId, conversation: conversationId, code: error?.code ?? "unexpected" });
      }
    }
    rememberProfile(key, info, ttl);
    if (cached && (previous?.key ?? null) !== info.key) {
      logger.info({ event: "profile_changed", account: accountId, conversation: conversationId, profile: info.key, previous: previous?.key ?? null });
    }
    return info;
  }

  async function loadConfig(accountId, { timeout } = {}) {
    const cached = configs.get(accountId);
    if (cached && now() - cached.at < env.configTtlMs) return cached.config;
    try {
      const config = normalizeConfig(await project.config(accountId, { timeout }));
      configs.set(accountId, { config, at: now() });
      return config;
    } catch (error) {
      if (cached && now() - cached.at < env.configStaleMs) return cached.config;
      throw error;
    }
  }

  function classify(payload, config) {
    const conversation = payload?.event === "conversation_resolved" ? payload : payload?.conversation ?? {};
    const conversationId = Number(conversation.id);
    if (!Number.isInteger(conversationId) || conversationId <= 0) return {};
    const accountId = Number(payload.account.id);

    const group = isGroupContact(contactOf(payload));
    if (payload.event === "conversation_resolved") {
      // Conversa de grupo não vira sugestão de conhecimento: é a equipe trabalhando com quem ela convidou.
      const handedOff = (conversation.labels ?? []).some((label) => config.handoff.labels.includes(label));
      return config.learning.enabled && handedOff && !group ? { key: `aprender:${accountId}:${conversationId}`, learn: true } : {};
    }
    if (payload.event !== "message_created" || payload.private === true) return {};
    const key = `${accountId}:${conversationId}`;
    const text = String(payload.content ?? "");
    if (payload.message_type === "outgoing") {
      const role = payload.sender?.type === "agent_bot" ? "robo" : "equipe";
      const record = text.trim() ? { id: payload.id, role, text } : null;
      if (!humanReply(payload)) return { key, record };
      // Uma pessoa respondeu: a conversa é dela (invariante 15). O Chatwoot -ce não abre sozinho a conversa
      // pendente nessa hora (message.rb: captain_pending_conversation? é false fora do enterprise).
      const phone = config.chatwoot.relay_user_id !== null && Number(payload.sender?.id) === config.chatwoot.relay_user_id;
      if (!phone && conversation.status !== "pending") return { key, record };
      return { key, record, takeover: { phone } };
    }
    if (payload.message_type !== "incoming") return {};
    const status = conversation.status;
    if (group) {
      // Num grupo, o robô só abre a conversa para a equipe e só fala quando chamado (invariante 13).
      const called = config.mode !== "desligado" && config.groups.mode === "chamado" && callsBot(text, config.groups.call_words);
      return { key, record: text.trim() ? { id: payload.id, role: "cliente", text } : null, act: status === "pending" || (status === "open" && called) };
    }
    // O modo vem do último perfil conhecido da conversa; processConversation confere com o perfil atual.
    const mode = conversationConfig(config, profiles.get(key)?.info ?? NO_PROFILE).mode;
    const act = status === "pending" || (status === "open" && mode === "sugestao" && config.suggest_on_open);
    return { key, record: text.trim() ? { id: payload.id, role: "cliente", text } : null, act };
  }

  async function report(config, ids, { category, topic, reason, excerpt }) {
    if (!config.report.enabled) return;
    try {
      await project.event({
        kind: "handoff",
        account_id: ids.account,
        conversation_id: ids.conversation,
        category,
        topic: scrub(topic, 80),
        reason: scrub(reason, 200),
        excerpt: scrub(excerpt, 300),
        at: new Date(now()).toISOString(),
      });
    } catch (error) {
      logger.warn({ event: "report_failed", account: ids.account, conversation: ids.conversation, code: error?.code ?? "unexpected" });
    }
  }

  /**
   * Passa a conversa para a equipe. A nota interna é o resumo (handoffSummary): da IA, em summary, ou do
   * que o robô tem, numa passagem por regra (done diz o que o robô fez). O motivo vai para as lacunas.
   */
  async function handoffFlow({ cw, ids, config, pending, text, reason, category = "outro", topic = "", excerpt = "", done = "", summary = null }) {
    const { account, conversation } = ids;
    const note = handoffSummary(config, { ai: summary ?? {}, need: excerpt, done });
    if (config.mode === "sugestao") {
      const content = text ? `${SUGGESTION_PREFIX}\n\n${text}\n\nO robô sugere passar para a equipe.\n\n${note}` : `O robô sugere passar para a equipe.\n\n${note}`;
      await cw.send(account, conversation, { content, privateNote: true });
    } else {
      const publicText = handoffMessage(config, { text, now: new Date(now()) });
      if (publicText) await cw.send(account, conversation, { content: publicText });
      await cw.send(account, conversation, { content: note, privateNote: true });
    }
    if (pending) await cw.handoff(account, conversation);
    if (config.handoff.labels.length) {
      try {
        const current = await cw.labels(account, conversation);
        await cw.setLabels(account, conversation, [...new Set([...current, ...config.handoff.labels])]);
      } catch {
        // etiqueta é ajuda para a equipe; a passagem já aconteceu
      }
    }
    if (config.handoff.team_id) {
      try {
        await cw.assignTeam(account, conversation, config.handoff.team_id);
      } catch {
        // a conversa já está aberta para a equipe toda
      }
    }
    await report(config, ids, { category, topic, reason, excerpt });
  }

  /** Conversa de grupo pendente: abre para a equipe sem escrever nada no grupo, com a etiqueta e o time. */
  async function openGroup(cw, ids, config) {
    await cw.handoff(ids.account, ids.conversation);
    try {
      const current = await cw.labels(ids.account, ids.conversation);
      if (!current.includes(GROUP_LABEL)) await cw.setLabels(ids.account, ids.conversation, [...current, GROUP_LABEL]);
    } catch {
      // etiqueta é ajuda para a equipe; a conversa já está aberta
    }
    if (config.groups.team_id) {
      try {
        await cw.assignTeam(ids.account, ids.conversation, config.groups.team_id);
      } catch {
        // a conversa já está aberta para a equipe toda
      }
    }
  }

  async function processConversation(key, items) {
    const started = now();
    const last = items[items.length - 1];
    const { accountId, config } = last;
    const conversationId = Number(last.payload.conversation.id);
    const ids = { account: accountId, conversation: conversationId };
    const cw = chatwootFactory({ baseUrl: env.chatwootUrl, token: config.chatwoot.bot_token, fetchImpl });
    // A configuração desta conversa: a da conta com o bloco do perfil de quem escreve por cima (D30).
    let cfg = config;
    const log = (fields) =>
      logger.info({ account: accountId, conversation: conversationId, mode: cfg.mode, ...(cfg.profile?.key ? { profile: cfg.profile.key } : {}), ...fields });
    let pending = last.payload.conversation.status === "pending";
    const texts = items.map((item) => String(item.payload.content ?? "").trim()).filter(Boolean);
    let excerpt = texts.join(" ");
    const contact = contactOf(last.payload);
    const group = isGroupContact(contact);
    const inboxId = last.payload.inbox?.id ?? last.payload.conversation?.inbox_id ?? null;
    let called = false;

    try {
      const fresh = await cw.show(accountId, conversationId).catch(() => null);
      const status = fresh?.status ?? last.payload.conversation.status;
      pending = status === "pending";
      if (group) {
        if (status !== "pending" && status !== "open") {
          log({ event: "skipped", status, group: true });
          return;
        }
        called = config.mode !== "desligado" && config.groups.mode === "chamado" && texts.some((text) => callsBot(text, config.groups.call_words));
        if (pending) {
          await openGroup(cw, ids, config);
          pending = false;
        }
        if (!called) {
          log({ event: "handled", action: status === "pending" ? "group_opened" : "group_quiet", group: true });
          return;
        }
      } else {
        if (status !== "pending" && status !== "open") {
          log({ event: "skipped", status });
          return;
        }
        // O perfil de quem escreve, a cada leva de mensagens (cache curto). Conversa de grupo não tem perfil.
        cfg = conversationConfig(config, await profileFor(key, { accountId, conversationId, inboxId, contact }));
        const draftingOnOpen = status === "open" && cfg.mode === "sugestao" && cfg.suggest_on_open;
        if (!pending && !draftingOnOpen) {
          log({ event: "skipped", status });
          return;
        }

        if (cfg.mode === "desligado") {
          if (pending) {
            const off = ruleHandoff(cfg);
            const message = handoffMessage(cfg, { code: off.code });
            if (message) await cw.send(accountId, conversationId, { content: message });
            // O resumo ajuda quem pega a conversa; se a nota falhar, a conversa ainda vai para a equipe.
            await cw.send(accountId, conversationId, { content: handoffSummary(cfg, { need: excerpt, done: off.done }), privateNote: true }).catch(() => {});
            await cw.handoff(accountId, conversationId);
            if (cfg.handoff.team_id) await cw.assignTeam(accountId, conversationId, cfg.handoff.team_id).catch(() => {});
          }
          log({ event: "handled", action: "handoff", code: "mode_off" });
          return;
        }
      }

      // Imagem, áudio e vídeo (D28): o que der para entender entra na mensagem, e a equipe só é chamada
      // quando nada do que a pessoa mandou pôde ser lido. Num grupo, só chega aqui a mensagem que chamou o robô.
      const attachments = items.flatMap((item) => (Array.isArray(item.payload.attachments) ? item.payload.attachments : []));
      // Com ai.transcription "project", o áudio é transcrito pelo projeto, e o contêiner fica sem chave de IA.
      const transcriber =
        cfg.ai.transcription === "project"
          ? projectTranscriber((part) => project.transcribe({ account_id: accountId, conversation_id: conversationId, ...part }))
          : null;
      const media = attachments.length ? await mediaTools.prepare({ attachments, wants: cfg.media, transcriber }) : EMPTY_MEDIA;
      if (attachments.length) {
        const skipped = media.skipped.map((item) => `${item.kind}:${item.code}`).join(",");
        log({ event: "media", items: attachments.length, ...(skipped ? { code: skipped } : {}) });
      }
      for (const text of media.texts) memory.add(key, { role: "cliente", text });
      for (const image of media.images) {
        const memo = image.memo ?? "[a pessoa mandou uma imagem]";
        if (memo) memory.add(key, { role: "cliente", text: memo });
      }
      const heard = [...texts, ...media.texts];
      excerpt = heard.join(" ");
      if (!heard.length && !media.images.length) {
        if (attachments.length && pending) {
          await handoffFlow({
            cw,
            ids,
            config: cfg,
            pending,
            text: cfg.messages.anexo,
            reason: "a pessoa mandou um arquivo que o robô não conseguiu ler",
            category: "anexo",
            topic: "arquivo enviado",
            done: "A pessoa mandou um arquivo que o robô não conseguiu ler.",
          });
          log({ event: "handled", action: "handoff", code: "attachment" });
        } else log({ event: "skipped", code: "empty" });
        return;
      }
      // A transcrição também fica para a equipe, numa nota interna: quem atende lê sem ouvir.
      for (const note of media.notes) await cw.send(accountId, conversationId, { content: note, privateNote: true }).catch(() => {});

      // As palavras que chamam a equipe e o limite de respostas, com o limite do perfil quando ele tem.
      const rule = pending ? ruleHandoff(cfg, { text: excerpt, turns: memory.turns(key) }) : null;
      if (rule) {
        await handoffFlow({ cw, ids, config: cfg, pending, text: "", reason: rule.reason, category: rule.category, excerpt, done: rule.done });
        log({ event: "handled", action: "handoff", code: rule.code });
        return;
      }

      if (cfg.history_from_project && !memory.seeded(key)) {
        try {
          const history = await project.history(accountId, conversationId, 20);
          memory.seed(key, Array.isArray(history) ? history : history?.messages ?? []);
        } catch {
          memory.seed(key, []);
        }
      }

      // Num grupo não há consulta (invariante 14): a resposta chega a todos os participantes.
      const tools = group ? [] : cfg.tools;
      const system = buildSystemPrompt(group ? { ...config, tools } : cfg, {
        now: new Date(now()),
        contactName: !group && cfg.share_contact_name ? firstName(last.payload.sender?.name) : null,
        group,
        media: media.images.length > 0,
        documents: media.documents > 0,
      });
      const messages = toMessages(memory.transcript(key));
      if (!messages.length) messages.push({ role: "user", content: heard.join("\n") || "A pessoa mandou uma imagem." });
      if (media.images.length) attachImages(messages, media.images);
      const providerGenerate = providerFor(cfg.ai.provider);
      const generate = ({ system: prompt, messages: history, schema }) =>
        providerGenerate({ ai: cfg.ai, system: prompt, messages: history, schema, keys: env.keys, fetchImpl, project, ids, tools, purpose: "acao" });
      const callTool = async (name, input) => {
        if (group) return { ok: false, code: "group_chat" };
        // Uma consulta pode confirmar quem é a pessoa (outro número, código por e-mail): o perfil é perguntado de novo na próxima leva.
        forgetProfile(key);
        return project.tool(name, { account_id: accountId, conversation_id: conversationId, inbox_id: inboxId, contact, input });
      };

      const showTyping = cfg.mode === "auto" && (pending || group);
      if (showTyping) cw.typing(accountId, conversationId, true).catch(() => {});
      let action;
      try {
        action = await runAgent({ generate, system, messages, tools, callTool, onStep: ({ tool }) => log({ event: "lookup", tool }) });
      } finally {
        if (showTyping) cw.typing(accountId, conversationId, false).catch(() => {});
      }

      if (action.action === "reply") {
        if (cfg.mode === "sugestao") {
          await cw.send(accountId, conversationId, { content: `${SUGGESTION_PREFIX}\n\n${action.text}`, privateNote: true });
          if (pending) await cw.handoff(accountId, conversationId);
        } else {
          const sent = await cw.send(accountId, conversationId, { content: action.text });
          memory.add(key, { id: sent?.id, role: "robo", text: action.text });
          memory.countTurn(key);
        }
        log({ event: "handled", action: "reply", lookups: action.lookups, provider: cfg.ai.provider, ms: now() - started });
        return;
      }

      if (pending || group || cfg.mode === "sugestao") {
        await handoffFlow({
          cw,
          ids,
          config: cfg,
          pending,
          text: action.text,
          reason: action.reason || "decisão do robô",
          category: action.category,
          topic: action.topic,
          excerpt,
          summary: action.summary,
        });
      }
      log({ event: "handled", action: "handoff", code: action.category, lookups: action.lookups, provider: cfg.ai.provider, ms: now() - started });
    } catch (error) {
      logger.error({ event: "failed", account: accountId, conversation: conversationId, code: error?.code ?? "unexpected", ms: now() - started });
      // Num grupo em que ninguém chamou o robô, nem a falha vira mensagem (invariante 13).
      if (group && !called) return;
      try {
        const code = error?.code ?? "erro inesperado";
        const text = cfg.mode === "sugestao" ? "" : cfg.messages.erro;
        await handoffFlow({ cw, ids, config: cfg, pending, text, reason: `o robô falhou (${code})`, category: "falha", excerpt, done: `O robô tentou responder e falhou (${code}).` });
      } catch (handoffError) {
        logger.error({ event: "handoff_failed", account: accountId, conversation: conversationId, code: handoffError?.code ?? "unexpected" });
      }
    }
  }

  /**
   * Uma pessoa respondeu: a conversa pendente abre para a equipe sem o robô escrever nada, e as mensagens do
   * cliente que chegaram junto ficam com ela. Resposta pelo celular do número: a etiqueta "celular" e, uma vez
   * por conversa, a nota que pede para registrar quem respondeu.
   */
  async function processTakeover(items) {
    const last = items[items.length - 1];
    const { accountId, config } = last;
    const conversationId = Number(last.payload.conversation.id);
    const cw = chatwootFactory({ baseUrl: env.chatwootUrl, token: config.chatwoot.bot_token, fetchImpl });
    const phone = items.some((item) => item.takeover?.phone === true);
    try {
      const fresh = await cw.show(accountId, conversationId).catch(() => null);
      const status = fresh?.status ?? last.payload.conversation.status;
      if (status === "pending") await cw.handoff(accountId, conversationId);
      if (phone) {
        const current = await cw.labels(accountId, conversationId);
        if (!current.includes(PHONE_LABEL)) {
          // A nota antes da etiqueta: se a etiqueta falhar, a nota se repete na próxima, mas nunca falta.
          await cw.send(accountId, conversationId, { content: PHONE_NOTE, privateNote: true });
          await cw.setLabels(accountId, conversationId, [...current, PHONE_LABEL]);
        }
      }
      logger.info({ event: "handled", account: accountId, conversation: conversationId, action: "takeover", phone, status });
    } catch (error) {
      logger.error({ event: "takeover_failed", account: accountId, conversation: conversationId, code: error?.code ?? "unexpected" });
    }
  }

  /** Conversa que o robô passou e a equipe resolveu: até 3 perguntas e respostas sugeridas, sem dado pessoal. */
  async function processLearning(item) {
    const { accountId, config, payload } = item;
    const conversationId = Number(payload.id);
    const ids = { account: accountId, conversation: conversationId };
    try {
      const history = await project.history(accountId, conversationId, 50);
      const entries = (Array.isArray(history) ? history : history?.messages ?? []).filter((entry) => ROLE_LABEL[entry?.role] && String(entry.text ?? "").trim());
      if (!entries.some((entry) => entry.role === "equipe")) {
        logger.info({ event: "learning_skipped", account: accountId, conversation: conversationId, code: "no_team_reply" });
        return;
      }
      const transcript = entries.map((entry) => `${ROLE_LABEL[entry.role]}: ${scrub(entry.text, 1500)}`).join("\n");
      const providerGenerate = providerFor(config.ai.provider);
      const { text } = await providerGenerate({
        ai: config.ai,
        system: buildSuggestionPrompt(config),
        messages: [{ role: "user", content: `Conversa:\n${transcript}` }],
        schema: SUGGESTION_SCHEMA,
        keys: env.keys,
        fetchImpl,
        project,
        ids,
        tools: [],
        purpose: "sugestoes",
      });
      const suggestions = parseSuggestions(text)
        .map((suggestion) => ({ q: scrub(suggestion.q, 500), a: scrub(suggestion.a, 3000), why: scrub(suggestion.why, 300) }))
        .filter((suggestion) => suggestion.q && suggestion.a);
      if (!suggestions.length) {
        logger.info({ event: "learning_skipped", account: accountId, conversation: conversationId, code: "nothing_general" });
        return;
      }
      await project.suggestions({ account_id: accountId, conversation_id: conversationId, suggestions, at: new Date(now()).toISOString() });
      logger.info({ event: "learning_sent", account: accountId, conversation: conversationId, items: suggestions.length });
    } catch (error) {
      logger.warn({ event: "learning_failed", account: accountId, conversation: conversationId, code: error?.code ?? "unexpected" });
    }
  }

  const queue = createConversationQueue({
    debounceMs: env.debounceMs,
    run: (key, items) => {
      const last = items[items.length - 1];
      if (last.learn) return processLearning(last);
      // Uma resposta de pessoa no meio das mensagens vence: o robô não responde por cima dela.
      if (items.some((item) => item.takeover)) return processTakeover(items);
      return processConversation(key, items);
    },
    onError: (error) => logger.error({ event: "queue_error", code: error?.code ?? "unexpected" }),
  });

  async function receive({ rawBody, headers }) {
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { status: 400, body: { ok: false, code: "bad_json" } };
    }
    const delivery = header(headers, "x-chatwoot-delivery");
    if (delivery && seen.has(delivery)) return { status: 200, body: { ok: true, ignored: "duplicate" } };
    const accountId = Number(payload?.account?.id);
    if (!Number.isInteger(accountId) || accountId <= 0) return { status: 200, body: { ok: true, ignored: "no_account" } };

    let config;
    try {
      config = await loadConfig(accountId, { timeout: 3000 });
    } catch (error) {
      logger.error({ event: "config_failed", account: accountId, code: error?.code ?? "config_failed" });
      return { status: 503, body: { ok: false, code: "config_unavailable" } };
    }
    const check = verifyChatwoot({
      secret: config.chatwoot.bot_secret,
      timestamp: header(headers, "x-chatwoot-timestamp"),
      signature: header(headers, "x-chatwoot-signature"),
      rawBody,
      now: now(),
    });
    if (!check.ok) {
      logger.warn({ event: "signature_refused", account: accountId, code: check.code });
      return { status: 401, body: { ok: false, code: check.code } };
    }
    if (delivery) seen.add(delivery);

    const decision = classify(payload, config);
    if (decision.record) memory.add(decision.key, decision.record);
    if (decision.act) queue.push(decision.key, { payload, accountId, config });
    if (decision.takeover) queue.push(decision.key, { payload, accountId, config, takeover: decision.takeover });
    if (decision.learn) queue.push(decision.key, { payload, accountId, config, learn: true });
    return { status: 200, body: { ok: true, queued: Boolean(decision.act || decision.takeover || decision.learn) } };
  }

  return {
    receive,
    health: () => ({
      ok: true,
      version: VERSION,
      conversations: memory.size(),
      queued: queue.size,
      // transcriber: quem transcreve pelas chaves do contêiner; o projeto que transcreve não aparece aqui.
      media: { ffmpeg: mediaReady, transcriber: mediaTools.transcriber?.() ?? null, pdf: pdfReady },
    }),
    /** Confere se o ffmpeg está no contêiner; o /health mostra o resultado (null antes de conferir). */
    checkMedia: async () => {
      mediaReady = await mediaTools.available();
      pdfReady = mediaTools.pdfAvailable ? await mediaTools.pdfAvailable() : null;
      return mediaReady;
    },
    idle: () => queue.idle(),
  };
}
