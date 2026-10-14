import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { briefingAnswer, buildChecklist, buildDocument, profileGaps, recordingPlan } from "../scripts/roteiro.mjs";

function videoFolder(files) {
  const root = mkdtempSync(join(tmpdir(), "roteiro-"));
  const dir = join(root, "roteiros", "panela-eletrica");
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return { root, dir };
}

test("the checklist lists what to make first, every pending mark with its block, and the publishing checks", () => {
  const { root, dir } = videoFolder({
    "briefing.md": "# Briefing\n\n- O resultado já existe? não: a marmita ainda vai ser feita.\n",
    "verdade.md": "# Ficha de verdade\n\n## Panela de pressão elétrica\n- O que faz: …\n\n## O que fica fora da fala\n- o preço\n",
    "roteiro.md": "# Marmita\n\n## Gancho\n[TELA: a marmita pronta]\nLevou [CONFIRMAR: quanto tempo].\n\n## Como foi\nEscolhi [ESCOLHER: o cardápio].\n",
    "descricao.md": "O link: [CONFIRMAR: o link da receita]\n",
  });
  try {
    const built = buildChecklist(dir);
    assert.equal(built.result_missing, true);
    assert.equal(built.pending, 3);
    assert.match(built.text, /Fazer o que o vídeo mostra antes de gravar a fala/);
    assert.match(built.text, /Gravar \(tela: a marmita pronta\)/);
    assert.match(built.text, /roteiro, bloco "Gancho", linha 5: \[CONFIRMAR: quanto tempo\]/);
    assert.match(built.text, /roteiro, bloco "Como foi", linha 8: \[ESCOLHER: o cardápio\]/);
    assert.match(built.text, /descrição, linha 1: \[CONFIRMAR: o link da receita\]/);
    assert.match(built.text, /nomes escritos certo: Panela de pressão elétrica\./);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the full document joins the files in reading order, one heading level down", () => {
  const { root, dir } = videoFolder({
    "briefing.md": "# Briefing\n\n- O vídeo em uma frase: marmita.\n",
    "roteiro.md": "# Marmita da semana\n\n## Gancho\nOlha a marmita.\n",
    "embalagem.md": "# Embalagem\n\n## Títulos\n1. \"Marmita\"\n",
  });
  try {
    const built = buildDocument(dir);
    assert.deepEqual(built.included, ["briefing.md", "embalagem.md", "roteiro.md"]);
    assert.match(built.text, /^# Roteiro · Marmita da semana\n/);
    assert.ok(built.text.indexOf("## Resumo e premissas") < built.text.indexOf("## Título, thumbnail") && built.text.indexOf("## Título, thumbnail") < built.text.indexOf("## Roteiro completo"));
    assert.match(built.text, /### Gancho\nOlha a marmita\./);
    assert.ok(!built.text.includes("# Briefing"));
    assert.ok(!built.text.includes("Rascunho"));
    assert.match(buildDocument(dir, { pending: 3 }).text, /^# Roteiro · Marmita da semana\n\n> Rascunho: 3 marca\(s\) a preencher no roteiro, antes de gravar/);
    assert.match(buildDocument(dir, { pending: 2, other: 4 }).text, /2 marca\(s\) a preencher no roteiro e 4 nos outros arquivos/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the checklist takes the recording plan, every shot and the marks of the other files", () => {
  const { root, dir } = videoFolder({
    "briefing.md": "# Briefing\n\n- Alguma coisa que aparece no vídeo é sua (você fez, vende ou ganha com ela)? sim/não: **não**\n- O resultado já existe? sim/não: não, o teste começa segunda (num vídeo que mostra fazer, testar ou experimentar algo)\n",
    "gravacao.md": "# Gravação\n\n## O que fazer e gravar antes da fala\n- [ ] Dormir 8 horas por 7 noites e anotar a hora de deitar\n- [ ] Filmar o despertador toda manhã\n\n## O mapa da gravação\n- 00:12 a tela inicial\n",
    "verdade.md": "# Ficha\n\n## A panela\n- Tempo: [CONFIRMAR: quanto leva]\n",
    "embalagem.md": "# Embalagem\n\n## Thumbnails\n- [CONFIRMAR: se o canal tem o teste de miniaturas]\n",
    "roteiro.md": "# Sono\n\n## Gancho\n[B-ROLL: o quarto escuro]\n[CÂMERA]\n[TELA 00:12–00:31: a tela que já foi gravada]\n[TELA 00:40 a 00:55: outra tela já gravada]\nSete noites.\n",
  });
  writeFileSync(join(dir, "..", "canal.md"), "# Canal\n\n- Nicho e tema: [CONFIRMAR: o nicho]\n");
  try {
    const built = buildChecklist(dir);
    assert.equal(built.result_missing, true);
    assert.equal(built.plan, 2);
    assert.match(built.text, /- \[ \] Dormir 8 horas por 7 noites/);
    assert.ok(!built.text.includes("Fazer o que o vídeo mostra"), "the plan replaces the generic line");
    assert.ok(!built.text.includes("00:12 a tela inicial"), "the map of a finished recording is not a task");
    assert.ok(!built.text.includes("Gravar (apoio"), "with a plan, the shots come from it");
    assert.equal(built.shots, 0);
    assert.ok(!built.text.includes("a tela que já foi gravada"), "a [TELA mm:ss–mm:ss] points at a recording that exists");
    assert.ok(!built.text.includes("outra tela já gravada"), "the documented form [TELA mm:ss a mm:ss] too");
    assert.match(built.text, /ficha de verdade, bloco "A panela", linha 4: \[CONFIRMAR: quanto leva\]/);
    assert.match(built.text, /embalagem, bloco "Thumbnails"/);
    assert.match(built.text, /## Quando puder: o perfil do canal\n\n- \[ \] linha 3: \[CONFIRMAR: o nicho\]/);
    assert.equal(built.pending, 2, "the profile's open lines are not needed to record this video");
    assert.equal(built.pending_profile, 1);
    assert.ok(!/nomes escritos certo: A panela/.test(built.text), "a common object is not a name to check");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the checklist lists each thing once and skips marks quoted in prose", () => {
  const { root, dir } = videoFolder({
    "gravacao.md": "# Gravação\n\n## O que fazer e gravar antes da fala\n- [ ] Gravar a tela do pedido inteiro\n- [ ] Onde a fala tiver `[CONFIRMAR]`, anote a resposta\n",
    "verdade.md": "# Ficha\n\n## Lista Pronta\n- Tempo: [CONFIRMAR: quanto leva]\n- Custo: `[CONFIRMAR: o que é pago]`\n",
    "roteiro.md": "# Teste\n\n## Gancho\n[TELA: a tela do pedido inteiro]\nLevou [CONFIRMAR: quanto leva].\n",
  });
  try {
    const built = buildChecklist(dir);
    assert.equal(built.pending, 2, "the mark the script repeats is listed once; a quoted mark with content still counts");
    assert.equal(built.pending_script, 1);
    assert.equal(built.pending_other, 1);
    assert.match(built.text, /ficha de verdade, bloco "Lista Pronta", linha 5: \[CONFIRMAR: o que é pago\]/);
    assert.equal(built.shots, 0, "with a plan, the shots come from it");
    assert.ok(!/plano de gravação, linha/.test(built.text));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("briefing answers are read in the template's own wording", () => {
  const own = /aparece no v[íi]deo [ée] su[ao]/i;
  const result = /resultado j[áa] existe/i;
  assert.equal(briefingAnswer("- O resultado já existe? sim/não: não, ainda vou fazer", result), "não");
  assert.equal(briefingAnswer("- **O resultado já existe?** **Não**.", result), "não");
  assert.equal(briefingAnswer("- O resultado já existe? sim, gravei ontem", result), "sim");
  assert.equal(briefingAnswer("- O resultado já existe? sim/não: …", result), null);
  assert.equal(briefingAnswer("- Alguma coisa que aparece no vídeo é sua (você fez, vende ou ganha com ela)? sim/não: sim, o app é meu", own), "sim");
  assert.equal(briefingAnswer("# Briefing", own), null);
});

test("the recording plan: the items to do first, or every checkbox when there is no such heading", () => {
  assert.deepEqual(recordingPlan("## Antes de gravar\n- comprar\n- [x] filmar\n\n## Mapa da gravação\n- 00:10 x"), ["comprar", "filmar"]);
  assert.deepEqual(recordingPlan("# Plano\n- [ ] medir\n- nota solta"), ["medir"]);
});

test("a thin channel profile says what it lacks", () => {
  const thin = "# Canal\n\n- Nicho e tema: cozinha prática\n- Para quem: …\n- Ritmo de fala: 180 palavras por minuto (estimado)\n\n## Voz\n- você\n";
  assert.deepEqual(profileGaps(thin), ["para quem", "promessa do canal", "prova e autoridade", "na primeira pessoa", "teste de miniaturas", "voz", "histórias e opiniões", "regras do criador"]);
  assert.ok(profileGaps("- Teste de miniaturas: sim/não (o do YouTube)\n").includes("teste de miniaturas"), "the unanswered template line is a gap");
  assert.ok(profileGaps("## Histórias e opiniões\n\n### Como eu comecei\n- … (a história)\n\n## Regras do criador\n").includes("histórias e opiniões"), "the empty template is a gap");
  const full = "# Canal\n\n- Nicho e tema: cozinha\n- Para quem: quem trabalha fora\n- Promessa do canal: comer bem gastando pouco\n- Prova e autoridade: 5 anos de marmita\n- Na primeira pessoa: cansada\n- Teste de miniaturas: sim\n\n## Voz\n- fala com você\n- frases curtas\n- ri de si mesmo\n\n## Histórias e opiniões\n\n### O que eu defendo\n- marmita boa é a que você aguenta comer na quinta\n\n## Regras do criador\n\n### Nunca dizer\n";
  assert.deepEqual(profileGaps(full), []);
});
