// Conferência do número do atendimento: a sessão do OpenWA (rota não oficial) e a saúde que o Chatwoot
// consulta na Meta (rota oficial). Cada caixa volta com um nível e com achados que dizem o que se viu, a
// correção e quem corrige. Aqui nada se grava: o projeto guarda a memória (healthAlerts) e escolhe o canal do aviso.

import { chatwootAccount } from "./chatwoot.mjs";
import { ADAPTER_ID, adapterEnabled, openwaClient } from "./openwa.mjs";

/** ok: funcionando. atencao: funciona, mas pede um olhar. fora: mensagens não chegam ou não saem. */
export const LEVELS = ["ok", "atencao", "fora"];

/** fixBy: "quem_conecta" resolve na tela ou na Meta; "tecnico" é o servidor, de quem cuida da implantação. */
const finding = (level, code, detail, fix, fixBy = "quem_conecta") => ({ level, code, detail, fix, fixBy });

export function worstLevel(levels) {
  return levels.reduce((worst, level) => (LEVELS.indexOf(level) > LEVELS.indexOf(worst) ? level : worst), "ok");
}

/** O número atual do atendimento: a última caixa conectada, a mesma que a tela Conectar WhatsApp mostra. */
export function currentInbox(state) {
  return state?.inboxes?.[state.inboxes.length - 1] ?? null;
}

function untilText(value) {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.getTime())) return "";
  return ` até ${date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} (horário de Brasília)`;
}

const READ_QR = "Na tela Conectar WhatsApp, use Ler o QR de novo com o celular do número.";

function restrictionFindings(restriction) {
  if (!restriction) return [];
  if (restriction.kind === "tos_block") {
    return [finding("fora", "whatsapp_recusou_numero", "O WhatsApp recusou a conexão deste número pelos termos de uso.", "Veja no celular do número se há aviso de banimento. A API oficial é o caminho sem esse risco.")];
  }
  if (restriction.kind === "proxy_block") {
    return [finding("fora", "whatsapp_recusou_rede", "O WhatsApp recusou o endereço de rede de onde o OpenWA conecta.", "Troque a saída de rede ou o proxy do OpenWA e leia o QR de novo.", "tecnico")];
  }
  if (restriction.kind === "reachout_timelock") {
    return [
      finding(
        "atencao",
        "whatsapp_limitou_conversas_novas",
        `O WhatsApp bloqueou começar conversas novas${untilText(restriction.expiresAt)}. As conversas que os clientes começam continuam chegando.`,
        "Não mande mensagem para quem não escreveu primeiro até o bloqueio acabar.",
      ),
    ];
  }
  return [finding("atencao", "whatsapp_restricao", `O WhatsApp pôs uma restrição no número (${String(restriction.code ?? restriction.kind)}).`, "Veja o aviso no celular do número.")];
}

/**
 * Os estados do OpenWA 0.29.1 (docs/06-api-specification.md): created, initializing, qr_ready, authenticating,
 * ready, disconnected, action_required, failed. disconnected com o motor carregado é o OpenWA tentando de novo;
 * sem o motor, a sessão parou. session null: a sessão não existe mais.
 */
export function classifySession(session) {
  if (!session) return [finding("fora", "sessao_ausente", "A sessão do OpenWA desta caixa não existe mais.", "Na tela Conectar WhatsApp, conecte o número de novo.")];
  const findings = restrictionFindings(session.restriction);
  const status = String(session.status ?? "unknown");
  switch (status) {
    case "ready":
      break;
    case "qr_ready":
      findings.push(finding("fora", "numero_desconectado", "O número saiu do aparelho conectado e o WhatsApp espera um QR novo.", READ_QR));
      break;
    case "created":
      findings.push(finding("fora", "numero_nunca_conectou", "A sessão foi criada, mas o número nunca foi conectado.", READ_QR));
      break;
    case "disconnected":
      if (session.engineLoaded === true) {
        findings.push(finding("atencao", "reconectando", "A conexão caiu e o OpenWA está tentando de novo sozinho.", "Se continuar assim na próxima conferência, use Ler o QR de novo na tela Conectar WhatsApp."));
      } else {
        findings.push(finding("fora", "sessao_parada", "A sessão do OpenWA está parada.", READ_QR));
      }
      break;
    case "initializing":
    case "authenticating":
      findings.push(finding("atencao", "iniciando", "A sessão do OpenWA está iniciando.", "Espere alguns minutos. Se não passar disso, use Ler o QR de novo na tela Conectar WhatsApp."));
      break;
    case "action_required":
    case "failed":
      findings.push(finding("fora", "sessao_com_falha", "A sessão do OpenWA falhou.", "Veja o erro da sessão nos registros do OpenWA e depois use Ler o QR de novo na tela Conectar WhatsApp.", "tecnico"));
      break;
    default:
      findings.push(finding("atencao", "estado_desconhecido", `O OpenWA devolveu um estado que o kit não conhece: ${status}.`, "Confira se a versão do OpenWA é a travada no kit.", "tecnico"));
  }
  return findings;
}

/**
 * Uma URL de retorno serve a vários números do mesmo app da Meta: o Chatwoot acha o número pelo conteúdo do
 * aviso (Webhooks::WhatsappEventsJob), então basta apontar para os avisos de WhatsApp deste painel.
 */
function samePanelWebhook(url, expected) {
  try {
    const seen = new URL(url);
    return seen.origin === new URL(expected).origin && seen.pathname.startsWith("/webhooks/whatsapp");
  } catch {
    return false;
  }
}

function webhookFindings(health) {
  const expected = health?.expected_webhook_url;
  if (!expected || health.webhook_configuration === undefined) return [];
  const config = health.webhook_configuration ?? {};
  const url = config.phone_number || config.whatsapp_business_account || config.application || null;
  if (!url) {
    return [finding("fora", "meta_sem_aviso", "A Meta não tem endereço de aviso para este número: as mensagens dos clientes não chegam ao painel.", `No app da Meta, em WhatsApp, Configuração, cadastre a URL de retorno ${expected} e assine o campo messages.`)];
  }
  if (samePanelWebhook(url, expected)) return [];
  return [
    finding(
      "atencao",
      "meta_aviso_em_outro_endereco",
      `A Meta manda os avisos deste número para ${url}, e este painel espera ${expected}. Se esse endereço não repassa ao painel, as mensagens dos clientes não chegam.`,
      `No app da Meta, em WhatsApp, Configuração, use a URL de retorno ${expected} e assine o campo messages.`,
    ),
  ];
}

/**
 * A resposta de GET inboxes/:id/health do Chatwoot 4.19.1 (Whatsapp::HealthService), que consulta a Meta na
 * hora. error: o corpo do 422; type "authorization" é o código 190 da Meta, token vencido ou revogado.
 */
export function classifyCloudHealth({ health = null, error = null } = {}) {
  if (error) {
    if (error.type === "authorization") {
      return [
        finding(
          "fora",
          "meta_recusou_token",
          "A Meta recusou o token desta caixa: ele venceu ou foi revogado. As respostas não saem.",
          "Gere um token permanente novo no Gerenciador de Negócios da Meta e use Trocar o token da Meta na tela Conectar WhatsApp, com o mesmo número.",
        ),
      ];
    }
    return [finding("atencao", "meta_sem_resposta", "A Meta não respondeu à consulta do número agora.", "Se repetir na próxima conferência, confira o número no WhatsApp Manager da Meta.")];
  }
  const findings = [];
  const status = String(health?.status ?? "").toUpperCase();
  if (["BANNED", "DELETED", "DISCONNECTED"].includes(status)) {
    findings.push(finding("fora", "meta_numero_fora", `A Meta marca o número como ${status}: ele não envia nem recebe pela API.`, "Veja o aviso do número no WhatsApp Manager da Meta."));
  } else if (["RESTRICTED", "RATE_LIMITED", "FLAGGED"].includes(status)) {
    findings.push(finding("atencao", "meta_numero_limitado", `A Meta marca o número como ${status}.`, "Veja o aviso do número no WhatsApp Manager da Meta."));
  } else if (status && status !== "CONNECTED") {
    findings.push(finding("atencao", "meta_estado", `Estado do número na Meta: ${status}.`, "Veja o número no WhatsApp Manager da Meta."));
  }
  const quality = String(health?.quality_rating ?? "").toUpperCase();
  if (quality === "RED" || quality === "YELLOW") {
    findings.push(
      finding(
        "atencao",
        "meta_qualidade",
        `A qualidade do número na Meta está ${quality === "RED" ? "vermelha" : "amarela"}: muitos bloqueios ou denúncias podem limitar o envio.`,
        "Veja os motivos no WhatsApp Manager e reduza as mensagens que as pessoas não pediram.",
      ),
    );
  }
  return [...findings, ...webhookFindings(health)];
}

/** A falha de quem pergunta ao OpenWA: sessão apagada, chave recusada ou serviço fora do ar. */
export function openwaFailure(error) {
  if (error?.code === "http_404") return classifySession(null)[0];
  if (error?.code === "http_401" || error?.code === "http_403") {
    return finding("atencao", "openwa_chave_recusada", "O OpenWA recusou a chave do projeto: a conferência não conseguiu ler a sessão.", "Confira OPENWA_API_KEY no servidor do projeto.", "tecnico");
  }
  return finding("fora", "openwa_fora_do_ar", "O OpenWA não respondeu à conferência: as mensagens do WhatsApp não chegam ao painel.", "Confira o contêiner do OpenWA e a rede entre ele e o projeto.", "tecnico");
}

function panelFailure(error) {
  if (error?.code === "http_404") return finding("fora", "caixa_ausente", "A caixa deste número não existe mais no painel.", "Na tela Conectar WhatsApp, conecte o número de novo.");
  if (error?.code === "http_401" || error?.code === "http_403") {
    return finding("atencao", "painel_chave_recusada", "O painel recusou a conta de serviço do kit: a conferência não conseguiu ler esta caixa.", "Confira se a conta de serviço continua na conta do Chatwoot e rode o provisionamento de novo.", "tecnico");
  }
  return finding("fora", "painel_fora_do_ar", "O painel de atendimento não respondeu à conferência.", "Confira se o Chatwoot está no ar e a rede entre ele e o projeto.", "tecnico");
}

async function officialFindings({ inbox, account }) {
  try {
    return classifyCloudHealth({ health: await account.inboxHealth(inbox.id) });
  } catch (error) {
    if (error?.code !== "http_422") return [panelFailure(error)];
    const reason = error.body?.error;
    return classifyCloudHealth({ error: reason && typeof reason === "object" ? reason : { message: String(reason ?? "") } });
  }
}

async function unofficialFindings({ inbox, account, openwa, fetchImpl }) {
  try {
    await account.inbox(inbox.id);
  } catch (error) {
    return { findings: [panelFailure(error)], phone: null };
  }
  if (!openwa?.url || !openwa?.apiKey) {
    return { findings: [finding("atencao", "openwa_sem_configuracao", "Falta o endereço ou a chave do OpenWA para conferir a sessão.", "Defina OPENWA_URL e OPENWA_API_KEY no servidor do projeto.", "tecnico")], phone: null };
  }
  const client = openwaClient({ url: openwa.url, apiKey: openwa.apiKey, fetchImpl });
  let session;
  try {
    session = await client.session(inbox.session_id);
  } catch (error) {
    return { findings: [openwaFailure(error)], phone: null };
  }
  const findings = classifySession(session);
  try {
    const adapter = (await client.plugins()).find((plugin) => plugin.id === ADAPTER_ID);
    if (!adapterEnabled(adapter)) {
      findings.push(finding("fora", "adaptador_desligado", "A ponte entre o OpenWA e o painel está desligada: as mensagens não passam de um para o outro.", "Ligue o chatwoot-adapter no OpenWA ou conecte o número de novo.", "tecnico"));
    } else {
      // Ligado não basta: em erro de configuração, o número conecta e nenhuma mensagem chega ao painel.
      const problem = classifyAdapterHealth(await client.pluginHealth(ADAPTER_ID));
      if (problem) findings.push(problem);
    }
  } catch {
    // A sessão já foi lida; sem a lista de plugins, o achado da sessão continua valendo.
  }
  return { findings, phone: session?.phone ?? null };
}

/**
 * A saúde do chatwoot-adapter (healthCheck do plugin). Ela é falsa com mensagem descartada depois das
 * tentativas (dead-lettered), perdida antes da fila (LOST) ou com a fila de reenvio cheia. A contagem de
 * descartadas só cresce enquanto o plugin fica ligado: uma mensagem perdida no passado deixaria o alarme
 * para sempre, com as mensagens passando de novo (achado da Atrupe, 2026-11-12). Por isso perdida antes da
 * fila, fila cheia ou erro sem explicação é "fora"; só descartadas é "atencao", com a contagem na chave da
 * memória, para o aviso sair de novo quando ela crescer. Desligar e ligar o adaptador zera a contagem.
 */
export function classifyAdapterHealth(health) {
  if (health?.healthy === true) return null;
  const message = String(health?.message ?? "").slice(0, 200);
  const deadLetters = /(\d+) dead-lettered/i.exec(message);
  if (!deadLetters || /LOST|queue full/i.test(message)) {
    return finding(
      "fora",
      "adaptador_com_erro",
      `A ponte entre o OpenWA e o painel está ligada, mas com erro${message ? `: ${message}` : ""}. As mensagens não chegam ao painel.`,
      "Confira os logs do OpenWA (chatwoot-adapter), a configuração base do plugin e se o Chatwoot responde pelo endereço público.",
      "tecnico",
    );
  }
  const count = Number(deadLetters[1]);
  return {
    ...finding(
      "atencao",
      "adaptador_mensagens_perdidas",
      `${count === 1 ? "Uma mensagem do WhatsApp não chegou" : `${count} mensagens do WhatsApp não chegaram`} ao painel depois de todas as tentativas: ${message}.`,
      "Corrija a causa pelo último erro, depois desligue e ligue o adaptador no OpenWA para zerar a contagem; a fila de reenvio fica guardada.",
      "tecnico",
    ),
    key: `adaptador_mensagens_perdidas:${count}`,
  };
}

/**
 * Confere o número atual (ou as caixas de inboxes). Não lança: serviço fora do ar vira achado.
 * openwa: { url, apiKey }, só para caixa da rota não oficial.
 */
export async function checkWhatsappHealth({ chatwootUrl, state, openwa = null, inboxes = null, fetchImpl = fetch, now = new Date() }) {
  const current = currentInbox(state);
  const targets = inboxes ?? (current ? [current] : []);
  const account = chatwootAccount({ url: chatwootUrl, token: state?.service_token, accountId: state?.account_id, fetchImpl });
  const results = [];
  for (const inbox of targets) {
    const seen =
      inbox.route === "nao_oficial"
        ? await unofficialFindings({ inbox, account, openwa, fetchImpl })
        : { findings: await officialFindings({ inbox, account }), phone: inbox.phone ?? null };
    results.push({ inbox_id: inbox.id, route: inbox.route, phone: seen.phone, level: worstLevel(seen.findings.map((item) => item.level)), findings: seen.findings });
  }
  return { checked_at: now.toISOString(), level: worstLevel(results.map((item) => item.level)), inboxes: results };
}

const TITLES = {
  novo: { fora: "O WhatsApp do atendimento parou", atencao: "O WhatsApp do atendimento pede atenção" },
  lembrete: { fora: "O WhatsApp do atendimento continua parado" },
  voltou: "O WhatsApp do atendimento voltou ao normal",
};

function buildAlert(inbox, kind, since) {
  const title = kind === "voltou" ? TITLES.voltou : kind === "lembrete" ? TITLES.lembrete.fora : TITLES.novo[inbox.level];
  const number = inbox.phone ? ` (${inbox.phone})` : "";
  const text =
    kind === "voltou"
      ? `${title}${number}. A conferência não encontrou mais problema neste número.`
      : `${title}${number}. ${inbox.findings.map((item) => `${item.detail} O que fazer: ${item.fix}`).join(" ")}`;
  return {
    inbox_id: inbox.inbox_id,
    route: inbox.route,
    phone: inbox.phone,
    level: inbox.level,
    kind,
    since,
    fixBy: inbox.findings.some((item) => item.fixBy === "tecnico") ? "tecnico" : "quem_conecta",
    title,
    text,
    findings: inbox.findings,
  };
}

/** Estados que costumam passar sozinhos: só viram aviso se continuarem na conferência seguinte. */
const PASSING = new Set(["reconectando", "iniciando", "meta_sem_resposta"]);

/**
 * Compara a conferência com a memória da anterior e diz o que avisar: quando o nível ou o problema muda,
 * quando o número volta ao normal depois de um aviso e, enquanto estiver fora, uma vez a cada remindHours.
 * previous e health são o campo health do estado do cliente. Uma caixa que saiu da conferência sai da memória.
 */
export function healthAlerts({ previous = {}, report, now = new Date(), remindHours = 24 }) {
  const at = now.toISOString();
  const health = {};
  const alerts = [];
  for (const inbox of report.inboxes) {
    const key = String(inbox.inbox_id);
    const before = previous?.[key] ?? null;
    // A chave de um achado, quando existe, entra no lugar do código: a contagem que cresce vira mudança.
    const codes = inbox.findings.map((item) => item.key ?? item.code).sort();
    const unchanged = Boolean(before) && before.level === inbox.level && JSON.stringify(before.codes ?? []) === JSON.stringify(codes);
    const passing = codes.length > 0 && codes.every((code) => PASSING.has(code));
    let kind = null;
    if (inbox.level === "ok") {
      if (before?.open) kind = "voltou";
    } else if (!unchanged) {
      if (!passing) kind = "novo";
    } else if (passing) {
      if (!before.notified_at) kind = "novo";
    } else if (inbox.level === "fora" && now.getTime() - Date.parse(before.notified_at ?? before.since) >= remindHours * 60 * 60 * 1000) {
      kind = "lembrete";
    }
    const since = unchanged ? before.since : at;
    health[key] = {
      level: inbox.level,
      codes,
      since,
      notified_at: kind ? at : unchanged ? (before.notified_at ?? null) : null,
      open: kind === "voltou" ? false : kind ? true : Boolean(before?.open),
    };
    if (kind) alerts.push(buildAlert(inbox, kind, since));
  }
  return { alerts, health };
}
