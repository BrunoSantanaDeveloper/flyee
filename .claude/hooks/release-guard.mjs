#!/usr/bin/env node
// PreToolUse guard for commands that cannot be taken back.
//
// The CLI reaches npm only through the release workflow (a `cli-v<version>`
// tag, docs/RELEASE.md). A `npm publish` run by an agent burns the version
// number for good, and several sessions share this working tree, so text in a
// skill ("never publish by hand") is a request, not a barrier. These rules turn
// it into a deterministic check on the command, before it runs: regex only, no
// model, no network.
//
// Lessons kept from the guard this one is modelled on (brunosantanadev):
// - Quoted text is removed first: it is an argument, not a command. Without
//   that, `git commit -m "explica o npm publish"` would be denied.
// - A bug in the guard must never block work: any failure exits 0 and allows.
// Denies and explains; nothing else.

const RULES = [
  {
    pattern: /\b(?:npm|pnpm|bun)\s+(?:publish|pub)\b|\byarn\s+(?:npm\s+)?publish\b/,
    reason:
      "a CLI vai ao npm só pela CI, com a tag `cli-v<versão>` (docs/RELEASE.md). Publicar daqui gasta o número da versão para sempre. Para conferir o pacote, use `npm run check:tarball` ou `npm pack --dry-run`.",
  },
  {
    pattern: /\bnpm\s+(?:unpublish|deprecate|owner|access)\b|\bnpm\s+dist-tag\s+(?:add|rm)\b/,
    reason: "mudar o pacote publicado no npm é decisão do operador, feita por ele: não rode isso por conta própria.",
  },
  {
    pattern: /\bgit\s+push\b[^|;&]*(--force(?!-with-lease)\b|(?<![\w-])-f(?![\w-]))/,
    reason: "push forçado reescreve o histórico remoto e apaga trabalho de outra sessão sem aviso. Se for mesmo preciso, peça ao operador.",
  },
  {
    pattern: /\bgit\s+push\b[^|;&]*(--tags\b|--mirror\b|--delete\b|\s:\S)/,
    reason:
      "push de todas as tags, espelho ou exclusão no remoto dispara ou apaga releases em lote. Empurre só a tag da versão aprovada (`git push origin cli-v<versão>` ou `<app>@<versão>`).",
  },
  {
    pattern: /--no-verify\b|\bgit\s+commit\b[^|;&]*(?<![\w-])-n(?![\w-])|\bHUSKY=0\b|\bSKIP_HOOKS\b/,
    reason: "a verificação não se desliga para o commit passar. Se ela reprovou, corrija o que ela apontou.",
  },
];

/** Removes quoted strings: what is inside quotes is an argument (a message, a body), never the command. */
const withoutQuoted = (value) => value.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");

/**
 * Removes heredoc bodies (`git commit -F - <<'EOF'` … `EOF`) and PowerShell
 * here-strings (`@'` … `'@`): text, like a quoted argument. The first version
 * missed them and denied its own commit, whose message mentioned the rule.
 */
function withoutHeredocs(value) {
  const kept = [];
  let end = null;
  for (const line of value.replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, "''").split(/\r?\n/)) {
    if (end !== null) {
      if (line.replace(/^\t+/, "") === end) end = null;
      continue;
    }
    kept.push(line);
    const open = /(?<!<)<<-?\s*(['"]?)([A-Za-z_]\w*)\1/.exec(line);
    if (open) end = open[2];
  }
  return kept.join("\n");
}

/** A command that hands text to an interpreter makes that text a command again (`bash -c "…"`, `cmd /c "…"`, `node - <<EOF`). */
const INTERPRETER =
  /\b(?:(?:ba|z|da|k)?sh|pwsh|powershell|cmd)(?:\.exe)?\b|\b(?:eval|iex|Invoke-Expression)\b|-ArgumentList\b|\bnode(?:\.exe)?\s+(?:-e|-p|--eval|--print|-)(?:\s|$)/i;

export function reasonToDeny(command) {
  if (typeof command !== "string" || !command.trim()) return null;
  const bare = withoutQuoted(withoutHeredocs(command));
  const checked = INTERPRETER.test(bare) ? command : bare;
  return RULES.find(({ pattern }) => pattern.test(checked))?.reason ?? null;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let reason = null;
  let codex = false;
  try {
    // A byte-order mark (PowerShell pipes add one) would make the input unreadable and the guard allow everything.
    const input = JSON.parse(raw.replace(/^﻿/, "") || "{}");
    codex = Object.prototype.hasOwnProperty.call(input, "model");
    const toolInput = input?.tool_input ?? input?.toolInput ?? {};
    const command = Array.isArray(toolInput.command) ? toolInput.command.join(" ") : toolInput.command;
    reason = reasonToDeny(command);
  } catch {
    process.exit(0);
  }
  if (!reason) process.exit(0);
  const message = `PORTÃO DE COMANDOS IRREVERSÍVEIS: ${reason}`;
  if (codex) {
    process.stderr.write(`${message}\n`);
    process.exit(2);
  }
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: message } }),
  );
  process.exit(0);
});
