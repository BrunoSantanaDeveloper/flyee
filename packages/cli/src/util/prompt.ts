import { createInterface } from "node:readline";

/** A yes/no question on the terminal. `No` is the default and the answer when stdin is not a TTY. */
export async function confirmOnTerminal(question: string, suffix: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => rl.question(`${question}${suffix}`, resolve));
    return /^(y|yes|s|sim)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
