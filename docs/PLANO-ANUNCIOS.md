# Criativos para anúncios: plano de implementação

Apps: `ad-creatives` (workflow), `instagram-research` (tool) e, numa fase seguinte, `ads-insights` (tool).

## Contexto

O operador abre nos próximos dias uma campanha de tráfego pago do MedChina e quer um app do catálogo que entregue os criativos com mais chance de retorno já na primeira campanha, quando ainda não existe dado próprio de anúncio, e que depois leia o resultado para montar a rodada seguinte.

O catálogo hoje produz peças (`video-render`, `video-studio`, `motion-carousel`) e estuda vídeos (`video-analysis`, `youtube-research`). Nada decide quais peças fazer para um anúncio, pesquisa Instagram ou anúncios de concorrentes, nem lê resultado de campanha.

Decidido pelo operador em 2026-10-12:

- um workflow `ad-creatives` e um tool `instagram-research`; a leitura de resultados (`ads-insights`) entra numa fase seguinte deste mesmo plano;
- independente do Seenaly: método e etiquetas próprios;
- primeiro caso real é o MedChina, e a campanha começa em dias. Por isso o plano começa por uma rodada zero feita à mão no workspace, e o app é destilado dela, como foi com o roteiro do YouTube;
- a pesquisa manual guiada é o modo base, sem chave; o Apify, com chave opcional, automatiza a mesma coleta.

**Objetivo:** um integrante pede "prepare os criativos da minha primeira campanha" e recebe três conceitos produzidos e conferidos, cada um com a ficha da evidência que o sustenta, sem chave nenhuma; com a chave do Apify a coleta é automática; depois que a campanha roda, o app lê o resultado exportado e propõe a rodada seguinte.

⚠️ **Correção (2026-10-23, D22).** Este plano nasceu de uma campanha do operador e cita o caso dela nos épicos 0 a 4. Daqui em diante, tudo o que ele constrói é produto do flyee: nenhum épico, aceite, data ou fixture se vincula a um pedido de uma marca, e as menções anteriores ficam como história. Os épicos 6 a 11 seguem essa regra.

> Auditado contra o código em 2026-10-12 (HEAD `e57ec73` mais a árvore não commitada). Legenda: ✅ existe · 🟡 parcial · ⬜ não existe · ⚠️ correção.
>
> Caminhos fora deste repositório: `medchina/…` é o repositório irmão `C:\AppsProjects\medchina`; `radar-instagram/…` é o plugin Radar, em `~/.claude/plugins/synced/<id>/radar-de-conteudo~g4/skills/`.

## 0. Decisões que o implementador não inventa

| # | Decisão | Valor | Onde mora |
|---|---|---|---|
| D1 | Apps e trilhas | `ad-creatives` (workflow · divulgar) e `instagram-research` (tool · planejar): decidido. `ads-insights` (tool): trilha em aberto, proposta `escalar` | manifesto: `name`, `type`, `trail` |
| D2 | Títulos | "Criativos para anúncios" / "Ad creatives"; "Pesquisa no Instagram" / "Instagram research": proposto | manifesto: `title` |
| D3 | Ligação com o Seenaly | Nenhuma: decidido. Nenhum arquivo distribuído o cita | não se aplica |
| D4 | Redes da 1.x | Só Meta (Instagram e Facebook): decidido. O Top Ads do TikTok entra só como referência colhida à mão | README e `references/meta-anuncios.json` do `ad-creatives` |
| D5 | Chave externa | `APIFY_TOKEN`, opcional (`required: false`) | manifesto: `external_credentials`; o valor fica em `~/.flyee/keys.json` |
| D6 | Atores do Apify | Posts: `apify/instagram-post-scraper`. Comentários: `apify/instagram-comment-scraper`. Anúncios: o vencedor do teste da T0.3 entre `apify/facebook-ads-scraper` e `curious_coder/facebook-ads-library-scraper`; o outro fica de reserva | `references/fontes.json` de cada app, com `checked_on` |
| D7 | Teto de gasto por coleta | Proposto: avisar antes de qualquer coleta estimada acima de US$ 1 e nunca rodar sem limite de itens (o Radar avisava em US$ 5) | `references/fontes.json`: `cost_warn_usd`, `max_items` |
| D8 | Versão gratuita | Proposto: `instagram-research` sai completa na 1.0.0, como os outros tools; `ad-creatives` sai reduzida na 1.0.0 e completa na 1.1.0 no mesmo dia (recorte no início do ÉPICO 3) | console da plataforma (marca da versão grátis); `changelog` |
| D9 | Conceitos e estrutura da primeira campanha | Proposto: 3 conceitos, um por barreira ou motivador do comprador; um anúncio por conceito, os três no mesmo conjunto. Cada anúncio leva uma peça por posicionamento: 9:16 em Stories e Reels e, na 1.1.0, 4:5 no feed. A conta da verba diz se esse conjunto sai da fase de aprendizado. Confere-se no Gerenciador na T0.7 | `references/conceitos.md` e `references/lancamento.md`; constante em `scripts/lib/concepts.mjs` |
| D10 | Conta da verba | 50 eventos de otimização em 7 dias por conjunto. Só achei em fontes de terceiros que citam a Meta: conferir na Central de Ajuda no dia e gravar a data | `references/lancamento.md`; constante com fonte e data em `scripts/lib/budget.mjs` |
| D11 | Confiança de um conceito | Proposto: pelo número de tipos de fonte independentes que o apoiam. 0 = aposta, 1 = baixa, 2 = média, 3 ou mais = alta | `scripts/lib/concepts.mjs` |
| D12 | Regra de seleção e limiares da leitura de concorrentes | Proposto: os 10 primeiros cartões ativos de cada concorrente, todos registrados, sem escolha; o script ordena por tempo no ar. Anúncio "mantido" a partir de 30 dias no ar; um ângulo vira padrão do mercado quando aparece em 2 ou mais concorrentes; concorrente com menos de 3 anúncios ativos é indício. Fecha na T0.4, com o operador no papel do integrante | `references/pesquisa-manual.md`; constantes em `scripts/lib/evidence.mjs` |
| D13 | Pastas no projeto do integrante | `./anuncios/<campanha>/`, `./instagram-research/` e `./ads-insights/` | constantes dos scripts; permissões `fs:write` |
| D14 | O app escreve na conta de anúncios? | Não: decidido. Ele prescreve, e quem cria a campanha é a pessoa | invariante 5 |
| D15 | Amostra mínima para julgar uma peça (`ads-insights`) | Em aberto. Decide-se com o export real da campanha do MedChina | `references/leitura.json` do `ads-insights` |
| D16 | Posicionamentos de anúncio no feed (4:5 e 1:1) | Valores do Guia de Anúncios da Meta, conferidos no dia | `modules/video-render/references/redes.json` |
| D17 | IAs testadas e core | `compatible_ais: ["claude_code"]`; `min_core` `>=1.3.0` no workflow (usa a `texto-natural`) e `>=1.1.0` no tool | manifesto |
| D18 | Dados do caso MedChina | Oferta, página de destino, evento de otimização, verba e concorrentes: o operador informa na T0.1 | `anuncios/medchina-rodada-0/briefing.md` no projeto `medchina` (`C:\AppsProjects\conteudo\medchina`), nunca no repositório |
| D19 | Etiquetas próprias | Proposto: barreira ou motivador, ângulo, família de gancho, tipo de prova, estrutura e estilo visual, em listas do próprio app. Fecham com os conceitos da T0.5 | `references/etiquetas.json` do `ad-creatives` |
| D20 | Limites do texto do anúncio | Texto principal com 125 caracteres visíveis antes do "ver mais", título com 40, os botões aceitos pela Meta. São números de guias de terceiros: conferir no Guia de Anúncios da Meta e gravar a data | `references/meta-anuncios.json`, com `checked_on` |
| D21 | Nome de cada anúncio | O do site do integrante, perguntado no briefing: um site pode escolher a manchete pelo nome que chega no `utm_content`. O MedChina usa `<ângulo>-<formato>-<gancho>-v<n>` (`medchina/apps/web/src/lib/offer-angles.ts`). Sem convenção, o app usa `<conceito>-<formato>-<gancho>-v<n>`, em minúsculas, ASCII e com hífen | briefing da campanha; `entrega/nomes.json` |

### Decisões de 2026-10-23: o plano, a medição e a base

Decididas pelo operador em 2026-10-23, depois de uma avaliação de prontidão: um pedido de plano de tráfego pago a nível de especialista precisa de 36 coisas, 20 essenciais; nenhuma era coberta inteira por um app, 16 em parte e 20 só pelo conhecimento geral da IA, 10 delas essenciais. O desenho passou por uma crítica adversarial antes destas decisões.

| # | Decisão | Valor | Onde mora |
|---|---|---|---|
| D22 | Produto, não um pedido de marca | ⚠️ Decidido: tudo o que este plano constrói é produto do flyee. Nenhum épico, aceite, data, fixture ou exemplo se vincula a um pedido de uma marca do operador; os casos de teste usam uma marca fictícia. Vale para o que já estava escrito acima: onde um épico anterior cita o caso de uma marca como razão ou prazo, leia como história | este plano; `modules/*/tests` |
| D23 | Faixas de referência e cenários | Decidido: um app pode carregar faixas de mercado (custo por lead, taxas de conversão, CPM) e calcular cenários condicionais, desde que toda faixa venha rotulada como regra de bolso com fonte, moeda e data, e todo cenário seja aritmética sobre suposições rotuladas ("se o lead custar X, a verba Y traz Z"). Nenhum app prevê resultado. A regra "nenhum número sai de estimativa" passa a "nenhum número sem rótulo e fonte" | `references/referencias.json` do `media-plan`; o verificador de promessa continua |
| D24 | O que o plano sugere | Decidido: evento de otimização e ponto de conversão, verba por fase e por canal, públicos, a forma da oferta (anual parcelado, bônus, vagas, prazo, condição para quem já é cliente) e faixas de desconto calculadas dos números do integrante, como opções com `source: sugerido-pendente` até o sim. Nunca sugere resultado nem inventa fato da marca | `premissas.json` e `plano.json` do `media-plan` |
| D25 | Onde vive o plano | Decidido: app próprio, `media-plan` (workflow · planejar), com `plano.json` como interface v1 lida pelo `ad-creatives`, pelo `contact-base` e pelo `ads-insights` | manifesto; `references/interface.md` |
| D26 | Publicação | ⚠️ Decidido, contra a recomendação de instalar só num projeto: construir para publicar. `media-plan` e `contact-base` saem com a 1.0 reduzida e a 1.1 completa no mesmo dia, como os workflows; `ads-insights` sai completo na 1.0.0, como os tools. Guias em pt-BR e en, exemplo da loja nos dois idiomas | console da plataforma; `changelog` |
| D27 | Busca do Google | ⚠️ Corrige a D4: a Busca do Google entra. No plano (veredito, palavras, correspondências, negativas, campanha de marca), na medição (tag do Google Ads e conversão) e na leitura (export do Google Ads). Os criativos do `ad-creatives` ganham os anúncios de texto da Busca; as peças de vídeo e imagem seguem só na Meta | `media-plan`, `ads-insights`, `ad-creatives` |
| D28 | Amostra mínima | Fecha a D15 com um padrão rotulado: gancho e CTR legíveis com ao menos 1.000 impressões e 30 cliques no link por anúncio; custo por resultado legível com 30 resultados ou mais; "cortar" com zero resultados depois de 3 vezes o custo permitido; abaixo disso, indício, e o texto diz. Revisão com o primeiro export real de qualquer integrante | `references/leitura.json` do `ads-insights` |
| D29 | Dados pessoais de uma base | Decidido: a base limpa fica na pasta do projeto da marca, nunca em `~`, nunca sai da máquina, nunca entra em relatório, contagem, telemetria ou saída de outro app; o público para a Meta sai com os valores já transformados em hash | `contact-base`, invariante 13 |
| D30 | LGPD como método | Decidido: o `contact-base` registra a base legal de cada grupo e marca a régua como pendente enquanto ela faltar; a primeira mensagem a quem não é contatado há 6 meses ou mais é repermissão. Sem cerimônia de assinatura e sem regra derivada da história de uma marca | `contact-base`, `references/base-legal.md` |
| D31 | Avisos MIT | Decidido: cada app que adapta trechos substanciais do goose-skills (Copyright (c) 2026 GooseWorks) ou do agency-agents (Copyright (c) 2025 AgentLand Contributors) leva um `NOTICE.txt` com o aviso de copyright e o de permissão; o opensquad declara MIT sem arquivo de licença, então entra só como ideia de método, sem texto copiado. O `.txt` passa pela regra de texto do pacote: sem travessão | `modules/<slug>/NOTICE.txt` |
| D32 | Nomes e trilhas | `media-plan` "Plano de estratégia e mídia" (workflow · planejar); `ads-insights` "Medição e leitura de resultados" (tool · escalar, a trilha que a D1 propôs); `contact-base` "Base de contatos e CRM" (workflow · vender). Skill nova `ad-landing-page` no `ad-creatives` | manifestos |
| D33 | Exceção do "fale simples" | Decidido: quando o pedido é um plano, um relatório ou uma leitura de resultados, o chat traz o que foi olhado, dois ou três achados e o primeiro passo, e o documento completo vai para o arquivo do app, indicado numa frase; as perguntas vão numa mensagem só, até quatro, cada uma com a sugestão e o que muda se a resposta for outra. Entra no core 1.10.0 (CLI 1.2.3) e se repete nas skills dos apps de plano e leitura | `packages/core/assets/agents/*.md`; skills |

## 0.5 Convenções do repositório que valem para todas as tarefas

- **Fronteira.** Tudo em `modules/<slug>/` fora de `tests/`, `.dev/` e `*.dev.md` vai para o integrante: pt-BR, sem nome interno, sem citar avaliações. O `validate` recusa comando de instalação e "no seu terminal" em qualquer `.md` distribuído, inclusive dentro de bloco de código (`packages/module-tools/src/validate.ts:156-167`).
- **Criação.** App novo só por `npm run apps -- new`. O modelo deixa valores a corrigir à mão: quatro `compatible_ais`, `min_core ">=1.0.0"` e uma permissão `fs:write ./saida/`. `files` é gerado por `npm run pack`.
- **Entre apps.** Um app chama outro por `node .flyee/modules/<outro>/scripts/<x>.mjs --json` e nunca importa código dele. A relação do catálogo é lida desse caminho literal num arquivo distribuído, e o README precisa citar a dependência.
- **Scripts.** Node sem dependências, Windows primeiro, `--json` em todo comando, progresso no stderr, erro como `{ code, message, fix }`.
- **Chave.** Variável de ambiente primeiro (vazia quer dizer sem chave), depois `~/.flyee/keys.json`. Nunca no chat, num comando ou num arquivo do projeto.
- **O projeto é a pasta.** O que um app aprende da marca e o que entrega fica na pasta dele, na raiz do projeto (`anuncios/`, `instagram-research/`, `ads-insights/`), nunca em `~` nem num cache partilhado entre projetos (`.claude/rules/apps.md:6`). O cache de perfis do `instagram-research` também fica na pasta dele.
- **Texto.** Todo `.md` distribuído passa no verificador de pt-BR e pela skill `humanizer-pt-br`. "impulsionar" e "jornada" geram aviso fora de aspas (`packages/module-tools/src/text-lint.mjs:24`).
- **Testes.** Só `modules/<slug>/tests/*.test.mjs`, sem subpastas (`package.json:21`).
- **Árvore compartilhada.** Cinco dos seis apps e dez arquivos estão sem commit, de outras sessões. Antes de tocar em `modules/video-render`, conferir as sessões ativas e a seção 6 de `docs/PLANO-VIDEO.md`. Cada commit leva só os arquivos deste trabalho.
- **Uso.** Apps são testados no workspace (`C:\AppsProjects\flyee-workspace`) e usados para uma marca no projeto dela (`C:\AppsProjects\conteudo\<nome>`), nunca dentro deste repositório nem no repositório de código da marca (`.claude/skills/apps/SKILL.md:34`).
- **Fechamento.** `npm run validate` sem slug antes de dar um épico por pronto: só assim aparece nome de skill repetido entre apps.

## Invariantes

1. **Nenhum número sai de estimativa.** Plays, tempo no ar, custo e verba vêm de uma coleta ou do script. Um número plausível inventado é o único erro que o integrante não consegue perceber.
2. **O app não promete nem prevê resultado.** A evidência ordena apostas. O conferidor de texto bloqueia promessa de ROAS, CPA ou venda nas fichas e nas notas de lançamento.
3. **Todo dado carrega origem e data.** Apify, link, captura de tela, exportação ou declaração do integrante. Conceito sem evidência sai marcado como aposta, nunca vestido de achado.
4. **Nunca usar login, cookie ou sessão do integrante para colher dado da Meta.** Os atores do Apify rodam sem a conta dele; é isso que mantém a conta fora de risco.
5. **Nunca escrever na conta de anúncios nem pedir credencial dela.** É dinheiro em jogo e não há como desfazer.
6. **Sem a chave o app entrega.** O modo manual é o modo base, e a chave só automatiza.
7. **Nenhuma coleta paga sem limite de itens, e acima do teto (D7) só depois de dizer o custo estimado.** Um ator sem limite pode gastar o crédito do mês numa chamada.
8. **O integrante não abre o terminal.** A pesquisa manual acontece no navegador, com links prontos.
9. **Reels e post estático nunca dividem um ranking, e números de redes diferentes nunca são comparados.** As escalas não são as mesmas.
10. **Leitura que falha vira pedido ao integrante, com as opções.** O app não tenta outro caminho por conta própria para o mesmo conteúdo.
11. **Depoimento, antes e depois e pessoa real só com material que o integrante forneceu.** Nada de semelhança de pessoa gerada.
12. **Amostra pequena é indício, e o texto diz isso.** Perfil com menos de 5 Reels medidos não tem mediana confiável.
13. **Arquivos compartilhados do motor (`accept`, comandos de som, `redes.json`) só mudam depois de conferir as outras sessões.**
14. **Peça sem `window.boxes(t)` não conta como conferida.** O motor só avisa quando faltam as caixas e pula capa, texto e área segura; o `ads.mjs` trata esse aviso como reprovação.
15. **A confiança de um conceito é calculada pelo script, nunca escrita pela IA.** Se a IA pudesse escrever, a ficha viraria opinião com cara de medida.

## Passo 0 do catálogo

| Grupo | Apps | O que o plano faz |
|---|---|---|
| Chamar em execução | `video-render` (obrigatório), `instagram-research` (novo), `video-analysis` e `youtube-research` (opcionais) | O workflow chama cada um pela interface; ausência de um opcional é oferecida para instalação e o trabalho segue sem ele |
| Usar na construção | `video-studio`, `motion-carousel` e o plugin Radar | Servem de modelo de página, trilha e método, e produzem peças do caso MedChina na rodada zero |
| Sobreposição | `video-studio` atende o pedido "anúncio animado" na descrição da skill `motion-video` | Não mexer nele. A descrição do `ad-creatives` fala em campanha, pesquisa e conjunto de peças; quem quer um vídeo só é encaminhado ao Estúdio |
| Ferramenta que falta | Pesquisa de Instagram e leitura de resultados | Viram `instagram-research` e `ads-insights`. Geração de imagem continua dentro do `motion-carousel` e fica fora da 1.x |

## Ordem e caminho crítico

1. **Criativos reais do MedChina primeiro:** T0.1 → T0.3 ou T0.4 → T0.5 → T0.6 → T0.7, à mão, com os apps que já existem. São duas ou três sessões de trabalho. A T0.2 corre em paralelo; se não ficar pronta a tempo, os conceitos usam a pesquisa de 2/set, com a ressalva da base por amostra.
2. **`instagram-research`** (ÉPICO 1) começa junto, porque o núcleo dele é o script da T0.2.
3. **Motor** (ÉPICO 2): uma prova sem mudar código (T2.1) e uma entrada aditiva na tabela, se a sessão dona concordar (T2.2).
4. **`ad-creatives`** (ÉPICO 3), destilado da rodada zero: 1.0.0, depois 1.1.0.
5. **`ads-insights`** (ÉPICO 4), quando a campanha tiver ao menos uma semana de gasto exportável.
6. **Fechamento** (ÉPICO 5), ao fim do ÉPICO 3 e de novo ao fim do ÉPICO 4.

## ÉPICO 0: rodada zero do MedChina, à mão, no projeto da marca

**Bloqueia:** os casos de avaliação, as fixtures e as decisões D6, D9, D10, D12, D16, D19 e D20. Não bloqueia o começo do ÉPICO 1.

Tudo deste épico fica no projeto do MedChina, em `C:\AppsProjects\conteudo\medchina\anuncios\medchina-rodada-0\`. Nada dele entra no repositório, a não ser o que a T0.8 destilar.

⚠️ **Correção (2026-10-12).** A primeira versão deste plano punha a rodada no workspace. A regra de `.claude/skills/apps/SKILL.md:34`, que entrou no mesmo dia, deixa o workspace para teste e manda o trabalho real de uma marca para o projeto dela.

**Andamento em 2026-10-12** (o texto de cada tarefa abaixo continua como foi aprovado):

| Tarefa | Estado | Onde está |
|---|---|---|
| T0.0 | ✅ | `docs/PLANO-ANUNCIOS.md` e as duas linhas de `docs/PLANO.md` |
| T0.1 | ✅ | projeto `medchina` com cinco apps em dia; `briefing.md`; `APIFY_TOKEN` salva. Destino `/assinar`, otimização por compra, R$ 50 por dia |
| T0.2 | 🟡 | medido só o @medchina.ai pelo Apify (27 Reels, mediana de 59 plays). Faltam os perfis do nicho e a comparação com a captura manual |
| T0.3 | ✅ | `pesquisa/teste-atores.md`. D6 fechada: `curious_coder` principal, `apify/facebook-ads-scraper` de reserva. Falta conferir `collation_count` no site |
| T0.4 | ⬜ | os links estão em `pesquisa/links.md`; a coleta manual com o operador não foi feita |
| T0.5 | ✅ | `conceitos.json` e `conceitos.md`: `memoria`, `confianca` e `mtc`, aprovados, confiança média nos três. Falta a fala do público |
| T0.6 | ✅ | em `entrega/`: três vídeos 9:16 de 15 s com som, conferidos para `ads_meta` (10 de 10, sem avisos), e três imagens 4:5 conferidas com `--safe instagram-feed`; `nomes.json` e `textos.md`. A versão com a Débora está em `roteiros-debora.md`, sem gravação |
| T2.1 | 🟡 | a imagem estática está provada sem mudar o motor (as três imagens acima). O vídeo de feed em 4:5 não foi feito |
| T0.7 | 🟡 | `lancamento.md` com a conta aberta. Evento de otimização em aberto; D10, D16 e D20 ainda sem conferência na fonte da Meta |
| T0.8 | 🟡 | `C:\AppsProjects\flyee-workspace\prototipos\anuncios\destilado.md` |

Gasto com o Apify na rodada: US$ 0,30 em 10 execuções (`pesquisa/apify/*.run.json`).

### T0.0: gravar este plano no repositório
**Estado: ⬜** não existe `docs/PLANO-ANUNCIOS.md` (listagem de `docs/`: `ARQUITETURA`, `CATALOGO`, `COMO-CRIAR-UM-APP`, `PLANO`, `PLANO-VIDEO`, `RELEASE`).
- Salvar este plano como `docs/PLANO-ANUNCIOS.md` e acrescentar as linhas "Apoio · `instagram-research`" e "App · `ad-creatives`" na tabela de `docs/PLANO.md`, no padrão das linhas 14 a 19.
- **Aceite:** `docs/PLANO-ANUNCIOS.md` existe e `docs/PLANO.md` tem uma linha com "A fazer" que aponta para ele.

### T0.1: briefing do caso e workspace
**Estado: 🟡** existe a pesquisa orgânica de 2/set (`medchina/docs/radar/2026-09-02-radar-mtc-ia.csv`: 114 itens do Instagram, 102 perfis), o que pode e o que não pode ser dito (`medchina/docs/radar/2026-09-02-pautas-mtc-ia.md:6-16`) e a regra do funil, `Schedule → StartTrial → Purchase`, sem otimizar por criação de conta (`medchina/docs/FUNIL.md:9` e `:13`). Não existe coleta de anúncios de concorrentes (busca por "Ad Library" e "Biblioteca de Anúncios" em `medchina/docs` = zero) nem lista de concorrentes. A página de entrada do tráfego pago existe: `/assinar`, com a manchete escolhida pelo prefixo do nome do anúncio entre os ângulos `presenca`, `memoria`, `confianca`, `mtc`, `plano` e `china` (`medchina/apps/web/src/lib/offer-angles.ts`; `medchina/docs/FUNIL.md:110`).
- O operador informa os dados da D18: oferta e página para público frio, evento de otimização, verba diária, de 3 a 5 concorrentes e os perfis de Instagram do projeto.
- Com o sim do operador, criar o projeto com os apps que a rodada usa: `npm run apps -- project new medchina video-render video-analysis youtube-research motion-carousel video-studio`.
- Salvar a chave do Apify. Fora deste repositório, `npx flyee` cai no pacote antigo do npm (`flyee@0.7.9`), então a IA roda a CLI do repositório: `node C:/AppsProjects/flyee/packages/cli/dist/flyee.js key set APIFY_TOKEN --json` (`.claude/skills/apps/SKILL.md:32`). O comando abre a página e o operador cola a chave lá; a chave vale para a máquina inteira.
- **Aceite:** `briefing.md` existe com os campos da D18 preenchidos e a lista "não pode ser dito"; `npm run apps -- project list --json` mostra o projeto `medchina` com os cinco apps em dia; `key list --json` mostra `APIFY_TOKEN` salva, sem o valor.

### T0.2: evidência orgânica medida de novo
**Estado: 🟡** o ranking de 2/set existe, mas 105 dos 114 itens foram medidos contra a mediana do conjunto, sem o normal de cada perfil (coluna "Origem da base" = `proxy`). O próprio Radar diz que sem a mediana por perfil o resultado não serve (`radar-instagram/SKILL.md:49-51`). Os achados de duração da pauta não dependem disso e continuam valendo.
- Escolher de 12 a 20 perfis do nicho entre os 102, mais os do projeto, e medir os últimos 30 posts de cada um pelo Apify (`apify/instagram-post-scraper`; cerca de US$ 1 para 20 perfis, pela tabela de preços de hoje).
- Medir 3 desses perfis também pelo modo manual: uma captura da aba de Reels, lida pela IA.
- O script que faz a conta nasce aqui, fora do repositório, e vira o núcleo do `instagram-research`.
- **Aceite:** `evidencias.json` tem os posts com `data.baseline`, `data.multiplier` e `source`, no formato da T3.3; `comparacao-manual-apify.md` mostra, para os 3 perfis, a mediana pelos dois caminhos e a diferença.

### T0.3: teste dos dois atores da Biblioteca de Anúncios
**Estado: ⬜** nenhum ator foi rodado; até a T0.1 o flyee só tinha `GEMINI_API_KEY` salva nesta máquina (`key list --json`, 2026-10-12).
- Mesma busca nos dois atores: um concorrente, Brasil, só ativos, limite de 30. Comparar campos devolvidos, quantidade, custo cobrado e tempo.
- Abrir 3 anúncios no site e conferir se `collationCount` é o número de versões que a Biblioteca mostra.
- **Aceite:** `teste-atores.md` traz a tabela comparativa, o gasto total e a escolha da D6; os dois JSON brutos ficam salvos como fixtures.

### T0.4: pesquisa manual, com o operador no papel do integrante
**Estado: ⬜** o protocolo nunca foi executado. O site da Biblioteca devolve 403 a uma requisição sem navegador (testado em 2026-10-12), então a coleta sem chave depende de a pessoa abrir a página.
- A IA entrega os links já filtrados; o operador colhe 2 concorrentes pela regra da D12 e devolve links ou capturas.
- Testar o caminho por link: `yt-dlp` baixa um anúncio da Biblioteca? O `video-analysis` destrincha o vídeo baixado?
- **Aceite:** `protocolo-manual.md` registra o tempo gasto, cada dúvida que apareceu, a regra de seleção final (fecha a D12) e, por link testado, se o download funcionou.

### T0.5: conceitos e fichas
**Estado: ⬜** não existe conceito de anúncio para o projeto; as cinco pautas de 2/set miram alcance orgânico com chamada para seguir o perfil (`pautas-mtc-ia.md:8-15`).
- Colher a fala do público: `youtube-research comments` em vídeos do nicho e, com a chave, comentários de posts.
- Montar 3 conceitos, um por barreira ou motivador, cada um com a ficha das evidências e a confiança da D11. Cada conceito aponta para um ângulo que a `/assinar` já tem, para a promessa do anúncio ser a mesma da manchete.
- **Aceite:** `conceitos.json` tem 3 conceitos; cada um cita ao menos um `id` que existe em `evidencias.json` ou está marcado como aposta; a aprovação do operador está registrada em `diario.json`.

### T0.6: peças
**Estado: 🟡** o motor renderiza e confere o vertical de anúncio (`ads_meta`, `modules/video-render/references/redes.json:231`); não há posicionamento de feed para anúncio e nenhum app produz peça com pessoa falando.
- Por conceito: um vídeo 9:16 com som de até 15 s, conferido com `accept --networks ads_meta`, e uma imagem 4:5 tirada da mesma página com `frames --times <t> --format 4:5` e conferida com `accept <pagina> --format 4:5 --safe instagram-feed`. Sem o `--safe`, uma página 4:5 é conferida como slide de carrossel (`modules/video-render/scripts/lib/accept.mjs:105-108`).
- A página declara `window.boxes(t)`. Sem ele, o motor só avisa e não confere capa, texto nem área segura (`modules/video-render/scripts/commands/accept.mjs:316-323`).
- Versão com a Débora falando: o app entrega roteiro e plano de cenas; a gravação ou o avatar ficam por fora, como na pauta de 2/set.
- **Aceite:** cada vídeo e cada imagem têm relatório de `accept` com `passed: true`; os arquivos estão em `entrega/` com o nome do anúncio da D21 (`<ângulo>-<formato>-<gancho>-v1`), e abrir `/assinar?utm_content=<nome>` mostra a manchete do ângulo certo.

### T0.7: notas de lançamento e diário
**Estado: ⬜**.
- Conferir na Central de Ajuda e no Guia de Anúncios da Meta os números das D10, D16 e D20 e anotar a data.
- Fazer a conta da verba com os números do operador: o piso diário do conjunto para sair da fase de aprendizado, se a verba alcança, e a estrutura da D9. Dizer o que não mexer enquanto a campanha aprende.
- Deixar escrito quais colunas exportar do Gerenciador quando houver resultado.
- **Aceite:** `lancamento.md` mostra a conta aberta e as datas de conferência; `diario.json` tem a rodada 0 com peça, hipótese e data; depois que o operador monta a campanha, o diário registra se a estrutura da D9 coube no Gerenciador. Criar a campanha é do operador.

### T0.8: destilar
**Estado: ⬜**.
- Transformar cada falha e cada dúvida da rodada em regra, fixture ou caso de avaliação.
- **Aceite:** `destilado.md` lista as regras extraídas e os casos candidatos, e as fixtures brutas estão separadas, com os nomes de perfil trocados.

## ÉPICO 1: `instagram-research` 1.0.0

**Bloqueia:** a evidência orgânica automática do `ad-creatives` 1.1.0. Pode começar em paralelo ao ÉPICO 0.

**Andamento em 2026-10-17** (o texto de cada tarefa abaixo continua como foi aprovado). O app existe em `modules/instagram-research` 1.0.0, sem commit. `npm run validate` dá os 7 apps válidos, sem avisos. O app passa em 26 testes (`node --test "modules/instagram-research/tests/*.test.mjs"`), e `npm run test:apps` deu 364 aprovados, 0 falhas e 1 pulado. `npm run apps -- catalog --check` está em dia.

| Tarefa | Estado | Evidência |
|---|---|---|
| T1.1 | ✅ | `flyee.module.json`: `compatible_ais` só `claude_code`, `min_core >=1.1.0`, `APIFY_TOKEN` com `required: false`, as seis permissões da tarefa e nenhum valor do modelo |
| T1.2 | ✅ | `scripts/lib/{instagram,score,report}.mjs` e `util.mjs` copiado byte a byte; `tests/unit.test.mjs` tem um teste por item. O app não tem `--dir`: tudo é gravado sob `instagram-research/` |
| T1.3 | 🟡 | `import` lê a leitura versão 1 (`reels_grid` e `posts`, com origem `screenshot`, `link`, `export` ou `declared`) e o JSON do coletor de posts do Apify. Não lê planilha CSV. ⚠️ O aceite fala em `baseline.median`: o campo é `baseline.reels.value`, com `n` e `status` |
| T1.4 | ✅ | `scripts/lib/apify.mjs`; os quatro casos do aceite estão em `tests/e2e.test.mjs`. Em vez de variável de ambiente, `--apify-url` aceita só 127.0.0.1 ou localhost, para a chave nunca sair para outro endereço |
| T1.5 | ✅ | `check`, `profile`, `outliers`, `import`, `comments`, `list` e `help`, cada um com teste de envelope; `references/interface.md` (9 seções), `metodologia.md` e `fontes.json`; o catálogo mostra "sim v1 `scripts/research.mjs`" |
| T1.6 | ✅ | SKILL, README e guias `usar` e `abrir-o-capo` nas duas línguas, revisados com a `humanizer-pt-br`; `validate` sem avisos |
| T1.7 | 🟡 | `tests/eval.json` tem 9 casos. As fixtures são sintéticas (`tests/fixtures/posts.mjs`); a coleta real do @medchina.ai continua no projeto da marca e serviu ao aceite da T1.8 |
| T1.8 | ✅ | `dist/modules/instagram-research-1.0.0.zip` e `.sha256` (`812f87f2…`), ligado no projeto `medchina`. O `import` da coleta da T0.2 (`pesquisa/apify/ig-posts-medchina-ai.json`) deu a mesma mediana de 59 plays em 27 Reels e os mesmos multiplicadores 44,83 e 208,22. Uma coleta nova pelo app em 2026-10-17 deu 62 plays em 28 Reels, com o custo previsto de US$ 0,081 |

O `comments` também rodou no Apify real, no Reels de 12.285 plays: veio o único comentário do post, sem o nome de quem escreveu, por US$ 0,0026.

O que as coletas reais ensinaram, e que já está no app:
- O Apify lança o custo de uma execução alguns segundos depois que ela termina. Por isso o app lê a execução de novo, até quatro vezes, antes de informar o custo cobrado.
- O coletor de posts cobra US$ 0,007 a mais por foto ou carrossel com dados de música. Isso não apareceu na coleta e está anotado em `references/fontes.json`.

Gasto com o Apify neste épico: US$ 0,086 em três execuções.

Falta: o commit, que fica com o operador, e a publicação, que é passo de console (`docs/RELEASE.md`). O modo de capturas não foi testado com uma captura real da aba de Reels, só com a leitura de exemplo dos testes; a comparação entre captura e Apify continua pendente na T0.2.

### T1.1: criar o app e o manifesto
**Estado: ⬜** `modules/instagram-research` não existe.
- `npm run apps -- new instagram-research --type tool --trail planejar`, com título e resumo da D2; corrigir os valores que o modelo deixa.
- Manifesto: `APIFY_TOKEN` opcional; permissões para o próprio script, `network api.apify.com`, `fs:read ~/.flyee/keys.json (só a chave APIFY_TOKEN)`, as capturas e planilhas que a pessoa indicar, `fs:write ./instagram-research/` e `env APIFY_TOKEN`.
- **Aceite:** o manifesto tem esses campos e nenhum valor do modelo sobrou (`./saida/`, quatro IAs).

### T1.2: núcleo da conta
**Estado: 🟡** existe no `youtube-research` o que dá para copiar: `scripts/lib/util.mjs` inteiro, mediana, faixas, pesos e ordenação (`scripts/lib/score.mjs:15-52` e `:136-145`), formatação e CSV (`scripts/lib/report.mjs:17-29` e `:71-94`). Não existe nada de Instagram em código: no Radar a mediana por perfil, a faixa de duração e a isca de DM eram instruções para a IA.
- Copiar `util.mjs` byte a byte (as linhas 78 e 102 têm caracteres invisíveis).
- Novo `lib/instagram.mjs`: normalizar um item (`videoPlayCount`, `likesCount` igual a -1, `commentsCount`, `ownerUsername`, `timestamp`, `videoDuration`, `type`, `shortCode`), ler endereço de post e de perfil, ler número em pt-BR ("12,3 mil").
- Novo `lib/score.mjs` adaptado: mediana por perfil só com Reels, fixados fora, mínimo de 5; marcas `hidden_likes`, `dm_bait` (comentário ÷ curtida acima de 0,5), `ad`, `maturing`, `old`, `no_baseline`; faixas de duração até 20 s, de 21 a 60 s e acima.
- Não repetir os defeitos conhecidos: neutralizar `= + - @` no começo de célula do CSV, `interface_version` em todos os comandos, `--dir` preso à pasta do app.
- **Aceite:** `node --test modules/instagram-research/tests/unit.test.mjs` passa, com um teste para cada item desta lista.

### T1.3: modo manual
**Estado: ⬜** não há formato nem validador de dado trazido pelo integrante.
- Formato de leitura versão 1: a IA grava o texto como viu (`plays_text`) e o script converte; origem e data são obrigatórias.
- Comando `import <arquivo>` para leitura de captura, lista de links e planilha exportada.
- **Aceite:** teste em que uma leitura de fixture gera `profiles/<perfil>/profile.json` com `baseline.n`, `baseline.median` e `source.type = "screenshot"`; uma leitura sem origem devolve `reading_invalid` com o caminho do campo.

### T1.4: cliente do Apify
**Estado: ⬜** nenhum código do repositório fala com o Apify (busca por `apify` em `modules/` = zero; o Radar usava um conector). O leitor de chave existe e é copiável (`modules/video-analysis/scripts/lib/tools.mjs:155-193`).
- `lib/apify.mjs` com `fetch` e tempo limite, chave no cabeçalho e nunca no endereço, classificador de erro, aviso quando vem menos do que foi pedido e estimativa de custo antes de rodar.
- Opção `--apify-url` para o teste apontar um servidor falso, como o `--gemini-url` do `video-analysis`.
- **Aceite:** teste de ponta a ponta com servidor em `127.0.0.1`: com chave, os itens voltam normalizados; sem chave, o comando orienta o modo manual e sai com 0; resposta 401 vira `apify_unauthorized`; custo acima do teto devolve `needs_confirmation` e o servidor registra zero chamadas.

### T1.5: comandos e interface 1
**Estado: ⬜**.
- `check`, `profile`, `outliers`, `import`, `comments`, `list`, `help` em `scripts/research.mjs`, no esqueleto de `modules/youtube-research/scripts/research.mjs`.
- `references/interface.md` nas nove seções do `youtube-research`, com "Versão da interface: **1**." e as linhas literais de comando que o catálogo lê; `references/metodologia.md`; `references/fontes.json` (D6 e D7).
- **Aceite:** `npm run apps -- catalog` mostra o app com "sim v1 `scripts/research.mjs`"; há um teste de envelope para cada comando.

### T1.6: skill e README
**Estado: ⬜**.
- `skills/instagram-research/SKILL.md` e `README.md` com "Peça assim", "Sem a chave", o custo com o Apify e uma frase sobre os termos da Meta, como o Radar já diz.
- Passar pela `humanizer-pt-br`.
- **Aceite:** `npm run validate instagram-research` devolve válido, sem avisos.

### T1.7: avaliações
**Estado: ⬜**.
- `tests/eval.json` com os casos: outliers com chave, por captura de tela, sem chave, perfil com menos de 5 Reels, curtidas ocultas, leitura que falha e custo acima do teto.
- **Aceite:** o arquivo tem ao menos 7 casos e as fixtures da T0.2 estão em `tests/fixtures/`.

### T1.8: pacote e uso no workspace
**Estado: ⬜**.
- `npm run pack instagram-research`, ligar no projeto (`npm run apps -- link instagram-research --project medchina`) e refazer a medição da T0.2 pelo app.
- **Aceite:** existem `dist/modules/instagram-research-1.0.0.zip` e o `.sha256`; com as mesmas entradas, as medianas do app são iguais às do script da T0.2.

## ÉPICO 2: o que o motor precisa para anúncio

**Bloqueia:** só o rótulo do vídeo de feed no `ad-creatives` 1.1.0 (T2.2). A T2.1 não muda código.

**Andamento em 2026-10-21.** T2.1 🟡: o caminho foi provado pelo `ad-creatives` 1.1.0 sem mudar o motor. A imagem sai de `frames --format 4:5` ou `1:1` e é conferida por `accept --safe instagram-feed`; o vídeo 4:5 sai de `render --format 4:5` e é conferido por `accept --networks feed` (`modules/ad-creatives/tests/templates.test.mjs` e a rodada real até o `final`, em `modules/ad-creatives/.dev/avaliacoes.md`). O aceite no projeto do MedChina não rodou, porque a pasta da rodada não existe mais (ÉPICO 3). T2.2 ⬜: não feita. O `ad-creatives` confere contra `feed`, como esta tarefa prevê, e a entrega diz isso.

### T2.1: provar a imagem estática e o vídeo de feed sem mudar o motor
**Estado: 🟡** o caminho existe e nunca serviu a anúncio:
- `frames` grava PNG no tamanho do formato, sempre monta a folha com o ffmpeg e apaga os `quadro-*.png` antigos da pasta (`modules/video-render/scripts/render.mjs:288-311`);
- `accept` na própria página exige `film.duration` e, para outro formato, `window.setFormat` (`scripts/commands/accept.mjs:280-286`), e recusa arquivo de imagem (`:184-185`);
- `--safe instagram-feed` usa a zona do próprio formato (`scripts/lib/accept.mjs:117` e `:144-147`).

O que fazer:
- No workspace, com uma página da T0.6 de duração nominal: `frames --times <t> --format 4:5` numa pasta só dela e `accept <pagina> --format 4:5 --safe instagram-feed --json`.
- O vídeo de feed: `render --format 4:5`, depois `accept <pagina> --format 4:5 --video <video> --networks feed`.
- **Aceite:** os dois relatórios em `anuncios/medchina-rodada-0/` com `passed: true`, gerados pela cópia do motor que já está no projeto, sem nenhuma edição em `modules/video-render`.

### T2.2: posicionamento de anúncio no feed
**Estado: ⬜** `ads_meta` só aceita 9:16 (`modules/video-render/references/redes.json:230-248`), e o único 4:5 e 1:1 da tabela é o feed orgânico (`:61-82`). Uma entrada nova não quebra os testes, que exigem uma lista mínima de redes (`tests/accept.test.mjs:434`) e conferem `defaults_by_format` e a listagem contra a própria tabela (`:441-443` e `:721-722`). O `video-render` 1.0.0 nunca foi publicado (nenhuma tag), então a mudança entra nele sem versão nova.
- Antes de tudo, rodar `ListAgents` e mandar mensagem à sessão dona de `redes.json`, `aceite.md`, `interface.md` e `tests/accept.test.mjs`. A divisão desses arquivos entre sessões foi combinada em 2026-10-07; a seção 6 de `docs/PLANO-VIDEO.md` lista os arquivos.
- Entrada `ads_meta_feed` com 4:5 e 1:1, durações e zonas do Guia de Anúncios da Meta (D16) e `checked_on` novo.
- O id entra no teste da linha 434, numa linha da tabela de `references/aceite.md` (186-199) e na lista de `references/interface.md:480`. A interface continua na versão 1, porque só acrescenta.
- Sem acordo, o `ad-creatives` confere o vídeo de feed contra `feed`, e o relatório da entrega diz isso.
- **Aceite:** `node --test modules/video-render/tests/accept.test.mjs` passa; `render.mjs networks --json` lista `ads_meta_feed`; o ZIP do `video-render` é refeito e o checksum novo fica anotado.

## ÉPICO 3: `ad-creatives` 1.0.0 e 1.1.0

**Bloqueia:** a T4.5. Depende da T0.8 para as regras e os modelos de página.

**Andamento em 2026-10-21** (o texto de cada tarefa abaixo continua como foi aprovado). O app existe em `modules/ad-creatives` 1.1.0, sem commit; a 1.0.0 é o ZIP de `dist/modules`, que passa a ser a fonte dela. `npm run validate` dá os 8 apps válidos, sem avisos. O app passa em 53 testes (`node --test "modules/ad-creatives/tests/*.test.mjs"`: 52 aprovados e 1 pulado, o do Motor de verdade, que passa com `ADS_TEST_REAL=1` em 4 minutos). `npm run apps -- catalog --check` está em dia, e o catálogo lê que o app usa `video-render`, `instagram-research`, `youtube-research` e `video-analysis`.

| Tarefa | Estado | Evidência |
|---|---|---|
| T3.1 | ✅ | `flyee.module.json`: `workflow · divulgar`, `compatible_ais` só `claude_code`, `min_core >=1.3.0`, sem `./saida/`; desde a 1.1.0, `APIFY_TOKEN` com `required: false` e as três permissões da T3.8 |
| T3.2 | ✅ | `scripts/ads.mjs` com os 13 comandos da tabela e mais seis: `capture` (a marca do site antes das peças; quando falha, as peças usam os arquivos do integrante), `approve` (o sim dos conceitos e de cada prévia, gravado com o hash do conteúdo, para que mudar o aprovado peça o sim de novo), `collect` (a coleta da 1.1.0), `status` (retomar uma campanha pelo `next_step`), `list` e `help`. Um teste por comando em `tests/commands.test.mjs`, contra o motor substituto `tests/fixtures/engine/render.mjs`, com a sequência do `final` conferida: no vertical `render`, `mix`, `frames` (a capa), `accept`, `probe`; no vídeo 4:5 `render`, `mix`, `accept`, `probe`; na imagem `frames`, `accept`. Os dois casos do `budget` estão em `tests/unit.test.mjs` |
| T3.3 | ✅ | `scripts/lib/evidence.mjs` e `concepts.mjs`; os três casos do aceite em `tests/unit.test.mjs` ("concepts (D11, D21)"). Entraram também o tipo `organic_pattern` (um padrão, com `n`) e a origem `apify` |
| T3.4 | 🟡 | `references/pesquisa-manual.md` e os casos do aceite em `tests/unit.test.mjs` ("evidence (D12)"), com leituras sintéticas (`tests/fixtures/campanha.mjs`). A T0.4 não rodou: o roteiro nunca foi seguido por uma pessoa, e o tempo que ele pede não foi medido |
| T3.5 | ✅ | `runtime/ad.js` e `ad.css`; os modelos `problema-mecanismo`, `produto-em-uso` e `lista` em `scripts/lib/pieces.mjs`. `tests/templates.test.mjs` com `ADS_TEST_REAL=1` passa no `accept` real: 9:16 com `ads_meta` (zona de 270, 672, 65 e 140 px) e, na 1.1.0, o vídeo 4:5 e as imagens 4:5 e 1:1 |
| T3.6 | ✅ | `skills/ad-creatives/SKILL.md` (passos 0 a 7), as seis referências da tarefa, README e guias `usar` e `abrir-o-capo` nas duas línguas; `validate` sem avisos |
| T3.7 | ✅ | `tests/eval.json` com 13 casos na 1.0.0; os resultados em `modules/ad-creatives/.dev/avaliacoes.md`: 11 passaram rodados por script em pastas isoladas de `C:\AppsProjects\flyee-eval`, 1 é coberto por teste e 1 não rodou ("vídeo avulso vai para o Estúdio", que depende da escolha da IA). `dist/modules/ad-creatives-1.0.0.zip`, sha256 `0df5d5a9c180bcfb57a1df99bcc74384346661b8b33582e3b8e436c20edd1ff6` |
| T3.8 | ✅ | a coleta (`collect`, `scripts/lib/adlibrary.mjs`, `apify.mjs` copiado do `instagram-research`), os parceiros (`scripts/lib/partners.mjs`), as três peças por conceito e `references/reels-de-teste.md`. `tests/apify.test.mjs` passa (5 testes, servidor falso do Apify). `tests/eval.json` tem 18 casos, os 5 novos da tarefa. `dist/modules/ad-creatives-1.1.0.zip` (32 arquivos), sha256 `952bc0f58357d0c14601631581eacb8414f3e4f5b8ba9de3612ff2e1255356c0`, refeito depois que os parceiros passaram a ser instalados sem esperar o sim (abaixo); o ZIP da 1.0.0 continua com `0df5d5a9…`. A 1.1.1 (2026-10-21) usa, numa sessão do Claude Code na nuvem, a chave do Apify guardada como segredo de rede do ambiente: `dist/modules/ad-creatives-1.1.1.zip` (32 arquivos), sha256 `7d8776ba5fdfaf9679b296526d2f86420fb402f01a3178d163f294367609b4be`; o registro está em `modules/ad-creatives/.dev/avaliacoes.md`. A rodada com o Motor de verdade foi do `new` ao `final` com as quatro peças: as nove finais passaram sem aviso (`.dev/avaliacoes.md`) |

**Envio à plataforma em 2026-10-21.** `ad-creatives@1.0.0` está no `85e2006`, fora da main e alcançável só pela tag, como o `8f2065f` das outras versões de entrada: o export dele empacota o mesmo `0df5d5a9…`. `ad-creatives@1.1.0` está no `7707f3c`. As tags subiram nessa ordem, uma por envio, para a importação do índice terminar com os textos da 1.1.0. As duas execuções do "Pack app" passaram, com o sha256 da plataforma igual ao do pacote (39667415323 e 39667535847). Publicar é o clique do operador em `/admin/catalogo/ad-creatives`: a primeira versão publicada ganha a marca de versão de entrada.

⚠️ **Correções (2026-10-21).**

- D10 foi conferida numa página da própria Meta, em 2026-10-21: `developers.meta.com/vr/resources/optimize-ad-campaign/` (50 eventos em 7 dias por conjunto). O valor e a fonte estão em `LEARNING`, `modules/ad-creatives/scripts/lib/budget.mjs:6-11`.
- D20: no Guia de Anúncios da Meta, o título tem 27 caracteres, não 40; o texto principal mostra 125 no feed e 44 nos Reels (`modules/ad-creatives/references/meta-anuncios.json`, conferido em 2026-10-21, com as fontes).
- A T2.2 não foi feita. Como ela mesma prevê, o vídeo 4:5 é conferido contra `feed`, e as imagens com `--safe instagram-feed`; a entrega diz isso (`zone_note` no relatório do `final` e uma linha de `lancamento.md`).
- As pastas citadas pelo ÉPICO 0 não existem mais: `C:\AppsProjects\conteudo` inteira, com `medchina\anuncios\medchina-rodada-0\`, e `C:\AppsProjects\flyee-workspace\prototipos\anuncios` (procuradas em 2026-10-21). Por decisão do operador, nada da rodada foi refeito nem guardado.
- A T3.8 pedia que o parceiro ausente fosse oferecido para instalar. Pela decisão do operador de 2026-10-21 (core 1.8.0), aplicada ao catálogo no mesmo dia, a IA diz numa frase qual app vai instalar e instala sem esperar o sim; se a instalação falhar, ou se o integrante pedir para não instalar, a campanha segue sem ele (`skills/ad-creatives/SKILL.md`, passo 0).
- A lista "O que este plano não cobre e o que não foi verificado", no fim, é a de 2026-10-12. A T0.3 rodou o coletor; o que segue sem verificação está nas lacunas abaixo.

**Lacunas declaradas.**

- A conversa não foi avaliada: os casos rodaram por script, no papel da IA do integrante. O executor de avaliações é a fase P7.
- O app nunca rodou uma coleta real no Apify; o coletor rodou na T0.3, fora do app. `collation_count` continua sem conferência na tela da Biblioteca.
- O download de um anúncio pela Análise de vídeo, pelo endereço do Apify ou pelo link da Biblioteca, não foi testado.
- Com o preço de 2026-10-21 (US$ 0,00075 por anúncio) e os limites do app (12 buscas, 10 anúncios por concorrente, 30 por palavra), a maior coleta custa US$ 0,27. O sim acima de US$ 1 (D7) só aparece se o preço subir.
- A 1.0.0 lê "0:06" e "6,4 s" errado num resultado próprio declarado (0 e 6). A 1.1.0 corrigiu; na 1.0.0, nenhum guia pede duração, e o ZIP ficou como estava, para manter o checksum da T3.7.

Recorte proposto (D8):

| | 1.0.0, a gratuita | 1.1.0, no mesmo dia |
|---|---|---|
| Apps exigidos | `video-render` | `video-render`; `instagram-research`, `video-analysis` e `youtube-research` quando instalados |
| Evidência | pesquisa manual guiada de anúncios de concorrentes e o que o integrante declara | mais a coleta pelo Apify com a chave, posts medidos do perfil e de concorrentes, comentários e anúncios de referência destrinchados |
| Peças | 3 conceitos, um vídeo 9:16 com som em cada | 3 conceitos em vídeo 9:16, vídeo 4:5 e imagem 4:5 ou 1:1 |
| Lançamento | a conta da verba e o que não mexer enquanto aprende | mais o guia de Reels de teste antes de pagar |

### T3.1: criar o app
**Estado: ⬜** `modules/ad-creatives` não existe. O nome de skill está livre: as existentes são `motion-carousel`, `analyze-video`, `video-render`, `motion-video`, `youtube-research` e `youtube-script`.
- `npm run apps -- new ad-creatives --type workflow --trail divulgar --title "Criativos para anúncios" --summary "<frase>"`. Corrigir `compatible_ais`, pôr `min_core` em `>=1.3.0` e tirar a permissão `./saida/`.
- Permissões da 1.0.0: o próprio script; `node .flyee/modules/video-render/scripts/render.mjs`; `ffmpeg, ffprobe`; o navegador já instalado; `network` só para o site da marca, na captura; `fs:read` da pasta da campanha e dos materiais; `fs:write ./anuncios/` e `./capturas/`.
- **Aceite:** `npm run validate ad-creatives` sem nenhum valor do modelo.

### T3.2: o script `scripts/ads.mjs`
**Estado: ⬜**. Copiar, nunca importar: o esqueleto e `scripts/lib/util.mjs` do `youtube-research`; a ponte com o motor de `modules/video-studio/scripts/lib/engine.mjs:10-178` (`findVideoRender`, `requireVideoRender`, `engineArgs`, `parseEngineOutput`, `runEngine`, `engineSupports`).

| Comando | O que faz |
|---|---|
| `check` | motor e apps parceiros por existência de arquivo, como o `youtube-script`; na 1.1.0, se a chave existe |
| `new <campanha>` | cria `./anuncios/<campanha>/` com o modelo do briefing |
| `brief <campanha>` | confere o briefing e devolve os campos que faltam |
| `links <campanha>` | monta os links filtrados da Biblioteca e o roteiro da coleta manual |
| `import <campanha> <arquivo>` | valida uma leitura (captura, lista de links, planilha) e junta à evidência |
| `evidence <campanha>` | resume a evidência: tempo no ar, versões, padrões entre concorrentes, indícios |
| `concepts <campanha>` | valida os conceitos, calcula a confiança e grava as fichas |
| `budget <campanha>` | a conta da verba com o que o briefing declara |
| `piece <campanha> <conceito>` | cria a página do conceito a partir de um modelo, com a zona de anúncio lida de `render.mjs networks --json` |
| `preview` e `final` | trilha, efeitos, render, mixagem, imagem estática e conferência, no molde do `preview` e do `final` do Estúdio |
| `copy <campanha>` | confere o texto do anúncio: limites da D20, promessa de resultado, a lista "não pode ser dito" e frase que afirma uma condição de quem vê ("Você sofre de…"), que a política de atributos pessoais da Meta recusa |
| `deliver <campanha>` | confere o conjunto e monta `entrega/` com os nomes etiquetados, `textos.md`, `lancamento.md` e `relatorio.json` |
| `journal <campanha>` | registra a rodada no diário |

- Pasta da campanha: `briefing.md`, `materiais/` (logo, telas, fotos e depoimentos que o integrante fornece), `pesquisa/` (links, capturas, leituras, brutos), `evidencias.json` e `.md`, `conceitos.json` e `.md`, `pecas/<conceito>/`, `entrega/`, `lancamento.md`, `relatorio.json`, `diario.json`.
- Nome de cada peça: o nome do anúncio da D21. O `deliver` grava `entrega/nomes.json` (arquivo, conceito, formato e nome do anúncio), que é a chave que o `ads-insights` usa (T4.2).
- ⚠️ **Correção (2026-10-12).** A versão aprovada deste plano nomeava a peça `<campanha>_<conceito>_<formato>`. A `/assinar` do MedChina tira os caracteres fora de `a-z` e do hífen e lê o primeiro trecho antes do hífen; com aquele nome, todo anúncio cairia no ângulo padrão.
- **Aceite:**
  - um teste por comando contra um motor substituto que registra as chamadas, no padrão de `modules/video-studio/tests/fixtures/engine/render.mjs`, e a sequência de chamadas do `final` bate com a esperada;
  - `budget` com custo por evento de R$ 45 e verba de R$ 500 por dia devolve piso de R$ 322 por conjunto e 1 conjunto;
  - com R$ 200 por dia, `budget` devolve `viable: false` e as três saídas: evento mais raso, mais verba, ou começar sabendo que não sai do aprendizado.

### T3.3: formatos da evidência e dos conceitos
**Estado: ⬜**.
- `evidencias.json` (versão 1). Cada item tem:
  - `id` e `kind` (`competitor_ad`, `organic_post`, `audience_comment` ou `own_result`);
  - `source`: `type` (`apify`, `link`, `screenshot`, `export` ou `declared`), `ref` e `collected_at`;
  - `who`;
  - `data` conforme o tipo: anúncio com `started_at`, `active`, `days_active`, `variations`, `text`, `cta` e `media`; post com `plays`, `baseline`, `multiplier` e `duration_s`; comentário com `text`;
  - `tags`, da D19.
- `conceitos.json` (versão 1). Cada conceito tem `key`, `driver` (barreira ou motivador, com o texto), `angle`, `hook`, `proof`, `structure`, `visual`, `formats`, `evidence` (ids) e `copy` (texto principal, título, descrição, botão).
- O script acrescenta `confidence` (D11) e recusa três casos: id de evidência que não existe; prova de depoimento, antes e depois ou pessoa real sem um arquivo do integrante em `materiais/`; e dois conceitos com o mesmo estilo visual e a mesma família de gancho.
- **Aceite:** testes com as fixtures da T0.5. Id inexistente devolve `concepts_invalid` com o caminho do campo; conceito sem evidência sai com `confidence: "aposta"`; uma confiança escrita no arquivo é sobrescrita pelo cálculo.

### T3.4: protocolo da pesquisa manual
**Estado: ⬜**. A T0.4 dá o roteiro real.
- **O que a IA prepara (`links`):** por concorrente, o link da Biblioteca filtrado por Brasil, anúncios ativos e todos os tipos, e cinco linhas sobre o que fotografar em cada cartão.
- **O que o integrante traz:** capturas em `pesquisa/capturas/<concorrente>/`, ou os links dos anúncios, que a IA grava num arquivo.
- **Como a captura vira dado:** a IA copia o texto como aparece, por exemplo `started_text: "Veiculação iniciada em 3 de jul de 2026"` e `variations_text: "3 anúncios usam esse criativo e esse texto"`, junto com o caminho da captura. O `import` converte data e número em pt-BR e recusa o que não entende (`reading_invalid`); a IA nunca converte por conta própria.
- **Seleção e limiares:** os da D12.
- **Aceite:** teste com as leituras da T0.4. As datas viram `started_at` e `days_active`, contados até `collected_at`; leitura sem a captura de origem é recusada; concorrente com 2 anúncios ativos sai como indício.

### T3.5: runtime e modelos de página
**Estado: 🟡** o motor tem as funções de texto e caixas (`fitText`, `wrapText`, `domBoxes` em `modules/video-render/runtime/motion.js`), mas `Motion.safeArea` só conhece a zona de cada formato (`:208-218`), e a zona do anúncio é maior (`references/formatos.md:51`). O `studio.js` do Estúdio desenha na zona orgânica.
- `runtime/ad.js`: layout por formato com a zona que o `piece` grava na página, `setFormat` para 9:16, 4:5 e 1:1, caixas por `data-role` e texto que cabe.
- Três modelos destilados da T0.6, sem pessoa real: problema e mecanismo, produto em uso (com a tela capturada) e lista. Um modelo de prova só entra com material do integrante (invariante 11).
- **Aceite:** com navegador e ffmpeg, cada modelo passa no `accept` real em 9:16 com `ads_meta` (e, na 1.1.0, em 4:5). Sem eles o teste é pulado, e uma variável de ambiente o faz rodar inteiro, como em `modules/video-studio/tests/studio.test.mjs:2297-2309`.

### T3.6: skill, guias e README da 1.0.0
**Estado: ⬜**.
- `skills/ad-creatives/SKILL.md`, em passos:
  0. conferir a máquina;
  1. briefing: perguntar só o que falta, sem inventar oferta nem preço;
  2. evidência, pelo protocolo manual;
  3. conceitos: o integrante aprova os três;
  4. peças: prévia aprovada antes do final;
  5. texto do anúncio: passar pela skill `texto-natural` e depois pelo `copy`;
  6. entrega e notas de lançamento;
  7. diário e `npx flyee track tool.executed --module ad-creatives`.
- A descrição da skill fala de campanha e criativos de tráfego pago. Para um vídeo animado avulso, a skill indica o Estúdio de vídeo.
- `references/`: `pesquisa-manual.md`, `conceitos.md`, `etiquetas.json`, `meta-anuncios.json`, `lancamento.md`, `pagina-anuncio.md`.
- README com "Peça assim" e com o que o app não faz: não cria a campanha e não promete resultado. Todo o texto passa pela `humanizer-pt-br`.
- **Aceite:** `npm run validate ad-creatives` válido, sem avisos.

### T3.7: avaliações e pacote da 1.0.0
**Estado: ⬜**.
- `tests/eval.json` com estes casos:
  - rodada zero sem chave;
  - briefing incompleto;
  - concorrente sem anúncio ativo;
  - conceito sem evidência;
  - pedido de "garanta que vai vender";
  - termo da lista "não pode ser dito" no texto;
  - verba que não sai da fase de aprendizado;
  - pedido de um vídeo avulso, que vai para o Estúdio.
- Rodar os casos como integrante, cada um numa pasta isolada: `FLYEE_WORKSPACE=C:/AppsProjects/flyee-eval/<caso> npm run apps -- link ad-creatives video-render`.
- `npm run pack ad-creatives`. Daqui em diante o ZIP é a fonte da 1.0.0.
- **Aceite:** existem `dist/modules/ad-creatives-1.0.0.zip` e o `.sha256`, e o resultado de cada caso fica em `modules/ad-creatives/.dev/avaliacoes.md`.

### T3.8: 1.1.0
**Estado: ⬜**.
- `npm run apps -- bump ad-creatives minor`.
- Coleta pelo Apify com o ator da D6:
  - cliente copiado de `modules/instagram-research/scripts/lib/apify.mjs` (T1.4);
  - estimativa de custo e confirmação acima do teto (D7);
  - `APIFY_TOKEN` opcional em `external_credentials`, com as permissões `network api.apify.com`, `fs:read ~/.flyee/keys.json (só a chave APIFY_TOKEN)` e `env APIFY_TOKEN`.
- Parceiros:
  - evidência orgânica pelo `instagram-research`;
  - fala do público pelo `youtube-research comments`;
  - anúncios de referência pelo `video-analysis analyze --focus editing --instructions .flyee/modules/ad-creatives/references/analise-anuncio.md`.
  - Parceiro ausente é oferecido para instalar, e o trabalho segue sem ele, como em `modules/youtube-script/references/pesquisa.md:7-9`.
- Os três formatos e o guia `references/reels-de-teste.md`: publicar as peças como Reels de teste, comparar umas com as outras depois de 72 horas e registrar o resultado como `own_result`.
- Casos novos de avaliação: com chave, chave vazia, custo acima do teto, parceiro ausente, anúncio de referência que não baixa.
- Se a 1.0.0 precisar de correção depois do bump: extrair o ZIP numa pasta temporária, corrigir, devolver `tests/eval.json` e chamar `packModule` de `packages/module-tools/src/pack.ts`. Nunca usar `fs.cpSync` recursivo no Windows.
- **Aceite:**
  - o teste de ponta a ponta com o servidor falso do Apify passa;
  - `npm run validate` sem slug sai válido;
  - existem `dist/modules/ad-creatives-1.1.0.zip` e o `.sha256`;
  - o ZIP da 1.0.0 mantém o checksum anotado na T3.7.

## ÉPICO 4: `ads-insights` 1.0.0 e a rodada seguinte

**Bloqueia:** nada. Depende do export real da campanha do MedChina (T0.7), que dá as fixtures e fecha a D15.

### T4.1: leitor do export do Gerenciador
**Estado: ⬜** não há leitor de CSV no repositório (o `youtube-research` só escreve CSV, `scripts/lib/report.mjs:78-94`).
- Criar o app (`tool`, trilha da D1), sem chave na 1.0.0: a pessoa exporta a tabela no nível de anúncio e o app diz quais colunas pedir.
- Leitor que aceita cabeçalho em português e em inglês, vírgula ou ponto e vírgula, decimal com vírgula e BOM.
- **Aceite:** teste em que o export real (com os nomes trocados) e uma fixture em inglês geram a mesma tabela normalizada; coluna ausente aparece em `missing` e nunca vira zero.

### T4.2: ligar peça e resultado
**Estado: ⬜**.
- O nome do anúncio vem de `entrega/nomes.json`, gravado pelo `ad-creatives`. O que não casar é listado, nunca adivinhado.
- **Aceite:** teste com 6 anúncios em que 5 casam com nomes de `entrega/` e 1 sai em `unmatched`.

### T4.3: veredito com guarda de amostra
**Estado: ⬜**.
- Por peça: quem ficou nos 3 primeiros segundos, quem viu até o fim, CTR e custo por resultado. Veredito entre escalar, manter, iterar, cortar e dado insuficiente, pelas regras da D15, e a indicação de onde a peça falha (gancho, miolo ou página).
- **Aceite:** um teste por veredito com tabelas sintéticas; peça abaixo da amostra mínima devolve sempre `insufficient_data`.

### T4.4: interface, skill, README, avaliações e pacote
**Estado: ⬜**.
- Comandos `check`, `import`, `report` e `list`, interface 1, pasta `./ads-insights/`. Mesmo roteiro das T1.5 a T1.8.
- **Aceite:** `npm run validate ads-insights` válido sem avisos; o catálogo mostra "sim v1"; o ZIP e o `.sha256` existem.

### T4.5: `ad-creatives` 1.2.0, a rodada seguinte
**Estado: ⬜**.
- `npm run apps -- bump ad-creatives minor`. Novo passo na skill: ler o relatório do `ads-insights`, gravar o resultado no diário e propor a rodada seguinte, com o resultado do próprio anúncio como o tipo de evidência mais forte.
- **Aceite:** caso de avaliação com a fixture do MedChina em que os conceitos da rodada seguinte citam `id` de resultado e nenhum conceito cortado volta igual.

## ÉPICO 5: fechamento

Roda ao fim do ÉPICO 3 e de novo ao fim do ÉPICO 4.

### T5.1: catálogo e documentos
**Estado: 🟡** o catálogo é regenerado por gancho a cada escrita em `modules/`; os documentos não.
- Atualizar as linhas de `docs/PLANO.md` e o trecho "Where things stand" do `CLAUDE.md`. Marcar no topo de `docs/PLANO-ANUNCIOS.md` o que virou história. Levar para `.claude/rules/apps.md` as regras que ficaram: dado trazido pelo integrante carrega origem, e coleta paga tem teto.
- **Aceite:** `npm run apps -- catalog --check` e `npm run harness:check` passam.

### T5.2: verificação completa e commit
- Commit só quando o operador pedir, e só com os arquivos deste trabalho. Com trabalho de outras sessões na árvore, conferir o recorte numa cópia antes: `git checkout-index` dos arquivos preparados para uma pasta temporária, testes ali e um `AGENTS.md` gerado a partir deles.
- **Aceite:** `npm run ci:verify` verde.

### T5.3: entrega para publicação
- Publicar é passo de console do operador (`docs/RELEASE.md`) e não faz parte deste plano. Este plano entrega os ZIPs, os checksums e a indicação de qual versão é a gratuita.
- **Aceite:** em `dist/modules/` existem `instagram-research-1.0.0`, `ad-creatives-1.0.0` e `ad-creatives-1.1.0`, cada um com o `.sha256`; depois do ÉPICO 4, também `ads-insights-1.0.0` e `ad-creatives-1.2.0`.

## O que falta para um plano de especialista (2026-10-23)

> Auditado contra o código em 2026-10-23 (HEAD `c24271e`). Os épicos abaixo foram desenhados a partir da avaliação de prontidão descrita nas decisões D22 a D33, de três repositórios MIT lidos na íntegra (goose-skills `marketing-agent`, agency-agents `marketing/` e `paid-media/`, opensquad) e das interfaces que já existem (`nomes.json`, `diario.json` e a conta da verba do `ad-creatives`). O caso de teste de todos eles é uma marca fictícia (D22).

### Passo 0 do catálogo, de novo

| Grupo | Apps | O que o plano faz |
|---|---|---|
| Chamar em execução | `video-render` (`capture`, para olhar o site antes de perguntar e para auditar a página), `instagram-research`, `youtube-research`, `video-analysis` (o plano só lê o que eles gravaram) | O `media-plan` lê o projeto; o `ad-creatives` passa a ler `plano.json`; o `ads-insights` lê `entrega/nomes.json` |
| Usar na construção | `humanizer-pt-br`, `texto-natural`, `project-doc`, `app-author` | Todo texto distribuído passa pelo humanizer; cada app novo tem o seu `.dev/SPEC.md` |
| Sobreposição | `ad-creatives` 1.1.1 (briefing, conta da verba, `lancamento.md`) | Sobrepõe o começo do plano. Estende, não duplica: o plano fica no `media-plan` e o `ad-creatives` 1.2 o consome; a conta da D10 continua no `ad-creatives` e é reimplementada no plano com a mesma fonte |
| Ferramenta que falta | medição e leitura de resultados; plano de estratégia e mídia; base de contatos e CRM | Viram `ads-insights`, `media-plan` e `contact-base`. Construtor de UTM, consulta de DNS, varredura de tags e leitor de CSV são finos demais para apps próprios e moram dentro deles |

### Invariantes que estes épicos acrescentam

14. **Nenhum número sem origem e data.** Dado medido vem de coleta, export ou do integrante; faixa de referência vem rotulada como regra de bolso com fonte, moeda e data; cenário é aritmética condicional sobre suposição rotulada. Nenhum app promete ou prevê resultado.
15. **O app prescreve; o integrante executa o que mexe em dinheiro ou envia.** Nenhum app escreve na conta de anúncios, na ferramenta de e-mail ou no WhatsApp, nem pede a credencial delas.
16. **Perguntas numa mensagem só, até quatro, cada uma com sugestão** e o que muda se a resposta for outra; uma sugestão nunca inventa fato da marca e fica `sugerido-pendente` até o sim.
17. **Os fatos da marca vivem no projeto** (`media-plan/marca.md`, `plano.json`) com fonte e data; todo app olha o projeto antes de perguntar.
18. **Contratos entre apps só crescem:** `plano.json`, `report.json`, `nomes.json` e `origens.csv` com `interface_version` 1 e mudanças aditivas; cada app que serve outro traz `references/interface.md`.
19. **Vereditos, confiança e datas legíveis são calculados pelo script, nunca escritos pela IA;** abaixo da amostra mínima (D28) a leitura é indício e o texto diz.
20. **Chat curto, documento completo** (D33).
21. **Oferta honesta:** preço de referência verdadeiro, prazo e regras escritas, arrependimento de 7 dias na compra à distância, cliente antigo nunca paga mais que o novo; o app aponta a colisão entre uma promoção vigente e a seguinte.

## ÉPICO 6: core 1.10.0, planos e relatórios

**Bloqueia:** nada; reforça as skills dos apps de plano e leitura, que repetem a regra.

### T6.1: a exceção do "fale simples"
**Estado: ✅ 2026-10-23** core 1.10.0 (`packages/core/assets/core.json`), a exceção do plano, relatório e leitura e a regra das perguntas em `agents/pt-BR.md` e `agents/en.md`; o pedido de plano vai ao app de plano e a leitura ao app de medição; CLI 1.2.3 (`packages/cli/package.json`) com `packages/cli/test/release-123.test.ts`.
- A regra "Fale simples" ganha a exceção da D33; a regra "use o app do pedido" ganha o exemplo: plano, estratégia, verba por fase e oferta vão para o app de plano, não para o briefing de criativos.
- Core 1.10.0 e CLI 1.2.3, só para publicar o core.
- **Aceite:** `packages/cli/test/release-123.test.ts` confere nos dois idiomas a exceção e o exemplo de roteamento; depois do `release-cli`, `npx --yes flyee@latest --version` imprime 1.2.3.

## ÉPICO 7: `media-plan` 1.0.0 e 1.1.0

**Bloqueia:** o ÉPICO 9 (o `ad-creatives` lê o plano) e as datas da régua do ÉPICO 10.

Pasta `./media-plan/` no projeto: `marca.md` (fatos estáveis da marca com fonte e data: planos e preços, funil e eventos que existem, base, contas, o que pode ser dito) e uma pasta por plano, `./media-plan/<plano>/`, com `premissas.json`, `cenarios.json`, `calendario.json`, `plano.json` (interface v1), `plano.md`, `decisoes.md` e as versões anteriores. Script `scripts/plan.mjs`, comandos com `--json`.

### T7.1: criar o app e as referências de método
**Estado: ✅ 2026-10-23** `modules/media-plan` 1.0.0: `references/referencias.json` (faixas rotuladas, `checked_on`), `feriados.json`, `situacao.md`, `oferta.md`, `pagina.md`, `voz-do-cliente.md`, `interface.md`, `NOTICE.txt`.
- `npm run apps -- new media-plan --type workflow --trail planejar`.
- `references/situacao.md` (a restrição vinculante, o calendário, re-alcançar quem já conhece antes de comprar atenção, o que uma fase de preparação pode e não pode dar com conta sem histórico), `references/oferta.md` (escada da oferta, nunca vitalício nem desconto só no primeiro mês, as linhas do CDC), `references/pagina.md` (o briefing da página de destino: hero que continua a frase do anúncio, telas reais, prova autorizada, um chamado, objeções, as linhas do CDC e da LGPD, UTM preservada até o cadastro, perguntas de qualificação do lead), `references/voz-do-cliente.md` (questionário curto e roteiro de 5 a 10 conversas; a saída no formato `declared` do `ad-creatives`), `references/referencias.json` (as faixas de referência da D23, cada uma com fonte, moeda e data), `references/feriados.json` (feriados nacionais com fonte e `checked_on`).
- `NOTICE.txt` (D31). Adaptados do goose-skills: `plan-campaign` (intake, unit-economics, budget-and-tests, launch-and-calendar), `where-to-start` (situation-lens, questions, output-shape), `write-report`; do agency-agents, `paid-media-paid-social-strategist` (públicos e frequência).
- **Aceite:** `npm run validate media-plan` sem `[PREENCHER]` depois da T7.4; todo texto passou pelo `humanizer-pt-br`.

### T7.2: olhar antes de perguntar, e as premissas com sugestão
**Estado: ✅ 2026-10-23** `scripts/lib/look.mjs` e `premises.mjs`; `look` lê marca.md, os briefings, as capturas, a pesquisa no Instagram e o inventário; `premises` devolve até quatro perguntas com `suggestion` e `if_different`; testes em `tests/unit.test.mjs` e `tests/e2e.test.mjs`.
- `look <plano>`: inventaria o que o projeto já tem (`marca.md`, `anuncios/*/briefing.md` e as capturas do `ad-creatives`, `instagram-research/`, `contatos/inventario.json`; a captura do site pelo Motor quando o integrante dá o endereço e nada foi capturado) e devolve o que dispensa pergunta e `questions`: até quatro, na ordem produto e oferta, para quem e quantos, meta e data, verba, cada uma com `suggestion` e `if_different`.
- `premises <plano>`: a tabela fixa (produto e oferta, para quem e quantos, meta e data, verba, preço e planos, base e estado, prontidão do produto, evento e ponto de conversão, capacidade do time, contas e rastreamento), cada linha com `value`, `source` (`informado`, `encontrado`, `sugerido-pendente`, `confirmado`) e `if_different`; as cinco bloqueantes nomeadas (produto e oferta, para quem, meta e data, verba, evento). O script recusa um valor sem `source` e nunca preenche sozinho.
- **Aceite:** teste com um projeto fictício em que `look` encontra oferta, página e verba num `briefing.md` do `ad-creatives` e devolve só duas perguntas; `premises` recusa `source` ausente com `premise_invalid`.

### T7.3: a aritmética
**Estado: ✅ 2026-10-23** `scripts/lib/economics.mjs`, `offer.mjs`, `calendar.mjs`: custo permitido R$ 1.430,40 na fixture Agenda Leve, 19 da base e 11 do frio, piso de aprendizado R$ 143 contra R$ 125, colisão de 24 dias, seis fases para 27/11 a partir de 23/10 com os feriados de 2/11, 15/11 e 20/11 e ponto de decisão em 13/11 (`tests/unit.test.mjs`).
- `funnel <plano>`: custo permitido por cliente (preço × margem × meses de payback, ou o teto de um terço da receita do primeiro ano quando faltam margem e retenção), metas por origem com taxa rotulada, leads necessários, custo por lead permitido, dois ou três cenários de verba por fase e canal; a conta da fase de aprendizado da D10 com a mesma fonte e data do `ad-creatives`; frequência estimada por semana (impressões ÷ alcance) só como rótulo de alerta.
- `offer <plano>`: colisão entre uma promoção vigente e a seguinte (prazo que termina a menos de 30 dias de um desconto mais fundo), faixas de desconto calculadas do preço, verificação das linhas do CDC (preço de referência, prazo, regras, arrependimento de 7 dias), condição para quem já é cliente, alternativas ao desconto.
- `calendar <plano>`: fases de trás para frente da data alvo (preparação, testes, escala e captação, aquecimento, pico, depois), prazos fixos (rastreamento e oferta na página até T-7, revisão de anúncios 1 a 2 dias, subida programada antes do pico, régua 1 a 2 semanas), quantas janelas de 7 dias cabem, feriados nacionais, um ponto de decisão ao menos 7 dias antes do aquecimento.
- **Aceite:** testes de tabela para cada conta, com os números de entrada e a saída esperada; `calendar` para uma data alvo numa sexta a 35 dias dali devolve as fases, marca os feriados que caem no intervalo e um ponto de decisão; `offer` sinaliza a colisão de um prazo que termina 24 dias antes do pico.

### T7.4: o plano escrito, a aprovação e a 1.0.0
**Estado: ✅ 2026-10-23** `scripts/plan.mjs` (`plan` sempre rascunho, `approve` recusa `premises_pending`, versões congeladas em `plano-v<n>`); skill, README, guias pt-BR e en, `tests/eval.json` (6 casos), `.dev/showcase.json`; 37 testes; `validate` sem avisos; `dist/modules/media-plan-1.0.0.zip`. Não publicado: a tag espera o commit.
- `plan <plano>`: monta `plano.json` e `plano.md` sempre como rascunho (`estado: rascunho`), com as premissas `sugerido-pendente` dentro, no formato de topo curto (In short até 150 palavras, decisões para você, a história, o que fazer em até seis movimentos, o que não vamos fazer, o que não conseguimos conferir, fontes com viés) e as três linhas para o chat (`say`). `approve <plano>` exige as cinco bloqueantes `confirmado` ou `informado`, grava a frase do integrante e a data em `decisoes.md` e muda o estado para `aprovado`. `status`, `list`.
- Skill `media-plan`: o fluxo (olhar, perguntar numa mensagem só, premissas, as contas, o rascunho, as decisões, o sim), a regra do chat curto (D33) e a regra de que a IA escreve a narrativa e as sugestões rotuladas, nunca os números.
- `references/interface.md` v1: o esquema de `plano.json` (oferta, página, evento, verba por fase, públicos, datas das fases, padrão de nome, regra de UTM, termos proibidos, regras de decisão quando houver) e como outro app o lê.
- README, guias pt-BR e en, `tests/eval.json`, `.dev/showcase.json` nos dois idiomas.
- **Aceite:** `npm run validate media-plan` sem avisos; `npm run pack media-plan` gera o ZIP; `plan` num projeto fictício com duas premissas pendentes escreve o rascunho e `approve` recusa com `premises_pending` listando as duas.

### T7.5: 1.1.0, canais, estrutura, regras e replan
**Estado: ⬜** `npm run apps -- bump media-plan minor` depois do pacote da 1.0.0.
- `channels <plano>`: veredito Run, Test, Later ou No por canal (Meta, Busca do Google, e-mail e WhatsApp da base, parceiros, TikTok, LinkedIn, YouTube) pelas lentes (público e intenção, economia, prontidão, tempo até sinal, evidência, horas de quem executa), com o mínimo para aprender rotulado e a condição de virada.
- `structure <plano>`: por canal, em linguagem de negócio. Meta: objetivo honesto, um conjunto com razão, amplo contra interesses, exclusões, posicionamentos, verba diária contra o piso, padrão de nomes, públicos de remarketing por etapa (visitou, cadastrou e não ativou, ativou e não pagou, viu a oferta) e o público semelhante a partir da base. Google: campanha de Busca por grupos de palavras de alta intenção, correspondências, negativas, campanha de marca na semana do pico, lance e verba contra o mínimo de conversões.
- `rules <plano>`: `plano.json.rules` (o que é "dado suficiente", indicadores por fase, quando pausar, escalar e trocar, cadência semanal e diária) e `triggers` com o plano B de cada risco (custo, conta, base, produto).
- `replan <plano> --from <leitura semanal do ads-insights>`: a versão N+1 com "o que mudou e por quê".
- `references/estrutura-meta.md`, `references/estrutura-google.md`, `references/regras.md`, `references/conformidade.md` (política de saúde e de atributos pessoais da Meta, CDC, LGPD; método, não parecer), `references/lancamento.md` (demonstração ao vivo, gravação para remarketing, pagamento e recuperação, parcerias com link rastreado, contas e infraestrutura).
- **Aceite:** `channels` com uma verba pequena e sem evidência dá Later para TikTok e LinkedIn e Test para a Busca; `structure` recusa um conjunto cuja verba diária fica abaixo do piso de aprendizado; `replan` lendo uma leitura semanal fixture cria `plano-v2.md` com a seção "o que mudou"; `validate` e `pack` da 1.1.0.

## ÉPICO 8: `ads-insights` 1.0.0, medição e leitura

⚠️ **Substitui o ÉPICO 4** (2026-10-23): as tarefas T4.1 a T4.4 passam para cá, sem depender do export de uma marca; a T4.5 vira a 1.3.0 do `ad-creatives` (ÉPICO 9). A D15 fecha pela D28.

**Bloqueia:** a 1.3.0 do `ad-creatives` e o `replan` do `media-plan`.

Pasta `./ads-insights/` no projeto: `medicao.json` (o contrato de medição), `origens.csv` (a planilha de origem, sem dado pessoal), `entrada/` (os exports que o integrante traz), `leituras/`, `movimentos.json`. Script `scripts/insights.mjs`. Tool completo na 1.0.0 (D26).

### T8.1: criar o app e a medição
**Estado: ✅ 2026-10-23** `modules/ads-insights` 1.0.0: `contract`, `tags` (HTML servido, nunca "dispara"), `utm build|check`, `events` (rastreamento.md), `ledger init|add|import|summary` (pseudônimo SHA-256 com sal do contrato; `import` só de `entrada/`); fixture de 12 linhas dá a razão 1,3 (`tests/unit.test.mjs`).
- `npm run apps -- new ads-insights --type tool --trail escalar`.
- `contract`: `medicao.json` com o árbitro por tipo de negócio, a semana de reporte e o fuso, receita líquida e cliente novo, o campo de origem que viaja com a conta, o evento de ativação, margem e o MER de equilíbrio, a atribuição das plataformas como reivindicação; cada item `verificado`, `informado` ou `desconhecido`.
- `tags <url>`: lê o HTML público e detecta o Pixel da Meta, GA4 e gtag, GTM, a tag do Google Ads, TikTok, LinkedIn e o aviso de cookies; o resultado diz "presente no HTML servido", nunca que a tag dispara; uma página que injeta as tags depois do aceite de cookies é dita como tal.
- `utm build` e `utm check`: pela regra única do plano (`plano.json.tracking.utm_rule`) ou pela regra padrão do app, para anúncios, e-mails, WhatsApp e parceiros; recusa link sem os cinco campos; `utm_content` igual ao nome do anúncio.
- `events`: `references/rastreamento.md` renderizado para o caso: mapa de eventos do funil (visita, lead, cadastro, ativação, início de pagamento, compra com valor) por navegador e servidor, deduplicação, a conversão do Google Ads, o plano de teste no Gerenciador de Eventos, a restrição de categoria (eventos padrão, nenhum termo clínico em URL ou parâmetro), a origem que viaja com a conta.
- `ledger init|add|import|summary`: `origens.csv` com data, etapa, origem, meio, campanha, conteúdo, parceiro, valor, qualificado e um pseudônimo (SHA-256 do e-mail normalizado com um sal do projeto guardado em `medicao.json`); `import leads` lê só arquivos em `entrada/` e nunca grava nome, e-mail ou telefone; `summary` por origem e etapa e a razão de reivindicação (compras das plataformas ÷ compras reais).
- `NOTICE.txt`. Adaptados: goose-skills `analyze-performance` (measurement-contract, revenue-join), `plan-campaign/brief-template` (a regra de UTM); agency-agents `paid-media-tracking-specialist` (o que "rastreamento pronto" significa).
- **Aceite:** um HTML fixture com Pixel, GA4 e GTM devolve os três presentes e uma página vazia devolve `absent` em cada um; `utm build` devolve a string exata e um link sem `utm_campaign` dá `utm_invalid`; `ledger summary` numa fixture de 12 linhas dá as contagens e a razão 1,3; `import leads` com uma coluna de e-mail grava só o pseudônimo.

### T8.2: a leitura do export
**Estado: ✅ 2026-10-23** `import` (pt e en, coluna ausente em `missing`), `link` (5 casam, 1 `unmatched`), `report` (D28 em `references/leitura.json`), `weekly` (movimentos.json, `move applied`, legível em 14 dias), `pulse`; 27 testes; `validate` sem avisos; `dist/modules/ads-insights-1.0.0.zip`. Não publicado.
- `import <export.csv> --source meta|google`: leitor do export do Gerenciador da Meta (nível de anúncio, conjunto e campanha) e do Google Ads (campanha, grupo, palavra e anúncio), cabeçalhos em pt e en, vírgula ou ponto e vírgula, decimal com vírgula, BOM; coluna ausente vai para `missing` e nunca vira zero.
- `link <leitura> --names anuncios/<campanha>/entrega/nomes.json`: liga cada linha ao nome do anúncio; o que não casa sai em `unmatched`, nunca é adivinhado.
- `report <leitura>`: por peça, quem passou dos 3 segundos, quem assistiu até o fim, CTR do link, custo por visita e por resultado; veredito escalar, manter, iterar, cortar ou dado insuficiente pelas regras de `plano.json.rules` ou pelo padrão de `references/leitura.json` (D28), com a indicação de onde a peça falha (gancho, miolo ou página); `report.json` com `interface_version` 1.
- `weekly`: a leitura semanal (In short, o veredito de cada movimento anterior pela linha de base com janelas antes e depois e a data em que fica legível, a verdade do negócio pela planilha de origem, a tabela por peça e por canal, o que fazer na semana); `movimentos.json` com `proposto_em`, `aplicado_em` (preenchido por `move applied <id> --on <data>` quando o integrante diz que fez) e `legivel_em`; movimento sem `aplicado_em` fica fora do veredito.
- `pulse`: a leitura diária só por exceção (ritmo de gasto fora do plano, gasto do dia acima do normal, reprovações, custo acima do permitido em dado maduro, zero conversões com gasto normal, queda de CTR).
- `references/interface.md` v1, skill `ads-insights`, README, guias pt-BR e en, `.dev/showcase.json`, eval com fixtures sintéticas.
- `NOTICE.txt`: goose-skills `run-paid-campaigns` (reading-results, moves, proposal-and-log), `analyze-performance` (diagnosis, monday-report, monthly-and-pulse); agency-agents `paid-media-auditor`, `academic-statistician` (a cadeia da afirmação).
- **Aceite:** um export fixture em pt-BR com ponto e vírgula e um em inglês com vírgula produzem a mesma tabela normalizada e uma coluna ausente aparece em `missing`; 6 anúncios com 5 nomes em `nomes.json` dão 1 `unmatched`; um teste por veredito com tabelas sintéticas e uma peça abaixo da amostra mínima sempre `insufficient_data`; um movimento aplicado numa quarta fica legível 14 dias depois; `validate` e `pack`.

## ÉPICO 9: `ad-creatives` 1.2.0 e 1.3.0, e a zona de anúncio do feed

**Bloqueia:** nada. Depende do ÉPICO 7 (o plano) e, para a 1.3.0, do ÉPICO 8.

### T9.1: `video-render` 1.0.2, a zona de anúncio do feed
**Estado: ✅ 2026-10-23, não commitado** (D16). As sessões Geral e atrupe-34 confirmaram não tocar no motor. `references/redes.json` ganhou `ads_meta_feed` (22 linhas aditivas; 4:5 com 135/135/108/108 e 1:1 com 108): o Guia de Anúncios da Meta, conferido no dia, não publica recuo de interface para o feed, então a nota diz que é respiro de design. 31 testes do motor passam. O commit e a tag esperam o sim do operador.
- Entrada aditiva `ads_meta_feed` em `references/redes.json` com as zonas seguras de 4:5 e 1:1 dos anúncios da Meta, valores do Guia de Anúncios da Meta conferidos no dia, `checked_on` e a fonte.
- **Aceite:** `networks --json` lista `ads_meta_feed`; os testes do motor passam; o `preview` de uma peça 4:5 do `ad-creatives` não traz mais a nota da zona orgânica.

### T9.2: 1.2.0, o plano, a matriz, a página e a Busca
**Estado: ✅ 2026-10-23, não commitado** `brief` preenche 10 campos do plano com `sources: plano` (`scripts/lib/plan.mjs`); `matrix` (`matrix.mjs`: 7 peças recusadas, 10 aceitas, `needs_recording`); skill `ad-landing-page` com `page brief` e `page audit` (`page.mjs`); `search` (`search.mjs`, `references/google-busca.json`: título de 31 recusado); `politica-meta.md`, `interface.md`, `NOTICE.txt`; 67 testes; `validate` sem avisos. O commit espera o sim do operador.
- `brief` pré-preenche o briefing de `plano.json` (oferta, página, evento, verba diária da fase, público, datas, padrão de nome, parâmetros de URL, termos proibidos), marcando `source: plano` em cada campo; sem plano, segue como hoje. A regra "nunca invente oferta, preço, custo ou concorrente" fica e ganha a condição: com plano, o valor vem do plano e a fonte é mostrada; sem plano, a skill encaminha plano, oferta e verba ao app de plano.
- `matrix <campanha>`: valida `matriz.json` com 3 a 4 ângulos cruzados com formatos (Reels 9:16 com tela real, vídeo 4:5, imagem, carrossel estático, depoimento e fundador falando como roteiro e plano de cena marcados `needs_recording`), 8 a 12 peças na primeira leva, dois ângulos que diferem numa dimensão só dão `matrix_invalid`; os três conceitos de hoje são o caso mínimo.
- Skill nova `ad-landing-page`: `page brief <campanha>` escreve o briefing da página a partir de `references/pagina.md` do plano e do que o anúncio promete; `page audit <campanha>` lê o `captura.json` do Motor (posição do primeiro chamado contra a altura da tela, palavras do `h1` em comum com o título do anúncio, preços e prazo contra o plano, as linhas legais no texto) e devolve o que não dá para conferir como `nao_conferido`, nunca como reprovado.
- `search <campanha>`: os anúncios de texto da Busca do Google (até 15 títulos de 30 caracteres, 4 descrições de 90, fixações, as extensões), conferidos pelos mesmos verificadores de promessa e termos proibidos do `copy`; os grupos de palavras vêm do plano.
- `references/politica-meta.md` (atributos pessoais, antes e depois, saúde), `copy` estendido ao texto da página e aos anúncios de texto, evidência `declared` para o questionário do `voz-do-cliente.md`, 4:5 conferido em `ads_meta_feed` quando o motor a tem.
- `references/interface.md` v1 (status, o esquema de `nomes.json`, o import de `own_result`, a matriz), README e guias, `NOTICE.txt` (goose-skills `make-static-ads`, `claims-gate`, `ad-policy-check`; agency-agents `paid-media-creative-strategist`, `paid-media-ppc-strategist`).
- **Aceite:** `brief` com um `plano.json` fixture preenche nove campos com `source: plano`; `matrix` recusa 7 peças e aceita 10 com 4 ângulos e marca `needs_recording`; `page audit` sobre um `captura.json` fixture devolve chamado acima da dobra, palavras em comum e prazo igual ou diferente do plano; `search` recusa um título de 31 caracteres; `validate` e `pack`.

### T9.3: 1.3.0, a rodada seguinte e a sequência da data alvo
**Estado: ⚠️ ⬜** A 1.2.0 ainda não tem commit nem rascunho na plataforma, então um bump para 1.3.0 deixaria a 1.2.0 sem commit para a tag. Decisão de 2026-10-23: `round next` e `sequence` entram na própria 1.2.0 (uma versão só, com um changelog só), e esta tarefa deixa de ser uma versão. O que ela descreve continua valendo como aceite.
- `round next <campanha>`: lê o `report.json` do `ads-insights`, grava cada resultado como `own_result` com o id do resultado, registra a rodada no diário (`results`) e propõe a rodada seguinte com os resultados próprios como a evidência mais forte: conceito cortado não volta igual, os nomes terminam em `-v2`.
- `sequence <campanha>`: as quatro peças datadas pelo calendário do plano (abertura para a lista, oferta no ar, contagem regressiva, último dia) com preço, prazo e regras da oferta e as linhas do CDC, conferidas em `ads_meta` (9:16) e `ads_meta_feed` (4:5 e 1:1), com a nota de subir com data programada antes da revisão.
- Lembrete de reposição semanal (2 a 3 conceitos novos em teste); changelog; guias.
- **Aceite:** caso de eval com um `report.json` fixture em que os conceitos da rodada 2 citam ids `res-…`, nenhum conceito cortado volta igual e os nomes terminam em `-v2`; `sequence` devolve 4 peças com as datas do plano, cada uma aprovada na rede certa; `validate` e `pack`.

## ÉPICO 10: `contact-base` 1.0.0 e 1.1.0

**Bloqueia:** nada. Lê `plano.json` quando existe (datas e segmentos) e o `utm` do `ads-insights`.

Pasta `./contatos/` no projeto: `inventario.json` (só contagens), `base-limpa.csv` (D29), `base-legal.md`, `segmentos.json`, `regua.json` e `regua.md`, `envio.md`, `publicos/`, `atendimento.md`, `voz-do-cliente.md`. Script `scripts/contacts.mjs`.

### T10.1: criar o app, o inventário e a base legal
**Estado: ✅ 2026-10-23** `modules/contact-base` 1.0.0: `inventory` (`scripts/lib/inventory.mjs`; a fixture de 17 linhas dá 16 pessoas, 1 duplicada, 2 e-mails inválidos, 1 telefone sem DDD; `contatos-pacientes.csv` dá `patient_data`; `inventario.json` sem nome, e-mail ou telefone), `legal` (`legal.mjs`, oito campos, `pendente` ou `completo`).
- `npm run apps -- new contact-base --type workflow --trail vender`.
- `inventory <csv…>`: mapeia colunas por sinônimos em pt e en, conta, tira duplicados por e-mail e telefone normalizados, valida sintaxe (e-mail, telefone com 55 e DDD), agrupa (ainda ativos, parados, nunca ativados; pagantes e ex-pagantes) pelos limiares do plano ou pelos padrões do app; lê só exports de usuários e contatos e recusa colunas que pareçam de paciente ou de terceiro (`patient_data`); `inventario.json` sem nenhuma coluna de pessoa.
- `legal`: `base-legal.md` por grupo (como entrou, texto aceito, dados presentes, último contato e descadastros, onde está guardada, consentimento ou legítimo interesse, teto de contatos, retenção) e o estado `pendente` ou `completo` (D30).
- **Aceite:** uma base sintética com duplicados, e-mails inválidos e telefones sem DDD devolve as contagens certas e um `inventario.json` sem nenhuma coluna de pessoa; uma coluna `paciente` dá `patient_data`.

### T10.2: segmentos, régua e a 1.0.0
**Estado: ✅ 2026-10-23** `segments` (`segments.mjs`), `sequence` (`sequence.mjs`: repermissão primeiro para quem está sem contato há 180 dias ou mais, `repermission_required` para outra primeira mensagem, `pendente` enquanto a base legal falta, datas dentro das fases do plano, UTM pela regra do plano); `references/copy-regua.md`, `base-legal.md`, `interface.md`, `NOTICE.txt`; skill, README, guias, eval (6 casos), showcase; 16 testes; `validate` sem avisos; `dist/modules/contact-base-1.0.0.zip`. Não publicado.
- `segments`: engajamento por cliques, pedidos e último uso, nunca por abertura sozinha; RFM simples; prioridade e teto global (até 1 e-mail de marketing por 16 h, 3 a 5 por semana; compradores recentes fora de promoções); escada de ofertas.
- `sequence <segmento>`: a régua por grupo em e-mail, com datas ancoradas nas fases de `plano.json` ou numa data alvo informada (anúncio da novidade, convite para testar, prova, entrada na lista, acesso antecipado, abertura, lembretes, último dia); a primeira mensagem a quem não é contatado há 6 meses ou mais é repermissão; a régua fica `pendente` enquanto a base legal do grupo faltar; `regua.json` e `regua.md`, com a UTM de cada link pela regra do plano.
- `references/copy-regua.md` (um trabalho por mensagem, assunto curto, urgência só real, rodapé com quem escreve, de onde veio o contato e como sair), skill `contact-base`, README, guias, eval, `.dev/showcase.json`, `NOTICE.txt` (goose-skills `email-lifecycle`: flow-library, segments-cadence-offers, copy-craft; agency-agents `marketing-email-strategist`).
- **Aceite:** `sequence` para um grupo parado há 200 dias recusa como primeira mensagem qualquer coisa que não seja repermissão e marca a régua inteira como `pendente` enquanto `base-legal.md` tem campo vazio; as datas de uma régua ancorada num `plano.json` fixture caem dentro das fases; `validate` e `pack` da 1.0.0.

### T10.3: 1.1.0, entregabilidade, WhatsApp, públicos, voz e atendimento
**Estado: ⬜** `npm run apps -- bump contact-base minor`.
- `deliverability <domínio> --dkim <seletor>`: consulta DNS de SPF, DMARC e DKIM sem chave, descadastro em um clique, limiares (rejeição dura abaixo de 1%, reclamação abaixo de 0,1%, descadastro abaixo de 0,3%), lotes crescentes.
- `references/whatsapp.md` (API oficial: opt-in, modelos aprovados com antecedência, categorias, janela de 24 h, faixas de qualidade, horário, STOP; contato um a um para a base antiga; nunca disparo de número comum) e a régua em WhatsApp.
- `audience <segmento>`: o CSV de público personalizado da Meta com os valores já em SHA-256 (telefone com 55 e só dígitos, e-mail normalizado), só para quem tem base legal de marketing e sem descadastro, aviso de tamanho mínimo e taxa de casamento rotulada, lista de exclusão dos clientes atuais, e o passo a passo para o integrante subir.
- `voice`: o questionário e o roteiro de conversas de `references/voz-do-cliente.md` do plano, com a síntese gravada como leitura `declared` para o `ad-creatives`; `support`: `atendimento.md` (quem responde, tempo, respostas às objeções, cobertura do pico).
- **Aceite:** `audience` numa base fixture devolve só hashes e exclui quem não tem base legal de marketing; `deliverability` num domínio fixture sem DMARC devolve o item como `missing`; `validate` e `pack` da 1.1.0.

## ÉPICO 11: fechamento 2

### T11.1: catálogo e documentos
- `npm run apps -- catalog`; linhas dos apps novos em `docs/PLANO.md`; `CLAUDE.md` com uma frase por app; `.claude/rules/apps.md` com a regra "nenhum número sem rótulo e fonte" (D23) quando ela estiver provada nos três apps.
- **Aceite:** `npm run apps -- catalog --check` em dia; `npm run harness:check` verde.

### T11.2: verificação completa e entrega
- `npm run ci:verify` no Windows e num contêiner Linux sobre a árvore exata; os ZIPs com o mesmo SHA-256 nos dois.
- As tags dos apps, uma a uma, com o sim do operador; os rascunhos na plataforma com o SHA igual ao do pacote; publicar e marcar a versão de entrada são cliques do operador.
- **Aceite:** em `dist/modules/` existem `media-plan-1.0.0` e `-1.1.0`, `ads-insights-1.0.0`, `ad-creatives-1.2.0` e `-1.3.0`, `contact-base-1.0.0` e `-1.1.0`, cada um com o `.sha256`.

### Ordem

core 1.10.0 → `media-plan` 1.0.0 → `ads-insights` 1.0.0 (medição) → `ad-creatives` 1.2.0 → `media-plan` 1.1.0 → `ads-insights` (leitura) → `contact-base` 1.0.0 e 1.1.0 → `ad-creatives` 1.3.0 → fechamento. O `video-render` 1.0.2 entra quando a sessão dona do motor liberar.

### O que estes épicos deixam de fora

- Integrações de envio (API de e-mail, API do WhatsApp, CRM): o integrante envia pela ferramenta dele; o `contact-base` prepara textos, modelos, lotes e datas.
- Escrever na conta de anúncios, subir públicos ou devolver conversões offline: o integrante faz (D14); os apps entregam o arquivo e o passo a passo.
- Construir a página de destino: é do site do integrante; o `ad-creatives` escreve o briefing e o texto e audita a página viva.
- Tamanho do público na Meta e volume de busca no Google: o integrante lê nas ferramentas e informa; entra como premissa `informado`.
- Parecer jurídico: os checklists de LGPD, CDC e política de saúde são método.
- Leitura automática agendada e executor de evals: fases P4 e P7; o export é manual e os casos de eval rodam por script.
- Gravação com pessoa e geração de imagem: inalterado; o app entrega roteiro e plano de cena marcados `needs_recording`.
- Receita (`recipes/`) juntando os apps: quando a importação de receitas pela plataforma existir.

## Verificação de ponta a ponta

1. `npm run test:apps`: testes de unidade e de ponta a ponta dos apps novos, com servidor falso do Apify.
2. `npm run validate`, sem slug: todos os apps válidos, e os novos sem avisos.
3. `npm run pack <slug>` para cada app novo.
4. No workspace, com os apps ligados, pedir como integrante "prepare os criativos da minha primeira campanha" três vezes: sem chave (modo manual), com a chave, e com a variável `APIFY_TOKEN` vazia. Conferir a pasta `anuncios/<campanha>/entrega/` e o relatório do conjunto.
5. Rodar à mão os casos de `tests/eval.json`, cada um numa pasta isolada (`FLYEE_WORKSPACE=C:/AppsProjects/flyee-eval/<caso> npm run apps -- link …`). O executor de avaliações é a fase P7 e ainda não existe.
6. `npm run ci:verify`.

## Riscos

| Risco | Sinal mais cedo |
|---|---|
| Um ator do Apify quebra, muda de campo ou de preço | O `check` do app compara uma amostra com o formato esperado; `checked_on` de `fontes.json` envelhece. A saída é o modo manual |
| A pesquisa manual dá trabalho demais para um integrante | Tempo medido na T0.4. Se passar do aceitável, a regra de seleção encolhe ou o Apify vira o caminho recomendado |
| A evidência não se transfere: o conceito de maior confiança perde na campanha | Primeiro export lido no ÉPICO 4. O diário registra, e a D11 é revista |
| A versão gratuita fica reduzida demais para servir | Caso de avaliação "rodada zero sem chave", julgado antes de publicar |
| Conflito com outra sessão nos arquivos do motor | Sessões ativas e data de modificação dos arquivos, conferidas antes da T2.2 |
| A estrutura da D9 não cabe no Gerenciador (personalizar a peça por posicionamento) | O operador monta a campanha na T0.7 |
| Restrição da Meta a eventos de conversão em produto ligado a saúde (não verifiquei se atinge o MedChina) | Aviso no Gerenciador de Eventos quando o operador montar a campanha |
| Raspagem contraria os termos da Meta, mesmo em dado público | Conhecido. O README diz uma vez, e nenhum ator usa a conta do integrante |

## O que este plano não cobre e o que não foi verificado

- Nenhum ator do Apify foi rodado. O significado de `collationCount` e a resposta para anunciantes do Brasil saem da T0.3.
- O download de um anúncio por link pelo `yt-dlp` e a leitura dele pelo `video-analysis` não foram testados (T0.4).
- Não sei se uma captura da aba de Reels basta para uma mediana confiável (T0.2).
- O número da fase de aprendizado (D10) e as medidas de anúncio no feed (D16) vieram de fontes de terceiros.
- O conector oficial de anúncios da Meta e a API do Instagram ficam fora da 1.x. A leitura automática agendada depende da fase P4.
- Peça com pessoa falando não é produzida pelo app: sai como roteiro e plano de cenas.
- O lado da plataforma (`flyee-club`) não foi aberto. Publicação, marca da versão gratuita e página do app são passos de console.
- Os fatos do MedChina vêm dos documentos do próprio projeto, auditados por ele em 2026-08-09, e não foram conferidos de novo.
