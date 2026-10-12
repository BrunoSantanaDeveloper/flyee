import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { creatorRules, lint, packagingTitles } from "../scripts/lib/rules.mjs";
import { parseScript, timing } from "../scripts/lib/script.mjs";

const run = (body, options = {}) => {
  const script = parseScript(`## A\n${body}\n\n## B\nOutra coisa.\n\n## C\nFim do vídeo.`);
  return lint(script, timing(script, 180), options).issues;
};
const rules = (issues, rule) => issues.filter((issue) => issue.rule === rule);

test("[ESCOLHER] is a pending decision that blocks like [CONFIRMAR]", () => {
  const issues = run("O tema vai ser [ESCOLHER: o tema do carrossel].");
  assert.equal(rules(issues, "placeholder")[0].severity, "blocker");
  assert.equal(rules(run("Vou escolher um tema bom."), "placeholder").length, 0);
});

test("the creator's \"Nunca dizer\" comes from canal.md and blocks in the speech", () => {
  const parsed = creatorRules(readFileSync(new URL("./fixtures/canal-regras.md", import.meta.url), "utf8"));
  assert.deepEqual(parsed.never_say, ["marmita fitness", "Thermomix", "link na bio"]);
  assert.deepEqual(parsed.never_do, ["explicar planos ou preços do curso dele", "prometer emagrecimento"]);
  const issues = run("Essa é a minha marmita fitness da semana. E o link na bio tem tudo.", { banned: parsed.never_say });
  assert.deepEqual(rules(issues, "creator_banned").map((issue) => issue.severity), ["blocker", "blocker"]);
  assert.equal(rules(run("Uso a panela de pressão, não tenho Thermomixer.", { banned: parsed.never_say }), "creator_banned").length, 0);
  assert.deepEqual(creatorRules("# Sem regras\n- solta").never_say, []);
});

test("a claim that something does not exist needs the search and its scope", () => {
  assert.equal(rules(run("Ninguém mostra isso no YouTube."), "absence_unscoped").length, 1);
  assert.equal(rules(run("Não existe nenhum vídeo sobre isso."), "absence_unscoped").length, 1);
  assert.equal(rules(run("Em português, nas minhas buscas, ninguém mostra isso."), "absence_unscoped").length, 0);
  assert.equal(rules(run("Eu procurei e ninguém mostra isso. [fonte: busca no YouTube em 10/10/2026]"), "absence_unscoped").length, 0);
  assert.equal(rules(run("Quase ninguém tá fazendo isso ainda."), "absence_unscoped").length, 0);
});

test("ad language outside a sponsor block is flagged; inside it is fine", () => {
  assert.equal(rules(run("Garanta já o seu com o cupom da descrição."), "sales_pitch").length, 1);
  const sponsored = parseScript("## Gancho\nOi.\n\n## Publi\nUse o código PANELA e garanta já o seu.\n\n## Fim\nTchau.");
  assert.equal(rules(lint(sponsored, timing(sponsored, 180)).issues, "sales_pitch").length, 0);
  assert.equal(rules(run("O desconto só vale acima do preço mínimo."), "sales_pitch").length, 0);
});

test("titles of embalagem.md are read between quotes under ## Títulos", () => {
  const text = '# Embalagem\n\n## Títulos\n1. "Como eu organizo a marmita da semana (passo a passo)" · gatilho: busca\n2. "Fiz 30 dias de marmita" · gatilho: experimento\n3. Sem aspas aqui\n\n## Thumbnails\n1. "não é título"';
  const parsed = packagingTitles(text);
  assert.deepEqual(parsed.titles, ["Como eu organizo a marmita da semana (passo a passo)", "Fiz 30 dias de marmita"]);
  assert.equal(parsed.unquoted, 1);
});

test("the approved example trips no rule except its own pending marks", () => {
  const read = (name) => readFileSync(new URL(`./fixtures/regressao/${name}`, import.meta.url), "utf8");
  const script = parseScript(read("exemplo-roteiro.md"));
  const { never_say } = creatorRules(read("canal.md"));
  const issues = lint(script, timing(script, 200), { banned: never_say, own: true }).issues;
  const unexpected = issues.filter((issue) => issue.rule !== "placeholder");
  assert.deepEqual(unexpected.map((issue) => `${issue.rule}: ${issue.excerpt}`), []);
  assert.equal(issues.filter((issue) => issue.rule === "placeholder").length, 9);
});

test("every pending mark blocks, one by one, even alone on a line or at the start of a block", () => {
  const script = parseScript("## 1. Bloco\n[CONFIRMAR: como foi no mercado]\nUma dica pra essa hora.\n\n[CORTE]\n[CONFIRMAR: a noite que não deu certo]\n\n## 2. Outro\nFoi [CONFIRMAR: quanto] e [ESCOLHER: qual].\n> Nota para o criador: [CONFIRMAR: a foto]\n\n## 3. Fim\nTchau.");
  const issues = lint(script, timing(script, 180)).issues.filter((issue) => issue.rule === "placeholder");
  assert.deepEqual(issues.map((issue) => issue.line), [2, 6, 9, 9, 10]);
  assert.ok(issues.every((issue) => issue.severity === "blocker"));
  assert.equal(issues[0].section, "1. Bloco");
});

test("a note above the first block opens no block", () => {
  const script = parseScript("# Título\n> Nota para o criador: grave de manhã.\n\n## Gancho\nOi.");
  assert.deepEqual(script.sections.map((section) => section.title), ["Gancho"]);
});

test("a script written before the result is not called short: the marks become speech later", () => {
  const script = parseScript("## A\nFoi [CONFIRMAR: o que aconteceu].\n\n## B\nDepois.\n\n## C\nFim.");
  const duration = lint(script, timing(script, 180), { target_s: 480 }).issues.find((issue) => issue.rule === "duration");
  assert.equal(duration.severity, "info");
  assert.match(duration.message, /1 marca\(s\) pendente\(s\)/);
});

test("price, plan, version, free and store talk is flagged only in a video of the creator's own thing", () => {
  for (const sentence of ["O app é grátis até cinco receitas por semana.", "Com o Plano Família, você tem receitas ilimitadas.", "Na versão nova do app ficou mais rápido.", "Procura ele na loja e instala.", "Custa R$ 14,90 e vale."]) {
    assert.equal(rules(run(sentence, { own: true }), "own_pitch").length, 1, sentence);
    assert.equal(rules(run(sentence), "own_pitch").length, 0, sentence);
  }
  assert.equal(rules(run("E fora o plano do Claude, que eu já pago, o resto não custou nada.", { own: true }), "own_pitch").length, 0);
  assert.equal(rules(run("Um programa gratuito chamado ffmpeg junta tudo.", { own: true }), "own_pitch").length, 0);
  assert.equal(rules(run("Baixa agora o app."), "sales_pitch").length, 1);
});

test("absence: no alarm on a figure of speech, and a mark elsewhere in the paragraph is not a scope", () => {
  assert.equal(rules(run("A noite é o único pedaço do dia que é seu."), "absence_unscoped").length, 0);
  assert.equal(rules(run("Esse é o único vídeo que mostra isso."), "absence_unscoped").length, 1);
  assert.equal(rules(run("Ninguém mostra isso.\nEu fiz [CONFIRMAR: quanto] marmitas."), "absence_unscoped").length, 1);
});

test("\"não está no X. Está no Y\" sounds like an AI", () => {
  assert.equal(rules(run("O problema não está no fogão. Está na lista."), "ai_tell").length, 1);
  assert.equal(rules(run("A panela não está na pia, tá no fogão ainda."), "ai_tell").length, 0);
});

test("a contract read like a course outline, and a recap in the middle", () => {
  assert.equal(rules(run("Aqui você vai ver o pedido. Você vai entender como ele trabalha. E vai levar as sete regras."), "syllabus").length, 1);
  assert.equal(rules(run("Hoje eu vou te mostrar dois. Pra você entender por que fica bom."), "syllabus").length, 0);
  assert.equal(rules(run("Até aqui você viu o pedido e como ele trabalha."), "ai_tell").length, 1);
});

test("a mark where the speech should be, and a block left for the creator to write", () => {
  const script = parseScript("## Gancho\nOlha a marmita pronta, e ela levou [CONFIRMAR: quanto tempo] pra ficar assim, do começo ao fim, sem eu parar nada.\n\n## De onde veio\n[CONFIRMAR: o gatilho, do seu jeito]\nDaí saiu a planilha. [CONFIRMAR: a pergunta que veio]\n\n## Fim\nTá perfeito? Não. [CONFIRMAR: o que você ainda mudaria]");
  const issues = lint(script, timing(script, 180)).issues;
  assert.deepEqual(rules(issues, "mark_alone").map((issue) => issue.line), [5]);
  assert.deepEqual(rules(issues, "hollow_block").map((issue) => issue.section), ["De onde veio"]);
  assert.equal(rules(issues, "placeholder").length, 4);
});

test("too many figures in one paragraph get a note", () => {
  assert.equal(rules(run("São 120 batidas por minuto, 3 compassos, 6 segundos, 30 quadros e 1,25 segundo de pausa."), "number_dense").length, 1);
  assert.equal(rules(run("Tudo a 120 batidas por minuto. Cada slide dura seis segundos."), "number_dense").length, 0);
});

test("the contrast formulas a critic caught in an evaluated script", () => {
  assert.equal(rules(run("Parece uma música só, e não um corte seco a cada slide."), "ai_tell").length, 1);
  assert.equal(rules(run("Mas o que faz esse carrossel funcionar não é o código. São umas regras."), "ai_tell").length, 1);
  assert.equal(rules(run("São elas que fazem a diferença."), "ai_tell").length, 1);
  assert.equal(rules(run("Eu cheguei cansado, e não sei bem o que fazer agora com isso."), "ai_tell").length, 0);
  assert.equal(rules(run("Motion design é design gráfico que se mexe. Não é filme, não é personagem falando."), "ai_tell").length, 0);
});
