// The voice of the customer and the support of the peak: the questionnaire and the conversation
// script (from the plan's reference), the synthesis saved as a `declared` reading for the
// creatives app, and atendimento.md (who answers, how fast, the answers to the objections, the
// coverage of the peak).

const PLACEHOLDER = "[a decidir]";

/** voz-do-cliente.md: the questionnaire and the script, with the brand's product in the questions. */
export function voiceTemplate({ brand = null, product = null, today }) {
  const name = brand ?? "a marca";
  const what = product ?? "o produto";
  return `# A voz do cliente: ${name}

Escrito em ${today}. Antes de escrever anúncio ou e-mail, ouvir cinco a oito clientes e cinco a oito pessoas que testaram e não ficaram. As respostas entram aqui como foram ditas, com a data e quem disse (só o primeiro nome ou a profissão), e a síntese vai para a evidência do app de criativos como leitura declarada.

## O questionário (por formulário ou mensagem, sete perguntas)

1. O que você estava tentando resolver quando procurou ${what}?
2. O que você usava antes, e o que te incomodava nisso?
3. O que quase te fez não assinar (ou te fez não assinar)?
4. Qual foi o momento em que você pensou "vale a pena"? O que aconteceu?
5. Se ${name} sumisse amanhã, o que você faria?
6. Como você explicaria ${what} para um colega, em uma frase?
7. Quanto você pagaria, e por quê esse valor?

## O roteiro da conversa (20 minutos, por chamada)

- Abertura (2 min): quem você é, por que a conversa, que nada será publicado com o nome sem autorização.
- A situação antes (5 min): "me conta como era a sua semana antes de ${what}". Deixe falar; anote as palavras exatas.
- A busca e a dúvida (5 min): "o que te fez procurar; o que te fez hesitar".
- O momento (5 min): "quando você percebeu que ia ficar (ou que não ia)".
- Fechamento (3 min): "se pudesse mudar uma coisa"; a autorização para usar uma frase, com o primeiro nome.

## As respostas

| Data | Quem | Pergunta | O que disse (palavras exatas) | Autorizou citar |
|---|---|---|---|---|
| ${PLACEHOLDER} | ${PLACEHOLDER} | ${PLACEHOLDER} | ${PLACEHOLDER} | ${PLACEHOLDER} |

## A síntese (a IA escreve, depois de cinco respostas ou mais)

- A dor nas palavras deles: ${PLACEHOLDER}
- A objeção mais repetida: ${PLACEHOLDER}
- O momento do "vale a pena": ${PLACEHOLDER}
- A frase que vira gancho: ${PLACEHOLDER}
- O preço na cabeça deles: ${PLACEHOLDER}
`;
}

/**
 * The synthesis as a `declared` reading the creatives app imports: one audience_comment per
 * quoted line, with who said it (first name or profession only) and the date.
 */
export function voiceReading(quotes, { today, source = "conversas e questionário da voz do cliente" }) {
  const items = quotes
    .filter((quote) => quote && typeof quote.text === "string" && quote.text.trim())
    .map((quote, index) => ({
      kind: "audience_comment",
      id: `voz-${String(index + 1).padStart(2, "0")}`,
      who: quote.who && String(quote.who).trim() ? String(quote.who).trim() : "cliente",
      text: quote.text.trim(),
      where: quote.where ?? "conversa",
      tags: quote.tags ?? undefined,
    }));
  return { version: 1, kind: "declared", collected_at: today, source: { type: "declared", ref: source }, items };
}

/** atendimento.md: who answers in the peak, how fast, the answers to the objections, the coverage. */
export function supportTemplate({ brand = null, peak = null, holidays = [], today, objections = [] }) {
  const name = brand ?? "a marca";
  const window = peak ? `de ${peak.start} a ${peak.end}` : PLACEHOLDER;
  const lines = [`# O atendimento do pico: ${name}`, "", `Escrito em ${today}. No pico, cada pergunta sem resposta em uma hora é uma venda que esfria. Este arquivo diz quem responde, em quanto tempo, com que respostas, e quem cobre o fim de semana e o feriado.`, ""];
  lines.push("## Quem responde e em quanto tempo", "", `- Canal principal: ${PLACEHOLDER} (WhatsApp, e-mail, chat do site)`, `- Quem responde: ${PLACEHOLDER}`, `- Tempo de resposta no pico (${window}): até 1 hora das 9 às 21 horas; fora disso, uma resposta automática que diz quando alguém volta.`, `- Quem cobre o fim de semana do pico: ${PLACEHOLDER}`, ...holidays.map((holiday) => `- Feriado em ${holiday.date} (${holiday.name}): quem cobre ${PLACEHOLDER}`), "");
  lines.push("## As respostas às objeções (uma linha cada, nas palavras do público)", "");
  const defaults = objections.length ? objections : ["Onde os dados ficam e quem acessa", "O que acontece se eu cancelar", "Quanto tempo leva para começar", "Funciona no celular", "O preço anual pode ser parcelado", "Quem já é cliente paga o quê"];
  for (const objection of defaults) lines.push(`- ${objection}: ${PLACEHOLDER}`);
  lines.push("", "## O que o atendimento registra", "", "- Toda pergunta nova vira uma linha aqui, com a resposta que funcionou.", "- Quem comprou pelo atendimento entra na planilha de origem com a origem do contato (o anúncio, o e-mail, o parceiro).", "- Uma objeção que se repete três vezes vai para a página e para o anúncio seguinte.", "", "## O que não se faz", "", "- Prometer o que o produto não faz para fechar a venda.", "- Dar desconto além da oferta escrita: quem já comprou pagaria mais do que quem esperou.", "- Responder dados de saúde ou de pacientes por mensagem.");
  return `${lines.join("\n").trimEnd()}\n`;
}
