import assert from "node:assert/strict";
import { test } from "node:test";

import { profilePace, teleprompterText } from "../scripts/roteiro.mjs";
import { lint } from "../scripts/lib/rules.mjs";
import { chapters, countWords, markSeconds, parseScript, sentences, spoken, timing } from "../scripts/lib/script.mjs";

const BAD = `# Orçamento

## Gancho
Fala galera, tudo bem com vocês? Nesse vídeo eu vou mostrar como fazer um orçamento. Antes de começar, deixa o like e se inscreve.

## Contrato
Hoje 80% dos meus clientes aceitam na primeira proposta.

## 1. Descubra quanto custa a sua hora
No mundo de hoje, é importante ressaltar que precificar não é só fazer conta, é entender o seu valor. Ademais, some o custo fixo. [CONFIRMAR o valor]
Some. Divida. Multiplique. Pronto. Simples assim.

## Fecho
É isso pessoal, obrigado por assistir. Se inscreve, deixa o like, comenta aqui embaixo e baixa a planilha no link na descrição.
`;

const GOOD = `# Primeiro orçamento sem medo

## Gancho
Eu cobrei 300 reais por um site que me tomou um mês inteiro. [TELA 3s: o e-mail do cliente] No fim deste vídeo você vai ter a conta que eu queria ter feito naquele dia.

## 1. O custo que ninguém conta
Antes do preço vem uma pergunta simples: quanto custa manter a sua vida funcionando por um mês? Aluguel, internet, o computador que um dia quebra. Esse é o seu piso.
> Mostrar a planilha aberta enquanto fala.

## 2. Quanto vale uma hora sua
Agora divida esse piso pelas horas que você realmente trabalha. Não as horas que você gostaria de trabalhar. As de verdade, com reunião, e-mail e retrabalho.
[B-ROLL: agenda cheia]
Na minha conta deu 62 reais por hora. [fonte: minha planilha de 2025]

## 3. A proposta em três linhas
O problema do cliente, o que você entrega e o preço. Mais do que isso e a pessoa se perde antes de chegar no valor.

## Fecho
A planilha que eu uso está no primeiro comentário. Baixe, preencha com os seus números e me conte quanto deu a sua hora.
`;

test("parseScript separates spoken text, marks, notes and sections", () => {
  const script = parseScript(GOOD);
  assert.equal(script.title, "Primeiro orçamento sem medo");
  assert.deepEqual(script.sections.map((section) => section.title), ["Gancho", "1. O custo que ninguém conta", "2. Quanto vale uma hora sua", "3. A proposta em três linhas", "Fecho"]);
  assert.equal(script.sections[0].extra_s, 3);
  assert.equal(script.sections[1].notes.length, 1);
  assert.ok(!script.sections[0].paragraphs[0].text.includes("TELA"));
  // A line of marks only does not split the paragraph: the teleprompter keeps the flow.
  assert.equal(script.sections[2].paragraphs.length, 1);
  assert.deepEqual(script.sections[2].paragraphs[0].lines.map((entry) => entry.line), [11, 12, 13]);
  assert.equal(spoken("Olá [TELA: x] mundo"), "Olá mundo");
  assert.equal(countWords("Um, dois — três 4"), 4);
  assert.deepEqual(sentences("Primeiro. Segundo! Terceiro?"), ["Primeiro.", "Segundo!", "Terceiro?"]);
  assert.equal(markSeconds("[PAUSA 2,5s]"), 2.5);
  assert.equal(markSeconds("[B-ROLL: agenda]"), 0);
});

test("timing estimates each block at the creator's pace and chapters follow YouTube's rules", () => {
  const timed = timing(parseScript(GOOD), 120);
  assert.equal(timed.sections[0].start_s, 0);
  assert.ok(timed.sections[1].start_s > 3);
  assert.equal(timed.words, timed.sections.reduce((total, section) => total + section.words, 0));
  const result = chapters(timed);
  assert.equal(result.items[0].title, "Introdução");
  assert.equal(result.items[1].title, "O custo que ninguém conta");
  assert.equal(result.valid, true);
  const short = chapters(timing(parseScript("## Gancho\nOi.\n## Fim\nTchau."), 180));
  assert.equal(short.valid, false);
});

test("a good script passes with no blocker and no false alarm", () => {
  const script = parseScript(GOOD);
  const timed = timing(script, 180);
  const result = lint(script, timed, { target_s: timed.est_s });
  assert.equal(result.summary.blockers, 0, JSON.stringify(result.issues, null, 2));
  assert.equal(result.summary.warnings, 0, JSON.stringify(result.issues, null, 2));
});

test("a bad script trips every rule it breaks", () => {
  const script = parseScript(BAD);
  const timed = timing(script, 180);
  const result = lint(script, timed, { target_s: 600 });
  const rules = new Set(result.issues.map((issue) => issue.rule));
  for (const rule of ["dead_opener", "early_cta", "placeholder", "unsourced_number", "ai_tell", "written_style", "dead_outro", "cta_count", "duration", "short_run"]) {
    assert.ok(rules.has(rule), `missing ${rule}`);
  }
  const tells = result.issues.filter((issue) => issue.rule === "ai_tell").map((issue) => issue.message);
  assert.ok(tells.some((message) => message.includes("não é só X")));
  assert.ok(tells.some((message) => message.includes("é importante ressaltar")));
  assert.equal(result.issues[0].severity, "blocker");
});

test("Portuguese words are not mistaken for placeholders and sources silence the number check", () => {
  const script = parseScript("## A\nTodo mundo erra o preço no começo, e todo erro ensina.\n\n## B\nSão 3 vezes mais clientes. [fonte: pesquisa do Sebrae 2024]\n\n## C\nFim do vídeo com uma pergunta para você.");
  const result = lint(script, timing(script, 180));
  assert.ok(!result.issues.some((issue) => issue.rule === "placeholder"));
  assert.ok(!result.issues.some((issue) => issue.rule === "unsourced_number"));
});

test("short videos get a tighter hook limit", () => {
  const script = parseScript(`## Gancho\n${"palavra ".repeat(40)}\n## Fim\nAcabou.`);
  const timed = timing(script, 180);
  assert.ok(lint(script, timed, { format: "short" }).issues.some((issue) => issue.rule === "hook_length"));
  assert.ok(!lint(script, timed, { format: "long" }).issues.some((issue) => issue.rule === "hook_length"));
});

test("teleprompter keeps only what is said, one sentence per line", () => {
  const text = teleprompterText(parseScript(GOOD));
  assert.ok(!text.includes("["));
  assert.ok(!text.includes("Mostrar a planilha"));
  assert.ok(!text.includes("##"));
  assert.ok(text.includes("Esse é o seu piso.\n"));
  assert.ok(text.includes("· · ·"));
});

test("the channel profile can carry the measured pace", () => {
  assert.equal(profilePace("Ritmo de fala: 185 palavras por minuto (medido em 5 vídeos)"), 185);
  assert.equal(profilePace("Sem ritmo medido"), null);
  assert.equal(profilePace("Ritmo de fala: 20 palavras por minuto"), null);
});

const claimsIn = (body) => {
  const script = parseScript(`## A\n${body}\n\n## B\nOutra coisa.\n\n## C\nFim.`);
  return lint(script, timing(script, 180)).issues.filter((issue) => issue.rule === "unsourced_number").length;
};

test("claims are caught spelled out, as ratios, averages and vague studies", () => {
  for (const sentence of [
    "Setenta por cento dos freelancers cobram pouco.",
    "Nove em cada dez orçamentos são recusados.",
    "9 em cada 10 orçamentos são recusados.",
    "Três em cada dez clientes pedem desconto.",
    "Um site custa em média 5 mil reais no Brasil.",
    "O mercado paga 150 reais por hora.",
    "A minha renda triplicou em seis meses.",
    "Milhares de designers cobram pouco.",
    "Estudos mostram que quem cobra por hora ganha menos.",
    "Pesquisas mostram o contrário.",
    "70% dos freelancers cobram pouco.",
  ]) assert.equal(claimsIn(sentence), 1, sentence);
  for (const sentence of ["Eu cobrei 300 reais por um site.", "Faça a conta do seu piso.", "São três passos."]) assert.equal(claimsIn(sentence), 0, sentence);
  assert.equal(claimsIn("Hoje eu ganho o dobro. [fonte: o criador]"), 0);
});

test("a comparison sourced in the paragraph just before is covered", () => {
  const script = parseScript("## A\nDividindo por 160 dá 26 reais. Por 68, dá 62. [fonte: números do criador]\n\nMais que o dobro, só por trocar o divisor.\n\n## B\nOutra.\n\n## C\nFim.");
  assert.ok(!lint(script, timing(script, 180)).issues.some((issue) => issue.rule === "unsourced_number"));
});

test("a guaranteed result is a blocker", () => {
  const script = parseScript("## A\nVocê vai ganhar 10 mil reais por mês com esse método, garantido.\n\n## B\nOutra.\n\n## C\nFim.");
  const issues = lint(script, timing(script, 180)).issues;
  assert.ok(issues.some((issue) => issue.rule === "guarantee" && issue.severity === "blocker"));
  const fine = parseScript("## A\nO seu lugar na turma está garantido.\n\n## B\nOutra.\n\n## C\nFim.");
  assert.ok(!lint(fine, timing(fine, 180)).issues.some((issue) => issue.rule === "guarantee"));
});

test("problems point at their own line, not the paragraph's first", () => {
  const script = parseScript("## A\nPrimeira linha sem nada.\nSegunda linha também.\n[TEXTO: algo]\nTerceira com [CONFIRMAR: o valor] pendente.\n\n## B\nOutra.\n\n## C\nFim.");
  const placeholder = lint(script, timing(script, 180)).issues.find((issue) => issue.rule === "placeholder");
  assert.equal(placeholder.line, 5);
});

test("chapters with working names are flagged and the teleprompter count is the spoken words", () => {
  const timed = timing(parseScript(`## Gancho\n${"a ".repeat(40)}\n## 1. Como cobrar\n${"b ".repeat(40)}\n## Fecho\n${"c ".repeat(40)}`), 180);
  const result = chapters(timed);
  assert.deepEqual(result.items.map((item) => item.internal ?? false), [false, false, true]);
  const text = teleprompterText(parseScript("## A\nUm dois.\n\n## B\nTrês."));
  assert.equal(text, "Um dois.\n\n· · ·\n\nTrês.\n");
});

test("the contrast formula \"X, e não Y\" reads as AI text", () => {
  const tells = (body) => {
    const script = parseScript(`## A\n${body}\n\n## B\nOutra.\n\n## C\nFim.`);
    return lint(script, timing(script, 180)).issues.filter((issue) => issue.rule === "ai_tell").map((issue) => issue.message);
  };
  assert.ok(tells("Por isso eu monto apps, e não arquivos soltos.").some((message) => message.includes("X, e não Y")));
  assert.deepEqual(tells("Eu testei e não gostei do resultado."), []);
});
