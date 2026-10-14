import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

import { DASH, EMOJI } from "./text-lint.mjs";

/**
 * The text an app's scripts can print: string literals and the parts of
 * template literals, never comments or regular expressions. The member's AI
 * reads every message, report and help text a script writes, so the
 * platform's copy rules reach them as they reach the platform's own code: a
 * dash or an emoji in any string (copy-rules.test.ts, "the rest of the
 * shipped code"). The exclamation mark stays with the author, because `!=`
 * and `!important` live in strings too.
 */
const SCRIPT = /\.(?:mjs|cjs|js)$/;

export type ScriptText = { line: number; text: string };

export function scriptStrings(source: string, fileName = "script.mjs"): ScriptText[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const found: ScriptText[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, text: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** `scripts/x.mjs:12: …` for every string that breaks a rule, in the shipped scripts of an app. */
export function scriptTextErrors(dir: string, files: string[]): string[] {
  const errors: string[] = [];
  for (const file of files.filter((candidate) => SCRIPT.test(candidate))) {
    for (const { line, text } of scriptStrings(readFileSync(join(dir, ...file.split("/")), "utf8"), file)) {
      const rules = [DASH.test(text) ? "travessão (— ou –)" : "", EMOJI.test(text) ? "emoji" : ""].filter(Boolean);
      if (rules.length) {
        errors.push(`${file}:${line}: ${rules.join(" e ")} num texto que o script imprime: "${text.trim().slice(0, 60)}"; a regra de texto do flyee.club não aceita`);
      }
    }
  }
  return errors;
}
