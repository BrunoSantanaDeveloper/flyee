# Páginas que vendem: especificação

**Objetivo:** quando o operador (ou um integrante) pedir à IA uma página de um tipo conhecido (página de vendas, planos e preços, página de API, order bump, upsell, downsell, cross-sell, página de obrigado), a IA segue o roteiro de mercado daquele tipo e os modelos reais analisados, constrói a página e a confere pela captura. O repertório cresce a cada modelo que o operador traz.

> Conferido contra o código em 2026-11-07. A primeira rodada (Hostinger) está em a702826; a segunda (Juridiq, ÉPICO 5) está em 9b986bd e e859313. Nada tem tag. Legenda: ✅ existe · 🟡 parcial · ⬜ não existe · ⚠️ correção.

## Estado da implementação (2026-11-07)

| Tarefa | Estado | Evidência |
|---|---|---|
| T1.1 a T1.4 | ✅ | `video-render` 1.1.0, em a702826. A leitura fica em `readAnatomyDesktop` e `readAnatomyMobile` (`scripts/lib/capture.mjs`). `references/interface.md` §5 descreve `anatomy`, `texto.md`, `input_kind` e `anatomy_counts`. Testes em `tests/anatomy.test.mjs` e `tests/fixtures/oferta/` |
| T2.1 a T2.6 | ✅ | `conversion-pages` 1.0.0, em a702826: 19 regras, 14 testes, 3 casos de avaliação. É a candidata à versão de entrada (D7, D14) |
| T5.1 a T5.6 | ✅ | A rodada do Juridiq, em 9b986bd e e859313: `conversion-pages` 1.1.0 (ZIP sha256 `5fd81aa6…`, 30 arquivos) e o `video-render` 1.1.0 corrigido no lugar, ainda sem tag (ZIP sha256 `f40eb58c…`). Detalhes no ÉPICO 5 |
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

## 5. Riscos

| Risco | Primeiro sinal |
|---|---|
| A pasta de skills do usuário muda numa versão do Claude Code | a skill não aparece numa sessão nova em outro repositório (aceite de T3.1) |
| O Codex não tem pasta de skills do usuário conferida | declarado como fora de cobertura; o operador usa o Claude Code nesses repositórios |
| As heurísticas da anatomia erram num HTML incomum | o item sai `nao_conferido` em vez de errado; cada falha real vira um caso de teste |
| A página salva traz dado pessoal (nome, e-mail, pedido) | fica no projeto do integrante; no caso do operador, na pasta de trabalho, nunca no repositório |
| Um artigo de lei citado muda | `lei.md` traz a data da conferência; a próxima versão confere de novo |

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
