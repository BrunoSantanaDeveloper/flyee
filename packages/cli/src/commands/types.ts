export type Ok = { ok: true; [key: string]: unknown };
export type Fail = { ok: false; error: string; message: string; action_url?: string; [key: string]: unknown };
export type Result = Ok | Fail;

export type ParsedArgs = {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
};

export function flag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === "string" ? value : undefined;
}

export function has(args: ParsedArgs, name: string): boolean {
  return args.flags[name] === true || typeof args.flags[name] === "string";
}
