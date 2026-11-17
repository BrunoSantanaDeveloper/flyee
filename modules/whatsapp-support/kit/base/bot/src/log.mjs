// Registro em linhas JSON, só com campos permitidos: nunca conteúdo de mensagem, telefone ou nome.
// Um campo fora da lista é descartado em silêncio, para que um descuido no código não vaze dado pessoal.

const ALLOWED = new Set([
  "event",
  "account",
  "conversation",
  "inbox",
  "action",
  "mode",
  "provider",
  "model",
  "ms",
  "code",
  "status",
  "attempt",
  "items",
  "lookups",
  "tool",
  "version",
  "port",
  "group",
  "phone",
  // A chave do perfil de quem escreve (D30), no formato de PROFILE_KEY: um código, nunca o nome ou o dado da pessoa.
  "profile",
  "previous",
]);

export function createLogger({ write = (line) => process.stdout.write(`${line}\n`), clock = () => new Date() } = {}) {
  const emit = (level, fields) => {
    const record = { t: clock().toISOString(), level };
    for (const [key, value] of Object.entries(fields ?? {})) {
      if (!ALLOWED.has(key) || value === undefined) continue;
      record[key] = typeof value === "string" ? value.slice(0, 120) : value;
    }
    write(JSON.stringify(record));
  };
  return {
    info: (fields) => emit("info", fields),
    warn: (fields) => emit("warn", fields),
    error: (fields) => emit("error", fields),
  };
}

export const silentLogger = { info() {}, warn() {}, error() {} };
