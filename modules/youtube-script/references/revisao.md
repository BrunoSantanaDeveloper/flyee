# Revisão

Quem escreveu o roteiro é o pior juiz dele: sabe o que quis dizer e lê isso mesmo quando não está escrito. A revisão tem três etapas, nesta ordem, e nenhuma é pulada.

## 1. A conferência automática

Rode `lint <vídeo> --target <minutos> --json` e resolva todos os bloqueios. Os avisos e as observações que sobrarem entram na crítica como evidência: um roteiro com aviso de frase longa não leva nota alta em fala.

## 2. A abertura às cegas

Antes de ler o resto, julgue só a abertura, como um estranho, pelo teste de `ganchos.md`. Se a abertura não passa, conserte-a antes de avaliar o corpo: um roteiro bom atrás de uma abertura fraca não é visto.

## 3. A crítica

**Quem critica.** Se a sua ferramenta abre um subagente, peça a crítica a ele, entregando estes arquivos e nada mais:

- `roteiro.md`, `briefing.md`, `embalagem.md` e `estrutura.md` (com os laços abertos) do vídeo, e `gravacao.md`, se existir;
- `verdade.md`, se existir;
- o perfil `canal.md`, com as "Regras do criador";
- o resultado do `lint` (rode com `--out roteiros/<vídeo>/lint.json` para ter o arquivo);
- este guia, `ganchos.md` (para o teste da abertura às cegas) e `escrita-falada.md` (para as mudanças propostas não caírem nas fórmulas que a conferência aponta).

Ele não recebe a conversa nem as suas justificativas. Um aviso do `lint` que você manteve com motivo é conferido por você, em `revisao.md`, não pela crítica. Se não abre, faça a crítica numa etapa separada e releia os arquivos do zero.

**Como dar as notas.**

- Leia o roteiro inteiro antes da primeira nota.
- Cada nota vem com um "porque" e com o lugar exato (o bloco e a frase). Toda nota abaixo do mínimo traz o conserto proposto.
- **A nota de partida é 6.** Oito ou mais só quando o roteiro está claramente acima do comum. Uma crítica que aprova tudo está descalibrada.
- Aponte ao menos um ponto forte, para o conserto não destruí-lo.

### Defeitos que reprovam sozinhos

Decida estes antes das notas. Nenhuma nota alta os compensa:

1. um fato, um número ou uma vivência do criador que foi inventado ou não tem origem, por menor que seja (escrever "um mês de trabalho" quando ele disse só "levou um mês" já conta);
2. a promessa do título e da thumbnail não é paga pelo vídeo;
3. a abertura reprovada no teste às cegas;
4. promessa de cura, de ganho garantido ou de resultado certo em saúde, dinheiro ou direito;
5. uma afirmação sobre a ferramenta, o produto ou o serviço mostrado que a ficha de verdade (`verdade.md`) não sustenta. Conhecimento comum do ofício e do mercado, dito como observação e sem número ("legume cozinha mais rápido que carne", "aplicativo de entrega cobra taxa por pedido"), não é este defeito nem o 1; um número, um prazo ou uma alegação sobre aquele produto é, a não ser que esteja na ficha com a fonte da documentação. Um fato notório de uma ferramenta conhecida (que ela é paga, que roda no computador) é conhecimento comum. Uma opinião dele escrita como proposta e listada na entrega também não é;
6. um trecho com cara de anúncio: um bloco de venda, plano, preço, versão, "grátis" ou uma marca que o público não conhece na fala, quando o que aparece é do próprio criador e não há patrocínio;
7. uma fala que narra um acontecimento que o criador ainda não viveu (um erro, um tempo, uma reação, quantas perguntas a ferramenta fez desta vez), em vez de uma marca `[CONFIRMAR: …]`. Descrever como a ferramenta funciona, no presente e pela ficha ("ele pergunta o que falta"), não é este defeito. Não contam: o texto que o próprio criador escreveu (o gancho dele, palavra por palavra) e o que o plano de gravação define ou manda ele fazer antes de gravar (a busca, o teste, o tema e o tamanho do exemplo pedido), dito como feito e com o resultado em marca ("procurei em português e achei `[CONFIRMAR: quantos]`").

Confira também, frase a frase, cada item do "Nunca fazer" das Regras do criador e cada afirmação de ausência ("ninguém mostra", "não existe nenhum"): ela só fica com o escopo e a busca feita.

### A rubrica

Os critérios marcados com (P) são portões: precisam de **7 ou mais**. Os outros precisam de **6 ou mais**. A média não decide nada.

| Critério | 1 a 3 | 4 a 6 | 7 a 8 | 9 a 10 |
|---|---|---|---|---|
| 1. Gancho (P) | abertura morta, vinheta ou pedido | o tema está claro, mas é genérico e sem tensão | a primeira frase é específica, abre uma pergunta que importa e passa no teste às cegas | a pessoa se reconhece na primeira frase; curiosidade sem confusão |
| 2. Promessa paga (P) | o título promete o que o vídeo não entrega | entrega parcial, ou tarde demais | os 30 segundos iniciais confirmam a embalagem e o vídeo paga tudo | entrega mais do que prometeu |
| 3. Estrutura | uma lista de tópicos sem arco | blocos com nome de tema; laços abertos sem pagamento | blocos com nome de resultado; a melhor parte anunciada cedo e paga no terço final | cada bloco vale sozinho e puxa o seguinte; a tensão cresce até o pagamento |
| 4. Encadeamento | os blocos trocam de lugar sem perda | um ou dois saltos sem ponte | cada trecho nasce do anterior | a causa é tão clara que a próxima frase parece inevitável |
| 5. Fala | texto de artigo lido em voz alta | trechos duros, cara de texto de IA, frases que não cabem num fôlego | soa como conversa; o verificador não aponta nada | parece improviso do criador, com ênfases de propósito |
| 6. Voz do criador | qualquer canal leria; há frases que ele nunca diria | o tom está certo, o vocabulário é genérico | tratamento, palavras e ritmo batem com o perfil | o criador assinaria sem mudar nada |
| 7. Fatos (P) | dado inventado ou sem origem | "estudos mostram"; uma fonte só, sem aviso | todo número tem `[fonte: …]` ou é do criador | fontes de primeira mão; as incertezas são ditas em voz alta |
| 8. Ideia central e valor | tema sem ideia; conselho que todo mundo dá; só serve para quem compra ou instala algo | o ângulo se dilui; motivos misturados; o valor depende de usar a ferramenta | uma ideia reconhecível, um motivo dominante e algo que vale mesmo para quem não clicar em nada | um ponto de vista que só este criador sustenta e uma lição que a pessoa usa amanhã |
| 9. Fecho | despedida, ou vários pedidos empilhados | um pedido só, sem dizer o que a pessoa ganha | a promessa paga antes; um pedido com promessa; a objeção respondida | a frase final é forte e leva à próxima ação que o canal quer: um vídeo específico, o material, a pergunta |

### As batidas que mais pesam

Confira cada uma, com o trecho, antes do veredito. Uma batida que falta ou que saiu fraca é mudança obrigatória, mesmo com as notas altas:

- **O que é dele vem do perfil:** quando `canal.md` tem a história de origem, a posição ou o incômodo que serve a este vídeo, o roteiro usa a dele, com as palavras dele, e não uma proposta nova.
- **A origem** (num vídeo do que é dele): uma história curta (o gatilho, a percepção, a pergunta) que termina na transparência, numa frase só. Um aviso solto ("já te aviso que é meu") não é origem.
- **O exemplo que ensina:** o exemplo mostrado é sobre o que o vídeo ensina, e a fala diz isso ("e esse aqui ensina justamente elas"); as regras vêm numa lista só, logo depois dele.
- **A opinião com aposta:** uma leitura do presente dita com convicção, que começa pela concessão (o que continua valendo do jeito antigo) e termina na aposta (por que vale fazer o que o vídeo mostrou), ligada ao que o vídeo ensinou, e o que ainda não está perfeito em uma frase com a marca. Previsão de futuro e urgência ("ainda dá tempo de chegar antes") não são opinião, ressalva também não, e limite técnico da ferramenta não é o que ele sente.
- **A pergunta do fim:** se responde em duas ou três palavras ("qual dos dois você usaria?"); uma pergunta que obriga a pensar na própria vida responde pouca gente. Um obrigado curto depois dela não é despedida.
- **Honestidade sem defesa:** o que é dele aparece uma vez, dentro da história. O que ele não pode prometer simplesmente não se diz: a regra se cumpre calando, não avisando ("alcance eu não prometo" só entra se o público vai perguntar). "Já fica dito", "já te aviso" e "só um cuidado" soam defensivos.

### Duas conferências linha a linha

- **A ponte.** Cada frase nasce da anterior? A ponte boa é uma frase que sai do que acabou de ser dito, não um anúncio do próximo bloco no fim de cada um, nem uma volta ao próprio roteiro ("lá no começo eu falei que…"). Marque o salto sem ponte, a preparação que não pagou, o patrocínio que interrompe um raciocínio e a surpresa que não foi preparada. Proponha a ponte.
- **O livro de promessas.** Cada laço aberto em `estrutura.md` foi pago? Cada "já já eu mostro" teve o seu "aqui está"?

### O veredito

| Veredito | Quando |
|---|---|
| **Aprovado** | portões com 7 ou mais, os demais com 6 ou mais, nenhum defeito que reprova sozinho e nenhum aviso do verificador sem justificativa. Num roteiro escrito antes do resultado, as marcas não pesam na nota: aprovado quer dizer que, preenchidas as marcas, ele grava |
| **Revisar** | um portão em 5 ou 6, um critério comum em 5, um aviso sem justificativa, ou um defeito que reprova sozinho e se conserta no lugar (um fato inventado que sai ou ganha origem) |
| **Refazer** | algum critério abaixo de 5, ou um defeito que mexe no vídeo inteiro (a promessa não é paga, a abertura não passa às cegas, a ideia central quebrou): volte à estrutura, não remende frases |

Um defeito que reprova sozinho é sempre mudança obrigatória, mesmo com todas as notas altas.

Separe sempre **"Mudança obrigatória"** (o que impede a aprovação) de **"Sugestão"** (melhora, mas não bloqueia).

## Consertar

- **Parecido com a referência.** Só é mudança obrigatória quando é tradução de um argumento, de uma história ou de uma sequência de frases dela. Uma expressão comum, dita do jeito dele ("agora eu paro de falar"), uma frase parecida no assunto ou na função da batida e uma ideia comum do ofício (o feed cheio de vídeo, a pessoa que salva o post) não são: entram com a fala dele. Nunca troque uma frase boa por uma pior só para se afastar.
- **Uma ideia, uma vez.** A mesma ideia dita três vezes com outras palavras ("vale em qualquer ferramenta") é repetição: fique com a melhor. Frase de relatório ("é uma pergunta que se repete nos comentários") vira fala ("muita gente pergunta").
- **A crítica não passa por cima das regras.** Uma mudança obrigatória que quebra uma regra deste app (dizer na fala como conseguir o que é dele, citar a referência, trocar uma fala pronta por uma pergunta, atribuir a outro criador o que é conhecimento comum) não entra: anote em `revisao.md` o motivo.
- **No máximo duas rodadas.** Uma rodada é: a crítica dá o veredito, você aplica as mudanças obrigatórias e roda o `lint`. Depois de cada conserto, uma crítica nova (outro subagente, que não viu a anterior) confere o resultado inteiro. Se a segunda rodada ainda não aprovar, aplique as mudanças obrigatórias dela, rode o `lint` e entregue como rascunho, sem terceira crítica, dizendo com todas as letras qual defeito ficou. Num roteiro escrito antes do resultado, o normal é sair como rascunho: a aprovação vem depois de preencher as marcas, com uma crítica nova. Nunca baixe a exigência nem repita a crítica até sair a nota desejada. Sugestões aplicadas depois da aprovação não pedem crítica nova, mas o `lint` roda de novo.
- A cada rodada, diga o que melhorou e o que piorou. Um trecho bom não ganha mudança inventada.
- **Enxugue quando sobra.** Um primeiro rascunho acima da duração alvo quase sempre perde de 15% a 25% das palavras sem perder nada: corte o que repete uma ideia, o exemplo mais fraco de cada bloco e as frases de preparação ("agora eu quero falar de…"). Se o roteiro já está abaixo da duração, corte só o que repete e complete com um exemplo ou uma prova, nunca com enchimento. Antes de achar que está curto, some o tempo de tela: num vídeo que mostra coisas, cada demonstração tem a marca com os segundos (`[TELA 30s: …]`), e a fala ocupa por volta de dois terços do tempo. Se mesmo assim ele fica curto, o alvo é que estava alto: proponha a duração nova e anote. Nunca complete com o que a documentação da ferramenta diz. A duração de um vídeo de referência conta pela fala dele, não pelos trechos só com música.
- **Não corte o que ensina.** Ao tirar um trecho que dependia de um fato do criador, mantenha a lição para quem assiste: "some o que precisa entrar todo mês: aluguel, internet, o computador" é um conselho; "o meu aluguel é 1.800" é um fato que precisa vir dele.
- **O criador decide.** Mostre as notas e as mudanças obrigatórias, e aplique com o sim dele. Nunca reescreva em silêncio a fala que ele aprovou. Depois de mudar, rode o `lint` de novo.

## O que gravar em revisao.md

O formato está em `formato.md`: o resumo da conferência, a tabela de notas com os porquês, as mudanças obrigatórias, as sugestões e o que mudou em cada rodada.
