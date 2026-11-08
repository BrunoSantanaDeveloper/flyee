# Os vícios de IA numa página

Este guia é para a IA. Um vício é um padrão que aparece porque a IA o repete, sem que o plano tenha pedido. Esta lista não traz substitutos: trocar um vício por outro resolve pouco. Ela traz a pergunta que leva de volta ao projeto.

## A regra

- **Dado inventado sai da página, sem exceção:** o fato precisa de origem no projeto, ou de uma resposta do integrante. É o que diz a lei (CDC, art. 37, §1).
- **O resto é aviso.** Um padrão da lista pode ficar quando o plano o escolhe de propósito: registre o nome dele em `pagina.json` (`visual.chosen`), e a conferência para de apontá-lo. O degradê no título do modelo do Juridiq é um exemplo: serve, desde que seja uma escolha.
- **Adjetivo não escolhe nada.** "Moderno", "premium" ou "editorial" não autorizam um padrão. O pedido do integrante autoriza quando nomeia o padrão, e aí ele entra em `visual.chosen`.

Tirar os vícios deixa a página menos genérica, e só isso. Quem diz se ela vende é a medição do próprio projeto (veja `medicao.md`).

## Dado inventado

Pergunte sempre: de onde vem isto? A resposta vai em `pagina.json` (`claims`).

| O que aparece | A pergunta |
|---|---|
| Número de uso redondo ou preciso demais: "+10.000 clientes", "99,99%", "10x mais rápido", "47,3%" | onde isso foi medido, e a página pode dizer? |
| Escassez: "só 3 restantes", "últimas vagas", "27 pessoas vendo agora" | que sistema dá esse número, e ele muda quando o estoque muda? |
| Ano de fundação como selo: "Desde 2018" | é o ano real, e quem chega precisa dele? |
| Versão e estado na página: `v0.6.2`, "sincronizado há 4 s", "Build 0048" | de que versão real vem isso, e onde a página o lê? |
| Códigos sem catálogo: "SEC-01", "REF-204" | que catálogo ou documento esse código indica? |
| Nome de exemplo: "João da Silva", "Acme", "Empresa X", `lorem ipsum`, depoimento de quem nunca foi consultado | é cliente real, com permissão para aparecer? |
| Crédito de foto que não existe: "Arquivo da casa, nº 12" | quem fez a foto, e o projeto pode dar o crédito? |
| Tela do produto desenhada de memória | existe tela ou componente real? Sem isso, a página precisa dessa imagem? Veja `demonstracao.md` |

## Enfeite sem função

Pergunte: o que isto informa?

| Nome em `visual.chosen` | O que aparece | A pergunta |
|---|---|---|
| `numero_na_secao` | índice antes do título: "01 / Recursos", "04. Processo" | alguém usa esse número para achar a seção? |
| `aviso_de_rolagem` | "Role para baixo", uma seta pulando | há sinal de que as pessoas param na primeira tela? |
| `ponto_de_status` | um ponto colorido, muitas vezes pulsando, ao lado de um item | que estado real ele mostra, e o que o desliga? |
| `movimento_sem_fim` | animação em loop em algo que não mostra estado vivo | que estado ela mostra, e um quadro parado não diria o mesmo? |
| `brilho` | sombra colorida em volta de botão, texto ou borda | que estado ou destaque isso marca que o layout não marca? |
| `mancha_desfocada` | formas grandes e borradas de cor atrás do conteúdo | o que a seção perde sem elas? |
| `vidro` | painel translúcido que borra o que está atrás | o que ver através do painel mostra a quem usa? |
| `texto_degrade` | título preenchido com degradê | esse degradê faz parte da paleta escolhida, e passa no contraste em todas as cores? |
| `tudo_mono` | letra monoespaçada em rótulos e menus, além de código e tabelas | o que nesta página é código ou tabela? |

Leia também, à mão: frase solta entre o rótulo e o título que repete o título, faixa de três palavras no pé do topo (`DESIGN · BUILD · SHIP`), contador `01 / 4` em itens que não trocam, texto na vertical, linhas de grade que nada segue.

## Layout por reflexo

Pergunte: esta forma veio do conteúdo ou do hábito?

| Nome em `visual.chosen` | O que aparece | A pergunta |
|---|---|---|
| `tres_cartoes_iguais` | três cartões do mesmo tamanho: ícone, título, duas linhas | o conteúdo vem mesmo em três itens de peso igual? |

Leia também, à mão:

- imagem à esquerda e texto à direita, depois o contrário, mais de duas vezes seguidas;
- toda seção com o mesmo arranjo: título no centro e uma grade;
- grade com um bloco vazio ou só com degradê;
- título de um lado e um parágrafo pequeno solto no canto oposto;
- traço em toda linha de uma lista;
- barras de nota sobre um trilho cheio, sem nada medido;
- fundo de papel quente com um acento vermelho, numa marca que não fala de papel;
- letra de título escolhida pelo clima, e não pela marca.

## Texto vazio

Pergunte: esta frase é verdade deste produto, e de nenhum outro?

| Nome em `visual.chosen` | O que aparece | A pergunta |
|---|---|---|
| `verbos_de_enchimento` | `revolucione`, `eleve`, `turbine`, `potencialize`, `desbloqueie`, `leve ao próximo nível`, `seamless`, `supercharge` | o que o produto faz, nas palavras de quem usa? |

Leia também, à mão:

- o mesmo pedido com vários nomes: "Comece agora", "Teste grátis" e "Criar conta" na mesma página (a conferência aponta em `cta_consistent`);
- rótulos poéticos, como "Do campo" em cima de depoimentos;
- prova com falsa modéstia, como "Discretamente escolhido por";
- o tom que muda de uma seção para outra;
- qualquer texto que ninguém releu depois de escrever.

## Na hora de construir

- Antes de escrever o texto, leia a pergunta de "Texto vazio".
- Antes de pôr um número, um nome ou uma data, leia a de "Dado inventado".
- Antes de escolher o layout, a de "Layout por reflexo".
- Antes de um enfeite, a de "Enfeite sem função".

Na conferência, `ai_defaults` lista o que dá para ver na página pronta, e `claims_have_origin` e `placeholder_data` cobrem o dado inventado. O resto é leitura sua, uma vez, com a página pronta. Um vício que já estava no projeto, em outra página, você aponta ao integrante e não muda sem ele pedir.
