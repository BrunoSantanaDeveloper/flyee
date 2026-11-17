# Páginas que vendem: especificação

**Objetivo:** quando o operador (ou um integrante) pedir à IA uma página de um tipo conhecido (página de vendas, planos e preços, página de API, order bump, upsell, downsell, cross-sell, página de obrigado), a IA segue o roteiro de mercado daquele tipo e os modelos reais analisados, constrói a página e a confere pela captura. O repertório cresce a cada modelo que o operador traz.

> Conferido contra o código em 2026-11-08. A primeira rodada (Hostinger) está em a702826; a segunda (Juridiq, ÉPICO 5) está em 9b986bd e e859313; a terceira (ÉPICO 6) está em 4cc2280. As tags `video-render@1.1.0` e `conversion-pages@1.1.0` apontam para 4cc2280 e chegaram à plataforma como rascunho, com o SHA-256 da plataforma igual ao do pack. Publicar e marcar a versão de entrada (D7) continuam sendo cliques do operador. **⚠️ A terceira rodada piorou a página do ONE e não deve ser publicada; o ÉPICO 7 a corrige no commit b5535b0, com as tags `video-render@1.2.0` (`8b8ef9c2…`, run 42546822988) e `conversion-pages@1.2.0` (`a77b9581…`, run 42546875997), rascunhos com o SHA-256 da plataforma igual ao do pack.** As rodadas dos ÉPICOs 8 e 9 estão em f5dc4ad, com a correção do aviso de cookies em 1c343b4; as tags `video-render@1.3.0` (`3bc73786…`, run 43784479934) e `conversion-pages@1.3.0` (`685171d3…`, run 43784538501) apontam para 310fc83 (2026-11-15), rascunhos com o SHA-256 da plataforma igual ao do pack. Legenda: ✅ existe · 🟡 parcial · ⬜ não existe · ⚠️ correção.

## Estado da implementação (2026-11-07)

| Tarefa | Estado | Evidência |
|---|---|---|
| T1.1 a T1.4 | ✅ | `video-render` 1.1.0, em a702826. A leitura fica em `readAnatomyDesktop` e `readAnatomyMobile` (`scripts/lib/capture.mjs`). `references/interface.md` §5 descreve `anatomy`, `texto.md`, `input_kind` e `anatomy_counts`. Testes em `tests/anatomy.test.mjs` e `tests/fixtures/oferta/` |
| T2.1 a T2.6 | ✅ | `conversion-pages` 1.0.0, em a702826: 19 regras, 14 testes, 3 casos de avaliação. É a candidata à versão de entrada (D7, D14) |
| T5.1 a T5.6 | ✅ | A rodada do Juridiq, em 9b986bd e e859313, com o `video-render` 1.1.0 corrigido no lugar. Detalhes no ÉPICO 5 |
| T6.1 a T6.7 | ✅ | A rodada da demonstração e das medições (2026-11-08), commitada em 4cc2280 junto com o som do motor: `conversion-pages` 1.1.0 e `video-render` 1.1.0, corrigidos no lugar antes das tags (D16). Detalhes no ÉPICO 6 |
| T7.1 a T7.5 | ✅ | A correção da rodada 6 (2026-11-08), em b5535b0: detalhes no ÉPICO 7 |
| T7.6 | ✅ | A home refeita (5aadb0c) foi ao ar em 2026-11-09 com o push do operador, junto com aa15754 e 2263691: o deploy 42599019108 passou, e a página publicada tem o título novo e o brilho (`mkt-aurora`). Detalhes no ÉPICO 7 |
| T8.1 a T8.4 | ✅ | Em f5dc4ad. O modelo da Subido AI, o tipo `curso`, a conferência e o motor 1.3.0 (2026-11-09): detalhes no ÉPICO 8 |
| T8.5 | ✅ | A construção de verdade, em duas rodadas com leitores às cegas: detalhes no ÉPICO 8 |
| T8.6 | ✅ | Tags no 310fc83 (2026-11-15), rascunhos na plataforma com o SHA-256 do pacote; publicar é o clique do operador: detalhes no ÉPICO 8 |
| T9.1 a T9.3, T9.5 | ✅ | Em f5dc4ad, com a correção do aviso de cookies em 1c343b4. O modelo da Databricks, a §15 do guia das figuras, as correções do motor e o design system para o Orkestree na pasta de trabalho (2026-11-09): detalhes no ÉPICO 9 |
| T9.4 | ✅ | A construção de verdade, em quatro rodadas com leitores às cegas; a quarta venceu nas seis perguntas, nas duas ordens: detalhes no ÉPICO 9 |
| T9.6 | ✅ | As mesmas versões 1.3.0, nas mesmas tags do T8.6: detalhes no ÉPICO 9 |
| T10.1 a T10.3 | ✅ na árvore, sem commit | O modelo da Black Friday da Hostinger, os tipos `planos` e `landing` e três correções da conferência (2026-11-17): detalhes no ÉPICO 10 |
| T10.4 | ✅ | A construção de verdade, em duas rodadas com leitores às cegas; a segunda venceu nas duas ordens em assinar, entender o preço e escolher o plano: detalhes no ÉPICO 10 |
| T10.5 | 🟡 | `conversion-pages` 1.4.0 empacotado e instalado para o usuário; o commit e a tag esperam o operador: detalhes no ÉPICO 10 |
| ⚠️ CI do Windows | corrigido | `anatomy.test.mjs` falhava no Windows do GitHub desde a702826: o Windows Server desliga as animações do sistema, o navegador responde `prefers-reduced-motion: reduce`, e a página do teste para a animação. A captura e o render passam a fixar `no-preference` (T6.6). A CI de 4cc2280 passou no Linux e no Windows (run 42508159600) |
| ⚠️ `appeared_after_scroll` | corrigido | `video-render/references/interface.md` dizia "só apareceu depois da rolagem". A captura rola a página para aquecer antes de ler, e uma janela que abre pela rolagem saía como presente na chegada. Agora há uma leitura na chegada, antes do aquecimento (T5.4) |
| ⚠️ `above_fold.mobile` | corrigido | A interface dizia "pelo mesmo texto na mesma ordem". Um botão do menu escondido no celular tomava o par do botão de mesmo texto da página (no JuriChat, "Comece grátis" saía como ausente no celular). Agora o pareamento é primeiro pelo mesmo elemento (T5.4) |
| T3.1 | ✅ | O código está em `packages/module-tools/src/user-apps.ts` e `cli.ts`, com 12 testes em `test/user-apps.test.ts`. A instalação real foi feita: `~/.flyee/user-apps` e as pontes `conversion-pages` e `video-render` em `~/.claude/skills/`. Logo depois do `link --user`, a sessão do Claude Code em andamento passou a listar as duas skills; skills pessoais valem em qualquer pasta. Rodando `check` de dentro do flyee-club, o projeto é o flyee-club e o motor é o 1.1.0 |
| T3.2, T4.3 | ✅ | Duas linhas em `.claude/rules/apps.md`. `harness:check` passa, e as regras ocupam 27.343 bytes dos 32.768 |
| T4.1 | ✅ | `modules/conversion-pages/.dev/INTAKE.md` |
| T4.2 | ✅ | `C:\AppsProjects\flyee-workspace\pesquisa-paginas\hostinger-agente-2026-11-07\` (11 MB, com `LEIAME.txt`), sem o carrinho e sem as respostas da API |

**Verificação da segunda rodada (ÉPICO 5):**
- `npm run validate`: 13 apps válidos;
- `npm run test:apps`: 695 testes, 693 passam, 2 opcionais pulados, nenhum falha. Entre eles:
  - 108 do `video-render`;
  - 23 do `conversion-pages`, com duas capturas reais pelo motor;
- `npm run apps -- catalog --check` e `npm run harness:check`: passam;
- a conferência real nas quatro páginas do Juridiq e do JuriChat (T5.6).

Não rodou: o `ci:verify` completo (a CLI não mudou), macOS e Linux, e um pedido real de página de vendas, de planos ou de API numa sessão aberta num projeto de código.

**Verificação da primeira rodada:**
- `npm run validate`: 12 apps válidos;
- `npm run test:apps`: 618 testes, 616 passam, 2 opcionais pulados, nenhum falha;
- testes do `module-tools`: 67 passam;
- `npm run typecheck`, `npm run apps -- catalog --check` e `npm run harness:check`: passam;
- conferência real de ponta a ponta na página de exemplo do motor: 14 itens, 3 em atenção (contador sem prazo, garantia declarada e ausente, imagem sem `alt`).

**Não rodou:**
- o `ci:verify` completo: build, `check:tarball` e `check:packed`, porque a CLI não mudou;
- macOS e Linux;
- um pedido real de página feito numa sessão aberta no flyee-club;
- uma página real com login salva em `.mhtml`: só a página de exemplo salva pelo próprio teste.

### Onde a implementação divergiu, e por quê

1. **Os comandos.** A conferência se chama `audit`. O `check` ficou como prontidão, como nos outros apps, e entraram também `status` e `list`.
2. **A captura da conferência é leve.** Ela usa `--scroll 0 --no-assets`: sem vídeo de rolagem (e sem precisar do ffmpeg) e sem baixar logos. A anatomia rola a página por conta própria, então a barra que aparece ao rolar continua sendo lida.
3. **A página salva não roda script.** O navegador tira os scripts de um `.mhtml`, então contador e barra mostrada por script não existem nela. Nesse caso, `countdown_real` e `sticky_cta_long_page` saem `nao_conferido`, e não `atencao`.
4. **O projeto, quando instalado para o usuário.** O `projectRoot` dos outros apps devolveria a pasta de instalação. Neste app, ele devolve a pasta aberta na sessão. O manifesto declara `env: FLYEE_USER_APPS`.
5. **A anatomia ganhou `y`** em `forms[]` e `prices[]`, para conferir se a caixa do order bump fica acima do botão de pagar.
6. **A ponte do usuário faz mais do que o pedido:**
   - proíbe `npx flyee add`, `update`, `remove`, `new` e `login` no repositório, porque gravariam o harness do flyee nele, e manda religar com `npm run apps -- link <app> --user`;
   - diz onde fica a skill `texto-natural`;
   - recusa uma pasta de usuário que contenha o repositório ou a home;
   - trata `skill_name_clash` e `skill_invalid`, e compara nomes de pasta sem diferenciar maiúsculas;
   - o `unlink` apaga só o `SKILL.md` marcado e a pasta, se ficar vazia.
7. **O `video-render` foi além do pedido:**
   - no máximo 10 barras fixas por passada;
   - chamados com fundo em degradê;
   - mais formas de recusa;
   - os links de pular para o conteúdo ficam de fora;
   - a exclusão do aviso de cookies reaproveita o padrão que já existia;
   - caixas ARIA são lidas;
   - preços são lidos dos nós de texto, juntando os que vêm divididos.
8. **A skill cede a construção** às skills de página do próprio projeto, quando existem (no flyee-club, `marketing-page` e `marketing-verify`), e fica com a estratégia do tipo e a conferência.
9. **`compatible_ais`** traz só `claude_code`, a única IA testada.

## 0. Decisões tomadas antes do código

| # | Decisão | Valor | Onde mora |
|---|---|---|---|
| D1 | Como o operador usa o app nos repositórios de código (flyee-club, orkestree), que têm harness próprio com AGENTS.md gerado | Instalado para o usuário, nunca dentro do repositório: os pacotes ficam em `~/.flyee/user-apps` (a variável `FLYEE_USER_APPS` muda o lugar) e cada skill ganha uma ponte em `~/.claude/skills/<skill>/` (ou `$CLAUDE_CONFIG_DIR/skills`). Decidido pelo operador em 2026-11-07. | `packages/module-tools` (`apps link --user`) |
| D2 | Como a fonte de um modelo aparece no app | Nome da fonte e data em cada análise, com a nossa análise e trechos curtos. O bruto (texto completo, vídeos, quadros, código baixado) fica na pasta de trabalho, fora deste repositório, que é público. Decidido em 2026-11-07; segue D31 (material sem licença: só ideias). | cabeçalho de `modules/conversion-pages/references/modelos/*.md`; bruto em `<workspace>/pesquisa-paginas/<modelo>/` |
| D3 | Melhorias de outros apps nesta rodada | Só a captura completa do `video-render`. As outras seis ficam no backlog (seção 6). Decidido em 2026-11-07. | este plano |
| D4 | Nome, tipo e trilha | `conversion-pages`, "Páginas que vendem" / "Pages that sell", `workflow`, `vender`. Proposto em 2026-11-07, sem objeção. | manifesto |
| D5 | Tipos de página da 1.0 | `order-bump`, `upsell`, `downsell`, `cross-sell`, `obrigado`. O primeiro modelo é a oferta pós-compra do Agente da Hostinger, vista em 2026-11-07. | `references/tipos.json` |
| D6 | Onde o app grava no projeto | `paginas/<pagina>/` na raiz; num projeto que já tem `docs/` na raiz, `docs/paginas/<pagina>/`; `--dir` muda. | `scripts/pages.mjs` |
| D7 | Versão de entrada (a grátis) | Aberta. Decide-se na publicação, que é clique do operador. | console da plataforma |
| D8 | Versão do `video-render` | 1.1.0. A interface v1 só ganha campos (`anatomy`, `texto.md`, entrada `.mhtml`); nada muda de nome nem some. | manifesto e `references/interface.md` do `video-render` |
| D9 | Vocabulário da conferência | `ok`, `atencao`, `nao_conferido`, o mesmo do `ad-landing-page`. O que a captura não trouxe nunca é reprovado. | `modules/conversion-pages/scripts/lib/check.mjs` |
| D10 | Tipos da segunda rodada | `landing` (página de vendas), `planos` (planos e preços) e `api` (página de API), todos com `"cta": "lead"`: o chamado principal pede o próximo passo (agendar, testar, começar), não uma compra. O operador pediu "esta LP e páginas derivadas" como modelos em 2026-11-07; elas não cabiam nos cinco tipos da 1.0. | `references/tipos.json` |
| D11 | Divisão com o `ad-landing-page` | A página de vendas que recebe anúncio é construída e conferida aqui, como `landing`. O briefing a partir da campanha e a continuidade entre o anúncio e a página continuam no `ad-landing-page`, que não constrói página. Antes, a skill mandava toda página de anúncio para lá. | `skills/conversion-pages/SKILL.md`, Passo 0 |
| D12 | Os modelos da família Juridiq | Quatro entradas, uma por página, ligadas pelo tipo: `juridiq-pagina-de-vendas` (landing), `juridiq-planos` (planos), `juridiq-api` (api) e `jurichat-pagina-de-vendas` (landing e planos). Fonte e data em cada uma, como D2. | `references/modelos.json` |
| D13 | O `video-render` 1.1.0 sem tag | Corrigido no lugar, sem versão nova: a leitura na chegada e o pareamento por elemento. A forma da anatomia não muda (o `path` fica só nas leituras internas). | `modules/video-render/scripts/lib/capture.mjs` |
| D14 | A versão do `conversion-pages` | 1.1.0, pelo procedimento de entrada (modelo ou tipo novo sobe a versão menor). A 1.0.0 fica em a702826, com os cinco tipos de oferta, e é a candidata natural à versão de entrada; a decisão continua aberta em D7. | manifesto; console da plataforma |
| D15 | O que entra da avaliação do Stageshow e dos seis repositórios de design (2026-11-08) | As regras da demonstração e da grade de recursos, a lista de vícios de IA e as medições objetivas, como texto e código nossos, com `NOTICE.txt` (D31). Fica de fora o kit em React, os ícones e os logos de terceiros, a recriação de páginas do Awwwards MCP e o modo de vários agentes do Genjutsu. O kit se decide depois de um teste lado a lado (ÉPICO 6, fora de cobertura). Aprovado pelo operador em 2026-11-08 ("pode seguir como sugerido"). | este plano; `modules/conversion-pages/NOTICE.txt` |
| D16 | Versão das duas mudanças | Nenhuma versão nova: `conversion-pages` 1.1.0 e `video-render` 1.1.0 não têm tag, então mudam no lugar, como D13. A interface v1 do motor só ganha campos (`anatomy.quality`) e um comando (`film`). | manifestos |
| D17 | ⚠️ **Errada, trocada por D21.** A ordem de onde vem a demonstração | Componentes reais do projeto com dados fixos, depois a tela real, e a réplica simplificada só sem código nem tela. Foi inferência minha, sem teste, e inverteu a tese do próprio Stageshow. A veracidade (CDC, art. 30 e 37, §1) nunca dependeu do componente: depende de `demo.real_today`. | substituída em `references/demonstracao.md` |
| D18 | Dado inventado contra o resto da lista de vícios | Número de uso, escassez, ano e nome sem origem são `atencao` de peso `lei` (`claims_have_origin`, `placeholder_data`). O resto da lista é aviso: o que o plano escolhe vai em `visual.chosen` e deixa de ser apontado. | `references/vicios.md`; `pagina.json` |
| D19 | Os limiares das medições | 12 px e 40% do texto (auditoria de legibilidade do Lighthouse, retirada na versão 13); 24 por 24 px (WCAG 2.2, 2.5.8, AA); 4,5 e 3 para 1, com texto grande a 24 px ou 18,66 px em negrito (WCAG 2.2, 1.4.3); imagens de 500 KB ou servidas com o dobro da largura a partir de 100 KB (critério deste app, não regra de mercado). Conferidos em 2026-11-08. Abaixo de 1,5 para 1 a leitura duvida de si e não reprova. | `modules/video-render/scripts/lib/capture.mjs`, constantes no topo |
| D20 | Como a demonstração é filmada | Em tempo real, com fotos em intervalo fixo, sem mexer na página: serve a qualquer página e não prova o que acontece entre dois quadros. O relógio determinístico do Stageshow ficou de fora porque só vale para páginas feitas com o kit dele. | `modules/video-render/scripts/lib/film.mjs` |
| D21 | De onde vem a figura (substitui D17) | Uma versão desenhada para a página (`replica`), depois a tela real (`tela`), depois os componentes do projeto (`componentes`). A tela foi feita para quem a usa todo dia, e a figura é para quem nunca a viu. O que a figura mostra precisa existir hoje, e isso fica em `demo.real_today`. | `references/demonstracao.md` §2 |
| D22 | Quem manda no visual | O pedido do integrante, o manual do projeto, o modelo escolhido e só então o guia. A lista de vícios (D18) é aviso, serve para não acrescentar por reflexo e nunca tira de uma página o que alguém escolheu. Cada modelo lista os padrões que usa. Decidido depois da queixa do operador em 2026-11-08. | `references/vicios.md`; regra 10 da skill; `references/modelos/*.md` |
| D23 | Como conferir se a página se entende | Olhando a página sem nenhuma letra (`capture --no-letters`, `files.no_letters`). Testada lado a lado com a página borrada: a borrada deixa ler os títulos e disfarça o problema. Nenhuma medida separa o telefone da caixa branca, só o olho. A regra de quatro perguntas está em "Conferir olhando". | `references/demonstracao.md` §14; `modules/video-render/scripts/lib/capture.mjs` |
| D24 | Os limites de texto | Só o que separou as páginas medidas: cartão até 32 palavras para ler e sem buraco de 30% em cartão de 200 px ou mais (depoimento, pergunta, plano e cartão com figura ficam de fora); frase em figura até 15 palavras e até 30 para ler na figura. O total de palavras da página não entra: não separa uma página boa de uma ruim (tabela no ÉPICO 7). | `scripts/lib/checks.mjs` |
| D25 | Versões | `conversion-pages` 1.2.0 e `video-render` 1.2.0, porque as 1.1.0 já têm tag e são imutáveis. A interface v1 do motor só ganha campos e uma opção. O rascunho `conversion-pages` 1.1.0 não deve ser publicado. A versão de entrada (D7) continua aberta. | manifestos; console da plataforma |
| D26 | A prova de que melhorou | Uma regra que muda o que o app constrói só vale depois de uma construção de verdade: sessão nova, pedido real, resultado olhado ao lado do que ele substitui. Teste e conferência provam que a regra roda, nunca que o resultado melhorou. | `.claude/rules/apps.md`; `.claude/skills/app-author/SKILL.md` passo 5 |
| D27 | A página de vendas de curso é um tipo próprio | `curso`, e não `landing`: a pessoa compra direto, com o preço na página, a lista do que recebe, os bônus, a garantia, a objeção do preço e a oferta repetida, e o próximo passo é a inscrição, não uma demonstração ou um teste. O roteiro da `landing` foi escrito para software (demonstração, integrações, planos). | `references/tipos.json`; `references/tipos/curso.md` |
| D28 | Parcela nunca é o preço sozinha | O preço à vista em destaque junto das parcelas e, nas parcelas, o número, o valor, os juros e o total. Lei 10.962/2004, art. 2, III; Decreto 5.903/2006, art. 3 e art. 9, IV, conferidos no planalto.gov.br em 2026-11-09. Vale em `curso`, `landing` e `planos`, onde há preço. | `references/lei.md`; `cash_price_shown` em `scripts/lib/checks.mjs` |
| D29 | A lista do que se recebe soma o total | O total escrito é a soma dos itens; um item sem valor próprio fica fora ("N/A"). A conferência lê o texto da página: as linhas que terminam num preço, sob um mesmo título, antes de uma linha "Total", com pelo menos três itens. Não é um limite numérico. | `stack_sum` em `scripts/lib/checks.mjs` |
| D30 | A foto sem letras é tirada na tela | Uma tela por vez, depois que o que ela revela aparece, com as telas se sobrepondo em um décimo, até 12 por folha e 48 por página. Fotografada além da tela, a página saía com faixas vazias onde os blocos esperam a rolagem (94 blocos na Subido). O aquecimento passa a 250 ms por passo só quando há blocos escondidos na chegada. Custo medido: a captura da Subido levou 393 s. | `modules/video-render/scripts/lib/capture.mjs`; `references/interface.md` |
| D31 | Menos movimento se confere pelo efeito | A captura lê a página de novo com o pedido de menos movimento e conta os loops que continuam (`motion.reduced_still_running`). Ter a regra no CSS não basta: a Subido tem 9 regras e 38 loops continuam. Uma captura antiga continua lida pela regra. | `capture.mjs` (`readAnatomyDesktop`); `reduced_motion` em `checks.mjs` |
| D32 | Versões | `conversion-pages` 1.3.0 e `video-render` 1.3.0, porque as 1.2.0 já têm tag. O motor muda a foto e ganha campos, sem mudar a interface v1. Sem tag até o operador pedir. | manifestos |
| D33 | O modelo da Databricks é um arquivo só | As 13 páginas mostram um sistema: as de produto, a inicial e a de desenvolvedores entram como `landing`. A de desenvolvedores não tem documentação, código nem limites, então não é modelo de `api`. | `references/modelos/databricks-pagina-de-produto.md` |
| D34 | Logo de outra empresa, quando é verdade | A regra "nenhuma logo de outra empresa" vira: a de um cliente que autorizou e a de uma ferramenta com que o produto se integra hoje, com o arquivo oficial, inteira, na mesma altura e com a legenda do que é, registrada em `claims`. Nunca um nome escrito imitando uma logo. Poucas logos ficam paradas; a fileira que passa e a cor única só com dezenas delas e com o contraste do texto (rodada 1 de T9.4). Pedido do operador ("logomarcas reais e não só descritivas"). | `references/demonstracao.md` §3 e §15; `manual` da `landing` |
| D35 | Os diagramas e os ícones próprios | O guia das figuras ganha a seção 15: o diagrama feito com as peças do produto (camadas, fluxo, centro com raios, órbita) e uma família de ícones próprios repetida no menu, nos cartões e nos diagramas. Entra provado pela construção (T9.4). | `references/demonstracao.md` §15 |
| D36 | O motor e as janelas | O aviso de cookies que abre depois do carregamento é fechado numa segunda tentativa; na foto sem letras, o que flutua sobre a página (janela, fundo dela, chat, cartão de canto, inclusive em árvore própria ou pendurado no `<html>`) fica escondido, com aviso; uma transição de 5 s ou mais conta como movimento contínuo. | `modules/video-render/scripts/lib/capture.mjs` |
| D37 | O design system para o Orkestree | Fica na pasta de trabalho, não no app: o site medido e descrito (nunca o CSS, as imagens ou os ícones deles), o dbui (`@databricks/design-system`, ISC declarado no `package.json`) como fonte das áreas logadas, e um espécime com código nosso. A aplicação no repositório do Orkestree é da sessão do Orkestree. | `flyee-workspace/pesquisa-paginas/databricks-2026-11-09/design-system/` |
| D38 | O modelo da Black Friday da Hostinger é um arquivo só | A página inicial brasileira em promoção entra como `planos` (os cartões) e `landing` (o topo e a faixa). A internacional serve só de comparação. A oferta depois da compra continua no modelo de D3. Pedido do operador, para usar nas ofertas de Black Friday do MedChina; o modelo é produto, sem nada da marca (D22 do plano de anúncios). | `references/modelos/hostinger-black-friday.md` |
| D39 | Versões | `conversion-pages` 1.4.0, porque a 1.3.0 já tem tag. O `video-render` não muda. Sem tag até o operador pedir. | manifesto |
| D40 | A conferência fecha o período pago adiantado e lê a economia pelas palavras perto do preço | `discount_math` confere que "R$ 287,52 por 48 meses" é o preço por mês do cartão vezes 48. `plan_highlighted` aceita "Oferta especial" e "Melhor oferta". Um preço é economia quando as palavras logo antes ou logo depois dele dizem isso, e não quando a palavra aparece em qualquer ponto do trecho. Com a leitura antiga, a construção da rodada 2 recebeu um falso alarme em "Economia de R$ 427,20 no primeiro ano. Total do 1º ano: R$ 640,80". | `scripts/lib/checks.mjs` (`isSaving`, `PREPAID_TOTAL`, `RECOMMENDED`) |
| D41 | O contador da promoção mostra dias, e o topo escreve o começo e o fim | Com mais de um dia pela frente, o contador mostra dias, horas e minutos. O começo e o fim ficam no topo e perto dos planos, e a figura do produto fica no topo, ao lado da oferta. Entra provado pela construção: na rodada 1, a sessão copiou o contador só em horas da Hostinger ("270:59:29"), e os dois leitores o leram como pressa (T10.4). | `modelos/hostinger-black-friday.md`; `tipos/planos.md`; `manual` dos `planos` em `tipos.json` |

## 0.5 Convenções do repositório que este trabalho toca

- **A fronteira.** Sai para o integrante só `modules/<slug>/` sem `tests/`, `.dev/` e `*.dev.md`. O material bruto dos modelos nunca entra no repositório.
- **Regra de texto.** Todo `.md` distribuído, o manifesto e o que os scripts imprimem passam pelo `text-lint`: sem travessão, sem exclamação, sem emoji, sem as palavras vetadas. Revisão final com `humanizer-pt-br`.
- **O integrante não usa terminal.** Comandos nos textos são `npx --yes flyee@latest <comando>`; outro app se chama pelo caminho instalado (`.flyee/modules/video-render/scripts/render.mjs`), e é assim que o catálogo registra quem usa quem.
- **O projeto é a pasta.** O que o app produz fica no projeto aberto, mesmo quando o app está instalado para o usuário (D1).
- **Número com rótulo e fonte (D23).** Nenhuma taxa de aceite ou de conversão de mercado entra sem rótulo, fonte e data; na 1.0, nenhuma entra.
- **Windows primeiro.** Caminhos, processos e o navegador sem janela funcionam no Windows antes de tudo.

## Invariantes

1. **Nenhum texto completo de terceiros nem mídia baixada entra no repositório ou no pacote.** O repositório é público e o pacote é vendido: redistribuir material sem licença fere D31.
2. **O app nunca recomenda caixa já marcada, cobrança sem o valor visível no botão ou na confirmação, nem recusa escondida ou constrangedora.** A lei trata produto não solicitado e venda casada como prática abusiva (CDC, art. 39), e quem paga sem saber pede o dinheiro de volta.
3. **A conferência nunca reprova o que a captura não trouxe.** Um item sem dado sai `nao_conferido`, com o motivo.
4. **`link --user` nunca sobrescreve nem apaga uma skill do usuário sem a marca do flyee.** Ela pode ser trabalho do operador em outro lugar.
5. **A interface v1 do `video-render` só acrescenta.** `ad-creatives`, `media-plan`, `video-studio` e `motion-carousel` leem `captura.json`; um campo renomeado quebra os quatro.
6. **O que o app produz fica no projeto aberto**, nunca na pasta de instalação do usuário, que é trocada a cada `link`.

## ÉPICO 1: `video-render` 1.1.0, a captura completa

**Bloqueia:** a conferência automática do ÉPICO 2 (T2.4).

### T1.1: a anatomia da página em `captura.json`

**Estado: 🟡**
- `extractInPage` (`modules/video-render/scripts/lib/capture.mjs:877`) já lê até 60.000 caracteres (`:1708`), mas o arquivo guarda só os primeiros 4.000 (`:1797`).
- Os chamados são "os botões principais" (`references/interface.md:381`).
- Não há formulários, atributos de vídeo, elementos fixos nem animações; o grep por `anatomy` no app dá zero.

O que entra:
- Um bloco `anatomy` (`format_version: 1`) com:
  - `sections` (título, posição, texto e palavras);
  - `ctas` (todos os botões e links de ação, com posição, `above_fold` no computador e no celular e `in_fixed`);
  - `fixed` (barras fixas ou grudadas, com `appeared_after_scroll`);
  - `forms` (caixas e opções com `checked`, `required` e o preço no rótulo);
  - `prices` (com `struck` para o preço riscado);
  - `media` (vídeos com `autoplay`, `muted`, `loop`, `playsinline`, `controls`, `poster`, e as dimensões; iframes por provedor; imagens sem `alt`);
  - `motion` (as animações rodando por `document.getAnimations()`, os nomes de `@keyframes`, a contagem de transições, as regras de `prefers-reduced-motion`, a rolagem suave, os trilhos com encaixe, as folhas de estilo que não deu para ler);
  - `countdowns` (textos de relógio que mudaram entre duas leituras).
- Tetos por lista, e `null` quando a leitura falhar.
- **Aceite:** o teste do app captura a página de exemplo `tests/fixtures/oferta/index.html` e encontra:
  - a caixa marcada com `checked: true` e o preço riscado com `struck: true`;
  - o vídeo com os quatro atributos e a capa;
  - ao menos uma animação rodando e `reduced_motion_rules >= 1`;
  - a barra fixa com `appeared_after_scroll: true`;
  - o primeiro chamado com `above_fold.mobile: true`.

### T1.2: o texto inteiro em `texto.md`

**Estado: ⬜.** `files` não tem texto (`references/interface.md:373`).
- `texto.md` traz o texto da página na ordem, com os títulos como títulos, até o teto de 60.000 caracteres. `files.text` aponta para ele.
- **Aceite:** no mesmo teste, `texto.md` existe e contém o título da última seção da página de exemplo.

### T1.3: a página salva (`.mhtml`)

**Estado: ⬜.** `normalizeUrl` aceita só `.html` e `.htm` (`capture.mjs:619`).
- Aceitar `.mhtml` e `.mht` como arquivo local. `captura.json` ganha `input_kind` (`url`, `html` ou `mhtml`). É o caminho para páginas que só abrem com login: o integrante salva a página no navegador e a IA captura o arquivo.
- **Aceite:** o teste salva a página de exemplo como MHTML pelo próprio navegador (`Page.captureSnapshot`), captura o arquivo e recebe `input_kind: "mhtml"` com os mesmos títulos.

### T1.4: versão, interface e testes

- Na interface: `npm run apps -- bump video-render minor`, o changelog nos dois idiomas, a seção 5 de `references/interface.md` com os campos novos, e o guia "abrir o capô" com uma linha sobre a leitura completa.
- **Aceite:** `npm run validate video-render` passa, e os testes do app passam, os antigos e os novos.

## ÉPICO 2: `conversion-pages` 1.0.0

### T2.1: o app

**Estado: ⬜.** `modules/conversion-pages` não existe.
- `npm run apps -- new conversion-pages --type workflow --trail vender --title "Páginas que vendem" --summary "…"`.
- **Aceite:** `npm run apps -- list` mostra o app; `validate` só aceita depois que nenhum `[PREENCHER]` sobrar.

### T2.2: o repertório

**Estado: ⬜.**
- O que entra em `references/`:
  - `tipos.json` (cada tipo com `id`, rótulo, onde fica no funil, os ids das conferências e os modelos);
  - `tipos/<tipo>.md` para os cinco tipos (o que é, quando usar, a regra que não se quebra, as seções na ordem, a mecânica, a oferta, o texto, movimento e mídia, celular, medição, linhas legais);
  - `modelos/hostinger-agente-pos-compra.md` (fonte e data, fluxo, regra de exibição, anatomia, mecânica, movimento quadro a quadro, o que não repetir);
  - `principios.md`, `movimento.md`, `medicao.md` e `lei.md` (CDC e Decreto 7.962/2013, com os artigos conferidos na data, como método e não como parecer).
- **Aceite:**
  - cada tipo de `tipos.json` tem o seu `.md`, e cada id de conferência existe em `scripts/lib/check.mjs` (teste unitário);
  - `lei.md` traz a data em que os artigos foram conferidos;
  - o `validate` passa.

### T2.3: a skill

- `skills/conversion-pages/SKILL.md`, com descrição abaixo de 400 caracteres.
- Passos da skill:
  1. reconhecer o tipo;
  2. ler o roteiro e os modelos;
  3. perguntar só o que falta, numa mensagem;
  4. escrever o plano;
  5. construir no código do projeto;
  6. conferir pela captura;
  7. resumir no chat em três linhas.
- A página de destino de um anúncio vai para o `ad-landing-page`.
- **Aceite:** o caso de avaliação "página de anúncio" responde citando o `ad-landing-page` e não escreve plano próprio.

### T2.4: o script `scripts/pages.mjs`

- Comandos, todos com `--json`, erro com `code`, `message` e `fix`, e `next_step`:
  - `types`;
  - `models [--type]`;
  - `plan <tipo> --name <pagina>`, que grava `pagina.json` com os fatos declarados e `plano.md`;
  - `check <pagina> [--url <endereço> | --capture <captura.json>]`.
- O `check` roda a captura do `video-render`. Ele procura o motor primeiro em `.flyee/modules/video-render/`, depois na pasta irmã da própria instalação, o que cobre o projeto e a instalação do usuário.
- **Aceite:**
  - testes unitários sobre capturas de exemplo dão os estados esperados: caixa marcada é `atencao`, recusa ausente é `atencao`, captura sem anatomia é `nao_conferido`;
  - sem o motor, `check` devolve `video_render_missing` com o `fix`.

### T2.5: o que o integrante lê

- `README.md`, `guides/pt-BR/usar.md`, `guides/en/usar.md`, os dois "abrir o capô" e `.dev/showcase.json` (`en: null`: o app trabalha em português e com a lei brasileira).
- **Aceite:** `npm run validate conversion-pages` passa sem aviso de regra de texto que bloqueie.

### T2.6: avaliação

- `tests/eval.json` com três casos: o upsell pedido num projeto, o order bump com a caixa marcada apontada e a página de anúncio encaminhada.
- **Aceite:** os casos existem e o `validate` os aceita.

## ÉPICO 3: o app instalado para o usuário

### T3.1: `apps link <slug...> --user` e `unlink --user`

**Estado: ⬜.**
- Hoje o `link` liga só na pasta de trabalho ou num projeto (`packages/module-tools/src/cli.ts:236-240`, com `dev link` em `:133` e `workspace.ts:56`).
- As pastas de skill da CLI são as do projeto (`packages/core/assets/tools.json`, `.agents/skills` e `.claude/skills`).

O que entra:
- `dev link` na pasta do usuário (D1), que traz também os apps chamados.
- Uma ponte por skill em `~/.claude/skills/<skill>/SKILL.md`, com a marca `flyee:user-link`, o frontmatter original e o caminho absoluto do pacote, mais a regra de que o que o app grava fica no projeto aberto.
- Recusa (`user_skill_exists`) quando a pasta existe sem a marca.
- `unlink --user` tira só pontes marcadas.

**Aceite:**
- teste com `HOME` e `CLAUDE_CONFIG_DIR` temporários: cria as pontes, recusa a pasta sem marca, desfaz só as marcadas;
- feito à mão: depois de `npm run apps -- link conversion-pages --user`, uma sessão nova do Claude Code aberta em `C:\AppsProjects\flyee-club` lista a skill `conversion-pages`.

### T3.2: a regra

**Estado: ⚠️.** `.claude/rules/apps.md:5` diz que app nunca é instalado em repositório de código, e continua valendo. A exceção do operador é a instalação para o usuário, que não grava nada no repositório. A linha nova entra em `apps.md`, curta, porque as regras no espelho estão em cerca de 26,7 KB de 32 KB.

**Aceite:** `npm run harness:check` passa.

## ÉPICO 4: a entrada de cada modelo novo

### T4.1: o procedimento do operador

O procedimento fica em `modules/conversion-pages/.dev/INTAKE.md`:
1. **O que o operador traz:** endereço, página salva (`.mhtml`), capturas de tela ou vídeo.
2. **A captura:** `capture` com a anatomia. Para página com login, a página salva; como último recurso, o dicionário de textos e o código da tela que a página baixa, como no modelo da Hostinger.
3. **O bruto** vai para a pasta de trabalho.
4. **A análise** segue o modelo de `modelos/` e atualiza o roteiro do tipo.
5. **A conferência entre apps:** o que os outros apps do catálogo ganham com o mesmo achado.
6. **A versão nova.**

**Aceite:** o arquivo existe e o modelo da Hostinger foi feito seguindo-o.

### T4.2: o material bruto da Hostinger

- O material de 2026-11-07 vai para `C:\AppsProjects\flyee-workspace\pesquisa-paginas\hostinger-agente-2026-11-07\`: o texto transcrito, os sete vídeos, a capa, as folhas de quadros, o CSS e os arquivos de texto e código da tela.
- **Aceite:** a pasta existe com esses arquivos, e nada dela está no repositório (`git status` limpo para esses caminhos).

### T4.3: a regra da conferência entre apps

- Uma linha em `.claude/rules/apps.md`: todo modelo novo deste app termina com a lista do que os outros apps ganham.
- **Aceite:** a linha está no `AGENTS.md` gerado, e `harness:check` passa.

## ÉPICO 5: o modelo do Juridiq e as páginas derivadas (2026-11-07)

O operador trouxe quatro endereços: juridiq.com.br, juridiq.com.br/api, juridiq.com.br/plans e jurichat.com. Foram vistos durante a promoção de Black Friday das duas marcas.

### T5.1: a captura e o bruto

**Estado: ✅.**
- **Onde:** `C:\AppsProjects\flyee-workspace\pesquisa-paginas\juridiq-2026-11-07\`, com uma pasta por página: `captura.json`, `texto.md`, as fotos e as rolagens do computador e do celular.
- **A sonda:** em `sonda/`, um navegador por CDP, sem clicar em compra nem marcar demonstração. Ela mede:
  - quando a janela abre, por profundidade ou por tempo;
  - a barra do celular;
  - a digitação, o radar e a contagem dos números;
  - o seletor mensal;
  - a agenda;
  - o pedido de menos movimento.
- **As fotos:** 48 telas, das seções e do celular.

- **Aceite:** a pasta existe com um `LEIAME.txt`, e nada dela está no repositório.

### T5.2: os três tipos

**Estado: ✅.** `references/tipos.json` ganhou `landing`, `planos` e `api`. Os roteiros estão em `references/tipos/landing.md`, `planos.md` e `api.md`. `discount_math` entrou também nos quatro tipos de oferta que têm preço riscado.
- **Aceite:** o teste de coerência de `tests/pages.test.mjs` passa, e `types` lista os oito tipos.

### T5.3: os catorze itens novos da conferência

**Estado: ✅.** Os itens novos, em `references/checks.json` e `scripts/lib/checks.mjs`:
- `h1_present`, `numbers_not_zero`, `trial_terms`, `promo_terms_shown`, `discount_math`;
- `popup_dismissable`, `popup_on_arrival`;
- `supplier_identified`, `cancel_terms_shown`, `plan_highlighted`, `prices_first_screen`;
- para a página de API, `docs_first_screen`, `code_sample` e `rate_limits_shown`.

O que mudou no motor da conferência:
- **Modo `lead`:** o chamado principal pode ser agendar, testar ou começar. Botões lado a lado ficam na mesma faixa, e entre eles vence o que o celular mostra.
- **O texto inteiro:** a conferência lê o `texto.md` da captura, então o rodapé entra mesmo numa seção longa.
- **A barra fixa:** deixa de contar o botão do menu e as janelas que cobrem a tela.

- **Aceite:** 23 testes em `tests/pages.test.mjs`, nove deles novos. Um roda a captura real da página `video-render/tests/fixtures/janela/` como `landing` e confere três coisas: a janela aparece depois da rolagem, tem saída, e o botão principal está na primeira tela.

### T5.4: as duas correções do `video-render` 1.1.0

**Estado: ✅.**
- **A leitura na chegada.** `readArrival` lê as barras e as janelas antes do aquecimento, no computador e no celular. `mergeFixed` usa essa leitura para `appeared_after_scroll`. Quando uma janela que abre com a rolagem sai nas fotos, a resposta avisa em `warnings`.
- **O pareamento por elemento.** Cada chamado leva o caminho dele no documento, e `matchMobileCtas` pareia primeiro pelo mesmo caminho com o mesmo texto. O pareamento pelo texto, na ordem, fica para o que sobrar.
- **Aceite:** 108 testes do `video-render` passam, 3 deles novos. Um captura de verdade a página `tests/fixtures/janela/`, que tem uma janela que abre aos 40% da rolagem e um botão do menu escondido no celular.

### T5.5: os modelos

**Estado: ✅.** `references/modelos/juridiq-pagina-de-vendas.md`, `juridiq-planos.md`, `juridiq-api.md` e `jurichat-pagina-de-vendas.md`, e as quatro entradas em `modelos.json` (D12). Os princípios, o movimento, a medição e a lei passaram a valer para toda página que vende. A lei ganhou os arts. 30 e 35 do CDC e os incisos do art. 2 do Decreto 7.962/2013, conferidos no planalto.gov.br em 2026-11-07. Duas fontes técnicas entraram e foram conferidas no mesmo dia:
- a orientação do Google sobre janelas intrusivas;
- o critério 2.2.2 do WCAG 2.2, de pausar, parar e esconder.

- **Aceite:** `npm run validate conversion-pages` passa, o que inclui a regra de texto em cada arquivo distribuído.

### T5.6: a versão e a instalação

**Estado: ✅.** `npm run apps -- bump conversion-pages minor`, o changelog nos dois idiomas, `pack` dos dois apps e `link conversion-pages --user`.

**A conferência real.** Rodou pelo `audit` do app nas quatro páginas, num projeto de teste e com o motor corrigido:

| Página | Tipo | Resultado | Em atenção |
|---|---|---|---|
| inicial | `landing` | 14 ok, 2 atenção | o teste sem duração; os números "0+" |
| planos | `planos` | 13 ok, 2 atenção | o teste sem duração; a falta de `h1` |
| api | `api` | 11 ok, 2 atenção | os limites de uso; o preço partido "R$ 98" e ",90" (um falso aviso, ver o backlog) |
| jurichat | `landing` | 9 ok, 4 atenção | sem CNPJ; sem caminho de arrependimento; sem regra de cancelamento; sem barra fixa no celular |

A janela da página inicial saiu `ok` em `popup_on_arrival`. O botão principal do JuriChat saiu "Comece grátis", o mesmo que a página mostra em azul.

## ÉPICO 6: a demonstração, os vícios de IA e as medições da página pronta (2026-11-08)

O operador trouxe dois vídeos e pediu a análise do que serviria aos apps de página: a skill Stageshow (benjitaylor/skills, MIT) e seis repositórios de design (Awwwards MCP, Responsively, Genjutsu, Dembrandt, App Store Screenshots e brag). A análise e a decisão estão em D15 a D20; o material lido ficou na pasta temporária da sessão, fora do repositório, e nada dele foi copiado.

### T6.1: o guia da demonstração e da grade de recursos

**Estado: ⚠️ substituído no ÉPICO 7.** O guia foi escrito, mas a ordem de D17 e a grade da seção 12 pioraram a página. `modules/conversion-pages/references/demonstracao.md`, com as treze seções: de onde vem a imagem (D17), a regra da veracidade, o plano antes do código, a história (3 a 5 momentos em 10 a 16 s), a tela (3 a 7 textos reais), o enquadramento, o celular, a capa, o movimento, a cena dentro da página (`data-demo`, sem `h1` a `h6`), os cinco erros, a grade de recursos e o olhar sobre os quadros filmados.
- **Aceite:** `npm run validate conversion-pages` passa; `references/principios.md` §5 e os roteiros `landing.md`, `api.md` e `upsell.md` apontam para o guia.

### T6.2: a lista dos vícios de IA

**Estado: ⚠️ corrigida no ÉPICO 7 (D22).** Ela mandava tirar o que o integrante tinha escolhido. `modules/conversion-pages/references/vicios.md`: quatro famílias (dado inventado, enfeite sem função, layout por reflexo, texto vazio), cada item com o que aparece e a pergunta de volta ao projeto, e o nome que vai em `visual.chosen`.
- **Aceite:** cada nome de `visual.chosen` que `ai_defaults` conhece está na lista; o teste "the defaults are named, and what the plan chose on purpose stops being pointed at" passa.

### T6.3: o plano com a direção visual, a demonstração e os números

**Estado: ✅.** `pagina.json` ganha `visual`, `brand`, `demo` e `claims`; `plano.md` ganha as seções "A direção visual", "A demonstração" (só nos tipos com `"demo": true`: `upsell`, `landing` e `api`) e "Os números e as urgências". `visual.direction` entra nos fatos de `landing`, `planos`, `api` e `upsell`, e `demo.kind` nos três tipos com demonstração.
- **Aceite:** os testes de `tests/quality.test.mjs` sobre o plano passam, inclusive o de um `pagina.json` escrito antes desta rodada.

### T6.4: os doze itens novos da conferência

**Estado: ✅.** Em `references/checks.json` e `scripts/lib/checks.mjs`: `claims_have_origin`, `placeholder_data`, `demo_honest`, `demo_film`, `ai_defaults`, `cta_consistent`, `off_brand`, `mobile_fits`, `text_legible`, `tap_targets`, `contrast_ok`, `controls_fit` e `images_light`. Cada tipo lista os seus em `tipos.json` e no roteiro (um teste confere que os dois batem).
- **Aceite:** 39 testes do `conversion-pages` passam, 16 deles novos, um com a conferência real da página de defeitos e da cena filmada pelo motor.

### T6.5: as medições na captura do `video-render`

**Estado: ✅.** `anatomy.quality` (`references/interface.md` §5): a largura do celular, o texto pequeno, os alvos de toque, os botões em que o texto não cabe, as imagens e o peso no celular; o contraste, as cenas `data-demo` e os padrões visuais no computador. Cada leitura falha sozinha, sem derrubar a anatomia. O contraste lê cada par onde está na tela, com todo elemento respondendo ao toque durante a leitura, e deixa de fora texto decorativo (`aria-hidden`), botão desligado, texto sobre imagem ou degradê e o par abaixo de 1,5 para 1 (D19).
- **Aceite:** 14 testes em `tests/quality.test.mjs`, com a página `tests/fixtures/qualidade/`, que tem um defeito de cada tipo.

### T6.6: o comando `film` e o movimento reduzido fixado

**Estado: ✅.** `film <endereço> --select <seletor>` (`scripts/lib/film.mjs`, `scripts/commands/film.mjs`): três passadas (computador, celular, celular com menos movimento), uma folha de quadros por passada e `filme.json`. O `audit` do `conversion-pages` filma a cena quando `demo.selector` está registrado, e uma filmagem que falha deixa `demo_film` como não conferido, sem derrubar a conferência. Toda página aberta pelo motor responde `prefers-reduced-motion: no-preference`, a não ser quando a passada pede o contrário.
- **Aceite:** os testes de `film` passam com `tests/fixtures/filme/`, que se mexe sem o pedido e fica parada com ele; o teste "a system set to reduce motion does not change what a page shows, unless asked" abre o navegador com `--force-prefers-reduced-motion` e confere as duas respostas.

### T6.7: a conferência real nas quatro páginas

**Estado: ✅.** As quatro páginas do Juridiq e do JuriChat passaram pelo `audit` com as medições novas, num projeto de teste. A primeira passada achou quatro falsos alarmes, corrigidos antes desta versão: as porcentagens de desconto quebradas em duas linhas, os limites dos planos lidos como números de uso, um botão com brilho decorativo lido como texto cortado e um par de contraste sobre uma camada que a leitura não via. O resultado da segunda passada está em "Verificação da rodada 6", abaixo.

### Verificação da rodada 6

**A conferência real, segunda passada.** As quatro páginas, num projeto de teste sem `pagina.json` preenchido. Os itens que dependem dos fatos do plano saem como antes (ÉPICO 5). Os novos acharam:

| Página | Tipo | Resultado | O que os itens novos apontaram |
|---|---|---|---|
| inicial | `landing` | 16 ok, 10 atenção, 1 não conferido | "1.500+", "1,2 mi+" e "85.000+" sem origem; título com degradê, vidro, manchas desfocadas, três cartões iguais, animação sem fim e "Eleve"; o mesmo pedido com 9 textos; a faixa da promoção com 11 px; um botão sem nome de 20 px; "Agendar demo" a 3,12 para 1 |
| planos | `planos` | 15 ok, 9 atenção, 1 não conferido | "+1.500" sem origem; os mesmos padrões; a faixa com 11 px; um link de 16 px de altura junto de outro; o mesmo contraste |
| api | `api` | 15 ok, 6 atenção, 2 não conferidos | os padrões; 6 textos de chamado; a faixa com 11 px; o botão sem nome; "Agora não" a 2,68 para 1 |
| jurichat | `landing` | 12 ok, 10 atenção, 1 não conferido | os padrões e "Revolucione"; 7 textos de chamado; a faixa com 11 px; "Próximo mês" a 2,6 para 1 |

`off_brand` saiu não conferido nas quatro, porque o projeto de teste não registrou a marca. `mobile_fits`, `controls_fit` e `images_light` saíram ok nas quatro. A primeira passada achou os quatro falsos alarmes de T6.7. A segunda pôs "0+" entre os números sem origem; ele saiu depois dela, coberto por um teste, porque `numbers_not_zero` já aponta o contador parado em zero.

**O que rodou:**
- `npm run validate conversion-pages`: passa, com 33 arquivos; `pack` dá o ZIP sha256 `a19a4665…`;
- `node --test` nos testes do `conversion-pages`: 39 passam;
- no `video-render`, `tests/quality.test.mjs` e `tests/anatomy.test.mjs`: 30 passam;
- os testes do `module-tools`: 75 passam, entre eles a regra de texto sobre todo texto de integrante;
- `npm run apps -- catalog --check` e `npm run harness:check`: passam;
- o `video-render` foi empacotado pela sessão que mexia no som do motor, depois da parte dela: ZIP sha256 `05fc2c85…`, 35 arquivos, `validate` passa. Ela rodou os testes de som, synth, audio, core e runner, 55 de 55;
- `npm run apps -- link conversion-pages --user` reinstalou os dois apps, e as cópias instaladas são iguais à fonte. Rodando `check` da pasta do ONE, o projeto é o ONE, o motor é o 1.1.0 com a leitura completa e a página `home` aparece com a conferência antiga (5 ok, 2 em atenção);
- a suíte do motor em duas partes: 81 testes no navegador (`anatomy`, `capture`, `accept` e `quality`) sobre o estado final, e os 55 de som pela outra sessão;
- o commit 4cc2280 levou exatamente o estado empacotado: o stage estava igual à árvore nesses caminhos, e nenhum arquivo mudou depois dos dois pacotes;
- a CI de 4cc2280 passou inteira, Linux e Windows (run 42508159600);
- as tags, uma por vez: `video-render@1.1.0` (run 42508183476) e `conversion-pages@1.1.0` (run 42508231516). O log de cada uma diz "Platform sha256 …, the same as the pack", com `05fc2c85…` e `a19a4665…`.

**O que não rodou:**
- a revisão da landing do ONE com o app novo, que é o próximo pedido do operador numa sessão do ONE.

### Fora de cobertura desta rodada

- **O kit do Stageshow** não foi trazido nem testado. O passo seguinte é o teste lado a lado no ONE, num branch: o mesmo topo de página com e sem o kit, julgado pelas folhas de quadros. Ele mexe num repositório do operador e roda código de terceiros, por isso espera a palavra dele.
- **O relógio determinístico** (D20) não foi testado: `film` grava em tempo real.
- **A grade de recursos** não tem item automático: a regra é lida pela IA nas fotos.
- **O contraste** não compõe imagens, degradês nem pseudo-elementos: esses pares voltam como não medidos, e a IA olha nas fotos.
- **macOS e Linux** não rodaram as medições nem o `film`.
- **Nenhuma sessão real** construiu uma página com o guia da demonstração.

## ÉPICO 7: a correção da rodada 6, depois que ela piorou a página (2026-11-08)

O operador testou a home do ONE refeita com a 1.1.0 e escreveu "parece que ficou foi mais ruim", com quatro queixas: o título da hero sem fala natural, o elemento abaixo dela mais confuso, a seção de atendimento só com texto e um monte de cartão cheio de texto. O plano já declarava "nenhuma sessão real construiu uma página com o guia", e mesmo assim a rodada foi apresentada como melhora.

### A auditoria do erro

**Método:** a versão anterior (7fdd3e8 do ONE) rodada a partir do código, numa cópia fora do repositório; a publicada (2285f14); os modelos no ar; as três medidas pela mesma ferramenta. **Cobertura:** o ONE é uma página só, e o julgamento é visual.

| Queixa | De onde veio | Evidência |
|---|---|---|
| Título | Não veio da rodada 6: está igual desde f4e0c2a (21/10). ⚠️ `tipos/landing.md` já pedia o resultado no título, mas nada obrigava a testar, e o `audit` não olhava | `git log -S` em `packages/content/messages/pt-BR.json`; `one-home-title` igual nos dois commits |
| Elemento abaixo da hero | D17 e as seções 1, 5 e 6 do guia: a janela com etapas e cartões soltos virou um recorte de componentes reais | `CaseScreen` e os cartões saíram de `page.tsx`, `case-demo.tsx` entrou; `pagina.json` do ONE registrou `demo.kind: componentes` |
| Atendimento só com texto | Em parte: os quatro cartões são anteriores. O telefone (`PhoneFrame`) virou uma caixa branca com balões (`ConversationFigure`), porque o guia dizia que tela desenhada era dado inventado | `page.tsx` nos dois commits |
| Cartões cheios de texto | A seção 12 do guia (a grade) e a linha da lista de vícios contra alternar imagem e texto: o calendário, o gráfico de barras e o "4 de 4" viraram uma grade de frases | `FeatureRows` virou `BentoGrid`; o catálogo de textos perdeu `one-home-link-*`, `-court-*`, `-deadline-*`, `-board-*` |
| O brilho do topo saiu | A lista de vícios e o texto que passei ("tire os vícios da lista"), embora os modelos usem esses padrões | comentário em `hero.tsx` citando "mancha desfocada"; `quality.desktop.defaults`: Juridiq com 12 degradês, 4 vidros e 12 manchas |
| 16 itens ok | Nenhum item olhava se a página se entende | `docs/paginas/home/conferencia.json` do ONE |

**As medidas.** O total de palavras não explica a queixa: a página de que o operador reclamou é a que tem menos texto.

| Página | Palavras por 1.000 px | Parte em blocos de 12 palavras ou mais | Maior cartão, em palavras para ler (fora depoimento, pergunta e plano) | Buraco em cartão alto |
|---|---|---|---|---|
| Juridiq | 165 | 41% | 25 | nenhum |
| JuriChat | 153 | 42% | 31, com gráfico | nenhum sem figura |
| ONE antes (7fdd3e8) | 162 | 45% | 27 | nenhum |
| ONE publicado (2285f14) | 148 | 48% | 55 e 40 | 46% e 31% |

O telefone contra a caixa branca não aparece em número nenhum: as duas seções têm quase as mesmas contagens. Por isso a conferência principal é olhar (D23).

### T7.1: a foto sem letras e as leituras novas do motor

**Estado: ✅ em b5535b0.** `capture --no-letters` grava `sem-letras.jpg` e `sem-letras-celular.jpg`, com o texto apagado e ícones, imagens, cores e formas no lugar (`writeNoLetters`, `scripts/lib/capture.mjs`; as folhas saíram de `film.mjs` para `scripts/lib/sheet.mjs`). `anatomy.quality.desktop` ganha `figures[]` e `cards[]` (`references/interface.md`).
- **Aceite:** `node --test modules/video-render/tests/quality.test.mjs`, com o caso "captureSite reads the cards and the figures, and photographs the page with no letters", que abre a foto e mede que o texto preto sumiu.

### T7.2: o guia reescrito

**Estado: ✅ em b5535b0.** `references/demonstracao.md` abre com "A figura se entende sem ler"; a ordem é a de D21; o cartão branco com frase, o recorte de interface e o cartão com linhas estão entre os erros; a janela grande voltou a valer; os recursos principais ganham uma linha com figura grande, e a grade só entra a pedido. `references/vicios.md` segue D22. `references/principios.md` ganha a seção 17, o título que vende, com cinco formas e quatro testes e a regra do operador de 2026-10-30 ("exagere o interesse, nunca o fato"). Os modelos do Juridiq e do JuriChat ganham "As figuras, seção por seção", vistas sem letras, e os padrões da lista que usam.
- **Aceite:** o teste "the guide puts the drawing first and never tells anyone to strip a chosen look".

### T7.3: o plano, os itens novos e a foto de antes

**Estado: ✅ em b5535b0.** `pagina.json` ganha `headline` e `figures`, que passam a ser fatos obrigatórios de `landing`; o plano mostra as duas tabelas. Quatro itens: `title_promises`, `figures_seen`, `cards_short` e `cards_no_holes`, com os limites de D24. `audit --before` guarda a página em `antes/`, e o `audit` seguinte devolve `files.before`. O resultado e `conferencia.json` trazem `not_checked`, que diz o que a conferência não vê, e `next_step` diz que "nada em atenção" não quer dizer página boa.
- **Aceite:** `node --test modules/conversion-pages/tests/pages.test.mjs modules/conversion-pages/tests/quality.test.mjs`: 45 passam, entre eles "the limits of the cards separate the pages they were measured on", com os números reais da tabela acima.

### T7.4: a skill que não deixa pular

**Estado: ✅ em b5535b0.** Veio do segundo teste de construção, abaixo: a skill agora diz, antes das regras, que os seis passos não são opcionais, e a regra 11 diz que conferência em ok não é página boa. O passo 5 proíbe dizer que a página ficou boa porque a conferência passou.

### T7.5: as construções de verdade

**Estado: ✅, com as ressalvas abaixo.** Três sessões novas do Claude Code, sem contexto além da skill instalada. A evidência está em `C:\AppsProjects\flyee-workspace\pesquisa-paginas\one-home-2026-11-08\`, com um `LEIAME.txt`.

| Sessão | Pedido | Modelo | Tempo | O que aconteceu |
|---|---|---|---|---|
| 1 | Refazer a home do ONE, numa cópia fora do repositório (`git archive` de 34e5b4f), com as quatro queixas nas palavras do operador | o padrão do operador (Opus) | 39 min, 275 turnos | Título "Você advoga. O ONE faz o resto."; a janela grande do sistema, o telefone no centro com dois cartões escuros de cada lado, o radar, os documentos, a petição, o calendário e a pasta do protocolo. Usou `audit --before`, a foto sem letras e um agente sem contexto sem ninguém lembrar. Nenhum cartão pede mais de 15 palavras de leitura. Conferência: 21 ok, 2 em atenção (CNPJ e reembolso, os mesmos de antes) |
| 2 | Uma página do zero, em HTML, para um produto fictício de outro ramo (`PRODUTO.md`), antes de T7.4 | Sonnet | 78 s, 12 turnos | ⚠️ Leu os guias e escreveu a página direto, sem plano, sem as cinco opções de título e sem conferir, e disse isso no fim. A hero ficou boa. Abaixo dela, as figuras eram cartões brancos com linhas, o que a foto sem letras mostra de cara: foi o que originou T7.4 |
| 3 | O mesmo pedido, depois de T7.4 | Sonnet | 4 min, 25 turnos | Seguiu os passos: plano, cinco títulos, construção, conferência, foto sem letras no computador e no celular, uma figura corrigida e nova conferência. Telefone com a nota fiscal, barras de estoque, telefone com a conversa e relatório. Depois de corrigir, não abriu de novo a foto do computador, e disse isso |

**A leitura às cegas.** Um agente sem contexto (Sonnet), no papel de sócio de escritório, viu as três versões da home do ONE, sob os nomes A, B e C. Continuaria rolando a refeita, depois a anterior, e sairia da publicada. As críticas dele à refeita: "faz o resto" promete sem limite, e "Escrevendo a petição" pode assustar um advogado. É uma leitura de IA, de um único agente, com as duas primeiras telas de cada versão.

**Onde o resultado ficou aquém:**
- ⚠️ O brilho de fundo do topo, que a rodada 6 tirou, não voltou na sessão 1: o comentário em `hero.tsx` ainda dizia que ele saiu por causa da lista de vícios, e a análise do modelo não descrevia o efeito. Agora descreve, e o operador pediu o brilho de volta (T7.6). O manual do próprio ONE já avisava contra um topo liso (`.claude/skills/marketing-page/SKILL.md:88`): a lista passou por cima dele, o que D22 agora impede.
- "Você advoga. O ONE faz o resto." é forte e discutível: escrever a petição também é advogar. A própria sessão apontou isso e trocou o subtítulo para "a primeira versão da petição". O título segue como decisão do operador, com as alternativas em `docs/paginas/home/pagina.json`.
- A página da sessão 3 se entende, mas não tem a riqueza dos modelos.
- A skill pede e não obriga: a sessão 3 é uma amostra só de que o reforço funciona.
- A sessão 1 custou US$ 15,85 pela conta do Claude Code (`total_cost_usd`), e as sessões 2 e 3, US$ 0,34 e US$ 0,57.

- **Aceite:** abrir `comparacao-topo.jpg` e `comparacao-sem-letras.jpg` naquela pasta: a refeita mostra objetos onde a publicada mostra caixas. O juiz final é o olho do operador, que viu a refeita e aprovou em 2026-11-08 ("essa versão ficou muito boa").

### T7.6: a home refeita no ONE

**Estado: ✅ no ar desde 2026-11-09.** O operador fez o push de 5aadb0c, aa15754 e 2263691, e o deploy 42599019108 passou. Antes disso: o operador pediu para commitar e publicar. O Claude Code recusou o push para o `main` do ONE (classificador do modo automático, sem explicação), e o caminho alternativo de disparar o deploy pelo branch não foi tentado: a decisão voltou para o operador. O `main` do GitHub segue em 34e5b4f, e o push levará também aa15754, o commit do operador com as metas da controladoria. O operador aprovou a página, ficou com o título sugerido ("Você advoga. O ONE faz o resto.") e pediu o brilho do topo de volta. A luz atrás do título (`mkt-aurora`, finita, parada com menos movimento) e o halo atrás da janela (`ProductFrame glow`) voltaram como eram em 7fdd3e8, primeiro na cópia. O pacote foi aplicado sobre aa15754, com outras sessões avisadas; o Prettier do projeto formatou `product-figures.tsx`; um comentário que citava o componente removido foi corrigido. O commit leva só os 22 arquivos da home: as chaves de PDF de outra sessão ficaram fora, por `git apply --cached` nos trechos da home em `pt-BR.json`.
- **Aceite:** no ONE, `git diff` mostra só os 22 arquivos da home além do que já estava em andamento; `conferencia.json` com 21 ok e 2 em atenção (CNPJ e reembolso, decisões de lançamento); `git status` não mostra `captura/` nem `filme/`.

**O que rodou no próprio ONE:** o servidor do projeto (`next dev --turbopack`) abriu a home com o título e o brilho; `prune-messages --check`, limpo; ESLint nos arquivos da home, sem apontamentos; `.claude/hooks/marketing-lint.mjs` nos mesmos arquivos, calado, depois de provado numa violação de propósito na cópia; `vitest` em `src/components/marketing` e `src/lib/i18n`, 16 passam; `tsc -p apps/web`, um único erro, em `.next/types/validator.ts`, apontando para a página temporária `convite/prev-pdf` de outra sessão; as telas em 1440 px no modo escuro, 768 px e 390 px, com um `h1` e nada passando da largura; com menos movimento, o brilho sem animação. 

**A CI do ONE sobre 5aadb0c (run 42545115644, no branch temporário `ci/home-refeita`) reprovou por dois motivos sem relação com a página:** ⚠️ `tsc` estoura o limite de memória padrão do Node no servidor do GitHub (2 GB), e o `test:db:embedded` não acha a pasta do pgTAP, porque o npm novo não roda o script de instalação do `@embedded-postgres`. `ci.yml` só roda em PR ou à mão, e o histórico recente só mostra as execuções desta rodada. Harness, testes do harness, classes do MUI e lint passaram. O que vinha depois foi rodado aqui, numa cópia limpa do commit: `tsc` com 8 GB, 0 erros; `vitest` de `apps/web`, 992 passam, 128 pulados, 1 falha só no Windows (`standing.test.ts` procura `"case\n"` e a migração sai em CRLF; passa em LF); mensagens e referências ao banco, limpas; `next build`, passa em 270 s.

**O que não rodou:** os testes de navegador do ONE (`test:e2e`), os pacotes fora de `apps/web` no `npm test` e o pgTAP. A home não mexe no banco.


### Verificação da rodada 7

- `npm run ci:verify` no Windows, sobre o estado do commit: 193 testes da CLI (1 pulado), 75 do `module-tools` e 782 dos apps (2 pulados), nenhum falha;
- a CI de b5535b0 passou no Linux e no Windows (run 42546183378);
- as tags, uma por vez, com o motor primeiro: o log de cada uma diz "Platform sha256 …, the same as the pack";
- `npm run validate`: 13 apps válidos; `pack` dá os ZIPs `a77b9581…` (`conversion-pages` 1.2.0, 33 arquivos) e `8b8ef9c2…` (`video-render` 1.2.0, 36 arquivos), e as cópias instaladas para o usuário são iguais à fonte;
- `npm run test:apps`: 782 testes, 780 passam, 2 opcionais pulados, nenhum falha, com os 45 do `conversion-pages`; os 19 da regra de texto do `module-tools` passam;
- `npm run harness:check` e `npm run apps -- catalog --check`: passam;
- a conferência nova na página publicada do ONE aponta o título, os cartões de 55 e 40 palavras e os buracos, e nenhum dos três no Juridiq e no JuriChat;
- `npm run apps -- link conversion-pages video-render --user` instalou as duas versões para o usuário;
- as pastas de fotos da conferência (`captura/`, `antes/`, `filme/`) levam um `.gitignore`, depois que a sessão 1 avisou que elas não deviam entrar no commit, com teste;
- `node --test` nos testes do `conversion-pages` depois disso: 45 passam.

### Fora de cobertura desta rodada

- **O julgamento é visual e de poucos olhos:** o meu, um agente sem contexto no papel de sócio de escritório e, por fim, o do operador. Nenhum advogado real viu, e nada foi medido em conversão.
- **A página refeita** não passou pelo `next build` nem pelos testes de navegador do ONE, e a sessão que a construiu rodou numa pasta sem confiança, onde os hooks do projeto não foram confirmados: o hook de lint rodou depois, à mão.
- **A pasta de atalhos das cópias sumiu às 21:29,** sem comando meu, e a causa não foi achada. O `node_modules` do ONE ficou intacto.
- **Modelos:** a construção longa rodou no modelo padrão do operador; a curta, em Sonnet. Outras IAs não rodaram.
- **macOS e Linux** não rodaram a foto sem letras.
- **A foto sem letras** não apaga o texto que está dentro de uma imagem, e para em 16.000 px no computador e em 9.600 px no celular, com aviso.

## ÉPICO 8: o modelo da Subido AI e a página de vendas de curso (2026-11-09)

O operador trouxe duas páginas do mesmo produto, `/subido-ai/inscricoes-abertas/a/` e `/b/` de viverdeiasubido.com.br: uma carta de vendas longa de um curso com plataforma, numa promoção de Black Friday, em teste A/B. Nenhum tipo do app servia: o roteiro da `landing` foi escrito para software. O bruto e as sondas estão em `flyee-workspace/pesquisa-paginas/subido-ai-2026-11-09/` (com LEIAME); nada foi clicado.

### T8.1: a captura, a sonda e o defeito da foto

**Estado: ✅.** As duas versões foram capturadas com `capture --no-letters` (motor 1.2.0). As fotos sem letras saíram com faixas vazias que mudavam de uma captura para a outra: a página revela 94 blocos com a rolagem (Elementor, classes `rv rv-pre`, transição de 1 s), e o motor fotografava além da tela. Uma sonda (`sonda/subido-sonda.mjs`) rolou uma tela por vez, esperou cada bloco e fotografou com e sem letras, e leu as barras fixas, as janelas (nenhuma, nem na chegada, nem em 20 s, nem na saída pela borda), o carrossel (não troca sozinho) e o vídeo de dentro do player (`sonda/subido-video.mjs`: 547 s; a barra marca 36% aos 37 s e 67% aos 2 min 24 s). Com o pedido de menos movimento, 49 animações continuaram na sonda e 38 na captura nova (leituras em pontos diferentes da página).
- **Aceite:** `sonda/faixas-*-sem-letras-*.jpg` mostram a grade dos 53, o recorte do Valor e a janela da plataforma onde `captura-a/sem-letras.jpg` tem faixas vazias.

### T8.2: o motor 1.3.0

**Estado: ✅.** `writeNoLetters` fotografa uma tela por vez na tela (D30), com `settleAfterScroll`; `warmUp` conta os blocos escondidos (`hiddenBlocksInPage`) e passa a 250 ms por passo quando há algum; `readAnatomyDesktop` lê de novo com `page.setReducedMotion(true)` (D31) e `reducedMotionReading` monta `motion.reduced_still_running` e `reduced_still_names`. A interface v1 ganha `files.no_letters_*_parts`, `viewports.*.hidden_until_scroll` e os dois campos de `motion`.
- **Aceite:** `tests/quality.test.mjs`, "the page with no letters shows the blocks that appear on scrolling…": a página `tests/fixtures/revelar/` tem cinco blocos que aparecem e somem com a rolagem e dois loops, um que respeita o pedido de menos movimento e outro que não. O teste falhou no código de antes e passa no novo. Nas três capturas reais com o motor novo (`motor-130/`): Subido com 3 folhas no computador e 4 no celular e 38 loops; Juridiq com 2 loops (o degradê e o pulso, que a análise do modelo já apontava); ONE sem nada em loop.

### T8.3: o modelo e o tipo

**Estado: ✅.** `references/modelos/subido-ai-pagina-de-vendas.md` no formato dos outros modelos, com o teste A/B do topo, as figuras olhadas na foto sem letras da sonda e o que não repetir; `modelos.json`; o tipo `curso` em `tipos.json` e `tipos/curso.md` (D27), com 16 seções, a caixa da oferta, a lista do que se recebe e as linhas legais; a linha do tipo em `medicao.md`; as quatro normas do preço em `lei.md` (D28).
- **Aceite:** `node scripts/pages.mjs types --json` lista `curso`; o teste de coerência confere que cada roteiro lista os itens do seu tipo.

### T8.4: a conferência

**Estado: ✅.** Dois itens novos, `cash_price_shown` (D28) e `stack_sum` (D29), e quatro ajustes que a página real mostrou:
- `discount_math` conta as parcelas: antes comparava os 40% com a parcela de R$ 797;
- `placeholder_data` deixa passar um dado de exemplo numa amostra com etiqueta ("Prévia ilustrativa · sem validade"), e continua apontando o solto;
- `cta_first_screen` aceita o botão do topo que rola até a oferta, e pede para conferir que o ponto é a oferta;
- `reduced_motion` lê o efeito quando a captura traz a leitura nova (D31).

Medido nas capturas dos seis modelos: na Subido, `cash_price_shown`, `stack_sum` (R$ 56.284 somados contra R$ 56.787 escritos) e `discount_math` (12x de R$ 797 somam R$ 9.564; 40% sobre R$ 16.200 dá R$ 9.720) em atenção, e os falsos alarmes sumiram; no Juridiq, no JuriChat, nos planos e na API, nenhum alarme novo.
- **Aceite:** `node --test "modules/conversion-pages/tests/*.test.mjs"`: 52 passam, com sete testes novos que usam o texto real das páginas e das construções.

### T8.5: a construção de verdade

**Estado: ✅, em duas rodadas.** O mesmo pedido sobre um curso fictício, em sessões novas em Sonnet, cada uma num projeto como o de um integrante (app instalado pelo `dev link`, `--setting-sources project,local`, sem PowerShell e sem web), e a comparação feita por leitores às cegas em Opus, com o topo, a página sem letras e o texto de cada página, nas duas ordens de rótulo. Evidência em `subido-ai-2026-11-09/prova/` (com LEIAME e a chave dos rótulos).
- **Rodada 1:** a 1.2.0 escolheu `landing` (14 seções, 6 min, US$ 0,70); a 1.3.0 escolheu `curso` (29 seções, 18 min, US$ 1,17). Os leitores dividiram um a um, e a preferência seguiu a posição. ⚠️ Nenhuma das duas provou ser melhor. As críticas que se repetiram nas duas leituras viraram mudanças no roteiro: nenhuma média por mês num pagamento único ("R$ 74,75 por mês" pareceu mensalidade); só leva valor o item vendido sozinho por esse preço hoje (a soma "vendida separada" foi lida como inventada nas duas páginas); a caixa da oferta repetida só em página longa.
- **Rodada 2:** a 1.3.0 revista (23 seções, 7 min, US$ 0,74) contra a mesma página da 1.2.0. Os dois leitores, um em cada ordem, preferiram a 1.3.0 revista: o total no cartão no topo, o "não é para você se", a frase de que o curso não promete vender mais, o WhatsApp para dúvidas e um desenho por módulo. Críticas que ficaram: a metade de baixo vira caixas de texto parecidas, o mesmo botão se repete, o topo não mostra o problema da compradora, e uma frase cita a planilha de alunos.
- **O que a construção achou no app:** um falso alarme de `cash_price_shown` (o preço à vista a algumas palavras do número, na pergunta "Como posso pagar?") e a origem dos números escrita como `{ text, source }` e `{ claim, source }`, que a conferência não lia. Os dois foram corrigidos, com teste.
- **Aceite:** `prova/leitor-cego-r2a.jsonl` e `prova/leitor-cego-r2b.jsonl` preferem a 1.3.0 com a chave de `cego-chave.txt`; `prova/audit-v130r2.json` dá `cash_price_shown` ok.

### T8.6: a versão e a instalação

**Estado: ✅ em f5dc4ad, com as tags no 310fc83 (2026-11-15); o estado final das duas versões está no T9.6.** Manifestos em 1.3.0 com o changelog nos dois idiomas; `validate` e `pack`: `conversion-pages` 1.3.0 com 35 arquivos, `video-render` 1.3.0 com 36. `npm run ci:verify` no Windows: 193 testes da CLI (1 pulado), 75 do `module-tools` e 790 dos apps (2 pulados), nenhum falha. Depois da prova, `npm run apps -- link conversion-pages video-render --user` instalou as duas versões para o usuário. O commit, as tags (o motor primeiro) e a publicação esperam o operador.

### Onde a implementação divergiu

- **O tipo `curso` mantém `cta_consistent`** (um texto por chamado) embora o modelo varie o texto por seção. O modelo escolhido manda no visual e no texto (D22), e o roteiro diz isso; o padrão do app continua sendo um texto.
- **A foto inteira (`desktop-full.png`) continua além da tela** e só melhora com o aquecimento mais lento. Um bloco que some de novo ao sair da tela sai vazio nela; a foto confiável é a das faixas.

### Fora de cobertura desta rodada

- **A inscrição:** o botão da caixa leva a `faturandocomia.viverdeai.ai`, que não foi aberto. O preço à vista pode aparecer lá; a página não mostra.
- **O vídeo da versão B** não foi assistido nem baixado. A barra foi lida no navegador da sonda; o som na chegada não pode ser afirmado, porque o navegador da captura é aberto com o som desligado e com a reprodução automática liberada.
- **Quem vence o teste A/B** não aparece na página.
- **A lei:** os artigos foram conferidos no texto do Planalto; não houve parecer jurídico, e o Código de Defesa do Consumidor não foi relido nesta rodada.
- **macOS e Linux** não rodaram a foto em faixas.
- **A prova** usou um produto fictício, construções em Sonnet e leitores em Opus no papel de compradora. Nenhuma pessoa real leu as páginas, e nada foi medido em conversão. Duas leituras por rodada são pouco: a rodada 1 mostrou que a posição do rótulo pesa.
- **As críticas que ficaram da rodada 2** (a metade de baixo em caixas de texto, o problema da compradora no topo) não viraram regra: só uma construção nova diria se uma mudança ajuda.

## ÉPICO 9: o modelo da Databricks e o design system para o Orkestree (2026-11-09)

O operador trouxe 13 páginas de databricks.com (a inicial, oito de produto, a de desenvolvedores, o blog, os recursos, a página da empresa e a do AI Days) para fazer as páginas do Orkestree, com três focos: os efeitos dos gráficos de demonstração, os ícones próprios que se explicam sozinhos e as logos reais em vez de nomes escritos. Pediu também o design system, do site e das áreas logadas, para aplicar no Orkestree. O bruto, as sondas e o pacote do design system estão em `flyee-workspace/pesquisa-paginas/databricks-2026-11-09/` (com LEIAME). Nada foi clicado além do aviso de cookies, que a captura aceita para fotografar.

### T9.1: as capturas, as sondas e os defeitos da foto

**Estado: ✅.** As 13 páginas foram capturadas com `capture --no-letters`. Na primeira rodada (`capturas-com-aviso-de-cookies/`), o aviso de cookies cobriu todas as faixas: ele abre cerca de 3 s depois do carregamento, quando a captura já tinha passado pela tentativa de fechar. Nas faixas apareciam também a janela de escolha de região e o painel do chat.

As sondas:
- a de design system mediu 10 páginas (`ds/<página>/ds.json`, juntas em `ds/agregado.txt`): fontes, variáveis, escala de tipo, cores por área, raios, sombras, botões com o estado ao passar o mouse, ícones, paredes de logos, figuras grandes e animações por faixa;
- a do chat achou `#qualified-multimodal-host`: fixo, do tamanho da tela, pendurado no `<html>` fora do `<body>`, com árvore própria aberta;
- a do movimento mostrou que, com o pedido de menos movimento, a fileira de logos da página inicial anda 119 px em 4 s. Ela anda por uma transição de 63 s, que a leitura da 1.3.0 não contava como loop.

As 33 imagens de demonstração e o vídeo do Genie One foram baixados para estudo e postos em folhas.
- **Aceite:** `capturas/<página>/sem-letras*.jpg` sem o aviso, sem a janela de região e sem o chat, contra `capturas-com-aviso-de-cookies/`; `ds/agregado.txt`; `folha-imagens-*.jpg`.

### T9.2: o motor, as janelas e o movimento longo

**Estado: ✅ (`video-render` 1.3.0, sem tag, mudado no lugar; D32, D36).**
- `dismissLateCookies` tenta de novo fechar o aviso depois do aquecimento e logo antes de cada foto sem letras;
- `hideOverlaysInPage` esconde, só na foto sem letras, o que flutua sobre a página: o que é alto (um quarto da largura e da altura), a janela (`role=dialog` ou `aria-modal`), o chat (um quadro com campo de texto ou `iframe`) e o cartão de canto. Ele percorre o `<html>` inteiro e as árvores próprias abertas, deixa as barras finas, avisa o que escondeu, e `restoreOverlaysInPage` devolve tudo;
- `isAmbientMotion` conta como movimento contínuo, além do loop sem fim, a transição de 5 s ou mais, na leitura de menos movimento e no gatilho dela.
- **Aceite:** em `tests/quality.test.mjs`, "a cookie window that opens seconds after the load is closed before the photos" (`tests/fixtures/cookies-tarde/`) e "the photo with no letters hides the windows and the chat panel over the page, and keeps its thin bars" (`tests/fixtures/janelas/`, com o chat em árvore própria pendurado no `<html>`); `tests/anatomy.test.mjs` conta a transição de 63 s e não a de 500 ms. Na página inicial real (`teste-movimento/`), a fileira de logos aparece em `motion.reduced_still_names`.

### T9.3: o modelo, a seção 15 e a regra das logos

**Estado: ✅.** `references/modelos/databricks-pagina-de-produto.md` (D33) descreve a página de produto como um sistema:
- o roteiro em 16 passos e as outras páginas (desenvolvedores, startups, AI Days, blog, recursos, empresa);
- os três pontos que o operador pediu: os gráficos de demonstração, os ícones e as logos reais;
- o movimento, as figuras como se veem na foto sem letras e o visual em palavras;
- o que não repetir, medido pela conferência como `landing` nas 13 capturas: três camadas sobre a página na chegada, teste grátis sem duração, três textos no mesmo chamado, cartões com 44% de vazio, texto de 8 e 10 px no celular, alvos de toque de 78 por 18 px, imagens de 2.560 px mostradas com 351, vídeo sem capa, imagens sem `alt`, a fileira de logos que anda com o pedido de menos movimento e o topo da página de desenvolvedores sem figura.

`demonstracao.md` §3 passa a aceitar a logo de outra empresa quando é verdade (D34), e a §15 nova ensina o diagrama feito com as peças do produto, a família de ícones próprios e a fileira de logos (D35). O modelo entra em `modelos.json`, nos modelos e no manual da `landing` em `tipos.json`, na descrição da skill, no README, nos guias e no changelog.
- **Aceite:** `node scripts/pages.mjs models --type landing --json` lista `juridiq-pagina-de-vendas`, `jurichat-pagina-de-vendas` e `databricks-pagina-de-produto`; o teste de coerência de `tests/pages.test.mjs` confere que cada modelo citado num tipo existe em `modelos.json` e tem o seu arquivo.

### T9.4: a construção de verdade

**Estado: ✅, em quatro rodadas.** O mesmo pedido ("crie a página de vendas do produto descrito em PRODUTO.md, no estilo da Databricks"), sobre um produto fictício que põe agentes de IA nos sistemas de uma empresa média, com cinco logos de clientes autorizadas no projeto e as quatro integrações sem arquivo de logo. Sessões novas em Sonnet, num projeto como o de um integrante, como no ÉPICO 8. A comparação foi feita por leitores às cegas em Opus no papel de gerente de operações, com o topo, a página inteira em fatias, a foto sem letras e o texto, nas duas ordens de rótulo. Evidência em `databricks-2026-11-09/prova/` (com LEIAME e a chave dos rótulos).
- **Rodada 1:** antes, o app sem o modelo e sem a §15 (8,8 min, US$ 0,83), recusou o "estilo da Databricks" porque a regra antiga proibia a logo de outra empresa, e levou só a estrutura. Depois, com o modelo (6,7 min, US$ 0,90), seguiu o esqueleto: o diagrama do centro com raios no topo, a fileira de logos numa cor só passando, um ícone próprio por recurso e uma figura por agente. ⚠️ Os dois leitores preferiram a página que estava na posição Y, então a preferência geral não prova nada. O que se repetiu nas duas ordens:
  - só a página nova tem ícones de recurso, e eles funcionam em parte: a chave lê como permissão e o documento com visto como registro, mas a moeda com "!" do custo lê como alerta;
  - a página nova tem um desenho por agente; a antiga, só o do WhatsApp;
  - as logos da antiga passam mais confiança: cinco, paradas, coloridas, com a legenda "autorizaram mostrar a logo". Na nova, a fileira de cinco passa, repete uma logo, corta e esmaece as das pontas;
  - a melhor imagem das duas páginas é o gráfico da antiga em que a barra passa do limite, fica vermelha e o agente é travado;
  - a página nova se contradiz: o diagrama do topo diz que o Gmail só lê, e a tabela de permissões mostra o Gmail escrevendo;
  - "Nenhuma ferramenta nova para a equipe aprender" foi lido como exagero, porque o próprio produto é uma ferramenta nova.

  As críticas viraram regra: na §15, poucas logos numa fileira parada, inteiras, com a legenda do que são, numa cor só apenas com o contraste do texto; o gráfico que mostra o produto agindo; o ícone de recurso sem "!" nem X. Na §3 e na §14, os dados de exemplo contam uma história só, e o nome de um cliente de verdade nunca entra num exemplo fictício. Em `principios.md` §14, a frase sem número que o próprio produto desmente. O modelo diz que a fileira que passa é para dezenas de logos.
- **Rodada 2:** a sessão nova (5,7 min, US$ 0,95) fez o diagrama em camadas no topo (agentes, a plataforma no meio, os sistemas embaixo) e as logos paradas, coloridas e com legenda, mas guardou quatro das cinco figuras de recurso em abas, como o modelo descrevia ("as capacidades ficam em abas"). ⚠️ Os dois leitores, um em cada ordem, preferiram a página de antes, sem o modelo: ela mostra o controle funcionando (a tabela de permissões com as chaves, o gasto travado no limite, a ação negada no registro), e a nova tem o diagrama e depois "quase só caixas vazias". Os ícones e os símbolos das ferramentas no diagrama contaram a favor da nova; o mesmo ícone em dois recursos e o triângulo de pontos para "agentes prontos" contaram contra. Mudanças: no modelo, as abas não guardam os recursos principais, que ganham uma linha cada com a figura funcionando; na §15, o diagrama resume e não substitui essas figuras, o registro mostra a ação negada, e dois recursos nunca dividem um ícone.
- **Rodada 3:** a sessão nova (7,6 min, US$ 0,84) pôs o painel no topo, as logos paradas e coloridas logo abaixo, o diagrama dos sistemas ligados à plataforma e uma linha por recurso: a tabela de permissões, o gasto que passa do limite e para o agente, o registro com a ação negada. ✅ Os dois leitores, um em cada ordem, escolheram a página nova para marcar a conversa e para confiar. Para explicar o produto, um a escolheu, e o outro a escolheu num empate. O que os dois disseram: a central entre os agentes e os sistemas responde a primeira pergunta de quem cuida da operação, a tabela mostra todos os agentes contra todos os sistemas de uma vez, e o registro mostra a ação negada com o motivo. ⚠️ Nos ícones, um dos três focos do pedido, os dois disseram que nenhuma das páginas resolve: a mesma moeda serve à cobrança e aos custos (o exemplo "o custo é uma moeda" do próprio guia levou a isso), o gráfico de barras da qualificação não diz nada, e as siglas "WA", "Gm", "Sl" e "Pg" no lugar das ferramentas parecem improvisadas. Mudanças: na §15, a lista de cada recurso com o objeto do ícone e por que ele não serve a outro, com exemplos de outro ramo (uma clínica), sem a moeda como exemplo; a ferramenta sem arquivo oficial pelo nome inteiro e pelo que o produto faz com ela, nunca uma sigla num quadrado; na §14, olhar os ícones na foto sem letras; no modelo, a âncora marcada segue a seção do meio da tela, e nenhuma fica marcada no topo (uma leitura viu "Perguntas" marcada ainda no topo).
- **Rodada 4:** a sessão nova (6,4 min, US$ 0,84) fez o diagrama em camadas no topo, as logos paradas, uma figura por agente (a conversa, os boletos conferidos, o funil), a tabela de permissões dos três agentes nos quatro sistemas, o gasto acumulado que bate no limite e o registro com a ação negada. ✅ Os dois leitores, um em cada ordem, escolheram a página nova nas seis perguntas: para começar o teste, para entender sem ler, nos desenhos, nos ícones, nas logos e na confiança. Nos ícones, o balão, o funil, o cadeado e o documento se entendem sem o nome; o de custos (uma cúpula) e o do painel (uma rosca) não.
- **O que ficou, sem virar regra** (só uma construção nova diria se uma mudança ajuda):
  - ao lado do nome inteiro de cada ferramenta, a sessão desenhou ícones genéricos nas cores das marcas (um círculo verde, um "#" num quadrado roxo), e um leitor os tomou pelas marcas reais. A §3 já proíbe ícone de outra empresa como se fosse do produto; deixar esses ícones nas cores da página é o candidato para a próxima rodada;
  - a tabela de permissões corta a coluna do Postgres ("Ler e escreve…"), e o menu do celular corta "Preço" e "Perguntas": a conferência não mede texto cortado;
  - a sessão marcou como de exemplo um diagrama sem dado inventado e pôs a etiqueta "para a conferência passar". A frase de `demo_honest` agora diz que `false` vale quando a cena só mostra o que existe; o pacote final difere do da rodada 4 só nessa frase;
  - "já saem trabalhando" e "97% deram certo" foram lidos como promessa maior do que a página mostra, nas duas páginas.
- **O que as quatro rodadas ensinaram:** um exemplo do guia vira o ícone da página (a moeda do custo serviu a dois recursos), então os exemplos vêm de outro ramo; uma mecânica do modelo que esconde figuras (as abas) piora a página mesmo seguindo a regra de figuras; e só as leituras nas duas ordens separaram a rodada que empatou pela posição das que provaram.
- **Aceite:** `prova/leitores/cego-r4a.txt` e `cego-r4b.txt` escolhem a página nova com a chave de `prova/cego-chave.txt`; `prova/depois4/foto-igual/sem-letras.jpg` mostra uma figura por recurso, contra `prova/antes/foto-igual/sem-letras.jpg`.

### T9.5: o design system para o Orkestree

**Estado: ✅ na pasta de trabalho (D37).** Em `design-system/`:
- `site.md`: o sistema do site medido em 10 páginas (letras, cores por papel, grade e espaço, raios e sombras, botões, parede de logos, as cinco famílias de ícones, os gráficos de demonstração, o movimento e o que não copiar);
- `tokens-site.css`: as mesmas medidas como variáveis com nome de papel (`--site-*`), para trocar a marca num lugar só;
- `area-logada.md`: o dbui (`@databricks/design-system` 2.0.16) com os seis temas, as fichas `--db-*` em três camadas, os 80 componentes por função, os 12 modelos de página, os princípios e os dois caminhos para o Orkestree (instalar o pacote com um tema próprio, ou portar as fichas para a pilha dele);
- `especime.html` e `especime.png`: o sistema montado com código nosso;
- `../dbui/tokens/`: as fichas por tema e modo, em JSON.

`LEIAME.md` diz o que pode ir e o que não pode: o dbui com o aviso de licença (ISC declarado só no `package.json`, sem arquivo de licença nem autor); as letras (OFL); as medidas como referência, sabendo que lava, marinho e aveia juntas são a cara da marca; nunca o CSS, as imagens, os ícones, a logo e os nomes de produto deles; logos de clientes só quando é verdade.
- **Aceite:** `especime.html` aberto no navegador mostra as cores, o tipo, os botões, a parede de logos, as famílias de ícones e as receitas dos gráficos; os únicos arquivos de fora que ele carrega são as letras do Google Fonts (procure `src=`, `href=` e `url(` no arquivo).

### T9.6: a versão e a instalação

**Estado: ✅ commit, tags e rascunhos (2026-11-15).** As duas versões continuam 1.3.0 (D32), mudadas no lugar, com o changelog nos dois idiomas e o README em dia.
- `validate` e `pack`: `conversion-pages` 1.3.0 com 36 arquivos (`685171d3…`), `video-render` 1.3.0 com 36 (`3bc73786…`). ⚠️ O pacote do motor era `950caedb…` até 2026-11-15: o CI do Linux de 938833b falhou em `quality.test.mjs:367`, porque a segunda tentativa de fechar o aviso de cookies acontecia antes de um aviso que abre 1,5 s depois do carregamento, numa máquina rápida. A correção (1c343b4, ainda 1.3.0, sem tag) espera pelo aviso até 4 s depois do carregamento de cada tela (`dismissLateCookies` com `loadedAt`, `tests/cookies-late.test.mjs`), e o changelog diz isso.
- O CI de 310fc83 passou no Linux e no Windows (run 43783926530). As tags foram uma de cada vez, o motor primeiro: `video-render@1.3.0` (run 43784479934) e `conversion-pages@1.3.0` (run 43784538501), cada rascunho com o SHA-256 da plataforma igual ao do pacote.
- `npm run ci:verify` no Windows passou: 193 testes da CLI (1 pulado), 75 do `module-tools`, 792 dos apps (2 pulados), nenhuma falha, os 13 apps válidos, o pacote da CLI limpo.
- Uma rodada anterior dos testes do motor, feita com os leitores rodando ao mesmo tempo, teve uma falha: o teste do tempo-limite em `runner.test.mjs`, que oscila com a máquina carregada. Sozinho, ele passou (3 de 3), e no `ci:verify` também.
- Depois da prova, `npm run apps -- link conversion-pages video-render --user` instalou as duas versões para o usuário. A ponte da skill já traz a descrição nova, e a cópia em `~/.flyee/user-apps` traz o modelo e a §15.
- Publicar os rascunhos 1.3.0 e marcar a versão de entrada (D7) são os cliques do operador no console. Os rascunhos 1.1.0 dos dois apps continuam sem publicar (ÉPICO 7).
- Em 2026-11-15, `npm run apps -- link conversion-pages video-render --user` trocou a cópia do usuário, de 2026-11-09, pela das tags: `scripts/lib/capture.mjs` em `~/.flyee/user-apps` é igual ao do repositório.

### Onde a implementação divergiu

- **O design system não entra no app.** O pedido foi copiar o DS para o Orkestree. O app ensina a gramática (a §15 e o modelo), e o sistema fica na pasta de trabalho (D37), porque o repositório do flyee é público e o que é da Databricks não vai num pacote.
- **A regra "nenhuma logo de outra empresa" mudou** (D34) em vez de ganhar uma exceção no modelo. A logo real é a prova que o operador pediu, e a regra antiga confundia não fingir com não mostrar.
- **A página de desenvolvedores não virou modelo de `api`** (D33).

### Fora de cobertura desta rodada

- **As áreas logadas não foram abertas:** não há conta. O dbui é o pacote público do produto; não foi conferido que as telas de hoje usam essa versão.
- **A licença do dbui** está só no `package.json`. Não houve leitura jurídica.
- **O blog, os recursos e a página da empresa** foram capturados e conferidos, mas a sonda de design system não passou por eles.
- **As capturas das 13 páginas** são do motor de antes da contagem da transição longa; só a página inicial foi capturada de novo depois (`teste-movimento/`).
- **O vídeo do Genie One** foi visto em quadros, sem som.
- **macOS e Linux** não rodaram as correções do motor.
- **A prova** usou um produto fictício, construções em Sonnet e leitores em Opus no papel de gerente de operações. Duas leituras por rodada; nenhuma pessoa real leu as páginas, e nada foi medido em conversão. Os exemplos de ícone da §15 são de outro ramo, mas a regra das figuras do controle (o limite que trava, a ação negada) cabe bem no produto da prova; um produto sem nada para controlar não foi testado.
- **As logos de ferramentas com o arquivo oficial** não foram construídas: o projeto da prova não tinha os arquivos, de propósito, para ver se a sessão inventava uma logo.
- **A aplicação no Orkestree** é da sessão do Orkestree; nada foi escrito naquele repositório.

## ÉPICO 10: o modelo da Black Friday da Hostinger (2026-11-17)

O operador pediu a página da Hostinger como modelo para implementar as ofertas de Black Friday do MedChina. O bruto, as sondas e a prova estão em `flyee-workspace/pesquisa-paginas/hostinger-black-friday-2026-11-17/` (com LEIAME). Nada foi clicado além do aviso de cookies.

### T10.1: as capturas e as sondas

**Estado: ✅.** hostinger.com.br leva a hostinger.com/br, e hostinger.com abre a versão internacional, em inglês. As duas foram capturadas com `capture --no-letters` (`captura-br/`, `captura-com/`).

Duas sondas leram o que a captura não lê:
- **`sondas/contador.mjs`** lê o contador na primeira visita, 10 s depois, depois de recarregar e com o navegador zerado, e calcula a hora em que ele termina. Em todas as leituras, ele terminava em 2026-11-19T08:00:00Z (5h de Brasília), com diferença de 1 s: o contador não recomeça a cada visita. A data não está escrita na página, e a Black Friday é no dia 27.
- **`sondas/topo.mjs`** lê o topo em visitas zeradas. Em 5 de 8 visitas zeradas, somando as duas sondas, o topo veio com o contador e "2x bônus de créditos"; nas outras, sem contador e com outro subtítulo. É um teste A/B do próprio contador. A versão internacional não tem contador.

- **Aceite:** `sondas/contador-br.json` e `contador-br-2.json` (as horas de fim) e `sondas/topo-br.json` (os topos); `recortes/br-planos-1.png` mostra os cartões.

### T10.2: o modelo e os tipos

**Estado: ✅ na árvore (D38, D41).** `references/modelos/hostinger-black-friday.md` traz:
- as contas dos quatro planos;
- o teste A/B do topo e o contador;
- a página na ordem e a mecânica que vale levar;
- o movimento, o visual em palavras e as figuras como se veem na foto sem letras;
- o que não repetir: a data do contador não escrita, o riscado que não diz o que é e é maior que a renovação, o "a partir de R$ 9,99" do topo com o Single a R$ 5,99, o plano em destaque a cerca de 3.000 px do topo no celular, "não precisa de cartão de crédito" numa página toda paga adiantada, os logos da imprensa sem legenda e o branco sobre o vermelho com contraste de 3,2 a 3,4 para 1;
- como levar a oferta à página do integrante.

`tipos/planos.md` ganha a seção "A promoção nos planos" e o preço do período pago adiantado. `tipos/landing.md` ganha o topo da promoção e a promoção que entra por cima da página de sempre. `tipos.json` ganha duas mecânicas e dois itens do manual nos `planos`, e o modelo nos `planos` e na `landing`. O modelo entra também em `modelos.json`, no README, nos guias e no changelog, e há um caso novo em `tests/eval.json`.
- **Aceite:** `node scripts/pages.mjs models --type planos --json` lista `juridiq-planos`, `jurichat-pagina-de-vendas` e `hostinger-black-friday`, como confere `tests/pages.test.mjs`.

### T10.3: a conferência

**Estado: ✅ na árvore (D40).** A conferência da 1.3.0 sobre a captura da Hostinger, como `planos`, deu dois falsos resultados:
- disse que nenhum plano estava em destaque, e o Unlimited tem o selo "Oferta especial", o fundo claro e o único botão cheio;
- não conferiu o total pago adiantado.

A construção da rodada 2 (T10.4) recebeu um terceiro: "a economia de R$ 640,80 não é a diferença…", num cartão em que a economia vinha antes do total, no mesmo trecho de texto.

As três estão corrigidas:
- `RECOMMENDED` aceita "oferta especial" e "melhor oferta";
- `discount_math` confere o total de N meses contra o preço por mês do mesmo cartão;
- `isSaving` lê a economia pelas palavras logo antes ou logo depois do preço, e compara com qualquer preço pago do cartão, venha antes ou depois.

A conferência da Hostinger passa a dizer "As 4 contas… batem" e "Um plano aparece em destaque (Oferta especial)". As três páginas da prova fecham as contas sem alarme.
- **Aceite:** três testes novos em `tests/pages.test.mjs`: o período pago adiantado, o selo de oferta especial e a economia antes do total, com o cartão real da rodada 2. O conjunto passa com 55 testes.

### T10.4: a construção de verdade

**Estado: ✅, em duas rodadas.** O mesmo pedido em todas as sessões: "crie a página de planos com a oferta de Black Friday do produto descrito em PRODUTO.md, no estilo da Hostinger". O produto é fictício, uma agenda para salões de beleza, com três planos, o anual com 40% no primeiro ano de 20/11 a 28/11 às 23h59 e lembretes em dobro como bônus.

As sessões rodaram em Sonnet, num projeto como o de um integrante: o "antes" com o app 1.3.0, tirado da tag, e o "depois" com a 1.4.0. As duas construíram em 17/11, antes de a promoção abrir, então as fotos mostram a oferta pela prévia que cada sessão deixou na página.

Os leitores rodaram às cegas, em Opus, no papel de dona de um salão com três profissionais, nas duas ordens de rótulo. Evidência em `prova/` (com LEIAME e a chave dos rótulos).
- **Rodada 1:** antes (7,0 min, US$ 0,80) e depois (5,5 min, US$ 0,71). A sessão "antes" não tinha o modelo da Black Friday e usou o dos planos do Juridiq. Nas duas ordens, a nova venceu em entender quanto se paga hoje e depois e em escolher o plano. A antiga venceu em até quando vale e na confiança, porque a sessão copiou o contador só em horas da Hostinger ("270:59:29"), deixou o começo da promoção fora do topo e tirou a figura do produto do topo. Assinar e entender sem ler seguiram a posição do rótulo.
- **O que mudou (D41):** o contador mostra dias quando falta mais de um dia, o começo e o fim ficam escritos no topo e a figura do produto fica ao lado da oferta. Cada regra está no modelo e no roteiro dos `planos`.
- **Rodada 2:** depois2 (8,7 min, US$ 0,84) contra o mesmo "antes". Nas duas ordens, a nova venceu em assinar agora, em entender quanto se paga hoje e depois e em escolher o plano. Em até quando vale, venceu numa ordem e empatou na outra. Entender sem ler e confiança seguiram a posição do rótulo. As queixas da rodada 1 sumiram.
- **Sobrou uma ressalva:** os leitores estranharam "8 dias e 23 horas" no contador. É efeito da prévia, que a sessão programou para simular o primeiro minuto da promoção, e não da página no ar. ⚠️ A prévia de uma página com data deveria dizer que é prévia; fica no backlog.
- **Aceite:** `prova/leitores/cego-r2a.txt` e `cego-r2b.txt`, com a chave em `prova/cego-chave.txt`; `prova/comparacao/topo-computador-r2.jpg`.

### T10.5: a versão e a instalação

**Estado: 🟡.**
- `npm run validate conversion-pages` passa.
- `npm run pack conversion-pages` gera `dist/modules/conversion-pages-1.4.0.zip` (37 arquivos, `d630758b…`).
- `node --test tests/*.test.mjs` passa com 55 testes.
- `npm run apps -- link conversion-pages --user` atualizou a ponte para `conversion-pages@1.4.0`, e o modelo novo está na cópia do usuário. Isso basta para o repositório do MedChina, sem escrever nada nele.
- O commit, a tag e a publicação esperam o operador.

### Onde a implementação divergiu

- **O pedido nomeou hostinger.com, e a análise usa a versão brasileira.** É a que mostra reais, parcelas e a lei daqui. A internacional confirma as contas e mostra que o contador existe só no Brasil.

### Fora de cobertura desta rodada

- **O que muda em 19/11, às 5h:** se o preço sobe, se começa outra fase ou se o contador some. O registro é de 17/11.
- **A página `/br/black-friday`,** com todas as ofertas, a de preços e o carrinho não foram capturados.
- **Os textos das condições** que abrem no item sublinhado foram lidos no texto da captura, sem abrir a dica na tela.
- **A prova** usou um produto fictício, construções em Sonnet e leitores em Opus, duas leituras por rodada; nenhuma pessoa real leu, e nada foi medido em conversão. As fotos mostram a promoção pela prévia de cada sessão, e a página no ar entre 20/11 e 28/11 não foi vista.
- **O uso no MedChina** é da sessão do MedChina; nada foi escrito naquele repositório.
- **macOS e Linux** não rodaram as conferências novas.

## 5. Riscos

| Risco | Primeiro sinal |
|---|---|
| A pasta de skills do usuário muda numa versão do Claude Code | a skill não aparece numa sessão nova em outro repositório (aceite de T3.1) |
| O Codex não tem pasta de skills do usuário conferida | declarado como fora de cobertura; o operador usa o Claude Code nesses repositórios |
| As heurísticas da anatomia erram num HTML incomum | o item sai `nao_conferido` em vez de errado; cada falha real vira um caso de teste |
| A página salva traz dado pessoal (nome, e-mail, pedido) | fica no projeto do integrante; no caso do operador, na pasta de trabalho, nunca no repositório |
| Um artigo de lei citado muda | `lei.md` traz a data da conferência; a próxima versão confere de novo |
| Uma medição nova aponta defeito onde não há | a conferência real das quatro páginas (T6.7); cada falso alarme vira um caso em `tests/quality.test.mjs`, como os quatro desta rodada |
| ⚠️ A lista de vícios vira gosto imposto | aconteceu na rodada 6: a IA tirou o que o operador tinha escolhido. Agora a lista só avisa (D22), e cada modelo diz os padrões que usa |
| Uma regra nova melhora o teste e piora a página | só uma construção de verdade mostra (D26) |
| Um exemplo do guia vira a figura de toda página | aconteceu no ÉPICO 9: "o custo é uma moeda" fez a mesma moeda servir a dois recursos. Os exemplos vêm de outro ramo que o do pedido, e a leitura dos ícones sem os nomes (§14) aponta a repetição |
| Uma mecânica do modelo esconde o que a regra pede para mostrar | aconteceu no ÉPICO 9: as abas guardaram as figuras dos recursos, e a página perdeu nas duas ordens. O modelo diz o que levar e o que não levar de cada mecânica |
| Um detalhe descrito no modelo vira regra na página | aconteceu no ÉPICO 10: "mostra horas acima de 24" virou um contador de "270:59:29". O detalhe ruim da página analisada vai para "o que não repetir", com o motivo |

## 6. Backlog: o que os outros apps ganham

### Do modelo do Juridiq (2026-11-07)

| App | O que ganharia | Evidência de que hoje não tem |
|---|---|---|
| `video-render` | ler o preço partido em elementos ("R$ 98" e ",90") como um preço só; tirar as fotos do topo sem a janela que abre com a rolagem; registrar os cookies gravados antes do consentimento, para uma conferência de LGPD | a conferência da API do Juridiq achou só "R$ 98"; `desktop.png` da página inicial saiu coberta pela janela, e agora o aviso diz isso; a captura não lê cookies |
| `ad-creatives` (`ad-landing-page`) | chamar o `audit` deste app como `landing` quando ele estiver instalado, em vez de repetir itens. Assim a página do anúncio ganha as contas de desconto, a promoção com data, o teste com duração, quem vende e a janela na chegada | `skills/ad-landing-page/SKILL.md`: a conferência própria olha o chamado, as palavras do anúncio, preço, prazo e linhas legais; este app ainda não tem `references/interface.md` para ser chamado |
| `whatsapp-support` | o JuriChat é uma referência de mercado do que esse kit monta. Conferido contra o Chatwoot 4.19.1 `-ce` pela sessão do kit, em 2026-11-07: <ul><li>a fila pelo tempo de espera e os webhooks já existem;</li><li>as metas de tempo de resposta são só da versão Enterprise;</li><li>o alerta de cliente sem resposta pediria uma rotina periódica no projeto;</li><li>a visão do gestor pediria uma tela própria, porque os relatórios só aparecem para administrador;</li><li>as integrações dentro da conversa usam os Dashboard Apps que o kit já cria.</li></ul>Quais entram é decisão do operador | `docs/PLANO-ATENDIMENTO.md`, seção "Backlog: o JuriChat como referência de mercado", com a linha do código do Chatwoot de cada item |
| `video-studio` | uma variação do roteiro `passos` em forma de conversa (as mensagens surgindo e as integrações dentro dela) e o roteiro da pergunta digitada com o resultado do produto, tirados das demonstrações do JuriChat e do Juridiq | `references/roteiros.json`: `lancamento`, `interface`, `oferta`, `lista`, `passos` |
| `ads-insights` | os eventos da página de vendas, dos planos e da API no plano de medição: pedido de demonstração, início do teste, plano e período escolhidos, a janela vista, aceita e recusada | grep por `demo_request`, `trial_start`, `plan_select` e `billing_toggle` em `modules/ads-insights`: zero |
| `media-plan` | a conversão do teste em pagante como premissa, com origem, e o efeito do PIX à vista contra o cartão parcelado no caixa do primeiro mês | o anual e o Pix já estão em `references/oferta.md:10` e `lancamento.md:15`; grep por teste grátis, trial e período de teste em `modules/media-plan`: zero |
| `contact-base` | a régua do teste (início, meio, véspera do fim) e a da promoção com as mesmas regras escritas da página (até quando, para quem); o lembrete da demonstração marcada | `references/` traz a régua do plano e a repermissão, sem régua de teste nem de demonstração |

### Da avaliação do Stageshow e dos seis repositórios (2026-11-08)

| App | O que ganharia | Evidência de que hoje não tem |
|---|---|---|
| `video-studio` | ⚠️ riscado: "reaproveitar a interface real em vez de redesenhá-la" é o erro de D17. Fica só o limite de 3 a 7 textos para ler por tela nas cenas de produto | `references/roteiros.md` e `pagina-do-video.md` põem as telas reais como imagem dentro de um aparelho (`Studio.device`); não há regra de quantos textos uma tela simulada mostra |
| `ad-creatives` (`ad-landing-page`) | as medições da página pronta (largura do celular, texto, toque, contraste, imagens) ao chamar o `audit` deste app, que já está na linha do Juridiq acima | `skills/ad-landing-page/SKILL.md`: a conferência própria não mede a página no celular |
| `motion-carousel` | os cinco erros da cena (demais, esqueleto, encaixotada, plana, genérica) na crítica dos slides que mostram uma tela | `references/` não tem crítica de tela simulada |
| `video-render` | gravar uma página que não foi feita para o Motor com um relógio que avança quadro a quadro, como o do Stageshow, para um vídeo sem quadros perdidos | `film` grava em tempo real (D20); não foi testado |

### Do modelo da Databricks (2026-11-09)

| App | O que ganharia | Evidência de que hoje não tem |
|---|---|---|
| `video-studio` | o roteiro da história de produto em conversa, como o vídeo do Genie One: a pessoa com nome e cargo pergunta, os passos de "pensando" aparecem com um indicador que vira visto, a resposta chega em cartões, e o fim mostra o que ficou pronto | `references/roteiros.json`: `lancamento`, `interface`, `oferta`, `lista`, `passos`; nenhum em forma de conversa com passos de raciocínio |
| `motion-carousel` | a gramática dos ícones próprios (uma família, duas cores do acento, a mesma figura em todo slide) e o diagrama de camadas ou de fluxo como slide | os slides desenham cenas por pedido, sem família de ícones registrada |
| `ad-creatives` | a prova por logos reais no anúncio, com a mesma regra da página (cliente que autorizou, arquivo oficial, poucas logos paradas, inteiras e com legenda), e a cena do produto agindo, que os leitores da prova do ÉPICO 9 escolheram como a melhor imagem (o gasto que bate no limite e para, a ação negada no registro) | `skills/ad-creatives/SKILL.md` não fala de logos de clientes nem de cena de controle |
| `whatsapp-support` | os princípios do dbui para as telas do painel (cor só para estado, borda em vez de sombra, tabela densa, esqueleto ao carregar, limite mostrado antes do erro) e os desenhos de estado vazio | `kit/modelos/react` tem as telas sobre `primitives.tsx`, sem regra escrita de densidade, carregamento ou estado vazio |
| `video-render` | ler a fileira de logos na anatomia (quantas são imagem, quantas são nome escrito, se têm a mesma altura, se alguma se repete ou sai cortada na mesma vista), para a conferência apontar a fileira de nomes e a fileira que passa com poucas logos | a anatomia lê seções, chamados, preços e mídia; não separa logo de texto |
| `video-render` e este app | apontar o mesmo ícone em dois recursos (o mesmo desenho dentro de cartões ou linhas com títulos diferentes) e o texto cortado com reticências numa figura ou num menu | na rodada 3 do ÉPICO 9 a mesma moeda serviu a dois recursos, e na rodada 4 a tabela cortou "Ler e escreve…", sem que a conferência visse |

### Do modelo da Subido AI (2026-11-09)

| App | O que ganharia | Evidência de que hoje não tem |
|---|---|---|
| `ads-insights` | ler um teste A/B de página: cada versão no seu endereço, o veredito por versão com a amostra mínima de D28 do plano de anúncios, e a versão em cada evento (o tipo `curso` já pede isso na medição) | grep por `variante`, `A/B`, `variant` e `ab_test` em `modules/ads-insights` (fora dos testes): zero |
| `ad-creatives` (`ad-landing-page`) | quando o anúncio vende um curso, a página de destino é `curso`: chamar o `audit` deste app com esse tipo e conferir que o anúncio não promete ganho que a página não sustenta | `skills/ad-landing-page/SKILL.md`: nenhuma menção a curso, infoproduto ou a este app |
| `media-plan` | o preço à vista contra as 12 parcelas no caixa e no custo por cliente; a oferta para quem já é cliente como um segmento com preço próprio; a data de fim da promoção escrita | `references/oferta.md:10` e `lancamento.md:15` falam do parcelamento do anual; não há à vista contra parcelas nem preço por segmento |
| `video-studio` e `youtube-script` | o vídeo de vendas do topo: começa sem som, com legenda gravada, e a barra mostra o tempo de verdade (a da Subido corre na frente). Um roteiro de vídeo de vendas pode virar um pedido próprio | grep por `vsl` e `vídeo de vendas` nos dois apps: só uma fixture de teste |
| `contact-base` | a mensagem para quem já é cliente com o preço próprio dele, e o canal de dúvidas no WhatsApp com a promessa de resposta honesta | a régua trata a base por uso e pedidos; não há oferta por condição de cliente |
| `video-render` | ler a barra de progresso de um player de vídeo contra o tempo real, como item da captura (hoje só a sonda faz) | `capture` não entra nos quadros de outro domínio |

### Do erro da rodada 6 (2026-11-08)

| App | O que ganharia | Evidência de que hoje não tem |
|---|---|---|
| `ad-creatives` (`ad-landing-page`) | a foto sem letras e os testes do título na página do anúncio, ao chamar o `audit` deste app | `skills/ad-landing-page/SKILL.md`: a conferência própria lê texto e não olha a página sem ele |
| `youtube-script` | a mesma pergunta na thumbnail: sem o texto, a imagem ainda diz o assunto? | a 1.3.0 mede palavras e repetição do título na thumbnail; não há teste da imagem sem texto |
| `video-studio`, `motion-carousel` | os quadros de uma cena de produto sem letras, para saber se o objeto se reconhece com o som e o texto de fora: o motor já aplica o mesmo CSS | `film` e as folhas de contato mostram a página com o texto |
| `contact-base` | os testes do título no assunto do e-mail (em voz alta, trocando o nome), com a mesma regra de exagerar o interesse e nunca o fato | `references/copy-regua.md:8` pede até 45 caracteres e palavras concretas; não traz esses testes |

### Do modelo da Black Friday da Hostinger (2026-11-17)

| App | O que ganharia | Evidência de que hoje não tem |
|---|---|---|
| `video-render` | a hora em que cada contador termina (a hora da leitura somada ao tempo que falta), para `countdown_real` comparar com `offer.deadline` e apontar o contador que recomeça a cada visita | `countdownsFrom` (`scripts/lib/capture.mjs:1018`) lê o contador duas vezes, com 1,2 s entre elas, e guarda só o texto; neste ÉPICO, a hora de fim saiu de uma sonda (`sondas/contador.mjs`) |
| este app | uma prévia de página com data que diga na tela que é prévia; e a conferência do "até" e do "a partir de" do topo contra os cartões | na rodada 2, a prévia simulou o primeiro minuto da promoção sem aviso; a Hostinger tem o topo em R$ 9,99 e o plano mais barato a R$ 5,99, e nenhum item compara os dois |
| `ad-creatives` (`ad-landing-page`) | o "até" e o "a partir de" do anúncio contra o maior desconto e o menor preço dos cartões da página, além do prazo, que já confere | `skills/ad-landing-page/SKILL.md:27` confere o prazo da oferta contra a data do plano, e nada compara o desconto e o preço de entrada |
| `ads-insights` | o teste do topo com e sem contador, como a Hostinger faz, lido por versão com a amostra mínima; entra no item do teste A/B da Subido acima | a mesma evidência do item da Subido |
| `video-studio`, `motion-carousel` | o objeto da campanha que se entende sem ler, como o sinal de porcentagem inflado da Hostinger, nos vídeos e slides de uma promoção | `video-studio` reconhece o pedido de oferta (`scripts/lib/request.mjs:364`), e nenhum roteiro traz um objeto próprio da promoção |

### Do modelo da Hostinger (D3)

Ficam registradas para não se perderem:

| App | O que ganharia | Evidência de que hoje não tem |
|---|---|---|
| `video-render` | formato de vídeo para site: sem som, em loop, capa no idioma da página, teto de tamanho | `references/redes.json`: 13 redes, todas sociais ou de anúncio |
| `video-studio` | o roteiro "pedido, resultado, prova" (pedido digitado, resultado montado, prova na tela, dissolve, loop sem emenda) | `references/roteiros.json`: `lancamento`, `interface`, `oferta`, `lista`, `passos`; o `interface` é um elemento mudando de estado na batida |
| `video-analysis` | o mapa de movimento para animações sem corte, ignorando o pulso do quadro-chave | `references/interface.md:50,107,116`: mede cortes e silêncios |
| `ads-insights` | os eventos da oferta (vista, aceita, recusada, segunda oferta, taxa de aceite) e uma identificação por posição de chamado | grep por oferta, upsell e bump em `references`, `skills` e `scripts`: zero |
| `media-plan` | order bump e upsell somados ao valor do pedido, o que muda o custo permitido por cliente | grep por upsell, order bump e ticket médio: zero (fora o ticket do LinkedIn em `references/canais.json:17`) |
| `ad-creatives` (`ad-landing-page`) | quatro itens novos na conferência: a prova fala do produto oferecido; os números prometidos batem com o que aparece; vídeos e capa no idioma da página; chamado fixo no celular | `skills/ad-landing-page/SKILL.md:24-28`: chamado na primeira tela, palavras do anúncio, preço, prazo, linhas legais |

## 7. Fora de cobertura

- **Codex:** a pasta de skills do usuário não foi conferida.
- **Outros sistemas:** a captura e a instalação para o usuário rodam só no Windows nesta rodada.
- **A plataforma:** a publicação, a marca de versão de entrada e a página do app no flyee.club não fazem parte deste plano.
- **Na rodada do Juridiq, ficaram sem ver:**
  - a documentação da API, que fica num endereço à parte;
  - as páginas de cadastro e de pagamento;
  - se a janela da promoção volta depois de "Agora não" na mesma visita;
  - se o JuriChat grava cookies antes do aceite;
  - a origem dos números das páginas (escritórios, processos, horas economizadas);
  - o Safari do iPhone.

  Os depoimentos e a promessa de criptografia foram lidos como estão, sem verificação.
