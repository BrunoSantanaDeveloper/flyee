import { homedir } from "node:os";
import { join } from "node:path";

export type Locale = "pt-BR" | "en";

export type Io = {
  out: (line: string) => void;
  err: (line: string) => void;
  /** Asks a yes/no question; `--yes` answers true without asking. */
  confirm: (question: string) => Promise<boolean>;
  /** Opens a URL in the member's browser; returns false when it could not. */
  openBrowser: (url: string) => Promise<boolean>;
};

export type Context = {
  /** The platform, without trailing slash. Overridable by FLYEE_BASE_URL for previews and tests. */
  baseUrl: string;
  /** `~/.flyee`: device identity, credentials, the event queue, known projects. */
  flyeeHome: string;
  /** The member's project. */
  cwd: string;
  env: Record<string, string | undefined>;
  io: Io;
  json: boolean;
  yes: boolean;
  dryRun: boolean;
  quiet: boolean;
  locale: Locale;
  now: () => number;
  fetch: typeof fetch;
  /** FLYEE_DEV=1: the operator's mode, enables `dev link` and nothing else. */
  dev: boolean;
};

export type ContextOptions = Partial<Omit<Context, "io" | "env">> & {
  io?: Partial<Io>;
  env?: Record<string, string | undefined>;
  homeDir?: string;
};

export const DEFAULT_BASE_URL = "https://flyee.club";

export function detectLocale(env: Record<string, string | undefined>): Locale {
  const raw = (env.FLYEE_LOCALE ?? env.LC_ALL ?? env.LC_MESSAGES ?? env.LANG ?? "").toLowerCase();
  if (raw.startsWith("en")) return "en";
  return "pt-BR";
}

export function createContext(options: ContextOptions = {}): Context {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? homedir();
  const baseUrl = (options.baseUrl ?? env.FLYEE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const io: Io = {
    out: options.io?.out ?? ((line) => process.stdout.write(`${line}\n`)),
    err: options.io?.err ?? ((line) => process.stderr.write(`${line}\n`)),
    confirm: options.io?.confirm ?? (async () => false),
    openBrowser: options.io?.openBrowser ?? (async () => false),
  };
  return {
    baseUrl,
    flyeeHome: options.flyeeHome ?? join(homeDir, ".flyee"),
    cwd: options.cwd ?? process.cwd(),
    env,
    io,
    json: options.json ?? false,
    yes: options.yes ?? false,
    dryRun: options.dryRun ?? false,
    quiet: options.quiet ?? false,
    locale: options.locale ?? detectLocale(env),
    now: options.now ?? (() => Date.now()),
    fetch: options.fetch ?? fetch,
    dev: options.dev ?? env.FLYEE_DEV === "1",
  };
}
