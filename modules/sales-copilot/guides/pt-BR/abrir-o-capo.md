# Abrir o capô

Como o Copiloto de vendas lê uma call, o que cada arquivo guarda e o que você pode mudar.

## Como ele trabalha

O app separa duas coisas que costumam vir misturadas: responder perguntas sobre uma fala e tirar conclusões da call.

**1. As perguntas.** Para cada fala existe um conjunto fixo de perguntas, sempre as mesmas:

- doze sinais de sim ou não, como "o cliente levantou uma objeção", "o cliente aceitou o próximo passo", "o vendedor fez uma pergunta aberta" e "o vendedor despejou recursos sem perguntar nada";
- sete fatos que, uma vez ditos, valem até o fim da call: o cenário atual, o problema nas palavras do cliente, o tamanho do problema, o valor de resolver, dinheiro na conversa, quem decide e o prazo;
- três notas de três níveis: o clima da conversa, a participação do cliente e a urgência dele;
- três escolhas: a etapa da call, o tipo de objeção e a jogada do seu playbook que cabe agora.

Quem responde depende do modo. Na revisão e no treino, é a sua IA. Ao vivo, é um modelo de decisões no OpenRouter, que só devolve valores e não escreve texto. Nos dois casos, quem responde não calcula nada.

**2. A conta.** O sinal de cada fala é a base da etapa em que a call está mais os pontos do que apareceu: um compromisso do cliente soma, uma objeção em aberto tira, o vendedor falando demais tira. O sinal mostrado caminha aos poucos na direção da leitura de cada fala, para não pular a cada frase.

**3. As conclusões.** O app acompanha cada objeção desde a fala em que abriu até a fala em que o cliente aceitou a resposta. Uma objeção em que ninguém toca por oito falas fica marcada como sem resposta. O roteiro é conferido item por item, e os avisos saem de regras fixas: o preço veio antes de o cliente dizer quanto o problema custa, a call terminou sem próximo passo, o preço foi dito sem saber quem decide.

Falas de uma ou duas palavras sem pergunta, como "Claro", não são lidas, e o sinal fica onde estava.

## Os arquivos por dentro

Tudo fica na pasta copiloto-de-vendas do seu projeto.

- **O playbook.** Tem quatro partes. Em "business" ficam o que você vende, o preço, o próximo passo e as alternativas, cada um com a origem e a data. Em "moves" ficam as jogadas, cada uma com quando usar, quando não usar e as frases. Em "roadmap" fica o roteiro da call, com a pergunta sugerida para cada item que falta. Peça à IA para trocar frases, acrescentar uma jogada ou mudar o roteiro.
- **A pasta de cada call.** O documento para você ler, as falas com a origem e a data, as respostas dadas a cada fala e a leitura calculada.
- **Os pesos.** Só existe se você mudar algum. Sem ele valem os pesos do app.

Um número só entra numa frase do playbook quando está em "business". Se uma frase trouxer um preço ou um percentual que você não informou, o app aponta a frase e não lê calls até ela ser corrigida.

## Pedidos avançados

> "Aumente o peso da objeção em aberto para 20 pontos e refaça a leitura da última call."

> "Acrescente ao playbook uma jogada para quando o cliente pede desconto, com três frases minhas."

> "Troque o roteiro para o meu processo: diagnóstico, proposta e contrato."

> "Compare as últimas calls e me diga em qual item do roteiro eu mais falho."

> "Abra o copiloto ao vivo com teto de 1 dólar e 90 minutos."

Mudar um peso não refaz as perguntas: as respostas de cada fala ficam guardadas, e a leitura é recalculada na hora.

## As conferências

- **Respostas.** Cada resposta é conferida campo a campo. Uma etapa que não existe, uma nota fora do intervalo ou uma jogada que não está no playbook é recusada com o caminho do campo, e a IA corrige só aquele campo.
- **Cobertura.** O documento diz quantas falas foram lidas, quantas eram curtas demais e quantas ficaram sem leitura.
- **Pesos.** O documento diz que o sinal é uma regra de bolso, a data dos pesos e se o seu projeto os ajustou. Os pesos do app são um ponto de partida e não foram medidos em calls reais.
- **Comparação entre calls.** Abaixo de dez calls com resultado de cada lado, a comparação sai marcada como indício.
- **Gasto ao vivo.** A página soma o custo que o OpenRouter informa a cada resposta. No teto, ela para de consultar o serviço e segue gravando as falas. A transcrição pelo Gemini usa a sua chave do Google e fica fora dessa conta; a página diz quando é o Gemini que está ouvindo. Quando a transcrição vai pelo OpenRouter e o serviço não informa o custo, a página estima pelo tempo de fala e marca o valor como estimado.
- **Quem ouve.** Com a chave do Gemini, é o Gemini. Se ele recusar a chave, os trechos seguintes vão pelo OpenRouter. Sem nenhuma das duas formas, as falas são digitadas.
- **Tempo ao vivo.** A página fecha sozinha no tempo combinado, 120 minutos se você não pedir outro, e grava a leitura antes de fechar.

## Com outros apps

Outros apps do flyee.club podem pedir a leitura de uma call a este e ler o resultado calculado: as etapas, as objeções, os itens do roteiro e o sinal fala a fala. Este app não chama nenhum outro.

## Privacidade

- **O que fica no seu computador.** As transcrições, as falas, as respostas, os documentos e o playbook, todos na pasta do projeto.
- **O que sai na revisão e no treino.** As falas vão para a sua IA, como qualquer arquivo que ela lê.
- **O que sai ao vivo.** A cada fala, as doze falas mais recentes e as perguntas vão para o OpenRouter. Com o microfone ou o áudio da reunião ligados, cada trecho de fala vai para o Gemini, para ser transcrito, ou para o OpenRouter quando não há chave do Gemini. As chaves ficam fora do projeto e nunca aparecem na conversa, na página ou nos arquivos.
- **A página da call.** Abre só no seu computador, num endereço que vale para aquela call. Ela não carrega nada de fora e recusa pedidos vindos de outros sites.
- **O cliente.** Transcrever uma conversa envolve dados de outra pessoa. Avise o cliente antes; a IA pergunta isso sempre que você pede o modo ao vivo.
