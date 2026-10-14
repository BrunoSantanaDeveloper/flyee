import { homedir } from "node:os";
import { join } from "node:path";

export type Locale = "pt-BR" | "en";

export type Io = {
  out: (line: string) => void;
  err: (line: string) => void;
  /**
   * Asks a yes/no question; `--yes` answers true without asking. `null` means
   * there was no terminal to ask on (an AI or a pipe ran the command): the
   * caller says how to confirm with the flag instead of reading it as a "no".
   */
  confirm: (question: string) => Promise<boolean | null>;
  /**
   * A line that must reach the reader before the command finishes (the device
   * code of a login that waits up to 10 minutes): written at once and flushed,
   * as plain text, or as one JSON line under --json, ahead of the final result.
   */
  progress: (text: string, event: Record<string, unknown>) => Promise<void>;
  /** Opens a URL in the member's browser; returns false when it could not. */
  openBrowser: (url: string) => Promise<boolean>;
  /** Reads a secret typed with the echo off; null when there is no terminal to type on. */
  secret: (question: string) => Promise<string | null>;
  /** Everything piped into stdin (`--stdin`). */
  stdin: () => Promise<string>;
};

/** How the CLI looks for and installs programs; tests replace both. */
export type SystemAccess = {
  find?: (binary: string) => string | null;
  run?: (file: string, args: string[], env?: Record<string, string>) => { status: number | null; stdout: string; stderr: string };
};

export type Context = {
  /** Program lookup and package-manager calls (`npx flyee need`); defaults to the real system. */
  system?: SystemAccess;
  /** The CLI script this process runs, when started from the command line; detached helpers reuse it. */
  cliEntry?: string;
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
    progress: options.io?.progress ?? (async (text) => (options.io?.out ?? ((line: string) => process.stdout.write(`${line}
`)))(text)),
    openBrowser: options.io?.openBrowser ?? (async () => false),
    secret: options.io?.secret ?? (async () => null),
    stdin: options.io?.stdin ?? (async () => ""),
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
    system: options.system,
    cliEntry: options.cliEntry,
  };
}
