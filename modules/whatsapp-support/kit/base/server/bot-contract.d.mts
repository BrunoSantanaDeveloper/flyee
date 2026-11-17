export interface BotRequest {
  method: string;
  /** O caminho completo pedido, com a query, como chegou: é o que o robô assinou. */
  pathWithQuery: string;
  /** O trecho depois da base das rotas do robô: "config", "contact", "tools/<nome>", "history" ou "generate". */
  route: string;
  query: Record<string, string | undefined>;
  rawBody: string;
  headers: Headers | Record<string, string | string[] | undefined>;
}

export interface ToolContact {
  id: number | null;
  name: string | null;
  phone_number: string | null;
  identifier: string | null;
  email: string | null;
}

export interface ToolCall {
  accountId: number;
  conversationId: number;
  inboxId: number | null;
  contact: ToolContact;
  input: Record<string, unknown>;
}

export interface ProjectTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** Só devolve dados da pessoa da conversa; o projeto decide como confirmar quem ela é. */
  run(call: ToolCall): Promise<unknown>;
}

export interface GapEventPayload {
  kind: "handoff";
  account_id: number;
  conversation_id: number;
  category: string;
  topic: string;
  reason: string;
  excerpt: string;
  at: string;
}

export interface SuggestionsPayload {
  account_id: number;
  conversation_id: number;
  suggestions: Array<{ q: string; a: string; why: string }>;
  at: string;
}

/** O que o robô manda à rota contact, no começo da conversa e a cada leva de mensagens do cliente (cache curto). */
export interface ContactPayload {
  account_id: number;
  conversation_id: number;
  inbox_id: number | null;
  /** phone: o número do contato; na rota não oficial pode vir null, e o telefone fica em identifier (5511...@c.us). */
  contact: { id: number | null; name: string | null; phone: string | null; identifier: string | null };
  /** O perfil que o robô conhecia nesta conversa, ou null. */
  previous_profile: string | null;
}

/** Um dado da pessoa: texto, número, sim ou não, vazio ou uma lista de textos. */
export type ContactFact = string | number | boolean | null | string[];

/**
 * O perfil de quem escreve. profile null (ou a rota ausente) é conversa sem perfil, como antes. facts entra no
 * prompt como dado da pessoa, nunca instrução; empresa, etapa e origem também vão para o resumo da passagem.
 */
export interface ContactProfile {
  /** Uma das chaves declaradas (DeclaredProfile.key), ou null. */
  profile: string | null;
  label?: string;
  facts?: Record<string, ContactFact>;
}

/** Uma parte de áudio para o projeto transcrever: MP3 mono de até 5 minutos, em base64. */
export interface TranscribePayload {
  account_id: number;
  conversation_id: number;
  /** Um áudio que a pessoa mandou, ou a fala de um vídeo. */
  kind: "audio" | "video";
  mime: string;
  /** A duração desta parte em segundos; null quando o ffmpeg não soube a duração. */
  seconds: number | null;
  data: string;
  /** Qual parte é esta (a partir de 1) e quantas o áudio tem. */
  part: number;
  parts: number;
}

/** audio: o robô consegue ouvir áudio e a fala do vídeo; null quando não se sabe. */
export interface MediaSupport {
  audio: boolean | null;
}

export function handleBotRequest(
  request: BotRequest,
  handlers: {
    secret: string;
    now?: () => number;
    getConfig(accountId: number): Promise<Record<string, unknown> | null>;
    runTool(name: string, payload: unknown): Promise<unknown>;
    getHistory(accountId: number, conversationId: number, limit: number): Promise<Array<{ role: string; text: string; at: string }>>;
    /**
     * O perfil de quem escreve e o que o sistema sabe da pessoa. Sem este tratador, a rota contact responde 404 e
     * o robô segue sem perfil. Devolva null quando não souber quem é.
     */
    getContact?(accountId: number, payload: ContactPayload): Promise<ContactProfile | null>;
    generate?(payload: { purpose: "acao" | "sugestoes"; [key: string]: unknown }): Promise<Record<string, unknown>>;
    /**
     * O texto falado na parte, com a IA do próprio projeto; só com ai.transcription "project". Para recusar
     * (sem a chave da empresa, teto de gasto, grande demais), devolva { ok: false, code }: o áudio vai para a equipe.
     */
    transcribe?(payload: TranscribePayload): Promise<string | { ok: false; code: string }>;
    /** Uma passagem para a equipe, para o relatório das lacunas. */
    saveEvent?(accountId: number, event: GapEventPayload): Promise<void>;
    /** Sugestões de conhecimento de uma conversa resolvida, para a camada dona do conhecimento aprovar. */
    saveSuggestions?(accountId: number, payload: SuggestionsPayload): Promise<void>;
  },
): Promise<{ status: number; body: unknown }>;

export function createToolRunner(
  tools: ProjectTool[],
  options?: { isEnabled?(accountId: number, name: string): Promise<boolean> },
): (name: string, payload: unknown) => Promise<unknown>;

export function mediaSupportFrom(input?: { ai?: Record<string, unknown>; health?: unknown }): MediaSupport;

export function botHealthUrl(botUrl: string): string;

export function mediaSupport(input: {
  ai?: Record<string, unknown>;
  /** SUPPORT_BOT_PUBLIC_URL, por exemplo https://atendimento.seudominio.com.br/robo/chatwoot. */
  botUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<MediaSupport>;
