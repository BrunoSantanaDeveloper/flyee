import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { packagingChoice, packagingTitles, TRIGGERS, triggerIssues } from "../scripts/lib/rules.mjs";
import { buildChecklist } from "../scripts/roteiro.mjs";

const DESCRIPTIVE = `# Embalagem: bolo de pote

## Títulos
1. "Como fazer bolo de pote para vender" · gatilho: busca direta · 35 caracteres
2. "Bolo de pote para vender: receita fácil" · gatilho: busca
3. "Receita de bolo de pote passo a passo" · **gatilho:** Busca direta (passo a passo)
4. "3 sabores de bolo de pote que vendem" · gatilho: lista
5. "Bolo de pote no pote de vidro ou de plástico" · gatilho: comparação

## Escolha
Título 1 com a thumbnail A.
`;

const STRONG = `# Embalagem: bolo de pote

## Títulos
1. "Bolo de pote para vender, sem forno (passo a passo)" · gatilho: busca direta + custo ou erro · 50 caracteres
2. "Coloquei R$ 3 mil num forno sem saber se ia vender" · gatilho: o que está em jogo
3. "Se você vende bolo pelo WhatsApp, pare de dar desconto" · gatilho: chamado direto + contrário
4. "O erro que derruba o lucro do bolo de pote" · gatilho: custo ou erro
5. "Por dentro de uma cozinha que vende 300 potes por semana" · gatilho: bastidor

## Escolha
Título 1 com a thumbnail B.
`;

test("each title line declares its triggers by the names of the table, two with +", () => {
  const { titles, triggers } = packagingTitles(STRONG);
  assert.equal(titles.length, 5);
  assert.deepEqual(triggers.map((item) => item.declared), [
    ["busca direta", "custo ou erro"],
    ["o que está em jogo"],
    ["chamado direto", "contrário"],
    ["custo ou erro"],
    ["bastidor"],
  ]);
  const short = packagingTitles(DESCRIPTIVE).triggers.map((item) => item.declared[0]);
  assert.deepEqual(short, ["busca direta", "busca direta", "busca direta", "lista", "comparação"], "short names, bold and a note in parentheses read the same");
  const odd = packagingTitles('## Títulos\n1. "Um título" · gatilho: polêmica\n2. "Outro título" · 30 caracteres\n').triggers;
  assert.deepEqual([odd[0].labeled, odd[0].unknown, odd[1].labeled], [true, ["polêmica"], false]);
  assert.equal(TRIGGERS.length, 13, "the thirteen triggers of embalagem.md");
});

test("the check warns when the chosen title only describes and when five titles repeat the trigger", () => {
  const { titles, triggers } = packagingTitles(DESCRIPTIVE);
  const issues = triggerIssues(titles, triggers, packagingChoice(DESCRIPTIVE, titles));
  assert.deepEqual(issues.map((issue) => [issue.rule, issue.severity]), [["titles_same_trigger", "warn"], ["title_descriptive", "warn"]]);
  assert.match(issues[0].message, /usam só 3 gatilho\(s\) \(busca direta, lista, comparação\)/);
  assert.match(issues[1].message, /só tem o gatilho busca direta/);
  assert.match(issues[1].fix, /alavanca que o vídeo paga/);
  const strong = packagingTitles(STRONG);
  assert.deepEqual(triggerIssues(strong.titles, strong.triggers, packagingChoice(STRONG, strong.titles)), [], "search words with a lever after them are not a descriptive title");
});

test("a title without a trigger or with one outside the table is a note, and fewer than five titles are not compared", () => {
  const text = '## Títulos\n1. "Fiz 30 dias de marmita" · gatilho: experimento\n2. "Marmita da semana" · gatilho: polêmica\n3. "Como fazer marmita"\n\n## Escolha\nTítulo 3.\n';
  const { titles, triggers } = packagingTitles(text);
  const issues = triggerIssues(titles, triggers, packagingChoice(text, titles));
  assert.deepEqual(issues.map((issue) => [issue.rule, issue.severity]), [["title_trigger_missing", "info"], ["title_trigger_unknown", "info"]]);
  assert.match(issues[1].fix, /o que está em jogo, extremo ou contraste, bastidor, chamado direto, transformação/);
});

function videoFolder(files) {
  const root = mkdtempSync(join(tmpdir(), "roteiro13-"));
  const dir = join(root, "roteiros", "bolo");
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return { root, dir };
}

test("lint gives each title its triggers and warns on a packaging that only describes", () => {
  const { root } = videoFolder({ "roteiro.md": "# Bolo\n\n## Gancho\nO bolo de pote que vende.\n\n## Corpo\nComo fazer.\n", "embalagem.md": DESCRIPTIVE });
  try {
    const script = fileURLToPath(new URL("../scripts/roteiro.mjs", import.meta.url));
    const out = JSON.parse(execFileSync(process.execPath, [script, "lint", "roteiros/bolo", "--json"], { cwd: root, encoding: "utf8" }));
    assert.deepEqual(out.titles[0].triggers, ["busca direta"]);
    assert.equal(out.chosen_title, "Como fazer bolo de pote para vender");
    const rules = out.issues.map((issue) => issue.rule);
    assert.ok(rules.includes("title_descriptive"));
    assert.ok(rules.includes("titles_same_trigger"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the checklist allows a thumbnail made of what is in the video and refuses an invented one", () => {
  const { root, dir } = videoFolder({ "roteiro.md": "# Bolo\n\n## Gancho\nOi.\n", "embalagem.md": STRONG });
  try {
    const text = buildChecklist(dir).text;
    assert.match(text, /Nas thumbnails, só o que está no vídeo \(montar com esses elementos vale; inventar uma cena, uma tela ou um resultado, não\)/);
    assert.match(text, /canto de baixo à direita, onde o YouTube mostra a duração/);
    assert.doesNotMatch(text, /tela montada/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
