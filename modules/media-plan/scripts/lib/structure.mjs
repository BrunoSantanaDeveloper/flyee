// The structure per channel, in business language: for Meta, an honest objective, one ad set
// with its reason, broad against interests, exclusions, placements, the daily budget against
// the learning floor, the naming pattern, the remarketing audiences by stage and the lookalike
// from the base; for Google Search, the brand and non-brand campaigns, the match types, the
// negatives, the brand campaign in the peak week, the bid and the budget against the minimum.

import { AppError, brl, round2 } from "./util.mjs";
import { field } from "./premises.mjs";

const LEAD_EVENTS = /lead|cadastro|registr|inscri|lista/i;
const PURCHASE_EVENTS = /compra|purchase|assin|venda|pagamento/i;

function objectiveFor(event) {
  const text = String(event ?? "");
  if (PURCHASE_EVENTS.test(text)) return { objective: "Vendas", event: "Compra (Purchase), com valor", note: "a compra só sai da fase de aprendizado com cerca de 50 por semana no conjunto; abaixo disso, o lead" };
  if (LEAD_EVENTS.test(text)) return { objective: "Cadastros (leads)", event: "Lead ou CompleteRegistration na página de obrigado", note: "o lead é o evento que a verba pequena consegue aprender; a compra é lida, não otimizada" };
  return { objective: "Tráfego, lido por visita à página", event: "LandingPageView", note: "sem um evento de conversão rastreado, a campanha compra visitas e a página é julgada pela conversão da origem" };
}

/**
 * Builds estrutura.json for the channels that run or test. Throws `structure_invalid` when the
 * Meta ad set's daily budget sits below the learning floor and the plan does not accept it.
 */
export function buildStructure(data, { channels, economics, calendar, plan, offer, acceptFloor = false, inventory = null }) {
  const decided = Object.fromEntries((channels?.rows ?? []).map((row) => [row.channel, row.verdict]));
  const daily = economics?.budget?.daily_brl ?? null;
  const floor = economics?.learning_floor?.floor_daily_brl ?? null;
  const allowable = economics?.funnel?.allowable_cpl_brl ?? economics?.economics?.allowable_cac_brl ?? null;
  const event = field(data, "evento", "event") ?? data.premises?.evento?.value ?? null;
  const contacts = field(data, "base", "contacts") ?? 0;
  const slug = data.plan ?? "plano";
  const brand = data.brand ?? "marca";
  const peak = calendar?.phases?.find((phase) => phase.id === "pico") ?? null;
  const warm = calendar?.phases?.find((phase) => phase.id === "aquecimento") ?? null;
  const out = { version: 1, channels: {}, warnings: [] };

  if (["run", "test"].includes(decided.meta)) {
    const searchShare = ["run", "test"].includes(decided.google_search) ? 0.3 : 0;
    const metaDaily = daily ? round2(daily * (1 - searchShare)) : null;
    const sets = metaDaily && floor && metaDaily >= floor * 2 ? 2 : 1;
    const perSet = metaDaily ? round2(metaDaily / sets) : null;
    if (perSet !== null && floor !== null && perSet < floor && !acceptFloor) {
      throw Object.assign(new AppError("structure_invalid", `A verba diária do conjunto da Meta (${brl(perSet)}) fica abaixo do piso de aprendizado (${brl(floor)} para o evento ${event ?? "escolhido"}).`, "Escolha uma saída: um evento mais cedo no funil, a verba até o piso, ou aceitar um conjunto que na semana 1 só compara criativos (structure --accept-floor).", {}), { details: { per_set_daily_brl: perSet, floor_daily_brl: floor, exits: ["evento mais cedo no funil", "verba até o piso", "aceitar com --accept-floor: a semana 1 compara criativos"] } });
    }
    const objective = objectiveFor(event);
    const lookalike = contacts >= 1000 ? { source: "a lista de clientes da base (hash), 1%", note: "a partir de 1.000 contatos a semelhança é lida; com menos, só o público amplo" } : contacts >= 100 ? { source: "a lista de clientes da base (hash), 1%", note: `${contacts} contatos: a Meta aceita a partir de 100 reconhecidos, mas o semelhante fica fraco; teste contra o amplo` } : null;
    out.channels.meta = {
      verdict: decided.meta,
      objective: objective.objective,
      optimization_event: objective.event,
      event_note: objective.note,
      campaign: { name: `${slug}-meta`, budget_level: "no conjunto", daily_brl: metaDaily },
      ad_sets: Array.from({ length: sets }, (_, index) => ({
        name: sets === 1 ? `${slug}-frio-amplo` : index === 0 ? `${slug}-frio-amplo` : `${slug}-frio-interesses`,
        daily_brl: perSet,
        floor_daily_brl: floor,
        clears_floor: perSet !== null && floor !== null ? perSet >= floor : null,
        audience: index === 0 ? "amplo: país, idade de quem compra, sem interesse; a Meta acha quem converte pelo evento" : "interesses do nicho, para comparar com o amplo por 14 dias; o que ler pior sai",
        exclusions: ["clientes atuais (lista da base, em hash, atualizada toda semana)", "quem já converteu no evento nos últimos 30 dias", "quem já está na lista de espera"],
        placements: "Advantage+ (todos), com o vídeo 9:16 em Stories e Reels e o 4:5 e a imagem no feed, pela personalização por posicionamento",
        reason: sets === 1 ? "um conjunto só: com a verba dividida, nenhum aprende" : "dois conjuntos porque a verba cobre dois pisos",
        ads: "3 anúncios por conjunto, um por conceito, nomeados pelo padrão da entrega",
      })),
      naming: { campaign: `${slug}-meta`, ad_set: `${slug}-<publico>`, ad: "o nome que o app de criativos entrega (e o utm_content do link)" },
      remarketing: [
        { stage: "visitou", audience: "visitou a página nos últimos 30 dias e não cadastrou", source: "PageView do Pixel", window_days: 30, message: "a prova e a objeção respondida" },
        { stage: "cadastrou-nao-ativou", audience: "entrou na lista ou cadastrou e não usou", source: "Lead ou CompleteRegistration sem o evento de ativação", window_days: 30, message: "o primeiro passo decidido" },
        { stage: "ativou-nao-pagou", audience: "usou o produto e não assinou", source: "o evento de ativação sem Purchase", window_days: 60, message: "a oferta, com o prazo" },
        { stage: "viu-oferta", audience: "abriu a página da oferta e não comprou", source: "PageView da página da oferta ou InitiateCheckout", window_days: 14, message: "o lembrete e o último dia" },
      ],
      remarketing_note: "os públicos de remarketing nascem vazios e se formam durante os testes: a verba deles entra na fase de escala; frequência acima de 5 por semana cansa um público pequeno",
      lookalike,
      budget_by_phase: (plan?.budget?.by_phase ?? []).map((item) => ({ phase: item.phase, daily_brl: round2(item.daily_brl * (1 - searchShare)) })),
      launch_rules: ["nenhum anúncio sobe antes do rastreamento conferido e da oferta na página", "a subida do pico é programada com data, 2 dias antes, para passar pela revisão", "uma mudança significativa por conjunto por semana"],
    };
    if (perSet !== null && floor !== null && perSet < floor) out.warnings.push({ code: "below_floor", text: `O conjunto da Meta roda com ${brl(perSet)} por dia, abaixo do piso de ${brl(floor)}: a semana 1 compara criativos pelo gancho e pelo CTR, não por resultado. Aceito pelo plano.` });
  }

  if (["run", "test"].includes(decided.google_search)) {
    const searchDaily = daily ? round2(Math.min(Math.max(40, daily * 0.3), daily)) : null;
    out.channels.google_search = {
      verdict: decided.google_search,
      daily_brl: searchDaily,
      minimum_daily_brl: 40,
      clears_minimum: searchDaily !== null ? searchDaily >= 40 : null,
      campaigns: [
        { name: `${slug}-busca-marca`, kind: "marca", when: peak ? `só na semana do pico, de ${peak.start} a ${peak.end}${warm ? `, ou do aquecimento (${warm.start}) se a base começar a procurar o nome` : ""}` : "quando a marca começar a ser procurada", keywords: [`[${brand.toLowerCase()}]`, `"${brand.toLowerCase()} <produto>"`], match: "exata e frase", negatives: ["nada do produto: a campanha de marca só pega o nome"], bid: "cliques máximos com CPC máximo baixo; o nome da marca é barato", budget_share: 0.2 },
        { name: `${slug}-busca-nao-marca`, kind: "nao-marca", when: "da fase de testes em diante", keywords: ["<o problema que o público procura>", "<a categoria do produto>", "<a profissão> + <produto>"], match: "frase e ampla, com o lance inteligente só depois de 30 conversões", negatives: [brand.toLowerCase(), "grátis", "gratuito", "curso", "o que é", "vaga", "emprego", "salário", "pdf", "modelo"], bid: `cliques máximos com CPC máximo até ${allowable ? brl(round2(Math.min(10, allowable * 0.1))) : "R$ 5"} enquanto não há 30 conversões em 30 dias; depois, CPA alvo no custo permitido`, budget_share: 0.8 },
      ],
      conversion: { primary: `a ação de conversão do evento ${event ?? "escolhido"}, pela tag do Google Ads ou importada do GA4`, secondary: ["visita à página da oferta", "início de pagamento"] },
      extensions: ["sitelinks: preços, como funciona, a oferta", "frases de destaque: um fato por frase", "snippet: Destaques"],
      rules: ["a página responde à palavra: quem procurou o problema lê o problema na primeira frase", "termos de pesquisa lidos toda semana: 10 cliques sem conversão viram negativa", "o lance inteligente só com 30 conversões em 30 dias"],
    };
  }

  const owned = [];
  if (["run", "test"].includes(decided.email)) owned.push({ channel: "email", what: "a régua do app de base, ancorada no aquecimento e no pico", dates: warm && peak ? `${warm.start} a ${peak.end}` : null });
  if (["run", "test"].includes(decided.whatsapp)) owned.push({ channel: "whatsapp", what: "pela API oficial com modelos aprovados, ou um a um para quem já respondeu", dates: warm && peak ? `${warm.start} a ${peak.end}` : null });
  if (["run", "test"].includes(decided.parceiros)) owned.push({ channel: "parceiros", what: "um texto pronto e um link rastreado por parceiro (utm_source=parceiro, utm_term=<nome>)", dates: warm ? `a partir de ${warm.start}` : null });
  if (owned.length) out.channels.owned = owned;

  const metaText = out.channels.meta ? `Meta: ${out.channels.meta.objective}, ${out.channels.meta.ad_sets.length} conjunto(s) a ${brl(out.channels.meta.ad_sets[0].daily_brl)} por dia${out.channels.meta.ad_sets[0].clears_floor === false ? " (abaixo do piso, aceito)" : ""}, amplo com exclusão de clientes, remarketing por etapa na escala.` : "Meta fora.";
  const searchText = out.channels.google_search ? ` Busca: ${brl(out.channels.google_search.daily_brl)} por dia, não marca desde os testes e marca na semana do pico.` : "";
  out.say = `${metaText}${searchText}${owned.length ? ` Base: ${owned.map((item) => item.channel).join(", ")}.` : ""}`;
  return out;
}
