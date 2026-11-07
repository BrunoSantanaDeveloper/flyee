// O robô: recebe o aviso do Chatwoot, confere a assinatura com o segredo da conta, responde 200 na hora
// e trabalha depois, uma conversa por vez. Toda falha vira passagem para a equipe.

import { providerFor } from "./ai/index.mjs";
import { runAgent } from "./agent.mjs";
import { chatwootClient } from "./chatwoot.mjs";
import { silentLogger } from "./log.mjs";
import { createMemory, createSeenSet } from "./memory.mjs";
import { asksForTeam, normalizeConfig, teamAvailable } from "./policy.mjs";
import { projectClient } from "./project.mjs";
import { buildSystemPrompt, toMessages } from "./prompt.mjs";
import { createConversationQueue } from "./queue.mjs";
import { verifyChatwoot } from "./signature.mjs";

export const VERSION = "1.0.0";

const SUGGESTION_PREFIX = "Sugestão do robô, revise antes de enviar:";

function header(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function firstName(name) {
  const first = String(name ?? "").trim().split(/\s+/)[0];
  return first && /\p{L}/u.test(first) ? first.slice(0, 40) : null;
}

function contactOf(payload) {
  const sender = payload?.sender ?? payload?.conversation?.meta?.sender ?? {};
  return {
    id: sender.id ?? null,
    name: sender.name ?? null,
    phone_number: sender.phone_number ?? null,
    identifier: sender.identifier ?? null,
    email: sender.email ?? null,
  };
}

export function createBot({ env, fetchImpl = fetch, now = () => Date.now(), logger = silentLogger, chatwootFactory = chatwootClient }) {
  const project = projectClient({ baseUrl: env.projectUrl, secret: env.secret, fetchImpl });
  const memory = createMemory({ now });
  const seen = createSeenSet();
  const configs = new Map();

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
    if (payload?.event !== "message_created" || payload.private === true) return {};
    const conversation = payload.conversation ?? {};
    const conversationId = Number(conversation.id);
    if (!Number.isInteger(conversationId) || conversationId <= 0) return {};
    const key = `${Number(payload.account.id)}:${conversationId}`;
    const text = String(payload.content ?? "");
    if (payload.message_type === "outgoing") {
      const role = payload.sender?.type === "agent_bot" ? "robo" : "equipe";
      return { key, record: text.trim() ? { id: payload.id, role, text } : null };
    }
    if (payload.message_type !== "incoming") return {};
    const status = conversation.status;
    const act = status === "pending" || (status === "open" && config.mode === "sugestao" && config.suggest_on_open);
    return { key, record: text.trim() ? { id: payload.id, role: "cliente", text } : null, act };
  }

  async function handoffFlow({ cw, ids, config, pending, text, reason }) {
    const { account, conversation } = ids;
    if (config.mode === "sugestao") {
      const note = text ? `${SUGGESTION_PREFIX}\n\n${text}\n\nO robô sugere passar para a equipe: ${reason}.` : `O robô sugere passar para a equipe: ${reason}.`;
      await cw.send(account, conversation, { content: note, privateNote: true });
    } else {
      const publicText = text || (teamAvailable(config.hours, new Date(now())) ? config.messages.handoff : config.messages.handoff_fora_do_horario);
      if (publicText) await cw.send(account, conversation, { content: publicText });
      await cw.send(account, conversation, { content: `O robô passou a conversa para a equipe: ${reason}.`, privateNote: true });
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
  }

  async function processConversation(key, items) {
    const started = now();
    const last = items[items.length - 1];
    const { accountId, config } = last;
    const conversationId = Number(last.payload.conversation.id);
    const ids = { account: accountId, conversation: conversationId };
    const cw = chatwootFactory({ baseUrl: env.chatwootUrl, token: config.chatwoot.bot_token, fetchImpl });
    const log = (fields) => logger.info({ account: accountId, conversation: conversationId, mode: config.mode, ...fields });
    let pending = last.payload.conversation.status === "pending";

    try {
      const fresh = await cw.show(accountId, conversationId).catch(() => null);
      const status = fresh?.status ?? last.payload.conversation.status;
      pending = status === "pending";
      const draftingOnOpen = status === "open" && config.mode === "sugestao" && config.suggest_on_open;
      if (!pending && !draftingOnOpen) {
        log({ event: "skipped", status });
        return;
      }

      if (config.mode === "desligado") {
        if (pending) {
          if (config.messages.desligado) await cw.send(accountId, conversationId, { content: config.messages.desligado });
          await cw.handoff(accountId, conversationId);
        }
        log({ event: "handled", action: "handoff", code: "mode_off" });
        return;
      }

      const texts = items.map((item) => String(item.payload.content ?? "").trim()).filter(Boolean);
      const attachments = items.some((item) => Array.isArray(item.payload.attachments) && item.payload.attachments.length > 0);
      if (!texts.length) {
        if (attachments && pending) {
          await handoffFlow({ cw, ids, config, pending, text: config.messages.anexo, reason: "a pessoa mandou um arquivo" });
          log({ event: "handled", action: "handoff", code: "attachment" });
        } else log({ event: "skipped", code: "empty" });
        return;
      }

      if (pending && asksForTeam(texts.join(" "), config.handoff.keywords)) {
        await handoffFlow({ cw, ids, config, pending, text: "", reason: "a pessoa pediu a equipe" });
        log({ event: "handled", action: "handoff", code: "asked_for_team" });
        return;
      }
      if (pending && memory.turns(key) >= config.handoff.max_bot_turns) {
        await handoffFlow({ cw, ids, config, pending, text: "", reason: "o robô chegou ao limite de respostas" });
        log({ event: "handled", action: "handoff", code: "max_turns" });
        return;
      }

      if (config.history_from_project && !memory.seeded(key)) {
        try {
          const history = await project.history(accountId, conversationId, 20);
          memory.seed(key, Array.isArray(history) ? history : history?.messages ?? []);
        } catch {
          memory.seed(key, []);
        }
      }

      const system = buildSystemPrompt(config, { now: new Date(now()), contactName: config.share_contact_name ? firstName(last.payload.sender?.name) : null });
      const messages = toMessages(memory.transcript(key));
      if (!messages.length) messages.push({ role: "user", content: texts.join("\n") });
      const providerGenerate = providerFor(config.ai.provider);
      const generate = ({ system: prompt, messages: history, schema }) =>
        providerGenerate({ ai: config.ai, system: prompt, messages: history, schema, keys: env.keys, fetchImpl, project, ids, tools: config.tools });
      const contact = contactOf(last.payload);
      const inboxId = last.payload.inbox?.id ?? last.payload.conversation?.inbox_id ?? null;
      const callTool = (name, input) =>
        project.tool(name, { account_id: accountId, conversation_id: conversationId, inbox_id: inboxId, contact, input });

      const showTyping = config.mode === "auto" && pending;
      if (showTyping) cw.typing(accountId, conversationId, true).catch(() => {});
      let action;
      try {
        action = await runAgent({ generate, system, messages, tools: config.tools, callTool, onStep: ({ tool }) => log({ event: "lookup", tool }) });
      } finally {
        if (showTyping) cw.typing(accountId, conversationId, false).catch(() => {});
      }

      if (action.action === "reply") {
        if (config.mode === "sugestao") {
          await cw.send(accountId, conversationId, { content: `${SUGGESTION_PREFIX}\n\n${action.text}`, privateNote: true });
          if (pending) await cw.handoff(accountId, conversationId);
        } else {
          const sent = await cw.send(accountId, conversationId, { content: action.text });
          memory.add(key, { id: sent?.id, role: "robo", text: action.text });
          memory.countTurn(key);
        }
        log({ event: "handled", action: "reply", lookups: action.lookups, provider: config.ai.provider, ms: now() - started });
        return;
      }

      if (pending || config.mode === "sugestao") {
        await handoffFlow({ cw, ids, config, pending, text: action.text, reason: action.reason || "decisão do robô" });
      }
      log({ event: "handled", action: "handoff", lookups: action.lookups, provider: config.ai.provider, ms: now() - started });
    } catch (error) {
      logger.error({ event: "failed", account: accountId, conversation: conversationId, code: error?.code ?? "unexpected", ms: now() - started });
      try {
        const text = config.mode === "sugestao" ? "" : config.messages.erro;
        await handoffFlow({ cw, ids, config, pending, text, reason: `o robô falhou (${error?.code ?? "erro inesperado"})` });
      } catch (handoffError) {
        logger.error({ event: "handoff_failed", account: accountId, conversation: conversationId, code: handoffError?.code ?? "unexpected" });
      }
    }
  }

  const queue = createConversationQueue({
    debounceMs: env.debounceMs,
    run: processConversation,
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
    return { status: 200, body: { ok: true, queued: Boolean(decision.act) } };
  }

  return {
    receive,
    health: () => ({ ok: true, version: VERSION, conversations: memory.size(), queued: queue.size }),
    idle: () => queue.idle(),
  };
}
