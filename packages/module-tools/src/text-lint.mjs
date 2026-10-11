/**
 * The pt-BR writing check for text that reaches the member: every shipped
 * `.md` of an app and the core assets the CLI writes into member projects.
 * Plain JavaScript on purpose, so the PostToolUse hook (plain Node) and
 * `validate` (TypeScript) run the very same rules.
 *
 * Hard (blocks) against advisory (warns): hard only for what is objectively
 * wrong in Portuguese; advisory for what can have a legitimate exception
 * (dash density, connectors, evaluative vocabulary), because a check that
 * cries wolf is a check the author learns to ignore. A rule enters only after
 * running against the existing texts without flagging what is right; the
 * corpus test in packages/module-tools/test/text-lint.test.ts keeps it so.
 *
 * Only prose is checked: fenced code blocks, inline code, tables' pipes and
 * link targets are removed first, because commands and identifiers are not
 * writing.
 */

/** Evaluative words that LLMs overuse in Portuguese; each wants a fact beside it or a number instead. */
// Word edges below are lookarounds on letters, not `\b`: without the `u` flag `\b` sees "é" and "ç" as
// non-word characters, and "não é só X, é Y", the most common formula, never matched.

const AI_VOCABULARY =
  /(?<![\p{L}\p{N}])(crucial|robust[oa]s?|inovador(?:a|es)?|poderos[oa]s?|transformador(?:a|es)?|disruptiv[oa]s?|vibrante|aprimorar|alavancar|potencializar|impulsionar|desbloquear|sem esfor[çc]o|jornada|incr[íi]vel|revolucion[áa]ri[oa])(?![\p{L}\p{N}])/iu;

/** Dashes per thousand words in human pt-BR prose; above it, the dashes are likely decoration. */
const HUMAN_DASHES_PER_THOUSAND = 3;

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

/** Prose only: no fenced blocks, no inline code, no URLs, no HTML comments, no frontmatter. */
export function proseOf(text) {
  let body = String(text).replace(/\r\n/g, "\n");
  body = body.replace(/^---\n[\s\S]*?\n---\n/, "");
  body = body.replace(/<!--[\s\S]*?-->/g, " ");
  const lines = [];
  let fenced = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) lines.push(line);
  }
  return lines
    .join("\n")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/https?:\/\/\S+/g, " ");
}

/**
 * Texts that teach the patterns cite them by design (word lists, "before"
 * examples written badly on purpose), so only the hard rule applies to them.
 */
export function teachesPatterns(relativePath) {
  return /^packages\/core\/assets\/skills\/texto-natural\//.test(String(relativePath).replace(/\\/g, "/"));
}

/**
 * @param {string} text
 * @param {{ teachesPatterns?: boolean }} [options]
 * @returns {{ violations: string[], advisories: string[], dashes: number, words: number }}
 */
export function lintMemberText(text, options = {}) {
  const violations = [];
  const advisories = [];
  const prose = proseOf(text);
  const words = prose.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length || 1;

  // Only the em dash between letters. An en dash between numbers ("3–4 q", "[0–1]") is a range, and correct:
  // the first version of this rule flagged five range tables in the video apps, all false positives.
  if (/\p{L}—\p{L}/u.test(prose)) {
    violations.push("[travessao-colado] travessão colado entre palavras: sempre erro em português. Use vírgula, dois-pontos ou ponto.");
  }
  // Dashes in sentences only: a table cell holding "—" means "no default" and "## Nome — subtítulo" is a label,
  // both structure. The warning starts above the human baseline, because the travessão is correct Portuguese;
  // at "any dash" it flagged 7 app references whose 21 dashes were all cells, headings or a cited symbol.
  const sentences = prose
    .split("\n")
    .filter((line) => !/^\s*(?:\||#)/.test(line))
    .join("\n");
  const dashes = (sentences.match(/\s[—–]\s|\s[—–]$|^[—–]\s/gmu) ?? []).length;
  if (options.teachesPatterns) return { violations, advisories, dashes, words };
  const density = (dashes / words) * 1000;
  if (density > HUMAN_DASHES_PER_THOUSAND) {
    advisories.push(
      `[travessao] ${dashes} travessão(ões) em ${words} palavras (${density.toFixed(1)} por mil; texto humano fica perto de ${HUMAN_DASHES_PER_THOUSAND}). Se vírgula, dois-pontos ou ponto cabem sem perda, era decoração.`,
    );
  }
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

  return { violations, advisories, dashes, words };
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
