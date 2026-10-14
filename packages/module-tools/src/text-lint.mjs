/**
 * The writing check for text that reaches the member or their AI: every
 * shipped `.md` of an app, the strings of its manifest and of its scripts,
 * and the core assets the CLI writes into member projects. Plain JavaScript on
 * purpose, so the PostToolUse hook (plain Node) and `validate` (TypeScript)
 * run the very same rules.
 *
 * Hard rules are the platform's copy rules (flyee-club, decided 2026-10-07,
 * `apps/web/src/lib/i18n/copy-rules.test.ts`), the same on the site, in the
 * member area, in the e-mails and in the CLI's messages: no dash (— or –), no
 * exclamation mark, no emoji (© and → stay) and none of the banned words. A
 * dash or an emoji is refused anywhere in the text, code included, as the
 * platform refuses it in any string; the exclamation mark and the words only
 * in prose, because `!==` and `--no-unlock-flag` are code, not writing.
 *
 * Advisories are the pt-BR style checks that can have a legitimate exception
 * (evaluative vocabulary, formulas, opening connectors, curly quotes): a check
 * that cries wolf is a check the author learns to ignore. The corpus test in
 * packages/module-tools/test/text-lint.test.ts runs both over every member
 * text and every current package.
 */

/** Where a dash would go: a colon, a comma or a new sentence; "·" between items; "a" in a range (3 a 4). */
export const DASH = /[–—]/u;
/** Any pictograph but the two the platform keeps on purpose. */
export const EMOJI = /(?![©→])\p{Extended_Pictographic}/u;
/** The platform's banned words, as prefixes in both languages ("robust" also stops "robusto"). */
export const BANNED_WORDS =
  /(?<![\p{L}\p{N}])(?:desbloque|potencializ|sem esforço|soluç(?:ão|ões) inovadora|unlock|elevat|empower|seamless|robust|supercharg|game-changing|it['’]s not just)/iu;

/**
 * Two more rules for what the store shows (flyee-club `lib/i18n/copy-rules.ts`,
 * applied by its catalog import to an app's title, summary and README): no
 * free plan is ever offered ("sem custo extra" stays), and the public page
 * never names FlyeeClub Pro.
 */
export const FREE = /(?<![\p{L}\p{N}])(?:gr[aá]tis|gratuit|free(?![\p{L}\p{N}])|sem custo(?! extra)|no cost|at no charge)/iu;
const PRO_NAME = /\bPro\b/;
const PRO_COMPLETE = /flyee\s?club\s+complet/i;

/**
 * The store's extra rules over a text it shows. `pro: false` for a text only
 * members read (a guide), where FlyeeClub Pro may be named.
 *
 * @param {string} text
 * @param {{ pro?: boolean }} [options]
 * @returns {string[]}
 */
export function storeBreaks(text, options = {}) {
  const found = [];
  const free = FREE.exec(String(text));
  if (free) found.push(`[gratis] "${free[0]}": a plataforma nunca oferece plano grátis, e a loja deixa de fora o texto que fala nisso.`);
  if (options.pro !== false && (PRO_NAME.test(text) || PRO_COMPLETE.test(text))) {
    found.push("[pro] o nome do FlyeeClub Pro: a página pública da loja nunca o mostra.");
  }
  return found;
}

// Word edges below are lookarounds on letters, not `\b`: without the `u` flag `\b` sees "é" and "ç" as
// non-word characters, and "não é só X, é Y", the most common formula, never matched.

/** Evaluative words that LLMs overuse in Portuguese; each wants a fact beside it or a number instead. */
const AI_VOCABULARY =
  /(?<![\p{L}\p{N}])(crucial|inovador(?:a|es)?|poderos[oa]s?|transformador(?:a|es)?|disruptiv[oa]s?|vibrante|aprimorar|alavancar|impulsionar|jornada|incr[íi]vel|revolucion[áa]ri[oa])(?![\p{L}\p{N}])/iu;

/** Decorative connectors opening a paragraph. */
const OPENING_CONNECTOR =
  /^(?:al[ée]m disso|no entanto|por outro lado|dessa forma|desse modo|nesse sentido|diante disso|adicionalmente|por conseguinte|vale ressaltar|vale destacar|[ée] importante (?:ressaltar|notar|destacar))(?![\p{L}\p{N}])/iu;

/** Formulas that give generated text away ("não é só X, é Y"). */
const FORMULAS = [
  [/(?<!\p{L})n[ãa]o (?:[ée]|se trata de) (?:s[óo]|apenas|somente) [^.;:\n]{1,60}, (?:[ée]|mas)(?!\p{L})/iu, '"não é só X, é Y"'],
  [/(?<!\p{L})n[ãa]o [ée] sobre [^.;:\n]{1,60}, [ée] sobre(?!\p{L})/iu, '"não é sobre X, é sobre Y"'],
  [/(?<!\p{L})faz toda a diferen[çc]a(?!\p{L})/iu, '"faz toda a diferença"'],
  [/(?<!\p{L})muda tudo(?!\p{L})/iu, '"muda tudo"'],
];

/**
 * Prose only: no fenced blocks, no inline code, no URLs, no HTML comments, no
 * frontmatter, no image syntax. Lines are kept (blank where code was), so a
 * line number in the prose is a line number in the file.
 */
export function proseOf(text) {
  const body = String(text).replace(/\r\n/g, "\n");
  const lines = body.split("\n");
  const out = [];
  let fenced = false;
  let front = lines[0] === "---";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (front) {
      out.push("");
      if (index > 0 && line === "---") front = false;
      continue;
    }
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      out.push("");
      continue;
    }
    out.push(fenced ? "" : line);
  }
  return out
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!\[/g, "[")
    .replace(/\]\([^)\n]*\)/g, "]")
    .replace(/https?:\/\/\S+/g, " ");
}

/** The 1-based line of the first match, or 0. */
function lineOf(text, pattern) {
  const lines = String(text).split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index + 1;
}

function countOf(text, pattern) {
  return (String(text).match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)) ?? []).length;
}

/**
 * The platform's copy rules over one piece of text. `raw` is checked for
 * dashes and emoji, `prose` (the same text without code) for the exclamation
 * mark and the banned words. For a plain string (a manifest field, a message)
 * both are the string itself.
 *
 * @param {string} raw
 * @param {string} [prose]
 * @returns {string[]} one message per rule broken, with the first line it breaks on
 */
export function copyBreaks(raw, prose = raw) {
  const found = [];
  const at = (text, pattern) => {
    const line = lineOf(text, pattern);
    return line > 0 && /\n/.test(String(text)) ? ` (linha ${line})` : "";
  };
  if (DASH.test(raw)) {
    const count = countOf(raw, DASH);
    found.push(
      `[travessao] ${count} travessão(ões) (— ou –)${at(raw, DASH)}: a regra de texto do flyee.club não aceita nenhum. Use dois-pontos, vírgula ou ponto; "·" entre itens; "a" num intervalo (3 a 4).`,
    );
  }
  if (EMOJI.test(raw)) found.push(`[emoji] emoji${at(raw, EMOJI)}: a regra de texto do flyee.club não aceita nenhum (© e → podem).`);
  if (/!/.test(prose)) found.push(`[exclamacao] ponto de exclamação${at(prose, /!/)}: a regra de texto do flyee.club não aceita nenhum.`);
  const word = BANNED_WORDS.exec(prose);
  if (word) found.push(`[palavra] "${word[0]}"${at(prose, BANNED_WORDS)}: palavra proibida pela regra de texto do flyee.club. Diga o que acontece, com um fato.`);
  return found;
}

/**
 * Texts that teach the patterns cite them by design (word lists, "before"
 * examples written badly on purpose), so the style advisories skip them. The
 * platform's rules still apply: the teaching describes a dash or an
 * exclamation mark by name instead of printing one.
 */
export function teachesPatterns(relativePath) {
  return /^packages\/core\/assets\/skills\/texto-natural\//.test(String(relativePath).replace(/\\/g, "/"));
}

/**
 * @param {string} text
 * @param {{ teachesPatterns?: boolean }} [options]
 * @returns {{ violations: string[], advisories: string[], words: number }}
 */
export function lintMemberText(text, options = {}) {
  const prose = proseOf(text);
  const violations = copyBreaks(String(text), prose);
  const advisories = [];
  const words = prose.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length || 1;
  if (options.teachesPatterns) return { violations, advisories, words };

  for (const paragraph of prose.split(/\n\s*\n/)) {
    const first = paragraph.trim().replace(/^[-*>#\d.\s|]+/, "");
    if (OPENING_CONNECTOR.test(first)) {
      advisories.push(`[conector] parágrafo abre com conector decorativo: "${first.slice(0, 40)}…". Apague e veja se o sentido fica.`);
    }
  }
  // Quoted text is a citation, not writing: a guide that lists "não é só X, é Y" as a formula to avoid
  // must not be flagged for using it (the youtube-script references do exactly that).
  const own = prose.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/g, " ");
  const vocabulary = own.match(AI_VOCABULARY);
  if (vocabulary) advisories.push(`[vocabulario-ia] "${vocabulary[0]}": adjetivo de avaliação pede um fato do lado, ou vira número.`);
  for (const [pattern, label] of FORMULAS) {
    if (pattern.test(own)) advisories.push(`[formula-ia] ${label}: fórmula que entrega texto gerado. Diga a coisa direto.`);
  }
  if (/[“”]/.test(prose)) advisories.push("[aspas] aspas curvas; no texto digital em português o padrão é a aspa reta.");

  return { violations, advisories, words };
}

/** Whether a repository-relative POSIX path is text that reaches the member. */
export function isMemberText(relativePath) {
  const path = String(relativePath).replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path.endsWith(".md")) return false;
  if (/^packages\/core\/assets\//.test(path)) return true;
  const app = /^modules\/([^/]+)\/(.+)$/.exec(path);
  if (!app || app[1].startsWith("_") || app[1].startsWith(".")) return false;
  const inner = app[2];
  if (inner.endsWith(".dev.md")) return false;
  return !inner.split("/").slice(0, -1).some((segment) => segment === "tests" || segment === ".dev");
}
