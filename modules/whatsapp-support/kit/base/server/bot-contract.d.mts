export interface BotRequest {
  method: string;
  /** O caminho completo pedido, com a query, como chegou: é o que o robô assinou. */
  pathWithQuery: string;
  /** O trecho depois da base das rotas do robô: "config", "tools/<nome>", "history" ou "generate". */
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

export function handleBotRequest(
  request: BotRequest,
  handlers: {
    secret: string;
    now?: () => number;
    getConfig(accountId: number): Promise<Record<string, unknown> | null>;
    runTool(name: string, payload: unknown): Promise<unknown>;
    getHistory(accountId: number, conversationId: number, limit: number): Promise<Array<{ role: string; text: string; at: string }>>;
    generate?(payload: unknown): Promise<Record<string, unknown>>;
  },
): Promise<{ status: number; body: unknown }>;

export function createToolRunner(
  tools: ProjectTool[],
  options?: { isEnabled?(accountId: number, name: string): Promise<boolean> },
): (name: string, payload: unknown) => Promise<unknown>;
