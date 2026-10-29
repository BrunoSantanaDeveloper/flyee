import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { packagingChoice, packagingThumbnails, packagingTitles, thumbnailIssues, titleCoverage, titlePromises } from "../scripts/lib/rules.mjs";
import { parseScript } from "../scripts/lib/script.mjs";
import { buildChecklist, descriptionIssues } from "../scripts/roteiro.mjs";

const EMBALAGEM = `# Embalagem: marmita

## Títulos
1. "Fiz 30 dias de marmita com a Airfryer Mondial" · gatilho: experimento · 46 caracteres
2. "O erro que estraga a sua marmita" · gatilho: custo ou erro

## Thumbnails
A. Imagem: as 30 marmitas na mesa · Texto: "30 dias de marmita" · O que acrescenta ao título: a pilha · O que testa: a prova
B. Imagem: a marmita antes e depois · Texto: "antes e depois da quinta feira de novo" · O que testa: a comparação
C. Imagem: a cara de quem provou · Texto: nenhum · O que testa: a emoção

## Escolha
Título 1 com a thumbnail A, porque a prova está no vídeo.
`;

test("embalagem.md gives its thumbnails, their text and the chosen title", () => {
  const { titles } = packagingTitles(EMBALAGEM);
  assert.deepEqual(packagingThumbnails(EMBALAGEM), [
    { letter: "A", text: "30 dias de marmita" },
    { letter: "B", text: "antes e depois da quinta feira de novo" },
    { letter: "C", text: null },
  ]);
  assert.equal(packagingChoice(EMBALAGEM, titles), "Fiz 30 dias de marmita com a Airfryer Mondial");
  assert.equal(packagingChoice("## Escolha\nO \"O erro que estraga a sua marmita\", com a B.\n", titles), "O erro que estraga a sua marmita");
  assert.equal(packagingChoice("## Títulos\n1. \"x\"\n", titles), null, "no choice yet");
  assert.equal(packagingChoice("## Escolha\nTítulo 2 com a thumbnail A, porque usa o traço mais forte (\"sem X\") e começa com \"Como\".\n", titles), "O erro que estraga a sua marmita", "quoted reasons are not the title");
  assert.equal(packagingChoice("## Escolha\nA que usa o traço \"sem X\".\n", titles), null, "a quoted word that is no title is not a choice");
});

test("a title promises its numbers, acronyms and names; years, money and Title Case do not count", () => {
  const terms = (title) => titlePromises(title).map((item) => item.term);
  assert.deepEqual(terms("Fiz 30 dias de marmita com a Airfryer Mondial"), ["30", "Airfryer", "Mondial"]);
  assert.deepEqual(terms("Como usar IA para declarar o MEI"), ["IA", "MEI"]);
  assert.deepEqual(terms("A melhor airfryer de 2026"), []);
  assert.deepEqual(terms("Ganhei US$ 500 vendendo bolo"), ["500"]);
  assert.deepEqual(terms("Como Fazer Pão Caseiro Em 3 Passos"), ["3"], "in Title Case every word is capitalized, so none is a name");
  const three = titlePromises("3 erros na marmita")[0].pattern;
  assert.ok(three.test("são três erros") && three.test("3 erros") && !three.test("13 erros"));
});

test("the speech pays the title before the last third", () => {
  const filler = (n) => Array.from({ length: n }, (_, i) => `palavra${i}`).join(" ");
  const early = parseScript(`## Gancho\nForam trinta dias de marmita na Airfryer Mondial.\n\n## Corpo\n${filler(60)}\n\n## Fim\n${filler(20)}`);
  assert.deepEqual(titleCoverage(early, "Fiz 30 dias de marmita com a Airfryer Mondial"), []);
  const late = parseScript(`## Gancho\nA marmita da semana.\n\n## Corpo\n${filler(80)}\n\n## Fim\nTrinta dias depois, a Mondial ainda funciona.`);
  assert.deepEqual(titleCoverage(late, "Fiz 30 dias de marmita com a Airfryer Mondial"), [
    { term: "30", later: true },
    { term: "Airfryer", later: false },
    { term: "Mondial", later: true },
  ]);
  assert.deepEqual(titleCoverage(late, "O erro que estraga a marmita"), [], "a title with no number or name promises nothing a script can check");
  const emphasis = parseScript(`## Gancho\nEste é um carrossel animado feito no Claude Code.\n\n## Corpo\n${filler(40)}`);
  assert.deepEqual(titleCoverage(emphasis, "Como eu uso o Claude Code pra criar carrosséis ANIMADOS"), [], "a word in capitals counts by its stem: \"animado\" pays \"ANIMADOS\"");
  const acronym = parseScript(`## Gancho\nA inteligência artificial declara o imposto.\n\n## Corpo\n${filler(40)}`);
  assert.deepEqual(titleCoverage(acronym, "Como usar IA para declarar o MEI").map((gap) => gap.term), ["IA", "MEI"], "an acronym is said as it is");
});

test("the thumbnail text has at most four words and words of its own", () => {
  const issues = thumbnailIssues(packagingThumbnails(EMBALAGEM), "Fiz 30 dias de marmita com a Airfryer Mondial");
  assert.deepEqual(issues.map((issue) => [issue.rule, issue.excerpt]), [
    ["thumbnail_repeats_title", "30 dias de marmita"],
    ["thumbnail_text_long", "antes e depois da quinta feira de novo"],
  ]);
  assert.match(issues[0].message, /\(30, dias, marmita\)/);
  assert.equal(issues[0].severity, "warn");
  assert.deepEqual(thumbnailIssues([{ letter: "A", text: "30 dias de marmita" }], null), [], "without a chosen title only the length is checked");
  const one = thumbnailIssues([{ letter: "C", text: "A LISTA PRIMEIRO" }], "Marmita da semana: a lista de compras em 4 regras");
  assert.deepEqual(one.map((issue) => [issue.rule, issue.severity]), [["thumbnail_repeats_title", "info"]], "one shared word is a note, not a warning");
});

test("the description: 5,000 bytes, no < or >, and at most 60 hashtags; the pinned comment is not part of it", () => {
  const accented = `${"ação ".repeat(900)}\n\nComentário fixado: ${"x".repeat(9000)}`;
  const long = descriptionIssues(accented);
  assert.ok(long.bytes > 5000 && [...accented.split("Comentário")[0]].length < 5000, "under 5,000 characters and still over 5,000 bytes");
  assert.equal(long.issues[0].rule, "description_too_long");
  assert.equal(long.issues[0].severity, "blocker");
  assert.equal(descriptionIssues(`Curto.\n\nComentário fixado: ${"x".repeat(9000)}`).issues.length, 0);
  const template = descriptionIssues("A promessa.\n\nCapítulos (estimados; confira depois da edição)\n00:00 <o primeiro bloco>\n");
  assert.deepEqual(template.issues.map((issue) => issue.rule), ["description_forbidden_char"]);
  assert.match(template.issues[0].excerpt, /<o primeiro bloco>/);
  const tags = Array.from({ length: 61 }, (_, i) => `#tema${i}`).join(" ");
  assert.deepEqual(descriptionIssues(`A promessa.\n\n${tags}`).issues.map((issue) => issue.rule), ["hashtags_ignored"]);
  assert.equal(descriptionIssues("A promessa. #marmita #airfryer\nhttps://site.com/#ancora").hashtags, 2);
});

function videoFolder(files, profile) {
  const root = mkdtempSync(join(tmpdir(), "roteiro12-"));
  const dir = join(root, "roteiros", "marmita");
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  if (profile !== undefined) writeFileSync(join(root, "roteiros", "canal.md"), profile);
  return { root, dir };
}

test("the checklist names what to set when publishing: paid promotion, audience, AI use and the A/B test", () => {
  const sponsored = videoFolder({ "roteiro.md": "# M\n\n## Gancho\nOi.\n\n## Publi\nO patrocinador.\n", "embalagem.md": EMBALAGEM }, "# Canal\n\n- Teste A/B: sim\n");
  try {
    const text = buildChecklist(sponsored.dir).text;
    assert.match(text, /Marcar "Meu vídeo contém promoção paga"/);
    assert.match(text, /conteúdo para crianças: o YouTube pede essa resposta em todo envio/);
    assert.match(text, /Responder "Uso de IA", na etapa Atributos/);
    assert.match(text, /canto de baixo à direita, onde o YouTube mostra a duração/);
    assert.match(text, /até 2 MB para subir pelo celular/);
    assert.match(text, /- \[ \] Subir as variantes no "Testar e comparar"[^\n]*até 3 títulos, thumbnails ou os dois/);
  } finally {
    rmSync(sponsored.root, { recursive: true, force: true });
  }
  const plain = videoFolder({ "roteiro.md": "# M\n\n## Gancho\nOi.\n", "embalagem.md": EMBALAGEM }, "# Canal\n\n- Teste de miniaturas: não\n");
  try {
    const text = buildChecklist(plain.dir).text;
    assert.doesNotMatch(text, /promoção paga/, "no sponsor block, no paid promotion line");
    assert.doesNotMatch(text, /Testar e comparar/, "the channel said it has no A/B test");
  } finally {
    rmSync(plain.root, { recursive: true, force: true });
  }
  const unknown = videoFolder({ "roteiro.md": "# M\n\n## Gancho\nOi.\n", "embalagem.md": EMBALAGEM });
  try {
    assert.match(buildChecklist(unknown.dir).text, /- \[ \] Se o canal tem o "Testar e comparar": subir as variantes/);
  } finally {
    rmSync(unknown.root, { recursive: true, force: true });
  }
});

test("lint warns when the chosen title is not paid, blocks a description YouTube refuses, and reads the thumbnails", () => {
  const filler = Array.from({ length: 70 }, (_, i) => `palavra${i}`).join(" ");
  const { root, dir } = videoFolder({
    "roteiro.md": `# Marmita\n\n## Gancho\nA marmita da semana.\n\n## Corpo\n${filler}\n\n## Como foi\nOutra parte.\n\n## Fim\nTrinta dias depois, ainda como.\n`,
    "embalagem.md": EMBALAGEM,
    "descricao.md": "A promessa.\n\n00:00 <o primeiro bloco>\n\nComentário fixado: uma pergunta\n",
  });
  try {
    const script = fileURLToPath(new URL("../scripts/roteiro.mjs", import.meta.url));
    const out = JSON.parse(execFileSync(process.execPath, [script, "lint", "roteiros/marmita", "--json"], { cwd: root, encoding: "utf8" }));
    const rules = (name) => out.issues.filter((issue) => issue.rule === name);
    assert.equal(out.chosen_title, "Fiz 30 dias de marmita com a Airfryer Mondial");
    assert.deepEqual(rules("title_unpaid").map((issue) => issue.excerpt), ["30", "Airfryer", "Mondial"]);
    assert.match(rules("title_unpaid")[0].message, /só diz isso no terço final/);
    assert.match(rules("title_unpaid")[1].message, /não diz isso/);
    assert.equal(rules("description_forbidden_char")[0].severity, "blocker");
    assert.equal(out.ready, false);
    assert.deepEqual(rules("thumbnail_text_long").map((issue) => issue.excerpt), ["antes e depois da quinta feira de novo"]);
    assert.equal(rules("thumbnail_repeats_title").length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
