// A synthetic campaign in the shape of the MedChina round zero (2026-10-12), with every name
// swapped: the brand is "Prontuário Lótus", the competitors are invented, and every number is
// made up for the tests. Nothing here came from a real profile or page.

export const COLLECTED_AT = "2026-10-12";

export const BRIEFING = `# Briefing: lotus-rodada-0

## Oferta

- Marca: Prontuário Lótus
- Produto: Prontuário inteligente para acupunturistas
- Oferta: Plano anual com garantia de 30 dias
- Preço: R$ 1.990 por ano
- Página de destino: https://www.prontuariolotus.com.br/assinar
- Site da marca: https://www.prontuariolotus.com.br
- Botão: Assinar

## Campanha

- Evento de otimização: compra
- Verba diária: R$ 50
- Custo por evento:
- Público: Acupunturistas que digitam a anamnese durante a consulta
- País: Brasil

## Nome dos anúncios

- O site lê o nome do anúncio: sim
- Padrão do nome: <ângulo>-<formato>-<gancho>-v<n>
- Ângulos que o site lê: presenca, memoria, confianca, mtc
- Parâmetros de URL:

## O que não pode ser dito

- Termos proibidos: diagnóstico, cura garantida
- Regras: Nada que soe como diagnóstico feito pela IA.

## Prova

- Prova autorizada: Telas do produto com dado fictício

## Concorrentes e pesquisa

- Concorrentes: Clínica Norte Digital, Agenda Viva, Nota Clara
- Palavras de busca: acupunturistas, prontuário
- Perfis de Instagram: @prontuariolotus
`;

/** A reading of three cards of one competitor, as the AI copies them from the screenshots. */
export const READING_NORTE = {
  version: 1,
  kind: "ad_cards",
  competitor: "Clínica Norte Digital",
  collected_at: COLLECTED_AT,
  source: { type: "screenshot", ref: "pesquisa/capturas/clinica-norte-digital/" },
  items: [
    {
      capture: "pesquisa/capturas/clinica-norte-digital/01.png",
      library_id: "Identificação da biblioteca: 2003332460391183",
      status_text: "Ativo",
      started_text: "Veiculação iniciada em 7 de mai de 2026",
      variations_text: "3 anúncios usam esse criativo e esse texto",
      text: "Menos tempo digitando, mais atenção para quem você atende.",
      cta: "Saiba mais",
      media: "video",
      tags: { angle: "presenca", hook_family: "contraste", proof: "demonstracao", structure: "problema-mecanismo", visual: "pessoa-falando" },
    },
    {
      capture: "pesquisa/capturas/clinica-norte-digital/02.png",
      status_text: "Ativo",
      started_text: "Veiculação iniciada em 28 de set de 2026",
      text: "A sessão termina e o registro já está pronto.",
      cta: "Saiba mais",
      media: "video",
      tags: { angle: "tempo", hook_family: "cena", visual: "pessoa-falando" },
    },
    {
      capture: "pesquisa/capturas/clinica-norte-digital/03.png",
      status_text: "Ativo",
      started_text: "Veiculação iniciada em 10 de out de 2026",
      text: "Você revisa cada campo antes de assinar.",
      cta: "Comprar agora",
      media: "image",
    },
  ],
};

/** A second competitor with only two active ads: an indication, not a pattern of its own. */
export const READING_AGENDA = {
  version: 1,
  kind: "ad_cards",
  competitor: "Agenda Viva",
  collected_at: COLLECTED_AT,
  source: { type: "screenshot", ref: "pesquisa/capturas/agenda-viva/" },
  items: [
    {
      capture: "pesquisa/capturas/agenda-viva/01.png",
      status_text: "Ativo",
      started_text: "Veiculação iniciada em 14 de set de 2026",
      text: "A melhor parte da consulta acontece quando você olha para o paciente.",
      cta: "Saiba mais",
      media: "video",
      tags: { angle: "presenca", hook_family: "contraste", visual: "tela-do-produto" },
    },
    {
      capture: "pesquisa/capturas/agenda-viva/02.png",
      status_text: "Ativo",
      started_text: "Veiculação iniciada em 1 de out de 2026",
      variations_text: "2 anúncios usam esse criativo e esse texto",
      text: "Consulta de pontos na palma da mão.",
      cta: "Baixar",
      media: "image",
    },
  ],
};

/** What the member says: one audience line, one organic post of the brand, one pattern of the niche. */
export const READING_DECLARED = {
  version: 1,
  kind: "declared",
  collected_at: COLLECTED_AT,
  source: { type: "declared", ref: "conversa com o integrante" },
  items: [
    { id: "fio da conversa", kind: "audience_comment", who: "acupunturista no grupo da escola", text: "Eu perco o fio da conversa quando paro para digitar.", where: "grupo de WhatsApp" },
    { id: "reels 3 set", kind: "organic_post", who: "@prontuariolotus", text: "Reels de 3 de setembro sobre usar IA sem perder o raciocínio", plays_text: "2.645", baseline_text: "59", url: "https://www.instagram.com/reel/AbCdEf123/" },
    { id: "ate 20s", kind: "organic_pattern", who: "nicho de acupuntura", text: "Vídeos de até 20 segundos renderam mais que os longos", n: 40 },
  ],
};

export const TAGS = {
  version: 1,
  kind: "tags",
  items: [
    { id: "ad-clinica-norte-digital-20261012-c03", tags: { angle: "confianca", hook_family: "demonstracao", proof: "demonstracao", visual: "tela-do-produto" } },
    { id: "ad-agenda-viva-20261012-c02", exclude: true, note: "Fala com estudante, não com quem atende." },
  ],
};

const COPY = {
  memoria: { primary_text: "Ela contou no começo da consulta. No fim, você ainda lembrava? O Prontuário Lótus transforma a conversa em anamnese para a sua revisão.", headline: "O que ela contou fica", description: "Prontuário para MTC", cta: "Assinar" },
  confianca: { primary_text: "A IA organiza o que a paciente relatou. O que ela não disse fica em branco, e nada entra sem a sua revisão.", headline: "Você revisa. Você assina.", description: "Prontuário para MTC", cta: "Assinar" },
  mtc: { primary_text: "Língua, pulso, Zang-Fu e pontos: o Prontuário Lótus organiza a consulta como você raciocina na MTC.", headline: "Um prontuário que fala MTC", description: "Prontuário para MTC", cta: "Assinar" },
};

/** The three concepts of the round, citing the evidence by id. */
export function concepts() {
  return {
    version: 1,
    campaign: "lotus-rodada-0",
    concepts: [
      {
        key: "memoria",
        driver: { type: "barreira", text: "Para registrar, ela digita durante a consulta, e digitando não ouve direito." },
        angle: "memoria",
        hook: { family: "pergunta", text: "Ela contou no começo da consulta. No fim, você ainda lembrava?", tag: "lembra" },
        proof: { type: "demonstracao", text: "A conversa vira anamnese, com o trecho de onde veio cada campo." },
        structure: "problema-mecanismo",
        visual: "frase-que-some",
        template: "problema-mecanismo",
        formats: ["vertical"],
        evidence: ["ad-clinica-norte-digital-2003332460391183", "ad-agenda-viva-20261012-c01", "fala-fio-da-conversa", "org-reels-3-set"],
        against: [],
        copy: COPY.memoria,
        // written by hand on purpose: the script computes "alta" and overwrites it
        confidence: "aposta",
      },
      {
        key: "confianca",
        driver: { type: "barreira", text: "Medo de a IA escrever no prontuário o que a paciente não disse." },
        angle: "confianca",
        hook: { family: "contraste", text: "A IA preencheu a anamnese. O que a paciente não disse ficou em branco.", tag: "branco" },
        proof: { type: "demonstracao", text: "Um campo em branco marcado como não informado e o trecho do áudio ao lado de cada campo." },
        structure: "problema-mecanismo",
        visual: "interface",
        template: "problema-mecanismo",
        formats: ["vertical"],
        evidence: ["ad-clinica-norte-digital-20261012-c03"],
        against: [],
        copy: COPY.confianca,
      },
      {
        key: "mtc",
        driver: { type: "motivador", text: "Um prontuário organizado como ela raciocina na MTC." },
        angle: "mtc",
        hook: { family: "lista", text: "Língua. Pulso. Zang-Fu. Pontos. Tudo no lugar.", tag: "pulso" },
        proof: { type: "demonstracao", text: "A anamnese organizada em língua, pulso, pontos e meridianos." },
        structure: "lista",
        visual: "tipografia-cinetica",
        template: "lista",
        formats: ["vertical"],
        evidence: [],
        against: ["pad-ate-20s"],
        copy: COPY.mtc,
      },
    ],
  };
}
