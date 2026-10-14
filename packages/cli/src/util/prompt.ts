import { createInterface } from "node:readline";

/**
 * A yes/no question on the terminal; `No` is the default. Null when stdin is
 * not a TTY: nobody can answer there, and the caller explains the flag.
 */
export async function confirmOnTerminal(question: string, suffix: string): Promise<boolean | null> {
  if (!process.stdin.isTTY) return null;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => rl.question(`${question}${suffix}`, resolve));
    return /^(y|yes|s|sim)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

/** Escape sequences a terminal may send while pasting or with arrow keys; never part of a key. */
const ESCAPES = /\x1b\[[0-9;?]*[A-Za-z~]/g;

/**
 * Reads a secret with the echo off: nothing typed or pasted appears on the
 * screen. The question goes to stderr, so stdout keeps only the --json result.
 * Returns null when stdin is not a terminal (an AI or a pipe), and when the
 * member presses Ctrl+C.
 */
export async function readSecretOnTerminal(question: string): Promise<string | null> {
  const stdin = process.stdin;
  if (!stdin.isTTY) return null;
  process.stderr.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve) => {
    let value = "";
    const finish = (result: string | null) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stderr.write("\n");
      resolve(result);
    };
    const onData = (chunk: string) => {
      for (const char of chunk.replace(ESCAPES, "")) {
        if (char === "\r" || char === "\n" || char === "\u0004") return finish(value);
        if (char === "\u0003") return finish(null);
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    stdin.on("data", onData);
  });
}

/** Everything piped into stdin, for `--stdin`. Never called on a terminal, where it would wait forever. */
export async function readAllStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString("utf8");
}
