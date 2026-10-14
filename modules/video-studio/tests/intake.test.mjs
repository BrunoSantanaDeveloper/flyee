// The brief of the Estúdio de vídeo, without any AI and without files: the reading of the literal
// request (table-driven, pt-BR first), how complete it is, the questions of each round and their
// shapes for a clickable tool and for a plain chat, the answers in every form a member types,
// "decida por mim", the 12-question cap, what the site of the brand adds, the defaults, the
// one-line plan, the complete brief written back, the next step across the life of a video, the
// beat grid of a duration, the folder names and the integrity of the question bank.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyAnswers,
  assess,
  decideRound,
  DESTINATIONS,
  echo,
  FIELDS,
  fillDefaults,
  linha,
  loadBank,
  loadTemplates,
  mergeKit,
  newState,
  nextStep,
  OBJECTIVES,
  planRound,
  questionFor,
  slugFor,
  solveTiming,
  STYLES,
  TEMPLATES,
  TONES,
} from "../scripts/lib/intake.mjs";
import { classifyUrl, findListItems, fold, normalizeUrl, parseRequest, shortenWords, splitList } from "../scripts/lib/request.mjs";
import { AppError } from "../scripts/lib/util.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(TESTS_DIR, "..");
const BANK = loadBank(APP_DIR);
const TEMPLATES_DATA = loadTemplates(APP_DIR);
const NOW = "2026-10-07T12:00:00.000Z";
const SCRIPT = "node .flyee/modules/video-studio/scripts/studio.mjs";

const clone = (value) => structuredClone(value);
const ids = (round) => (round ? round.questions.map((question) => question.id) : null);
const make = (request, project = {}) => newState({ request, appVersion: "1.0.0", now: NOW, project });
const answer = (state, answers, kit = null) => {
  const result = applyAnswers(state, answers, BANK, { kit, now: NOW });
  assert.deepEqual(result.errors, [], JSON.stringify(result.errors));
  return result.state;
};
/** What the script does after every command: a round that is asked is recorded in the state. */
function show(state, kit = null) {
  const round = planRound(state, BANK, { kit });
  if (!round) return null;
  if (!state.rounds.some((entry) => entry.n === round.n)) state.rounds.push({ n: round.n, ids: ids(round), at: NOW, answered: false });
  for (const id of ids(round)) if (!state.asked.includes(id)) state.asked.push(id);
  return round;
}
/** What the script does after the capture: the kit comes into the brief and exists on disk. */
function captured(state, kit) {
  const merged = mergeKit(state, kit);
  merged.brand = { ...merged.brand, slug: kit.slug, kit: `estudio-de-video/marcas/${kit.slug}/marca.json` };
  merged.files = { kit: true, roteiro: false, preview: false, final: false };
  merged.status = "capture";
  return merged;
}
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

/** A brand kit as the script writes it from a capture of the brand's site. */
const KIT = {
  format_version: 1,
  slug: "lojax",
  name: "Loja X",
  site: "https://lojax.com.br",
  host: "lojax.com.br",
  handle: "@lojax",
  captured_at: "2026-10-07T12:01:00.000Z",
  found_by: "resposta",
  confirmed: true,
  headline: "Roupa de treino que dura muito mais que você imagina",
  sections: ["Linha Easy", "Tabela de tamanhos", "Frete grátis acima de R$ 199", "Fale conosco"],
  products: [{ name: "Top Fitness Easy", price: "R$ 199" }, { name: "Legging Nova Coleção", price: "R$ 249" }],
  numbers: [{ text: "+12 mil clientes", value: 12000, page: "página inicial" }],
  cta: ["Comprar agora"],
  social: { instagram: "https://instagram.com/lojax", whatsapp: "https://wa.me/5511999999999" },
  colors: { primary: "#E8473C", background: "#FFFFFF", text: "#111111", palette: [] },
  fonts: { headline: "Inter", body: "Inter" },
  logo: { file: "estudio-de-video/marcas/lojax/assets/logo.png", source: "cabeçalho do site" },
  screens: { mobile: "capturas/lojax-com-br/mobile.png" },
};

// ---------------------------------------------------------------------------
// The four canonical requests of the spec
// ---------------------------------------------------------------------------

const R1 = "Faça um vídeo animado";
const R2 = "Faz um vídeo de 15 segundos da lojax.com.br para o Reels";
const R3 = `Faz um vídeo de motion graphics dinâmico de 20 segundos para Notion (https://www.notion.com/), com a energia do showreel de um motion designer. Vai com tudo.

Materiais
- Visita o site. Usa capturas de tela reais (Playwright), o logo real, as cores e as fontes reais.
  Salva tudo em ./assets e lista o que você encontrou antes de animar.
- Nunca redesenha a interface do produto de imaginação. Recorta e anima a coisa real.

História (um momento por batida, de 2 a 4 segundos cada)
1. Gancho: o problema em 5 palavras de tipografia cinética enorme.
2. O produto aparece, a interface se monta peça por peça.
3. Três recursos, cada um como um momento de interface com um cursor fazendo uma ação real.
4. Um número que prova que funciona, tirado do próprio site. Se não achar nenhum publicado, pula esta parte e não inventa.
5. Assinatura com o logo + "notion.com".

Som
- Música original, 120 BPM, sintetizada em código. Cliques e whooshes de interface na batida.

Formato: 1920x1080 (16:9) primeiro, depois 1:1 e 9:16 a partir da mesma linha do tempo.
Antes do render completo, me mostra uma folha de contato com um quadro por batida.
Salva o final em resultados/04-marca-de-verdade.mp4.`;
const R4 = "Quero um anúncio de 20 s da insiderstore.com.br com as peças da coleção, fecha com o link na bio";

/** The complete request of the script's own tests: a numbered story whose first and last lines are the opening and the ending. */
const R3_CLINIC = `Crie um vídeo de lançamento da Sorriso Pleno (https://www.sorrisopleno.com.br), com 15 segundos, para o Reels e o TikTok, apresentando a clínica.

A história:
1. Abre com "Seu sorriso novo em 90 dias"
2. Implantes dentários
3. Clareamento a laser
4. Alinhadores invisíveis
5. Fecha com o logo e o site

Música a 120 BPM. Primeiro em 16:9, depois em 9:16.
`;

const B05 = `<entradas>
Produto: Notion (https://www.notion.com/). Usa como frase do produto o título principal do site.
Pega o logo real, as cores da marca, as fontes e as capturas de interface do site com Playwright. Escolhe uma cor de destaque da marca.
Música: sintetiza uma trilha original em código a 120 BPM.
Formato: 1920x1080 (16:9).
</entradas>

<direcao>
Filme de produto com interface em movimento. Um contêiner que nunca corta: todo estado é o mesmo
elemento mudando de tamanho, de raio e de preenchimento, enquanto o conteúdo troca atrás de um desfoque curto.
Um cursor conduz cada mudança. Fundo neutro e quente, uma cor de destaque.
</direcao>

<estrutura>
120 BPM, 8 compassos, alguma coisa acontece em toda batida.
logo → página em branco com um título sendo digitado ("Plano de lançamento") → a página vira um quadro de tarefas com três colunas
→ o cursor arrasta um cartão de "A fazer" para "Fazendo" → o cartão abre e uma caixa de seleção é marcada
→ o cartão vai para "Feito" → o quadro encolhe e vira o botão "Compartilhar" → logo.
</estrutura>`;

const P1 = `/goal Edita o vídeo showreel/motionstela.mp4 com HyperFrames. Quero o resultado envolvente, limpo e no estilo Apple: motion graphics discretos, precisos e sem exagero.

1. Transcreve o vídeo palavra por palavra (Whisper) antes de animar.
4. Grava de verdade uma tela (B-roll), gera uma imagem e um vídeo no Higgsfield e mostra os quatro.`;

const P2 = `/goal Analisa este vídeo: <https://vimeo.com/1124592722> (SHOWREEL 2025, de Misha Ruchko).

1. Descobre por que ele é tão bom, em 3 camadas: estrutura (a ordem dos capítulos, o loop que abre e fecha), design (paleta, tipografia, componentes) e movimento medido em número (cortes, batida da música, tempo de cada transição, quanto do filme fica quase parado).
2. Transforma o que você descobriu numa skill reutilizável do Claude Code. Copia só o método e a sensação, nunca o conteúdo, as cores ou a marca da referência.
3. Testa a skill na prática: cria um showreel de 15 s sobre o YouTube, usando o meu canal como exemplo (<https://www.youtube.com/@FelipeBorgesFalaIA>). Pesquisa a marca do YouTube (logos oficiais, cores, tipografia e a interface real) e usa os dados reais do canal pela API.
4. A identidade do YouTube tem que ser inconfundível: busca, chips de filtro, thumbnails com selo de duração, barra de progresso vermelha, Inscrever-se e sino.
5. O reel abre digitando "acesse Felipe Borges Fala IA!" na busca e fecha em "Aperte o play." com o botão Inscrever-se.
6. Gera a música no Higgsfield, ajusta a batida e corta tudo em cima dela.

Antes de me entregar, mede o reel contra a referência (cortes na batida, ritmo) e corrige o que não passar.`;

const P4 = `/goal Cria um vídeo de 20 a 25 segundos, vertical (9:16, pra Reels e TikTok), mostrando peças reais da Insider (marca de roupa esportiva).

1. Usa como referência as fotos dos produtos no site oficial: https://www.insiderstore.com.br/collections/tecnologicamente-esportivas-homem.
2. Gera no Higgsfield as cenas com modelos masculinos e femininos sempre animados, praticando esporte.
4. Gera uma música animada no Higgsfield, com introdução, aceleração, clímax e batida final.`;

// ---------------------------------------------------------------------------
// parseRequest, table-driven
// ---------------------------------------------------------------------------

/**
 * Each case: the request and what must be read from it. `fields` compares values with deepEqual
 * (an object compares only the keys it names); `absent` lists fields that must not be read;
 * `unsupported` is the exact list of kinds; `evidence` checks that a field's evidence quotes the
 * member's words; `signals` checks parts of the raw finds.
 */
const PARSE_CASES = [
  { name: "R1: nada além do pedido", text: R1, fields: {}, absent: FIELDS, unsupported: [] },
  {
    name: "R2: site, rede e tempo; 'para o Reels' não é a marca",
    text: R2,
    fields: { brand: { name: null, site: "https://lojax.com.br", handle: null, article: "a" }, destinations: ["reels"], duration: 15 },
    absent: ["objective", "subject", "template", "points", "hook"],
    unsupported: [],
    evidence: { duration: "15 segundos", destinations: "Reels" },
  },
  {
    name: "R3: o briefing completo do Notion, com 16:9 fora desta versão",
    text: R3,
    fields: { brand: { name: "Notion", site: "https://www.notion.com" }, duration: 20, template: "lancamento", closing: { kind: "site", text: "notion.com" }, music: { mode: "music" }, tone: "surpresa", style: "interface-narra" },
    absent: ["objective", "points", "hook", "proof", "destinations", "skip_preview"],
    unsupported: ["format"],
    signals: { bpm: 120, directions: { points: { count: 3 } } },
  },
  {
    name: "R4: anúncio, assunto e fechamento",
    text: R4,
    fields: { brand: { site: "https://insiderstore.com.br", name: null }, objective: "vender", subject: "as peças da coleção", duration: 20, closing: { kind: "bio", text: "Link na bio" } },
    absent: ["template", "points", "hook", "destinations"],
    unsupported: [],
  },
  {
    name: "a lista de estados do Bloco 05 vira os passos da interface",
    text: B05,
    fields: { brand: { name: "Notion", site: "https://www.notion.com" }, template: "interface", duration: 16, style: "interface-que-se-transforma" },
    unsupported: ["format"],
    check: (parsed) => {
      assert.equal(parsed.fields.points.value.length, 6);
      assert.match(parsed.fields.points.value[0], /^página em branco com um título sendo digitado/);
      assert.equal(parsed.fields.points.value[5], 'o quadro encolhe e vira o botão "Compartilhar"');
      assert.equal(parsed.signals.arrow_steps.length, 6);
    },
  },
  {
    name: "editar uma gravação com cenas geradas: duas coisas fora desta versão",
    text: P1,
    fields: { skip_preview: true, style: "limpo" },
    absent: ["brand", "objective", "duration"],
    unsupported: ["edit", "generated"],
    evidence: { skip_preview: "/goal" },
  },
  {
    name: "um link de vídeo é referência, nunca a marca",
    text: P2,
    fields: { brand: { handle: "@FelipeBorgesFalaIA", site: null }, style: { reference: "https://vimeo.com/1124592722", description: null }, hook: "acesse Felipe Borges Fala IA!", closing: { kind: "frase", text: "Aperte o play" }, duration: 15 },
    absent: ["destinations"],
    unsupported: ["generated", "reference_study"],
    signals: { video_links: ["https://vimeo.com/1124592722"] },
  },
  {
    name: "de 20 a 25 segundos vira 20, com a nota na evidência",
    text: P4,
    fields: { brand: { name: "Insider", article: "a" }, destinations: ["reels", "tiktok"], duration: 20, music: { mode: "music", style: "energetic" }, skip_preview: true },
    unsupported: ["generated"],
    evidence: { duration: "usei 20" },
  },
  {
    name: "YouTube como referência de estilo, sem o rastreio do link",
    text: "Quero um vídeo da Loja X no estilo deste vídeo: https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abc123&utm_source=share",
    fields: { brand: { name: "Loja X", site: null, article: "a", noun: "loja" }, style: { reference: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } },
    unsupported: ["reference_study"],
    signals: { video_links: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"] },
  },
  { name: "'para o Reels' sozinho não é marca", text: "Faz um vídeo animado para o Reels", fields: { destinations: ["reels"] }, absent: ["brand"], unsupported: [] },
  {
    name: "uma sequência de estados com setas é a interface que se transforma",
    text: "Vídeo do Agenda Fácil: logo → busca digitando 'corte de cabelo' → lista de horários → horário marcado → lembrete no celular → logo",
    fields: { template: "interface", points: ["busca digitando 'corte de cabelo'", "lista de horários", "horário marcado", "lembrete no celular"] },
  },
  { name: "um roteiro com setas não vira estados: é o lançamento", text: "Vídeo da Loja X: gancho → o produto aparece → 3 recursos → assinatura", fields: { template: "lancamento" }, absent: ["points"] },
  {
    name: "Instagram @loja.x, 15s e três dicas",
    text: "Faz um Reels de 15s pro Instagram @loja.x com 3 dicas de treino",
    fields: { brand: { handle: "@loja.x", name: null, site: null }, destinations: ["reels"], duration: 15, template: "lista", subject: "dicas de treino" },
    absent: ["points"],
    signals: { handles: ["@loja.x"], directions: { points: { count: 3 } } },
    evidence: { duration: "15s" },
  },
  {
    name: "um pedido em inglês",
    text: 'Make a 15s animated video for my store lojax.com for Reels and TikTok, opens with "Train harder", no music',
    fields: { brand: { site: "https://lojax.com" }, destinations: ["reels", "tiktok"], duration: 15, hook: "Train harder", music: { mode: "none" } },
    unsupported: [],
  },
  { name: "editar a aula-01.mp4 é gravação", text: "Edite a aula-01.mp4 para o Reels, com legendas e animações.", fields: { destinations: ["reels"] }, unsupported: ["edit"], check: (parsed) => assert.match(parsed.unsupported[0].evidence, /aula-01\.mp4/) },
  {
    name: "1 minuto e YouTube horizontal: mais longo e outro formato",
    text: "Preciso de um vídeo de 1 minuto da Clínica Sorriso Pleno para o YouTube, horizontal",
    fields: { brand: { name: "Clínica Sorriso Pleno", article: "a", noun: "clinica" }, duration: 20 },
    absent: ["destinations"],
    unsupported: ["format", "long"],
    evidence: { duration: "1 minuto" },
  },
  {
    name: "três dicas escritas por extenso, sem música",
    text: "Faz um vídeo com 3 dicas para cuidar da pele: beber água, usar protetor e dormir bem. Sem música, só efeitos.",
    fields: { template: "lista", points: ["beber água", "usar protetor", "dormir bem"], music: { mode: "none", effects: true }, subject: "dicas para cuidar da pele" },
    absent: ["brand"],
    unsupported: [],
  },
  {
    name: "um número informado vira a prova, com o tom e o WhatsApp",
    text: "Vídeo de 20s do Estúdio Aurora (aurora.studio) mostrando que já atendemos +12 mil clientes, tom sério, chama no WhatsApp no final, faz direto",
    fields: { brand: { name: "Estúdio Aurora", site: "https://aurora.studio", article: "o" }, duration: 20, proof: { text: "+12 mil clientes", value: 12000, source: "informado no pedido" }, tone: "confianca", closing: { kind: "whatsapp", text: "Chama no WhatsApp" }, skip_preview: true },
    absent: ["points"],
    unsupported: [],
  },
  { name: "cenas geradas com pessoas reais", text: "Quero um vídeo com cenas geradas com IA de pessoas reais usando o produto", fields: {}, absent: ["brand"], unsupported: ["generated"] },
  {
    name: "quadrado 1:1 é outro formato",
    text: "Faz um vídeo quadrado 1:1 de 10 segundos da Padaria do Zé para o feed",
    fields: { brand: { name: "Padaria do Zé", article: "a" }, duration: 10 },
    unsupported: ["format"],
    check: (parsed) => assert.match(parsed.unsupported[0].evidence, /1:1/),
  },
  {
    name: "linhas numeradas viram os pontos; a música do integrante",
    text: "Vídeo da Bella Moda para TikTok e Shorts mostrando:\n1. frete grátis\n2. troca fácil\n3. parcelamento em 12x\nMinha música: trilha.mp3",
    fields: { brand: { name: "Bella Moda", article: "a" }, destinations: ["tiktok", "shorts"], points: ["frete grátis", "troca fácil", "parcelamento em 12x"], music: { mode: "file", file: "trilha.mp3" } },
    unsupported: [],
  },
  {
    name: "comente uma palavra no fim",
    text: "Vídeo animado sobre skincare para pele oleosa, 12 segundos, no final comente PELE",
    fields: { subject: "skincare para pele oleosa", duration: 12, closing: { kind: "frase", text: "Comente PELE" } },
    absent: ["brand"],
    unsupported: [],
  },
  {
    name: "stories servem para as três redes; quinze por extenso",
    text: "Faz um vídeo de quinze segundos para os stories da @docesdaana, divertido",
    fields: { brand: { handle: "@docesdaana" }, destinations: ["reels", "tiktok", "shorts"], duration: 15, tone: "proximidade" },
    evidence: { destinations: "stories" },
  },
  {
    name: "shorts de roupa não são o YouTube Shorts",
    text: "Anúncio dos shorts da nova coleção da Insider, 15 segundos",
    fields: { brand: { name: "Insider" }, objective: "vender", subject: "nova coleção da Insider", duration: 15 },
    absent: ["destinations"],
  },
  {
    name: "três recursos: a, b e c; gancho escrito",
    text: "Quero um vídeo do Notion com três recursos: páginas, bancos de dados e IA. Gancho: Tudo num lugar só. 18 segundos.",
    fields: { brand: { name: "Notion", article: "o" }, template: "lancamento", points: ["páginas", "bancos de dados", "IA"], hook: "Tudo num lugar só", duration: 18 },
  },
  {
    name: "uma abertura longa é encurtada sem cortar palavra, com a nota",
    text: 'Vídeo para a Loja X (lojax.com.br). Abre com "Roupa de treino que dura muito mais que a concorrência inteira" e fecha com @lojax',
    fields: { brand: { name: "Loja X", site: "https://lojax.com.br", handle: "@lojax" }, hook: "Roupa de treino que dura", closing: { kind: "perfil", text: "@lojax" } },
    check: (parsed) => assert.match(parsed.fields.hook.note, /11 palavras/),
  },
  {
    name: "tutorial passo a passo, tom leve",
    text: "Faz um tutorial animado de como funciona o agendamento online da Clínica Bem Estar, passo a passo, tom leve",
    fields: { brand: { name: "Clínica Bem Estar" }, objective: "explicar", template: "lista", tone: "proximidade", subject: "o agendamento online da Clínica Bem Estar" },
  },
  {
    name: "showreel do meu trabalho, estilo Apple, para o LinkedIn",
    text: "Quero um showreel do meu trabalho como arquiteta, estilo Apple, bem limpo, 20 segundos, para o LinkedIn",
    fields: { objective: "portfolio", style: "limpo", duration: 20 },
    absent: ["brand", "destinations"],
    unsupported: ["format"],
  },
  { name: "um e-mail não é o site da marca", text: "Me manda no contato@lojax.com.br um vídeo de 15 segundos da loja", fields: { duration: 15 }, absent: ["brand"], signals: { urls: [] } },
  {
    name: "TikTok de referência para a minha marca com nome",
    text: "faz um video igual a este https://www.tiktok.com/@fulano/video/7312345678901234567?is_from_webapp=1&sender_device=pc para a minha marca Doces da Ana",
    fields: { brand: { name: "Doces da Ana", noun: "marca" }, subject: "marca em geral", style: { reference: "https://www.tiktok.com/@fulano/video/7312345678901234567" } },
    unsupported: ["reference_study"],
  },
  {
    name: "um post do X como referência perde o ?s= e o &t=",
    text: "Vídeo de lançamento do meu curso, referência: https://x.com/WeAreLegora/status/2107078811925746132?s=20&t=abc",
    fields: { objective: "lancar", template: "lancamento", subject: "meu curso", style: { reference: "https://x.com/WeAreLegora/status/2107078811925746132" } },
    unsupported: ["reference_study"],
  },
  {
    name: "sem marca, com a frase e a música calma",
    text: 'Quero um vídeo animado sem marca, só com a frase "Bom dia, time" e música calma',
    fields: { brand: { name: null, site: null, handle: null }, hook: "Bom dia, time", music: { mode: "music", style: "warm" } },
  },
  {
    name: "compassos e BPM dão a duração; 120 BPM não muda a trilha",
    text: "Vídeo de 8 compassos a 120 BPM do Notion (notion.com), só interface",
    fields: { brand: { name: "Notion", site: "https://notion.com" }, duration: 16, style: "interface-narra" },
    absent: ["music"],
    signals: { bpm: 120 },
  },
  { name: "segundos de cada cena não são a duração", text: "Faz um vídeo da lojax.com.br com cenas de 2 a 4 segundos cada, vertical", fields: { brand: { site: "https://lojax.com.br" } }, absent: ["duration"], unsupported: [] },
  {
    name: "o link do pedido perde o rastreio; a minha loja é a marca em geral",
    text: "Faça um vídeo animado de 15 segundos para o Reels apresentando a minha loja: https://lojax.com.br/?utm_source=ig&fbclid=abc",
    fields: { brand: { site: "https://lojax.com.br" }, objective: "apresentar", subject: "marca em geral", destinations: ["reels"], duration: 15 },
  },
  {
    name: "o pedido completo do README",
    text: "Vídeo de lançamento do meu aplicativo de agenda. Abre com 'Chega de planilha'. Mostra: marcar um horário, lembrete automático e pagamento pelo celular. Fecha com o logo e meuapp.com.br.",
    fields: { brand: { site: "https://meuapp.com.br" }, objective: "lancar", subject: "meu aplicativo de agenda", template: "lancamento", points: ["marcar um horário", "lembrete automático", "pagamento pelo celular"], hook: "Chega de planilha", closing: { kind: "site", text: "meuapp.com.br" } },
  },
  {
    name: "uma promoção com preço e prazo",
    text: "Quero um anúncio de 20 segundos da promoção de inverno: casaco de lã por R$ 199 até domingo, fecha com 'link na bio'.",
    fields: { objective: "vender", template: "oferta", duration: 20, subject: "promoção de inverno: casaco de lã por R$ 199 até domingo", closing: { kind: "bio", text: "Link na bio" } },
    absent: ["brand"],
  },
  { name: "'não precisa me mostrar' pula a parada da prévia", text: "Faz um vídeo da Loja X, não precisa me mostrar antes", fields: { skip_preview: true, brand: { name: "Loja X" } } },
  { name: "música original a 120 BPM continua sendo trilha", text: "Vídeo do Notion com música original a 120 BPM", fields: { music: { mode: "music" } }, signals: { bpm: 120 } },
  {
    name: "5 segundos sobem para 6",
    text: "Um vídeo de 5 segundos da Loja X",
    fields: { duration: 6 },
    evidence: { duration: "mínimo" },
  },
  { name: "o jeito de outra marca é referência, não a marca do vídeo", text: "Quero um vídeo do jeito da Apple para a minha loja Bella Moda", fields: { brand: { name: "Bella Moda", noun: "loja" }, subject: "marca em geral" } },
  { name: "um assunto com maiúsculas depois de 'sobre' não é marca", text: "Faz um vídeo animado sobre Inteligência Artificial para iniciantes", absent: ["brand"] },
  { name: "um vídeo feito com IA é o que este app faz; pessoas geradas não", text: "Quero um vídeo animado feito com IA da Loja X", fields: { brand: { name: "Loja X" } }, unsupported: [] },
  { name: "gerar vídeos de pessoas é cena gerada", text: "Gera vídeos de pessoas usando o produto da Loja X", unsupported: ["generated"] },
  {
    name: "R3 da clínica: abre com e fecha com não são pontos; só os três recursos",
    text: R3_CLINIC,
    fields: {
      brand: { name: "Sorriso Pleno", site: "https://www.sorrisopleno.com.br" },
      objective: "lancar",
      template: "lancamento",
      duration: 15,
      destinations: ["reels", "tiktok"],
      points: ["Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis"],
      hook: "Seu sorriso novo em 90 dias",
      closing: { kind: "site", text: null },
    },
    unsupported: ["format"],
    signals: { bpm: 120 },
  },
  {
    name: "gancho, o produto aparece, número que prova e assinatura são o roteiro, não pontos",
    text: "Vídeo da Loja X (lojax.com.br):\n1. Gancho: “Treino sem desculpa”\n2. O produto aparece, a interface se monta\n3. Linha Easy\n4. Tabela de tamanhos\n5. Frete grátis\n6. Um número que prova que funciona\n7. Assinatura com “Chama no WhatsApp”",
    fields: { points: ["Linha Easy", "Tabela de tamanhos", "Frete grátis"], hook: "Treino sem desculpa", closing: { kind: "whatsapp", text: "Chama no WhatsApp" } },
  },
  {
    name: "a frase antes do rótulo vai para a abertura; termina com vai para o fechamento",
    text: "Vídeo da Loja X:\n- “Roupa que dura” como abertura\n- A loja aparece na tela\n- Linha Easy\n- Tabela de tamanhos\n- Termina com 'link na bio'",
    fields: { points: ["Linha Easy", "Tabela de tamanhos"], hook: "Roupa que dura", closing: { kind: "bio", text: "Link na bio" } },
  },
  {
    name: "uma abertura já dita no pedido não é trocada pela da lista",
    text: 'Vídeo da Loja X. Abre com "Primeiro gancho".\n1. Gancho: "Segundo gancho"\n2. Linha Easy\n3. Tabela de tamanhos',
    fields: { hook: "Primeiro gancho", points: ["Linha Easy", "Tabela de tamanhos"] },
  },
  {
    name: "pontos que só parecem partes do roteiro continuam pontos",
    text: "Vídeo do Banco Y mostrando:\n1. Abertura de conta em 5 minutos\n2. Assinatura mensal sem taxa\n3. Fechamento de caixa automático",
    fields: { points: ["Abertura de conta em 5 minutos", "Assinatura mensal sem taxa", "Fechamento de caixa automático"] },
    absent: ["hook", "closing"],
  },
  { name: "frete acima de R$ 199 não faz uma oferta", text: "Vídeo da Loja X mostrando: linha Easy, tabela de tamanhos e frete grátis acima de R$ 199", fields: { points: ["linha Easy", "tabela de tamanhos", "frete grátis acima de R$ 199"] }, absent: ["template", "objective"] },
];

function partialEqual(actual, expected, path) {
  if (expected && typeof expected === "object" && !Array.isArray(expected) && actual && typeof actual === "object" && !Array.isArray(actual)) {
    for (const [key, value] of Object.entries(expected)) partialEqual(actual[key], value, `${path}.${key}`);
    return;
  }
  assert.deepEqual(actual, expected, path);
}

test(`parseRequest reads ${PARSE_CASES.length} requests as the member wrote them`, () => {
  assert.ok(PARSE_CASES.length >= 25);
  for (const item of PARSE_CASES) {
    const parsed = parseRequest(item.text);
    const label = `[${item.name}]`;
    for (const [field, value] of Object.entries(item.fields ?? {})) {
      assert.ok(parsed.fields[field], `${label} esperava o campo ${field}; leu ${JSON.stringify(Object.keys(parsed.fields))}`);
      partialEqual(parsed.fields[field].value, value, `${label} ${field}`);
      assert.equal(parsed.fields[field].source, "pedido", `${label} ${field}.source`);
      assert.equal(typeof parsed.fields[field].evidence, "string", `${label} ${field}.evidence`);
    }
    for (const field of item.absent ?? []) {
      if (item.fields?.[field] !== undefined) continue;
      assert.equal(parsed.fields[field], undefined, `${label} não devia ler ${field}: ${JSON.stringify(parsed.fields[field])}`);
    }
    if (item.unsupported) assert.deepEqual(parsed.unsupported.map((entry) => entry.kind), item.unsupported, `${label} unsupported`);
    for (const [field, words] of Object.entries(item.evidence ?? {})) assert.ok(parsed.fields[field].evidence.includes(words), `${label} evidence de ${field}: ${parsed.fields[field].evidence}`);
    for (const [key, value] of Object.entries(item.signals ?? {})) partialEqual(parsed.signals[key], value, `${label} signals.${key}`);
    item.check?.(parsed);
    for (const entry of parsed.unsupported) assert.ok(entry.evidence, `${label} unsupported sem evidência`);
  }
});

test("parseRequest is deterministic and every value is one of the enumerations", () => {
  for (const item of PARSE_CASES) {
    const first = parseRequest(item.text);
    assert.deepEqual(parseRequest(item.text), first, item.name);
    const f = first.fields;
    if (f.objective) assert.ok(OBJECTIVES.includes(f.objective.value), item.name);
    if (f.tone) assert.ok(TONES.includes(f.tone.value), item.name);
    if (f.template) assert.ok(TEMPLATES.includes(f.template.value), item.name);
    if (f.destinations) assert.ok(f.destinations.value.every((id) => DESTINATIONS.includes(id)), item.name);
    if (typeof f.style?.value === "string") assert.ok(STYLES.includes(f.style.value), item.name);
    if (f.duration) assert.ok(f.duration.value >= 6 && f.duration.value <= 20, item.name);
    if (f.hook) assert.ok(f.hook.value.split(" ").length <= 6, item.name);
  }
  assert.deepEqual(parseRequest("").fields, {});
  assert.deepEqual(parseRequest(null).unsupported, []);
});

test("text helpers: whole words, lists, addresses and the folded text keep their places", () => {
  assert.equal(shortenWords("Roupa de treino que dura muito mais que você imagina", 6), "Roupa de treino que dura");
  assert.equal(shortenWords("Seu sorriso novo em 90 dias", 6), "Seu sorriso novo em 90 dias");
  assert.equal(shortenWords("Organize tudo: tarefas, notas e projetos num só lugar", 6), "Organize tudo");
  for (const text of ["Implantes, clareamento e alinhadores invisíveis com avaliação gratuita", "A plataforma completa para a sua clínica crescer de verdade"]) {
    const short = shortenWords(text, 6);
    assert.ok(short.split(" ").length <= 6, short);
    for (const word of short.split(" ")) assert.ok(text.includes(word.replace(/[,.]$/, "")), `${word} não é palavra inteira de ${text}`);
  }
  assert.deepEqual(splitList("páginas, bancos de dados e IA"), ["páginas", "bancos de dados", "IA"]);
  assert.deepEqual(splitList("parcelamento em 12x, R$ 9,90 de frete e troca fácil"), ["parcelamento em 12x", "R$ 9,90 de frete", "troca fácil"]);
  assert.deepEqual(splitList("um; dois; três"), ["um", "dois", "três"]);
  assert.equal(normalizeUrl("https://lojax.com.br/?utm_source=ig&fbclid=abc"), "https://lojax.com.br");
  assert.equal(normalizeUrl("lojax.com.br/planos?ref=bio#topo"), "https://lojax.com.br/planos");
  assert.equal(normalizeUrl("https://youtu.be/abc?si=xyz&t=30"), "https://youtu.be/abc?t=30");
  assert.equal(normalizeUrl("não é endereço"), null);
  assert.equal(classifyUrl("https://www.youtube.com/watch?v=abc"), "video");
  assert.equal(classifyUrl("https://www.youtube.com/@canal"), "profile");
  assert.equal(classifyUrl("https://www.instagram.com/reel/Cx1/"), "video");
  assert.equal(classifyUrl("https://www.instagram.com/lojax/"), "profile");
  assert.equal(classifyUrl("https://x.com/marca/status/123"), "video");
  assert.equal(classifyUrl("https://wa.me/5511999999999"), "contact");
  assert.equal(classifyUrl("https://lojax.com.br"), "site");
  const text = "Ação, VÍDEO e coração: São Paulo";
  assert.equal(fold(text).length, text.length);
  assert.equal(fold(text), "acao, video e coracao: sao paulo");
  assert.deepEqual(findListItems("1. um\n2. dois\n3. três").map((item) => item.text), ["um", "dois", "três"]);
  assert.deepEqual(findListItems("História: 1. Gancho forte. 2. O produto aparece. 3. Assinatura.").map((item) => item.n), [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// How complete the request is, and the rounds
// ---------------------------------------------------------------------------

test("assess and planRound for the four canonical requests", () => {
  const expected = [
    [R1, "vazio", "guided", ["marca", "objetivo", "onde", "duracao"]],
    [R2, "vazio", "guided", ["objetivo"]],
    [R3, "completo", "complete", null],
    [R4, "parcial", "partial", ["onde", "som"]],
  ];
  for (const [request, sufficiency, mode, round] of expected) {
    const state = make(request);
    const measured = assess(state);
    assert.equal(measured.sufficiency, sufficiency, request.slice(0, 40));
    assert.equal(measured.mode, mode, request.slice(0, 40));
    assert.equal(state.sufficiency, sufficiency);
    assert.equal(state.mode, mode);
    assert.deepEqual(ids(planRound(state, BANK)), round, request.slice(0, 40));
  }
  const r3 = make(R3);
  assert.deepEqual(r3.unsupported.map((item) => item.kind), ["format"]);
  assert.match(r3.unsupported[0].message, /vertical/);
  assert.deepEqual(assess(r3).story_present, ["template", "points", "hook"]);
  assert.deepEqual(assess(r3).style_present, ["tone", "style", "closing"]);
  assert.equal(r3.fields.objective.source, "inferido", "the objective of a request with a story is the story's");
  assert.equal(r3.fields.subject.value, "marca em geral");
  const clinic = make(R3_CLINIC);
  assert.deepEqual([clinic.sufficiency, clinic.mode], ["completo", "complete"]);
  assert.equal(planRound(clinic, BANK), null);
  assert.deepEqual(clinic.fields.points.value, ["Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis"], "the opening and the ending lines are not points");
  assert.equal(clinic.fields.hook.value, "Seu sorriso novo em 90 dias");
  assert.equal(clinic.fields.closing.value.kind, "site");
  assert.deepEqual(fillDefaults(clinic, TEMPLATES_DATA).fields.closing.value, { kind: "site", text: "sorrisopleno.com.br" });
  const r4 = make(R4);
  assert.equal(r4.fields.template.value, "oferta");
  assert.equal(r4.fields.template.source, "inferido");
  assert.ok(assess(make(R1)).missing.includes("brand"));
  assert.ok(!assess(make(R2)).missing.includes("brand"));
});

test("a round is ready for a clickable tool and for a plain chat", () => {
  const round = planRound(make(R1), BANK);
  assert.equal(round.n, 1);
  assert.equal(round.title, "O vídeo");
  assert.equal(round.note, "Responda só o que quiser; o que ficar sem resposta, eu decido pelo que já sei.");
  // the brand has no options yet: it goes in text
  assert.deepEqual(round.ask_in_text.map((item) => item.id), ["marca"]);
  assert.equal(round.ask_user_question.length, 3);
  for (const item of round.ask_user_question) {
    assert.ok(item.header.length <= 12, item.header);
    assert.ok(item.options.length >= 2 && item.options.length <= 4, item.question);
    assert.match(item.options[0].label, / \(recomendado\)$/, "the recommended option comes first");
    for (const option of item.options) assert.ok(option.label && option.description, JSON.stringify(option));
  }
  const objetivo = round.questions.find((question) => question.id === "objetivo");
  assert.deepEqual(Object.keys(objetivo).sort(), ["default", "field", "free_text", "free_text_only", "header", "id", "multi", "note", "options", "round", "stage", "text"].sort());
  assert.equal(objetivo.field, "objective");
  assert.equal(objetivo.round, 1);
  assert.equal(objetivo.default, "apresentar");
  assert.deepEqual(objetivo.options.map((option) => option.value), ["apresentar", "vender", "explicar", "portfolio"]);
  const onde = round.questions.find((question) => question.id === "onde");
  assert.equal(onde.multi, true);
  assert.deepEqual(onde.default, ["reels", "tiktok", "shorts"]);
  assert.equal(round.ask_user_question.find((item) => item.header === "Onde postar").multiSelect, true);
  const marca = round.questions.find((question) => question.id === "marca");
  assert.equal(marca.free_text_only, true);
  assert.deepEqual(marca.options, []);
  assert.match(marca.text, /^De qual marca ou negócio é o vídeo\? Mande o site, o @ ou só o nome, que eu procuro\.$/);
  // the chat: numbered questions, lettered options, the default marked, the closing line
  const chat = round.chat_text;
  assert.match(chat, /^O vídeo\n\n1\. De qual marca/);
  assert.match(chat, /\n2\. O que este vídeo precisa fazer\?\n {3}a\) Apresentar e levar ao site \(padrão\)\n {3}b\) Vender uma oferta ou novidade\n/);
  assert.match(chat, /\n4\. Quanto tempo de vídeo\?\n {3}a\) 15 segundos \(padrão\)\n {3}b\) 20 segundos\n {3}c\) 10 segundos\n/);
  assert.ok(chat.endsWith('Responda só o que quiser mudar (por exemplo, 2b) ou "ok" para seguir com os padrões.'), chat);
  // a member who wants to sell gets 20 seconds as the recommended length
  const seller = make("Faça um anúncio animado");
  assert.deepEqual(ids(planRound(seller, BANK)), ["marca", "onde", "duracao"]);
  const duracao = planRound(seller, BANK).questions.find((question) => question.id === "duracao");
  assert.equal(duracao.default, "20");
  assert.equal(duracao.options[0].value, "20");
});

test("the partial round asks at most three questions, by priority, and waits for the site when it needs it", () => {
  // brand and objective known, one story field: the round follows marca > assunto > objetivo > pontos > onde > duracao > som
  const state = make("Vídeo de lançamento da lojax.com.br");
  assert.equal(state.mode, "partial");
  assert.equal(planRound(state, BANK), null, "the points need the site first");
  assert.equal(nextStep(state, { scriptCommand: SCRIPT }).action, "capture");
  assert.match(linha(state), /Antes, visito o site e faço até três perguntas rápidas\.$/);
  const after = captured(state, KIT);
  const round = planRound(after, BANK, { kit: KIT });
  assert.deepEqual(ids(round), ["assunto", "pontos", "onde"]);
  assert.equal(round.title, "Antes de começar");
  assert.deepEqual(round.questions.find((question) => question.id === "pontos").options.map((option) => option.value), ["Linha Easy", "Tabela de tamanhos", "Frete grátis acima de R$ 199", "outras"]);
  // once answered (or decided), nothing more is asked: the rest are defaults stated in the line
  const decided = decideRound(after, BANK, { kit: KIT, now: NOW });
  assert.equal(planRound(decided, BANK, { kit: KIT }), null);
  assert.equal(nextStep(decided, { scriptCommand: SCRIPT }).action, "build", "no brief approval in the partial mode");
});

test("R2: the objective, then the site, then the story and the style", () => {
  let state = make(R2);
  assert.equal(state.slug, "lojax-animado");
  show(state);
  state = answer(state, { objetivo: "vender" });
  assert.equal(state.fields.objective.value, "vender");
  assert.equal(state.fields.template.value, "oferta", "the story follows the stated objective");
  assert.equal(state.fields.template.source, "inferido");
  assert.equal(planRound(state, BANK), null, "round 2 waits for the capture");
  assert.deepEqual(nextStep(state, { scriptCommand: SCRIPT }), {
    action: "capture",
    command: `${SCRIPT} capture lojax-animado --json`,
    say: "Vou visitar lojax.com.br para pegar o logo, as cores e as telas reais; leva um ou dois minutos.",
  });
  state = captured(state, KIT);
  const second = show(state, KIT);
  assert.deepEqual(ids(second), ["assunto", "roteiro"], "an offer has no points and no proof scene to ask about");
  const roteiro = second.questions.find((question) => question.id === "roteiro");
  assert.equal(roteiro.default, "oferta");
  assert.deepEqual(roteiro.options.map((option) => option.value), ["oferta", "lancamento", "lista", "ideia"]);
  const assunto = second.questions.find((question) => question.id === "assunto");
  assert.deepEqual(assunto.options.map((option) => option.label), ["A marca em geral", "Top Fitness Easy", "Legging Nova Coleção", "Outro: produto ou promoção"]);
  state = answer(state, { assunto: "b", roteiro: "ok" });
  assert.equal(state.fields.subject.value, "Top Fitness Easy");
  assert.equal(state.fields.template.source, "padrao");
  const third = show(state, KIT);
  assert.deepEqual(ids(third), ["sentimento", "referencia", "som", "fechamento"]);
  assert.equal(third.questions.find((question) => question.id === "sentimento").default, "vontade");
  assert.equal(third.questions.find((question) => question.id === "referencia").options[0].label, "Não: use o estilo “vitrine”");
  const fechamento = third.questions.find((question) => question.id === "fechamento");
  assert.deepEqual(fechamento.options.map((option) => option.label), ["Logo e lojax.com.br", "Logo e @lojax", "Logo e “Chama no WhatsApp”", "Escrevo a minha"]);
});

test("the guided brief of 'Faça um vídeo animado', from the first round to the echo", () => {
  let state = make(R1);
  assert.equal(state.slug, "video-animado");
  assert.deepEqual(nextStep(state, { scriptCommand: SCRIPT }), {
    action: "ask",
    command: null,
    say: "Tenho quatro perguntas rápidas sobre o vídeo.",
    answer_command: `${SCRIPT} answer video-animado <id> <valor> --json`,
    decide_command: `${SCRIPT} answer video-animado --decide --json`,
  });
  show(state);
  state = answer(state, { marca: "lojax.com.br", objetivo: "1", onde: "a, b, c", duracao: "15" });
  assert.deepEqual(state.fields.brand.value, { name: null, site: "https://lojax.com.br", handle: null });
  assert.equal(state.brand.found_by, "resposta");
  assert.equal(state.brand.confirmed, true);
  assert.equal(state.rounds[0].answered, true);
  assert.equal(nextStep(state, { scriptCommand: SCRIPT }).action, "capture");
  state = captured(state, KIT);
  const second = show(state, KIT);
  assert.deepEqual(ids(second), ["assunto", "roteiro", "pontos", "numero"]);
  assert.equal(second.questions.find((question) => question.id === "numero").text, "Achei este número no seu site: “+12 mil clientes”. Posso mostrar?");
  assert.deepEqual(second.questions.find((question) => question.id === "pontos").default, ["Linha Easy", "Tabela de tamanhos", "Frete grátis acima de R$ 199"]);
  assert.match(second.questions.find((question) => question.id === "roteiro").options[0].description, /^O problema em poucas palavras/);
  state = answer(state, { assunto: "a", roteiro: "1", pontos: "ok", numero: "ok" }, KIT);
  assert.equal(state.fields.proof.source, "captura");
  assert.equal(state.fields.proof.value.source, "lojax.com.br (página inicial, 2026-10-07)");
  const third = show(state, KIT);
  assert.deepEqual(ids(third), ["sentimento", "referencia", "som", "fechamento"]);
  state = answer(state, { sentimento: "vontade", referencia: "a", som: "1", fechamento: "a" }, KIT);
  assert.equal(planRound(state, BANK, { kit: KIT }), null);
  assert.equal(state.asked.length, 12);
  assert.equal(nextStep(state, { scriptCommand: SCRIPT }).command, `${SCRIPT} brief video-animado --json`);

  const brief = echo(state, TEMPLATES_DATA);
  assert.deepEqual(brief.lines, [
    "Vou fazer um vídeo animado de 15 s da Loja X (lojax.com.br), na vertical para Reels, TikTok e Shorts, para apresentar a loja e levar ao site.",
    "História: abre com “Roupa de treino que dura” em letras grandes; a loja aparece com as telas reais do site se montando; três momentos: “Linha Easy”, “Tabela de tamanhos” e “Frete grátis acima de R$ 199”; o número “+12 mil clientes” (da página inicial do site); fecha no logo com lojax.com.br.",
    "Tom: vontade de comprar.",
    "Trilha original na batida, com cliques de interface.",
    "Estilo: a interface conta a história.",
    "Prévia em uns 12 minutos.",
  ]);
  assert.equal(brief.text, brief.lines.join("\n"));
  assert.equal(brief.question.id, "aprovar_briefing");
  assert.equal(brief.question.text, "Posso construir assim?");
  assert.deepEqual(brief.question.options.map((option) => option.label), ["Pode construir", "Quero mudar algo"]);
  assert.equal(brief.question.ask_user_question[0].options[0].label, "Pode construir (recomendado)");
  assert.match(brief.markdown, /^# Briefing: Loja X · lançamento\n/);
  assert.match(brief.markdown, /\n## De onde veio cada decisão\n\n\| Decisão \| Valor \| De onde veio \|\n\|---\|---\|---\|\n/);
  assert.match(brief.markdown, /\| Marca \| Loja X \(lojax\.com\.br\) \| você respondeu \|/);
  assert.match(brief.markdown, /\| O que mostrar \| Linha Easy; Tabela de tamanhos; Frete grátis acima de R\$ 199 \| achei no site \|/);
  assert.match(brief.markdown, /\| Número \| “\+12 mil clientes”, publicado em lojax\.com\.br \(página inicial, 2026-10-07\) \| achei no site \|/);
  assert.match(brief.markdown, /\| Prévia \| você vê a prévia antes do vídeo final \| padrão \|/);

  state.status = "brief";
  assert.deepEqual(nextStep(state, { scriptCommand: SCRIPT }), { action: "approve_brief", command: null, say: "Posso construir assim?", after_yes: `${SCRIPT} approve video-animado brief --json` });
  // a change after the brief was shown: the member sees the new brief before the yes
  const changed = answer(state, { sentimento: "surpresa" }, KIT);
  assert.equal(nextStep(changed, { scriptCommand: SCRIPT }).action, "echo");
  assert.match(echo(changed, TEMPLATES_DATA).lines[2], /^Tom: surpresa/);
});

test("decida por mim: the round takes its defaults; the brand is the one thing never decided", () => {
  const first = decideRound(make(R1), BANK, { now: NOW });
  assert.equal(first.fields.objective.value, "apresentar");
  assert.equal(first.fields.objective.source, "padrao");
  assert.deepEqual(first.fields.destinations.value, ["reels", "tiktok", "shorts"]);
  assert.equal(first.fields.duration.value, 15);
  assert.equal(first.fields.brand, undefined);
  assert.deepEqual(ids(planRound(first, BANK)), ["marca"], "only the brand is left");
  assert.ok(first.answers.every((entry) => entry.decided === true));
  // with the brand given, the same --decide closes the round and goes to the site
  let state = answer(make(R1), { marca: "https://lojax.com.br" });
  state = decideRound(state, BANK, { now: NOW });
  assert.equal(state.rounds[0].answered, true);
  assert.equal(nextStep(state, { scriptCommand: SCRIPT }).action, "capture");
  // round 2, decided: everything comes from the site, nothing is invented
  state = decideRound(captured(state, KIT), BANK, { kit: KIT, now: NOW });
  assert.equal(state.fields.subject.value, "marca em geral");
  assert.equal(state.fields.template.value, "lancamento");
  assert.deepEqual(state.fields.points.value, ["Linha Easy", "Tabela de tamanhos", "Frete grátis acima de R$ 199"]);
  assert.equal(state.fields.points.source, "captura");
  assert.equal(state.fields.proof.value.text, "+12 mil clientes");
  assert.deepEqual(ids(planRound(state, BANK, { kit: KIT })), ["sentimento", "referencia", "som", "fechamento"]);
  // "o resto decide você": the later rounds are decided too
  const rest = decideRound(answer(make(R1), { marca: "lojax.com.br" }), BANK, { now: NOW, all: true });
  assert.equal(rest.decide_all, true);
  const afterSite = captured(rest, KIT);
  assert.equal(planRound(afterSite, BANK, { kit: KIT }), null);
  assert.equal(nextStep(afterSite, { scriptCommand: SCRIPT }).action, "echo");
  assert.match(echo(afterSite, TEMPLATES_DATA).lines[1], /três momentos: “Linha Easy”/);
  // without a site and without a list, the points are still asked: nothing to decide them from
  const blank = decideRound(make('Quero um vídeo animado sem marca, só com a frase "Bom dia, time"'), BANK, { now: NOW, all: true });
  assert.deepEqual(ids(planRound(blank, BANK)), ["pontos"]);
  assert.equal(planRound(blank, BANK).questions[0].free_text_only, true);
});

test("applyAnswers takes values, numbers, letters, labels, free text and lists, and refuses the rest", () => {
  const base = make(R1);
  const pick = (answers) => answer(base, answers);
  assert.equal(pick({ objetivo: "vender" }).fields.objective.value, "vender");
  assert.equal(pick({ objetivo: "2" }).fields.objective.value, "vender");
  assert.equal(pick({ objetivo: "c" }).fields.objective.value, "explicar");
  assert.equal(pick({ objetivo: "C)" }).fields.objective.value, "explicar");
  assert.equal(pick({ objetivo: "Mostrar meu trabalho" }).fields.objective.value, "portfolio");
  assert.equal(pick({ objetivo: "Apresentar e levar ao site (recomendado)" }).fields.objective.value, "apresentar");
  const free = pick({ objetivo: "quero lançar meu curso novo" });
  assert.equal(free.fields.objective.value, "lancar");
  assert.equal(free.fields.objective.note, "quero lançar meu curso novo");
  assert.equal(free.fields.objective.source, "resposta");
  assert.equal(free.fields.objective.evidence, "quero lançar meu curso novo");
  assert.deepEqual(pick({ onde: "a, c" }).fields.destinations.value, ["reels", "shorts"]);
  assert.deepEqual(pick({ onde: "Reels do Instagram; TikTok" }).fields.destinations.value, ["reels", "tiktok"]);
  assert.deepEqual(pick({ onde: "Instagram e TikTok" }).fields.destinations.value, ["reels", "tiktok"]);
  assert.deepEqual(pick({ onde: ["tiktok"] }).fields.destinations.value, ["tiktok"]);
  assert.deepEqual(pick({ onde: "todos" }).fields.destinations.value, ["reels", "tiktok", "shorts"]);
  assert.equal(pick({ duracao: "20" }).fields.duration.value, 20);
  assert.equal(pick({ duracao: "8" }).fields.duration.value, 8);
  assert.equal(pick({ duracao: "12 segundos" }).fields.duration.value, 12);
  const long = pick({ duracao: "45" });
  assert.equal(long.fields.duration.value, 20);
  assert.ok(long.unsupported.some((item) => item.kind === "long"));
  // "ok" and an empty answer take the default, with source padrao
  for (const raw of ["ok", "", "OK", "padrão"]) {
    const state = pick({ objetivo: raw });
    assert.equal(state.fields.objective.value, "apresentar", raw);
    assert.equal(state.fields.objective.source, "padrao", raw);
  }
  assert.deepEqual(pick({ onde: "ok" }).fields.destinations.value, ["reels", "tiktok", "shorts"]);
  // the answers are logged with their time
  const logged = pick({ objetivo: "vender", duracao: "b" });
  assert.deepEqual(logged.answers.filter((entry) => !entry.decided).map((entry) => [entry.id, entry.value, entry.at]), [["objetivo", "vender", NOW], ["duracao", "20", NOW]], "b is the second option as the member saw it");
  // an answer records only itself: the rest of the round waits for more answers or for --decide
  const shownRound = clone(base);
  show(shownRound);
  const reply = answer(shownRound, { objetivo: "vender" });
  assert.deepEqual(reply.answers.map((entry) => entry.id), ["objetivo"]);
  assert.deepEqual(ids(planRound(reply, BANK)), ["marca", "onde", "duracao"]);
  assert.equal(planRound(reply, BANK).questions.find((question) => question.id === "duracao").default, "20", "a sale gets 20 seconds");
  const half = nextStep(reply, { scriptCommand: SCRIPT });
  assert.equal(half.action, "ask");
  assert.match(half.hint, /answer video-animado --decide --json/);
  assert.equal(nextStep(shownRound, { scriptCommand: SCRIPT }).hint, undefined, "no hint before any reply");
  const rest = decideRound(reply, BANK, { now: NOW });
  assert.deepEqual([rest.fields.duration.value, rest.fields.duration.source], [20, "padrao"]);
  assert.deepEqual(ids(planRound(rest, BANK)), ["marca"], "the brand is never decided");
  // refusals: a stable code and nothing recorded
  const refused = applyAnswers(base, { objetivo: "vender", onde: "LinkedIn" }, BANK, { now: NOW });
  assert.deepEqual(refused.errors.map((error) => [error.id, error.code]), [["onde", "answer_invalid"]]);
  assert.deepEqual(refused.state, base, "an invalid answer records nothing");
  assert.equal(applyAnswers(base, { duracao: "muito" }, BANK, { now: NOW }).errors[0].code, "answer_invalid");
  assert.equal(applyAnswers(base, { som: "um rock pesado" }, BANK, { now: NOW }).errors[0].code, "answer_invalid");
  const unknown = applyAnswers(base, { cor: "azul" }, BANK, { now: NOW });
  assert.deepEqual(unknown.errors.map((error) => [error.id, error.code]), [["cor", "question_unknown"]]);
  const approval = applyAnswers(base, { aprovar_briefing: "pode" }, BANK, { now: NOW });
  assert.equal(approval.errors[0].code, "question_unknown");
  assert.match(approval.errors[0].message, /approve/);
  assert.equal(applyAnswers(base, { marca: "ok" }, BANK, { now: NOW }).errors[0].code, "answer_invalid", "the brand has no default");
  for (const error of [...refused.errors, ...unknown.errors]) assert.ok(error.message.length > 10);
});

test("the brand as an address, an @, a name, a saved brand or none", () => {
  const base = make(R1);
  const site = answer(base, { marca: "https://www.lojax.com.br/?utm_source=bio" });
  assert.deepEqual(site.fields.brand.value, { name: null, site: "https://www.lojax.com.br", handle: null });
  assert.deepEqual([site.brand.found_by, site.brand.confirmed, site.brand.slug], ["resposta", true, "lojax"]);
  const handle = answer(base, { marca: "@doces.da.ana" });
  assert.deepEqual(handle.fields.brand.value, { name: null, site: null, handle: "@doces.da.ana" });
  assert.equal(handle.brand.found_by, "busca");
  assert.equal(handle.brand.confirmed, false);
  const named = answer(base, { marca: "É a Padaria do Zé" });
  assert.equal(named.fields.brand.value.name, "Padaria do Zé");
  assert.equal(named.fields.brand.value.article, "a");
  assert.equal(named.brand.found_by, "busca");
  const both = answer(base, { marca: "Loja X, lojax.com.br" });
  assert.deepEqual([both.fields.brand.value.name, both.fields.brand.value.site, both.brand.found_by], ["Loja X", "https://lojax.com.br", "resposta"]);
  const noSite = answer(base, { marca: "Doces da Ana, não tem site" });
  assert.deepEqual([noSite.fields.brand.value.name, noSite.brand.found_by, noSite.brand.confirmed], ["Doces da Ana", "resposta", true]);
  // a name that matches the saved brand takes its site and needs no search
  const saved = applyAnswers(base, { marca: "Loja X" }, BANK, { kit: KIT, now: NOW }).state;
  assert.equal(saved.fields.brand.value.site, "https://lojax.com.br");
  assert.equal(saved.brand.found_by, "resposta");
  const none = answer(base, { marca: "sem marca" });
  assert.deepEqual(none.fields.brand.value, { name: null, site: null, handle: null });
  assert.equal(none.brand.confirmed, true);
  assert.equal(nextStep(decideRound(none, BANK, { now: NOW }), { scriptCommand: SCRIPT }).action, "ask", "no site to visit: the story comes next");
  // several saved brands: they become the options
  const many = make(R1, { kits: [{ slug: "lojax", name: "Loja X", site: "https://lojax.com.br" }, { slug: "aurora", name: "Estúdio Aurora", site: "https://aurora.studio" }] });
  const marca = planRound(many, BANK).questions.find((question) => question.id === "marca");
  assert.equal(marca.free_text_only, false);
  assert.deepEqual(marca.options.map((option) => option.label), ["Loja X", "Estúdio Aurora", "Sem marca"]);
  assert.equal(marca.default, "marca:lojax");
  const chosen = answer(many, { marca: "b" });
  assert.deepEqual([chosen.fields.brand.value.name, chosen.fields.brand.value.site, chosen.brand.slug], ["Estúdio Aurora", "https://aurora.studio", "aurora"]);
});

test("the brand found by search is confirmed before the story", () => {
  let state = make("Faz um vídeo da Loja X");
  assert.equal(state.brand.found_by, "busca");
  show(state);
  state = decideRound(state, BANK, { now: NOW });
  const search = nextStep(state, { scriptCommand: SCRIPT });
  assert.equal(search.action, "capture");
  assert.equal(search.command, `${SCRIPT} capture loja-x-animado --url <endereço do site> --json`);
  assert.match(search.say, /^Vou procurar o site oficial da Loja X/);
  state = captured(state, KIT);
  state.brand.confirmed = false;
  assert.equal(planRound(state, BANK, { kit: KIT }), null, "the story waits for the yes");
  const confirm = nextStep(state, { scriptCommand: SCRIPT });
  assert.equal(confirm.action, "confirm_brand");
  assert.equal(confirm.command, null);
  assert.equal(confirm.say, "Achei Loja X em lojax.com.br. É esta a sua marca?");
  const question = questionFor(BANK, "conferir_marca", { state, kit: KIT });
  assert.deepEqual(question.options.map((option) => option.value), ["sim", "materiais", "outro-site"], "the option that asks for words comes last");
  const yes = answer(state, { conferir_marca: "sim" }, KIT);
  assert.equal(yes.brand.confirmed, true);
  assert.deepEqual(ids(planRound(yes, BANK, { kit: KIT })), ["assunto", "roteiro", "pontos", "numero"]);
  // another address: the capture of the wrong brand leaves the brief
  const other = answer(state, { conferir_marca: "o certo é lojaxis.com.br" }, KIT);
  assert.deepEqual([other.fields.brand.value.site, other.brand.found_by, other.files.kit], ["https://lojaxis.com.br", "resposta", false]);
  assert.equal(other.fields.hook, undefined, "the headline of the wrong site is gone");
  assert.equal(nextStep(other, { scriptCommand: SCRIPT }).action, "capture");
  // "no" without an address: the brand is asked again
  const no = answer(state, { conferir_marca: "outro-site" }, KIT);
  assert.equal(no.fields.brand, undefined);
  assert.deepEqual(ids(planRound(no, BANK)), ["marca"]);
});

test("the reference video: named styles, a link, and one sentence about it", () => {
  let state = make(R1);
  state = answer(state, { marca: "lojax.com.br", objetivo: "ok", onde: "ok", duracao: "ok" });
  state = decideRound(captured(state, KIT), BANK, { kit: KIT, now: NOW });
  const other = answer(state, { referencia: "b" }, KIT);
  const follow = planRound(other, BANK, { kit: KIT });
  assert.deepEqual(ids(follow), ["sentimento", "som", "fechamento", "estilo"]);
  assert.equal(follow.title, "O jeito");
  const estilo = follow.questions.find((question) => question.id === "estilo");
  assert.equal(estilo.options.length, 4);
  assert.ok(!estilo.options.some((option) => option.value === "interface-narra"), "the recommended style is not repeated");
  assert.equal(answer(other, { estilo: "Vitrine" }, KIT).fields.style.value, "vitrine");
  // a link given in the round: the sentence about it is asked next
  const link = answer(state, { referencia: "https://www.youtube.com/watch?v=abc123XYZ" }, KIT);
  assert.deepEqual(link.fields.style.value, { reference: "https://www.youtube.com/watch?v=abc123XYZ", description: null });
  const asked = planRound(link, BANK, { kit: KIT });
  assert.ok(ids(asked).includes("referencia_descricao"));
  const sentence = asked.questions.find((question) => question.id === "referencia_descricao");
  assert.equal(sentence.free_text_only, true);
  assert.equal(sentence.text, "Nesta versão eu ainda não assisto a vídeos de referência. Em uma frase, o que você gosta nele (o ritmo, as cores, o jeito do texto)?");
  const described = answer(link, { referencia_descricao: "as letras grandes entrando na batida" }, KIT);
  assert.deepEqual(described.fields.style.value, { reference: "https://www.youtube.com/watch?v=abc123XYZ", description: "as letras grandes entrando na batida", base: "tipografia-cinetica" });
  const filled = fillDefaults(described, TEMPLATES_DATA, { kit: KIT });
  assert.equal(filled.fields.style.value, "tipografia-cinetica");
  assert.deepEqual(filled.fields.style.reference, { url: "https://www.youtube.com/watch?v=abc123XYZ", description: "as letras grandes entrando na batida" });
  assert.match(echo(described, TEMPLATES_DATA).lines[4], /^Estilo: letras em movimento\. Do vídeo de referência, levo o que você descreveu: “as letras grandes entrando na batida”\.$/);
  // "I have one" without the link: the link and the sentence in one question
  const without = answer(state, { referencia: "c" }, KIT);
  const text = planRound(without, BANK, { kit: KIT }).questions.find((question) => question.id === "referencia_descricao").text;
  assert.match(text, /^Nesta versão eu ainda não assisto a vídeos de referência\. Cole o link/);
  // a link in the request itself: round 3 asks for the sentence instead of the reference question
  let fromRequest = make("Faz um vídeo da Loja X (lojax.com.br) no estilo deste vídeo: https://www.youtube.com/watch?v=abc123XYZ");
  fromRequest = decideRound(fromRequest, BANK, { now: NOW });
  fromRequest = decideRound(captured(fromRequest, KIT), BANK, { kit: KIT, now: NOW });
  assert.deepEqual(ids(planRound(fromRequest, BANK, { kit: KIT })), ["sentimento", "som", "fechamento", "referencia_descricao"]);
});

test("never more than 12 questions, never more than 4 per round", () => {
  // the whole guided path, every question asked
  let state = make(R1);
  const seen = [];
  const take = (kit) => {
    const round = show(state, kit);
    if (round) {
      assert.ok(round.questions.length <= 4);
      seen.push(...ids(round));
    }
    return round;
  };
  take();
  state = answer(state, { marca: "lojax.com.br" });
  state = decideRound(state, BANK, { now: NOW });
  state = captured(state, KIT);
  take(KIT);
  state = decideRound(state, BANK, { kit: KIT, now: NOW });
  take(KIT);
  state = decideRound(state, BANK, { kit: KIT, now: NOW });
  assert.equal(planRound(state, BANK, { kit: KIT }), null);
  assert.equal(seen.length, 12);
  assert.equal(new Set(seen).size, 12);
  // a bank with more questions than fit: the cap holds
  const big = clone(BANK);
  for (const [n, stage] of [[1, "round1"], [2, "round2"], [3, "round2"], [4, "round3"]]) {
    big.questions.push({ id: `extra${n}`, field: "skip_preview", stage, header: "Extra", text: `Pergunta extra ${n}?`, options: [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }], default: "sim", multi: false, free_text: false, priority: 50 + n, ask_when: { note: "" }, skip_when: { note: "", sources: ["pedido", "resposta"] } });
  }
  let crowded = make(R1);
  const asked = [];
  for (let guard = 0; guard < 10; guard++) {
    const round = planRound(crowded, big, { kit: KIT });
    if (!round) break;
    assert.ok(round.questions.length <= 4);
    asked.push(...ids(round));
    crowded.rounds.push({ n: round.n, ids: ids(round), at: NOW, answered: false });
    crowded.asked.push(...ids(round));
    const answers = Object.fromEntries(ids(round).map((id) => [id, id === "marca" ? "lojax.com.br" : "ok"]));
    crowded = applyAnswers(crowded, answers, big, { kit: KIT, now: NOW }).state;
    if (guard === 0) crowded = captured(crowded, KIT);
  }
  assert.ok(asked.length <= 12, `${asked.length}: ${asked.join(", ")}`);
  assert.equal(asked.length, 12);
});

// ---------------------------------------------------------------------------
// The site of the brand and the defaults
// ---------------------------------------------------------------------------

test("mergeKit brings the site in with source captura and never replaces what the member said", () => {
  const merged = mergeKit(make(R2), KIT);
  assert.equal(merged.fields.hook.value, "Roupa de treino que dura");
  assert.equal(merged.fields.hook.source, "captura");
  assert.match(merged.fields.hook.evidence, /^título do site: “Roupa de treino que dura muito mais/);
  assert.deepEqual(merged.fields.points.value, ["Linha Easy", "Tabela de tamanhos", "Frete grátis acima de R$ 199"]);
  assert.deepEqual(merged.fields.proof.value, { text: "+12 mil clientes", value: 12000, source: "lojax.com.br (página inicial, 2026-10-07)", page: "página inicial" });
  assert.deepEqual(merged.fields.closing.value, { kind: "site", text: "lojax.com.br" });
  assert.equal(merged.fields.brand.value.name, "Loja X");
  assert.equal(merged.fields.brand.source, "pedido", "the brand stays the member's");
  assert.equal(merged.files.kit, true);
  assert.deepEqual(merged.candidates.numbers, [{ text: "+12 mil clientes", value: 12000, page: "página inicial" }]);
  // the member's own words stay
  const own = mergeKit(make('Vídeo da lojax.com.br. Abre com "Treino sem desculpa". Mostra: frete, troca e parcelas. Fecha com link na bio'), KIT);
  assert.equal(own.fields.hook.value, "Treino sem desculpa");
  assert.deepEqual(own.fields.points.value, ["frete", "troca", "parcelas"]);
  assert.deepEqual(own.fields.closing.value, { kind: "bio", text: "Link na bio" });
  // a kit with nothing in it breaks nothing, and invents nothing
  for (const kit of [{}, { name: "Só o nome" }, { headline: "", sections: null, numbers: "x", products: [null] }]) {
    const state = mergeKit(make(R2), kit);
    assert.equal(state.fields.proof, undefined);
    assert.equal(state.fields.points, undefined);
  }
  assert.deepEqual(mergeKit(make(R2), null).fields, make(R2).fields);
});

test("fillDefaults gives every field a value and a source, and never invents a number", () => {
  const empty = fillDefaults(make(R1), TEMPLATES_DATA);
  assert.deepEqual(Object.fromEntries(Object.entries(empty.fields).map(([name, entry]) => [name, entry.value])), {
    objective: "apresentar",
    subject: "marca em geral",
    destinations: ["reels", "tiktok", "shorts"],
    duration: 15,
    template: "lancamento",
    points: [],
    proof: null,
    tone: "confianca",
    style: "tipografia-cinetica",
    music: { mode: "music", style: "clean", file: null, effects: true },
    closing: { kind: "bio", text: "Link na bio" },
    skip_preview: false,
  });
  for (const entry of Object.values(empty.fields)) assert.equal(entry.source, "padrao");
  const seller = fillDefaults(answer(make(R2), { objetivo: "vender" }), TEMPLATES_DATA);
  assert.deepEqual([seller.fields.duration.value, seller.fields.template.value, seller.fields.tone.value, seller.fields.style.value, seller.fields.music.value.style], [15, "oferta", "vontade", "vitrine", "energetic"], "the request said 15 s");
  assert.equal(fillDefaults(answer(make(R1), { objetivo: "vender" }), TEMPLATES_DATA).fields.duration.value, 20);
  const site = fillDefaults(make(R2), TEMPLATES_DATA, { kit: KIT });
  assert.equal(site.fields.hook.source, "captura");
  assert.equal(site.fields.points.source, "captura");
  assert.equal(site.fields.proof.source, "captura");
  assert.equal(site.fields.style.value, "interface-narra", "with a site, the real screens tell the story");
  assert.deepEqual(site.fields.closing.value, { kind: "site", text: "lojax.com.br" });
  // the number that proves something comes first; a discount is never a proof
  const ordered = fillDefaults(make(R2), TEMPLATES_DATA, { kit: { ...KIT, numbers: [{ text: "20% OFF", value: 20, page: "página inicial" }, { text: "garantia de 10 anos", value: 10, page: "página /garantia" }, { text: "97% de aprovação", value: 97, page: "página /resultados" }] } });
  assert.deepEqual(ordered.fields.proof.value, { text: "97% de aprovação", value: 97, source: "lojax.com.br (página /resultados, 2026-10-07)", page: "página /resultados" });
  const onlyOther = fillDefaults(make(R2), TEMPLATES_DATA, { kit: { ...KIT, numbers: [{ text: "garantia de 10 anos", value: 10, page: "página inicial" }] } });
  assert.equal(onlyOther.fields.proof.value.text, "garantia de 10 anos", "without a better one, the first published number");
  const noNumbers = fillDefaults(make(R2), TEMPLATES_DATA, { kit: { ...KIT, numbers: [] } });
  assert.equal(noNumbers.fields.proof.value, null);
  const silent = fillDefaults(make("Vídeo da lojax.com.br sem som"), TEMPLATES_DATA);
  assert.deepEqual(silent.fields.music.value, { mode: "none", style: null, file: null, effects: false });
  for (const state of [empty, seller, site]) for (const entry of Object.values(state.fields)) assert.ok(["pedido", "resposta", "captura", "marca", "projeto", "inferido", "padrao"].includes(entry.source));
});

// ---------------------------------------------------------------------------
// The one-line plan and the brief
// ---------------------------------------------------------------------------

test("linha: the spec's sentence for a complete request, at most 300 characters", () => {
  const complete = make('Faz um vídeo de lançamento de 15 segundos da Loja X (lojax.com.br) para Reels, TikTok e Shorts. Abre com "Roupa de treino que dura". Mostra: linha Easy, tabela de tamanhos e frete grátis.');
  assert.equal(complete.mode, "complete");
  assert.equal(
    linha(complete),
    "Vou fazer um vídeo animado de 15 s da Loja X (lojax.com.br), na vertical para Reels, TikTok e Shorts, com o logo, as cores e as telas reais do site, trilha original na batida e, no fim, o logo com lojax.com.br. Prévia em uns 10 minutos. Já comecei; se quiser mudar algo, é só dizer.",
  );
  assert.match(linha(make(R3), { minutes: 12 }), /^Vou fazer um vídeo animado de 20 s da marca Notion \(notion\.com\), .* Prévia em uns 12 minutos\. Já comecei; se quiser mudar algo, é só dizer\.$/);
  assert.equal(
    linha(make(R4)),
    "Vou fazer um anúncio animado de 20 s da insiderstore.com.br, na vertical para Reels, TikTok e Shorts, com o logo, as cores e as telas reais do site, trilha original na batida e, no fim, o logo com “Link na bio”. Prévia em uns 10 minutos.",
    "questions are pending: no 'Já comecei'",
  );
  assert.match(linha(make('Quero um vídeo animado sem marca, só com a frase "Bom dia, time"')), /, sem marca, .*em visual neutro/);
  for (const request of [R1, R2, R3, R4, B05, P1, P2, P4, ...PARSE_CASES.map((item) => item.text)]) {
    const line = linha(make(request), { minutes: 15 });
    assert.ok(line.length <= 300, `${line.length}: ${line}`);
    assert.match(line, /^Vou fazer um (?:vídeo|anúncio) animado de \d+ s/);
  }
});

test("echo for the other stories: an offer, a list, a list of states, no brand, a direct request", () => {
  const offer = echo(make("Quero um anúncio de 20 segundos da Loja X (lojax.com.br): casaco de lã por R$ 199 até domingo, fecha com 'link na bio'."), TEMPLATES_DATA);
  assert.equal(offer.lines[0], "Vou fazer um anúncio animado de 20 s da Loja X (lojax.com.br), na vertical para Reels, TikTok e Shorts, para vender casaco de lã por R$ 199 até domingo.");
  assert.equal(offer.lines[1], "História: abre com “Casaco de lã” em destaque; o preço “R$ 199” batendo na tela; o prazo “até domingo”; fecha no logo com “Link na bio”.");
  assert.equal(offer.lines[2], "Tom: vontade de comprar.");
  const list = echo(make("Faz um vídeo da Clínica Bem Estar com 3 dicas para cuidar da pele: beber água, usar protetor e dormir bem. Sem música, só efeitos."), TEMPLATES_DATA);
  assert.equal(list.lines[1], "História: abre com “Dicas para cuidar da pele”; três itens numerados, um por vez: “beber água”, “usar protetor” e “dormir bem”; fecha no nome da marca com “Link na bio”.");
  assert.equal(list.lines[3], "Sem música: só efeitos sonoros nos movimentos.");
  assert.equal(list.lines[4], "Estilo: letras em movimento.");
  const states = echo(make(B05), TEMPLATES_DATA);
  assert.match(states.lines[1], /^História: abre no logo; um único elemento muda de estado a cada batida, em seis passos: “página em branco/);
  assert.equal(states.lines[4], "Estilo: interface que se transforma.");
  const none = echo(make('Quero um vídeo animado sem marca, só com a frase "Bom dia, time"'), TEMPLATES_DATA);
  assert.equal(none.lines[0], "Vou fazer um vídeo animado de 15 s, sem marca, na vertical para Reels, TikTok e Shorts, para passar a sua mensagem.");
  assert.match(none.lines[1], /fecha com “Link na bio”\.$/);
  const direct = echo(make('Faz direto um vídeo de lançamento de 15 segundos da Loja X (lojax.com.br). Abre com "Roupa de treino que dura". Mostra: linha Easy, tabela de tamanhos e frete grátis.'), TEMPLATES_DATA);
  assert.equal(direct.lines[5], "Prévia em uns 12 minutos. Você pediu para eu seguir direto: faço a prévia, confiro e já renderizo o final.");
  for (const brief of [offer, list, states, none, direct]) {
    assert.ok(brief.lines.length <= 10);
    assert.match(brief.markdown, /## De onde veio cada decisão/);
    assert.equal(brief.question.id, "aprovar_briefing");
  }
  assert.match(list.markdown, /\| O que mostrar \| beber água; usar protetor; dormir bem \| você disse \|/);
  assert.match(offer.markdown, /\| Para que serve \| vender \| você disse \|/);
});

// ---------------------------------------------------------------------------
// The next step across the life of a video
// ---------------------------------------------------------------------------

test("nextStep follows the order of the contract, from the first question to the delivery", () => {
  const step = (state) => nextStep(state, { scriptCommand: SCRIPT });
  let state = make(R2);
  const actions = [];
  const record = () => actions.push(step(state).action);
  record(); // ask (round 1)
  show(state);
  state = answer(state, { objetivo: "ok" });
  record(); // capture
  state = captured(state, KIT);
  record(); // ask (round 2)
  show(state, KIT);
  state = decideRound(state, BANK, { kit: KIT, now: NOW });
  record(); // ask (round 3)
  show(state, KIT);
  state = decideRound(state, BANK, { kit: KIT, now: NOW });
  record(); // echo
  state.status = "brief";
  record(); // approve_brief
  state.approvals.brief = NOW;
  record(); // build
  state.status = "build";
  state.files.roteiro = true;
  record(); // preview
  state.status = "preview";
  state.files.preview = true;
  record(); // approve_preview
  assert.equal(step(state).after_yes, `${SCRIPT} approve lojax-animado preview --json`);
  state.approvals.preview = NOW;
  record(); // final
  state.status = "final";
  state.files.final = true;
  record(); // deliver
  assert.equal(step(state).command, `${SCRIPT} open lojax-animado final --json`);
  state.status = "delivered";
  record(); // done
  assert.deepEqual(actions, ["ask", "capture", "ask", "ask", "echo", "approve_brief", "build", "preview", "approve_preview", "final", "deliver", "done"]);
  // every command is complete; a question to the member has none
  const commands = { build: `${SCRIPT} build lojax-animado --json`, preview: `${SCRIPT} preview lojax-animado --json`, final: `${SCRIPT} final lojax-animado --json` };
  for (const [action, command] of Object.entries(commands)) {
    const at = { ...clone(state), status: action === "build" ? "brief" : "preview", files: { kit: true, roteiro: action !== "build", preview: action === "final", final: false }, approvals: { brief: NOW, preview: action === "final" ? NOW : null } };
    assert.deepEqual([step(at).action, step(at).command], [action, command]);
  }
  // the complete request: no brief to approve; "faz direto": no stop at the preview
  let complete = make(R3);
  assert.equal(step(complete).action, "capture");
  complete = captured(complete, { ...KIT, slug: "notion", name: "Notion", site: "https://www.notion.com", host: "notion.com" });
  assert.equal(step(complete).action, "build");
  const direct = { ...clone(complete), files: { kit: true, roteiro: true, preview: true, final: false } };
  direct.fields.skip_preview = { value: true, source: "pedido", evidence: "faz direto" };
  assert.equal(step(direct).action, "final");
  // a site that did not open: the video goes on without the capture
  const failed = { ...clone(make(R2)), capture: { failed: true, code: "site_blocked" } };
  failed.answers.push({ id: "objetivo", value: "apresentar", at: NOW });
  failed.files = { kit: true, roteiro: false, preview: false, final: false };
  assert.equal(step(failed).action, "ask");
  const story = planRound(failed, BANK);
  assert.deepEqual(ids(story), ["assunto", "roteiro", "pontos", "numero"]);
  assert.equal(story.questions[3].text, "Tem algum resultado que prove que funciona? Só uso número que você me der ou que esteja publicado.", "without the site there is no number to offer: the member is asked");
  assert.equal(story.questions[3].default, "nenhum");
  // no more questions once the video is being made
  const building = { ...clone(make(R1)), status: "build" };
  assert.equal(planRound(building, BANK), null);
});

// ---------------------------------------------------------------------------
// Timing and names
// ---------------------------------------------------------------------------

test("solveTiming: whole bars and a tempo between 100 and 140 BPM, closest to 120", () => {
  const table = [
    [15, 8, 128],
    [20, 10, 120],
    [6, 3, 120],
    [12, 6, 120],
    [10, 5, 120],
    [18, 9, 120],
    [16, 8, 120],
    [14, 7, 120],
    [8, 4, 120],
  ];
  for (const [seconds, bars, bpm] of table) {
    const timing = solveTiming(seconds);
    assert.deepEqual([timing.bars, timing.bpm], [bars, bpm], `${seconds} s`);
    assert.ok(Math.abs(timing.duration - seconds) <= 0.01, `${seconds} s`);
    assert.equal(timing.beat_s, Math.round((60 / bpm) * 1e6) / 1e6);
    assert.equal(timing.bar_s, Math.round((240 / bpm) * 1e6) / 1e6);
    assert.equal(timing.exact, true);
    assert.equal(timing.warning, null);
  }
  const longer = solveTiming(25);
  assert.deepEqual([longer.bars, longer.bpm, longer.duration, longer.exact], [10, 120, 20, false], "20 s is the maximum");
  assert.match(longer.warning, /de 6 a 20 segundos/);
  const odd = solveTiming(13);
  assert.equal(odd.exact, false);
  assert.equal(odd.bpm, 120);
  assert.equal(odd.duration, odd.bars * 2);
  assert.match(odd.warning, /compassos inteiros/);
  for (let seconds = 6; seconds <= 20; seconds++) {
    const timing = solveTiming(seconds);
    assert.ok(timing.bpm >= 100 && timing.bpm <= 140);
    assert.ok(Number.isInteger(timing.bars));
  }
});

test("slugFor: the brand and the kind of story, ASCII, at most 40 characters", () => {
  assert.equal(slugFor(make(R1)), "video-animado");
  assert.equal(slugFor(make(R2)), "lojax-animado");
  assert.equal(slugFor(make(R3)), "notion-lancamento");
  assert.equal(slugFor(make(R4)), "insiderstore-oferta");
  assert.equal(slugFor(make("Faz um vídeo da Clínica Sorriso Pleno com 3 dicas")), "clinica-sorriso-pleno-lista");
  assert.equal(slugFor(make("Um vídeo para os stories da @docesdaana")), "docesdaana-animado");
  assert.equal(slugFor(make("Vídeo de lançamento da Confeitaria Artesanal Doce Lembrança de Vovó Ana Maria")).length <= 40, true);
  assert.match(slugFor(make("Vídeo de lançamento da Confeitaria Artesanal Doce Lembrança de Vovó Ana Maria")), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(slugFor({ fields: { brand: { value: { name: "Loja X" }, source: "pedido" }, template: { value: "oferta" } }, brand: { slug: "minha-loja" } }), "minha-loja-oferta");
  assert.equal(make(R2, {}).slug, "lojax-animado");
  assert.equal(newState({ request: R2, slug: "Meu Vídeo!", now: NOW }).slug, "meu-video");
});

test("newState: what the project says about the brand, and an empty request", () => {
  const fromSite = make(R1, { site: "https://lojax.com.br" });
  assert.equal(fromSite.fields.brand.source, "projeto");
  assert.deepEqual(fromSite.brand, { slug: "lojax", kit: null, found_by: "projeto", confirmed: true });
  assert.ok(!ids(planRound(fromSite, BANK)).includes("marca"), "the brand of the project is not asked");
  const fromKit = make(R1, { kits: [{ slug: "lojax", name: "Loja X", site: "https://lojax.com.br" }] });
  assert.equal(fromKit.fields.brand.source, "marca");
  assert.equal(fromKit.brand.found_by, "projeto");
  assert.equal(fromKit.fields.brand.value.name, "Loja X");
  const named = make("Faz um vídeo da Loja X", { kits: [{ slug: "lojax", name: "Loja X", site: "https://lojax.com.br" }] });
  assert.equal(named.fields.brand.value.site, "https://lojax.com.br", "a saved brand with the same name gives its site");
  assert.equal(named.brand.found_by, "pedido");
  assert.throws(() => newState({ request: "   ", now: NOW }), (error) => error instanceof AppError && error.code === "request_empty");
  const state = make(R2);
  assert.deepEqual(Object.keys(state).sort(), ["answers", "app", "approvals", "asked", "brand", "created_at", "fields", "files", "format_version", "history", "mode", "next_step", "request", "rounds", "route", "signals", "slug", "status", "sufficiency", "unsupported", "updated_at"].sort());
  assert.deepEqual([state.format_version, state.route, state.status, state.created_at, state.app.name], [1, "motion", "intake", NOW, "video-studio"]);
  assert.equal(state.next_step.action, "ask");
});

test("every function is pure: the input is never changed and the same input gives the same output", () => {
  const states = [make(R1), make(R2), make(R3), make(R4), captured(make(R2), KIT)];
  for (const original of states) {
    const frozen = deepFreeze(clone(original));
    const kit = deepFreeze(clone(KIT));
    const runs = () => [
      assess(frozen),
      planRound(frozen, BANK, { kit }),
      applyAnswers(frozen, { objetivo: "vender", sentimento: "b" }, BANK, { kit, now: NOW }),
      decideRound(frozen, BANK, { kit, now: NOW }),
      fillDefaults(frozen, TEMPLATES_DATA, { kit }),
      mergeKit(frozen, kit),
      linha(frozen),
      echo(frozen, TEMPLATES_DATA),
      nextStep(frozen, { scriptCommand: SCRIPT }),
      slugFor(frozen),
    ];
    const first = runs();
    assert.deepEqual(runs(), first);
    assert.deepEqual(frozen, original);
  }
});

// ---------------------------------------------------------------------------
// The question bank
// ---------------------------------------------------------------------------

const FORBIDDEN = /\b(?:terminal|winget|npm|install|cta|hook|templates?|prompts?|claude|anthropic|hyperframes|remotion|puppeteer|playwright|github|operador|repositório)\b/i;

/** The texts of the bank a member or the member's AI reads: never the machine keys and values. */
function humanTexts(bank) {
  const texts = [bank.note, bank.decide_line, ...Object.values(bank.chat ?? {}), bank.partial?.title, bank.partial?.note, bank.story_order?.note, bank.unsupported?.note];
  for (const round of bank.rounds) texts.push(round.title);
  for (const [kind, message] of Object.entries(bank.unsupported ?? {})) if (kind !== "note") texts.push(message);
  for (const style of Object.values(bank.styles ?? {})) texts.push(style.label, style.description);
  for (const question of bank.questions) {
    texts.push(question.header, question.text, question.hint, question.free_text_hint, question.ask_when?.note, question.skip_when?.note);
    for (const option of [...question.options, ...(question.variants ?? []).flatMap((variant) => variant.options ?? [])]) texts.push(option.label, option.description);
    for (const variant of question.variants ?? []) texts.push(variant.text, variant.note);
  }
  return texts.filter((text) => typeof text === "string");
}

test("the question bank is complete, consistent and written for the member", () => {
  const raw = loadBank(APP_DIR);
  const questions = raw.questions;
  const seen = new Set();
  for (const question of questions) {
    assert.ok(!seen.has(question.id), `id repetido: ${question.id}`);
    seen.add(question.id);
    assert.ok(["round1", "round2", "round3", "confirm", "brief", "preview"].includes(question.stage), question.id);
    assert.ok(question.field === null || FIELDS.includes(question.field), `${question.id}: field ${question.field}`);
    assert.ok(question.header.length >= 1 && question.header.length <= 12, `${question.id}: header "${question.header}"`);
    assert.match(question.text, /\?|:$/, `${question.id}: o texto é uma pergunta`);
    assert.equal(typeof question.multi, "boolean", question.id);
    assert.equal(typeof question.free_text, "boolean", question.id);
    assert.ok(question.ask_when && typeof question.ask_when.note === "string", question.id);
    assert.ok(question.skip_when && typeof question.skip_when.note === "string", question.id);
    const fixed = question.options.filter((option) => !option.from);
    const always = fixed.filter((option) => !option.when);
    const dynamic = question.options.some((option) => option.from);
    // options with `when` are alternatives (the site, the @, WhatsApp): at most four are shown, checked below by rendering
    assert.ok(always.length <= 4, `${question.id}: ${always.length} opções sempre presentes`);
    if (!question.free_text_only && !dynamic) assert.ok(fixed.length >= 2, `${question.id}: ${fixed.length} opções`);
    for (const variant of question.variants ?? []) if (variant.options) assert.ok(variant.options.length >= 2 && variant.options.length <= 4, `${question.id}: variante`);
    if (typeof question.default === "string" && !dynamic) assert.ok(fixed.some((option) => option.value === question.default), `${question.id}: o padrão é uma das opções`);
    for (const option of fixed) assert.equal(typeof option.value, "string", question.id);
  }
  for (const stage of ["round1", "round2", "round3"]) assert.ok(questions.filter((question) => question.stage === stage && !question.follow_up_of).length <= 4, stage);
  // the ending, rendered for every kind of brand: two to four options, the real ones only
  const ending = (state, kit = null) => questionFor(raw, "fechamento", { state, kit }).options.map((option) => option.label);
  assert.deepEqual(ending(captured(make(R2), KIT), KIT), ["Logo e lojax.com.br", "Logo e @lojax", "Logo e “Chama no WhatsApp”", "Escrevo a minha"]);
  assert.deepEqual(ending(captured(make(R2), { ...KIT, social: {} }), { ...KIT, social: {} }), ["Logo e lojax.com.br", "Logo e @lojax", "Logo e “Link na bio”", "Escrevo a minha"]);
  assert.deepEqual(ending(make("Vídeo para os stories da @docesdaana")), ["Logo e @docesdaana", "Logo e “Link na bio”", "Escrevo a minha"]);
  assert.deepEqual(ending(make("Um vídeo animado sem marca")), ["Só “Link na bio”", "Escrevo a minha"]);
  for (const id of ["marca", "objetivo", "onde", "duracao", "assunto", "roteiro", "pontos", "numero", "sentimento", "referencia", "estilo", "referencia_descricao", "som", "fechamento", "conferir_marca", "aprovar_briefing", "previa_ok", "abertura", "outra_marca", "publi", "setor"]) assert.ok(seen.has(id), id);
  assert.deepEqual(raw.partial.priority, ["marca", "assunto", "objetivo", "pontos", "onde", "duracao", "som"]);
  assert.equal(raw.decide_line, "Responda só o que quiser; o que ficar sem resposta, eu decido pelo que já sei.");
  assert.deepEqual(Object.keys(raw.styles).sort(), [...STYLES].sort());
  for (const kind of ["edit", "generated", "format", "reference_study", "long"]) assert.ok(raw.unsupported[kind], kind);
  for (const objective of OBJECTIVES) assert.ok(raw.story_order[objective].every((id) => TEMPLATES.includes(id)), objective);
  // the words a member reads: plain, with accents, no jargon, no internal names
  for (const text of humanTexts(raw)) assert.doesNotMatch(text, FORBIDDEN, text);
  assert.doesNotMatch(JSON.stringify(raw), /\[PREENCHER\]/);
  // questions with descriptions in the chat never double a colon
  for (const question of questions.filter((item) => item.chat_descriptions)) for (const option of question.options) assert.doesNotMatch(option.description ?? "", /:/, `${question.id}: ${option.description}`);
});

test("what the member reads in every round, brief and line is free of jargon and internal names", () => {
  const texts = [];
  let state = make(R1);
  texts.push(show(state).chat_text, linha(state));
  state = answer(state, { marca: "lojax.com.br", objetivo: "ok", onde: "ok", duracao: "ok" });
  state = captured(state, KIT);
  texts.push(show(state, KIT).chat_text);
  state = decideRound(state, BANK, { kit: KIT, now: NOW });
  const third = show(state, KIT);
  texts.push(third.chat_text, JSON.stringify(third.ask_user_question));
  state = decideRound(state, BANK, { kit: KIT, now: NOW });
  const brief = echo(state, TEMPLATES_DATA);
  texts.push(brief.text, brief.markdown, nextStep(state, { scriptCommand: SCRIPT }).say);
  for (const id of ["conferir_marca", "aprovar_briefing", "previa_ok", "outra_marca", "publi", "setor", "abertura"]) {
    const question = questionFor(BANK, id, { state, kit: KIT, vars: { "gancho 1": "Roupa de treino que dura", "gancho 2": "Treino sem desculpa", "gancho 3": "Feita para durar", nome: "Loja X", área: "saúde", itens: "o número do registro", texto: "CRO 12345" } });
    texts.push(question.text, question.chat_text);
    assert.ok(question.options.length >= 2 && question.options.length <= 4, id);
    assert.doesNotMatch(question.text, /\{[^}]+\}/, `${id}: ${question.text}`);
  }
  for (const text of texts) {
    assert.doesNotMatch(text, FORBIDDEN, text);
    assert.doesNotMatch(text, /\{[a-zçãéíóú @]+\}/i, text);
  }
  const opening = questionFor(BANK, "abertura", { state, kit: KIT, vars: { "gancho 1": "Roupa de treino que dura", "gancho 2": "Treino sem desculpa", "gancho 3": "Feita para durar" } });
  assert.deepEqual(opening.options.map((option) => option.label), ["Manter", "“Treino sem desculpa”", "“Feita para durar”", "Escrevo a minha"]);
  const withoutAlternatives = questionFor(BANK, "abertura", { state, kit: KIT, vars: { "gancho 1": "Roupa de treino que dura" } });
  assert.deepEqual(withoutAlternatives.options.map((option) => option.value), ["manter", "outra"]);
  assert.equal(answer(state, { abertura: "Treino sem desculpa nenhuma hoje mesmo, vem" }, KIT).fields.hook.value, "Treino sem desculpa nenhuma hoje mesmo");
  assert.equal(applyAnswers(state, { publi: "ok" }, BANK, { kit: KIT, now: NOW }).errors[0].code, "answer_invalid", "a rights decision needs its own answer");
  assert.deepEqual(answer(state, { publi: "nao" }, KIT).decisions.publi.value, "nao");
});

test("loadBank and loadTemplates refuse a broken install with runtime_missing", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "flyee-studio-intake-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.throws(() => loadBank(dir), (error) => error instanceof AppError && error.code === "runtime_missing");
  assert.throws(() => loadTemplates(dir), (error) => error instanceof AppError && error.code === "runtime_missing");
  mkdirSync(join(dir, "references"), { recursive: true });
  writeFileSync(join(dir, "references", "perguntas.json"), JSON.stringify({ format_version: 1, rounds: [], partial: { priority: [] }, questions: [{ id: "x", stage: "round9", field: "cor", header: "Um cabeçalho longo demais", text: "?", options: [] }] }));
  assert.throws(() => loadBank(dir), (error) => error.code === "runtime_missing" && /stage|field|header/.test(error.message));
  writeFileSync(join(dir, "references", "roteiros.json"), "{ quebrado");
  assert.throws(() => loadTemplates(dir), (error) => error.code === "invalid_json");
  assert.equal(Object.keys(TEMPLATES_DATA.templates).length, 4);
});
