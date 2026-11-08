# Plano dos apps de vídeo: a 1.1

Complementa a linha P3 de `docs/PLANO.md`. A 1.0 (`video-render` e `video-studio`, construídos em 2026-10-07, não publicados) faz vídeo animado do zero, 9:16, de 6 a 20 s, sem chave. Este arquivo guarda o que entra na 1.1, o que foi proposto e ainda espera o sim do operador, o que precisa de teste antes de virar promessa e de onde cada ideia veio. A especificação de construção de cada parte vai para `modules/<app>/.dev/` quando a parte começar.

Regra de versão que continua valendo: a 1.0 é a versão gratuita e sai reduzida de propósito; a 1.1 sai no mesmo dia.

Numeração, decidida em 2026-10-16: o `video-studio` 1.1.0 é o roteiro "passo a passo" (`passos`), pedido pelo operador para os vídeos que explicam como algo funciona, que antes caíam na lista. O escopo deste plano chega ao `video-studio` como 1.2; o `video-render` segue a própria numeração.

## 1. Aprovado

### 1.1 Combinado em 2026-10-07

| Item | Onde entra |
|---|---|
| Transcrição com o tempo de cada palavra, com um modo que funciona sem chave | app novo `transcription` (`tool`) |
| Edição de gravações: câmera cheia, câmera em cartão com painel ao lado, tela gravada com a pessoa no canto, tela dividida; animação como camada transparente sobre a gravação | `video-studio`, skill nova `edit-video` |
| Imagem e vídeo gerados: primeiro a IA do próprio integrante, depois outra que ele já paga, chave só como última opção | `video-studio` |
| Outros formatos (1:1, 4:5, 16:9) da mesma linha do tempo | `video-studio` (o motor já renderiza) |
| Vídeo de referência estudado pelo `video-analysis` | `video-studio` |
| Peças longas | `video-studio` e `video-render` |

### 1.2 Aprovado em 2026-10-10: câmera 3D (do estudo do Flute)

1. **Motor (`video-render`): palco 3D na biblioteca das páginas.** Planos no espaço, câmera com perspectiva, rotação e deslocamento, movimento por mola ou na batida, e foco por profundidade. Começa com desfoque por plano; depois, o desfoque que varia ao longo de um plano inclinado.
2. **Captura do site em 2x ou 3x e recorte de partes da página** (cards, gráfico, menu) como planos separados. A 1x o close perde nitidez.
3. **Estúdio (`video-studio`): estilo "interface em 3D"**, com os tipos de tomada: câmera rasante ao longo da página, close num botão ou ícone, seção que descola da página, seções que se encaixam e troca de foco. Com cortes na batida, som e conferência.

Prova feita em 2026-10-10: uma página de rascunho em CSS 3D (painel inclinado, card flutuando à frente, câmera andando, foco passando do painel para o card) foi renderizada pelo motor sem nenhuma mudança, e duas renderizações saíram idênticas quadro a quadro.

Fica fora, por enquanto: filmar ao vivo o app React do próprio integrante dentro do código dele. Seria um app `tool` separado (mexe no código do integrante, exige o servidor de desenvolvimento rodando, só serve a quem tem app React) que entregaria tomadas ao Estúdio.

### 1.3 Feito em 2026-11-08: o som acompanha o corte

Pedido pelo operador ("sim, siga já com as correções") depois do estudo da seção 7, linha de 2026-11-08. Auditado contra o código sobre d2275ae com as mudanças ainda fora de commit. Legenda: ✅ existe e foi conferido · 🟡 parcial · ⬜ não existe · ⚠️ correção.

| # | Defeito medido | Estado e onde mudou | Aceite que roda |
|---|---|---|---|
| S1 | O `whoosh` começa no `t` e só chega ao máximo depois do corte | ✅ Campo opcional `anchor: "peak"` nas duas listas do `sfx`. Na de eventos, o motor mede o trecho mais alto do som gerado e começa antes dele (`video-render/scripts/lib/audio/synth.mjs`, `loudestAt` e o marcador `swell` de `whoosh`, `swish` e `riser`). Na de deixas, usa a fração da forma (`lib/audio/sfx.mjs:78`). O padrão continua `start`, porque o `motion-carousel` conta com ele (`motion-carousel/references/sound.md:69`). O `video-studio` põe `peak` em todo `whoosh` e `swish` que o roteiro não marcou (`scripts/lib/roteiro.mjs`, `eventsFile`); o `ad-creatives`, nos `whoosh` dos cortes (`scripts/lib/pieces.mjs`, `eventsOf`) | `node --test modules/video-render/tests/sound.test.mjs`: com `peak`, o máximo cai a até 1 quadro do `t`, com 3 sementes, `direction: "out"`, `pitch` e `length` diferentes conferidos à parte; sem `anchor`, o som ainda começa no `t`; um `impact` com `peak` sai idêntico |
| S2 | O guia promete que a música cede sob cada `impact` (`video-render/references/som.md`, tabela da mixagem), e o `mix` só abaixava sob a voz | ✅ Segundo compressor na música, com os efeitos como chave: limiar 0,1, que deixa passar `tick` e `click`, ataque de 5 ms e volta em 250 ms (`lib/ffmpeg.mjs`, `mixAudio`). `--sfx-duck <dB>`, padrão 8 e `0` desliga, e `settings.sfx_duck` na resposta (`commands/audio.mjs`) | `sound.test.mjs`: sob o impacto a música cai 3 dB ou mais, sob o tique no máximo 1 dB, e volta a no máximo 1 dB do nível de antes; com `--sfx-duck 0`, nada muda |
| S3 | O ponto alto da trilha cai por fórmula (45% ou 60% dos compassos), e ninguém pedia onde (`references/motion.md:22` quer imagem e ponto alto juntos) | ✅ `music --drop-at <s>` leva o ponto alto ao início de compasso mais perto e avisa quando moveu ou quando a peça não tem arco (`lib/audio/music.mjs:156` e `:521`). O `video-studio` pede o começo do primeiro papel da lista `peak` de cada roteiro (`references/roteiros.json`: prova ou fechamento no lançamento, preço ou fechamento na oferta, resultado ou fechamento no passo a passo, fechamento na lista e na interface), só na trilha composta e só quando a ajuda do motor cita `--drop-at`. O `ad-creatives` pede o corte para a última cena, onde o impacto já cai | `sound.test.mjs`: todo estilo compõe com o pico pedido, o pico é mais alto que o trecho anterior e a mesma entrada dá a mesma música; `video-studio/tests/studio.test.mjs`, "--drop-at goes to the Motor only when its help offers it"; `ad-creatives/tests/commands.test.mjs`, o `preview --refresh` com um motor que aceita a opção |
| S4 | Achado ao medir S2: a mesma mixagem saía diferente a cada rodada (4 resultados em 10, ffmpeg 9.0.2) e às vezes perdia até meio segundo do fim da música | ✅ O `sidechaincompress` termina quando qualquer entrada termina, e qual termina primeiro variava. As duas entradas de cada compressor agora recebem silêncio no fim (`apad`) e o resultado é cortado na duração (`yieldUnder` em `lib/ffmpeg.mjs`). Vale também para a voz: uma voz mais curta não corta mais a música | `sound.test.mjs`: 5 mixagens dos mesmos arquivos com o mesmo SHA-256; com música de 10 s e voz de 6 s, a saída tem 10 s e a música volta depois da voz. Medição avulsa: 10 de 10 iguais em cada um dos quatro casos (efeitos do mesmo tamanho, efeitos curtos, voz curta, voz curta e efeitos) |

Versões: `video-render` 1.1.0, ainda sem tag, recebeu as quatro (o `changelog` é dividido com o trabalho de páginas). `video-studio` 1.1.2 e `ad-creatives` 1.2.2 vieram por `apps bump`, porque 1.1.1 e 1.2.1 têm tag. Com um motor anterior, os dois apps continuam funcionando como antes: o motor ignora `anchor`, e `--drop-at` só vai quando a ajuda dele o cita.

Entrega: commit 4cc2280 (junto com o trabalho de páginas), CI verde no Linux e no Windows (run 42508159600). As tags subiram uma por vez como rascunho, cada uma com o SHA-256 da plataforma igual ao do pack: `video-render@1.1.0` (05fc2c85…, run 42508183476), `video-studio@1.1.2` (2b124046…, run 42508280417) e `ad-creatives@1.2.2` (bb243bc2…, run 42508342742). Publicar no console é clique do operador, primeiro o motor.

- ⚠️ **O atraso medido no estudo estava subestimado.** A conta de 1,16 s para um `whoosh` em 1,00 s (5 quadros) foi medida na lista de deixas. Na lista de eventos, a que o Estúdio e os anúncios usam, o máximo vinha 0,27 s depois do `t`, uns 8 quadros, porque a varredura do filtro sobe e a energia cresce até perto do fim do som. Por isso a âncora é medida no som gerado, não calculada pela metade da duração.
- ⚠️ **`motion-carousel/references/sound.md:69` diz que o `whoosh` atinge o máximo no meio da duração.** Isso vale para a lista de deixas. Na de eventos, que o carrossel usa, o máximo vem perto do fim. O texto não foi mudado porque o `motion-carousel` 1.1.4 tem tag: corrigir na próxima versão dele, e decidir ali se o carrossel passa a usar `anchor: "peak"`.
- 🟡 **A T12.1 de `docs/PLANO-ANUNCIOS-FALA.md` (a voz mais curta corta a peça) foi atacada pela S4 só no `mixAudio`.** O aceite dela (vídeo de 10 s com 300 quadros e nenhuma janela de 0,5 s abaixo de −40 dB depois da voz) não foi rodado com vídeo. A T12.2, o último quadro perdido, não foi tocada.

**O que rodou:** os testes do motor que tocam o som (`audio`, `synth`, `sound`, `core` e `runner`, 55 de 55), todos os do `video-studio` (98 de 99), do `ad-creatives` (72 de 73) e do `motion-carousel` (63 de 63), e o teste de integração do Estúdio com o motor real (`STUDIO_TEST_REAL=1`, do pedido ao vídeo final em 5 min 54 s). Os dois testes pulados são as integrações com o motor real, que só rodam quando pedidas; a do `ad-creatives` não rodou.

**O que não foi verificado:** ninguém ouviu o resultado. Todos os aceites medem o arquivo (pico por janela de 10 ms, nível de um tom de 8 kHz pelo algoritmo de Goertzel, SHA-256). A curva da cessão (8 dB, 250 ms) é um ponto de partida e não foi ajustada de ouvido.

## 2. Proposto em 2026-10-10 (aguarda o sim do operador)

Origem: o vídeo "CLAUDE OPUS 5.5 = VÍDEOS DE R$100K" (Mateus Dias, 17:53) e a skill `yt-ddiasmatt-animation` que ele distribui na descrição. O fluxo dele é o da nossa edição de gravações: uma skill corta a gravação (decupagem) e outra anima por cima do vídeo falado. Tamanho: P pequeno, M médio, G grande.

### 2.1 Para a edição de gravações

| # | O que | Como funciona | Onde entra | Tam. |
|---|---|---|---|---|
| A | **Decupagem como skill própria** (`rough-cut`), antes da animação | Corta pelo áudio os silêncios entre falas (limiar ajustável; ele usa 100 ms), respirações e estalos; corta pela transcrição os erros e as repetições, ficando a última tomada boa. Entrega uma prévia leve (720p) e a lista de cortes. Os originais nunca são alterados e o vídeo final é montado a partir deles. | `video-studio` (skill e script), usa `transcription` | M |
| B | **Notas faladas para a IA** | "Abre nota … fecha nota" e "IA, …" dentro da gravação viram a lista de pedidos da edição, cada um com o seu instante. O trecho sai do vídeo, salvo quando a pessoa diz para deixar. O app devolve a lista ao integrante antes de construir. Frases configuráveis, em pt-BR e em inglês. | `video-studio` (o briefing da edição) | P |
| C | **Cena presa à palavra** | Cada entrada nasce de uma palavra da transcrição. Nada entra antes da fala. Número aparece como foi dito; nenhum número é inventado. | `video-studio` (roteiro da edição), `transcription` | M |
| D | **Curva de intensidade** | Conforme a duração: gancho denso até 30 s, descida até 2:30, depois 20% a 35% do tempo animado e só onde a fala pede tela. Impacto, tremor, clarão e som forte só no gancho. | `video-studio` (roteiro) e conferência nova no `accept` (cobertura por janela de tempo) | M |
| E | **Câmera nunca pisca** | Entre duas cenas animadas, ou o vão é menor que 0,6 s e as cenas se emendam, ou a câmera fica 3 s ou mais. | `video-studio` (plano de fronteiras automático) e conferência | P |
| F | **Mapa de ocupação** | A média de uns 48 quadros com uma grade de coordenadas mostra onde a pessoa fica; texto e painéis não caem ali. Na tela gravada do computador, só um painel estreito junto ao cartão da câmera. Não pede modelo de visão: é uma média de quadros. | `video-render` (comando que gera a imagem) e conferência no `accept` (caixas contra a zona ocupada) | M |
| G | **Áudio gravado à parte** | Câmera no cartão e microfone no computador: os dois arquivos são sincronizados sozinhos. | `video-render` (áudio) | P–M |
| H | **Legenda por palavra com destaque** | No gancho e nos vídeos curtos; no vídeo longo, só onde ajuda. | `video-studio` | P |

### 2.2 Para todos os vídeos, inclusive os da 1.0

| # | O que | Como funciona | Onde entra | Tam. |
|---|---|---|---|---|
| I | **Memória da marca** | Preferências e correções do integrante, por marca, lidas no começo de cada vídeo e acrescidas a cada correção ("pedido vira regra; erro listado não volta"). | `video-studio` (`estudio-de-video/marcas/<marca>/`, comando para registrar) | P |
| J | **Assinatura da marca** | Além de cores, fontes e logo: fundo, forma dos destaques, moldura e tratamento do título, aprovados uma vez e reutilizados. Evita que os vídeos de todos os integrantes saiam iguais (o próprio autor pede que ninguém use a skill dele sem mudar). | `video-studio` (os estilos viram base; a marca guarda a variação) | M–G |
| K | **Print de notícia ou de página com marca-texto** | Cena de prova a partir de uma matéria real, com a fonte na tela. | `video-render` (`capture` já existe) e `video-studio` (tipo de cena) | P–M |
| L | **Clipes e fotos de terceiros** | Só os segundos usados, com o crédito na tela e com a pergunta de direitos que o Estúdio já faz. | `video-studio`, `video-analysis` (baixa o trecho) | P–M |

### 2.3 Para peças longas

| # | O que | Como funciona | Onde entra | Tam. |
|---|---|---|---|---|
| M | **Renderizar só o que é animado** | As cenas saem como camada transparente e são compostas sobre a gravação numa passada; o resto do vídeo não passa pelo navegador. | `video-render` (`render` por trechos e um comando de composição) | G |
| N | **Blocos retomáveis e render em segundo plano** | Um vídeo de 18 min não cabe numa chamada: render por blocos com reaproveitamento, um `status` para acompanhar e a conferência de espaço em disco antes de começar. | `video-render` e `video-studio` | M–G |
| O | **4K** | Captura em 2x da página 1080p. | `video-render` (`--scale` acima de 1) | P–M |
| P | **Atos** | Roteiro e página divididos em atos, um arquivo por ato, com prévia e conferência por ato. Onde a ferramenta do integrante tiver subagentes, um por ato com um briefing comum; onde não tiver, um ato por vez. | `video-studio` | M |
| Q | **Conferências novas** | Fala intacta (transcrever o vídeo final e comparar com o esperado), quadros do corte iguais aos originais, tela final do YouTube livre nos últimos ~20 s. | `accept` e a tabela das redes | M |

### 2.4 Proposto em 2026-11-08 (aguarda o sim do operador)

Origem: o estudo de 2026-11-08 (seção 7). Os repositórios foram lidos como texto, nunca executados. Tudo é Node e ffmpeg, sem dependência nova, menos a voz (X). Nenhum item foi construído. Estado de todos: ⬜.

| # | O que | Como funciona | Onde entra | Tam. |
|---|---|---|---|---|
| R | **Revisão por alfinete no quadro** | Uma página de revisão em que o integrante clica num ponto de um quadro; o clique vira (tempo, x, y) e é ligado à cena do roteiro e à caixa de `window.boxes` daquele ponto, e o pedido de mudança já sai endereçado | `video-render` (página) e `video-studio` (aplicar o pedido) | M |
| S | **Revisor de contexto limpo** | Quem confere a prévia é uma leitura nova, sem o histórico de quem fez o vídeo, em vez da nota que o autor dá a si mesmo | `video-studio` (skill) | P |
| T | **Conferências como aviso** | Quadro vazio ou chapado, cortes declarados contra cortes renderizados, tempo de leitura de cada texto na tela, contraste do texto medido nos pixels e movimento por segundo. Avisam e não reprovam até serem calibradas nos nossos filmes verticais | `accept` | P–M |
| U | **Mapa de movimento de uma referência** | Medir onde e quanto se mexe num vídeo de referência e comparar com o render, sem copiar pixels. A mesma necessidade aparece no `docs/PLANO-PAGINAS.md:448` | `video-analysis` | M |
| V | **Três direções como quadros** | Antes da prévia, três caminhos visuais em quadros parados, para o integrante escolher um | `video-studio` | P–M |
| W | **Palavras da narração presas ao roteiro** | Alinhar a transcrição ao texto que já se conhece e expor o tempo de cada palavra à página (`Motion.cue`) | `video-render` (biblioteca) e o motor de transcrição da D36 de `docs/PLANO-ANUNCIOS-FALA.md`, que os repositórios estudados não superam | P |
| X | **Narração local em português** | Kokoro com a voz `pf_dora` ou Piper com `faber` (CC0), rodando na máquina. Nenhuma das duas foi ouvida: primeiro o teste de escuta (seção 3) | app novo ou `video-render` | M–G |
| Y | **Cursor roteirizado e gravação real do produto** | Um cursor com semente na biblioteca das páginas cobre a maior parte das demonstrações e continua determinístico (P). A gravação do produto rodando já existe em parte: o comando `film` do motor, feito para as páginas em 2026-11-08, fotografa um trecho em tempo real e não é determinístico | `video-render` (`motion.js`) | P |
| Z | **`Motion.follow` e `Motion.flow`** | Regras para um elemento seguir outro e para entradas que se sobrepõem sem disputar o mesmo instante | `video-render` (`motion.js`) | P |

## 3. Testar antes de prometer

**Recorte de pessoa** (palavras atrás de quem fala, fundo trocado pela grade da marca; no vídeo em 00:01, 00:33 e 13:30) e **elementos presos às mãos** (13:03). O vídeo diz que a máscara usa "Remotion"; a skill enviada não mostra como é feito, e só o `SKILL.md` veio, sem as referências nem os scripts.

Caminhos a medir: um modelo de segmentação rodando dentro do navegador do motor (nada a instalar) ou um app `tool` à parte. Medir a qualidade da borda em cabelo e mãos, o tempo por minuto de vídeo, o tamanho que isso acrescenta ao pacote e se o resultado se repete entre renderizações.

Os elementos junto às mãos podem começar sem rastreamento: a IA lê os quadros com a grade de coordenadas (item F) e posiciona à mão nos poucos segundos da cena.

**Narração local em português** (item X): ouvir Kokoro `pf_dora` e Piper `faber` lendo três textos reais de anúncio antes de qualquer código. Medir também o tamanho do modelo baixado, o tempo por minuto de fala nesta máquina e se a mesma entrada dá o mesmo áudio. O motor Kokoro do `argo` recusa as vozes `pf_*`, então o caminho não pode ser o dele.

## 4. O que não adotamos

- **Depender de um modelo e de um nível de esforço.** Ele só chega a bom resultado com o modelo mais caro em esforço alto. No Estúdio a qualidade fica nos roteiros, nos modelos de página e nas conferências, para funcionar com a IA que o integrante tiver.
- **Remotion.** Licença paga acima de três pessoas; decisão de 2026-10-07.
- **Uma skill escrita à mão por canal**, com caminhos fixos da máquina do autor, Python e shell de macOS. Nossos apps são Node, Windows primeiro, e a identidade do canal é dado da marca (itens I e J), não código.
- **Transcrição paga obrigatória.** O modo sem chave vem primeiro; a chave é opcional.
- **CLIProxyAPI** (`router-for-me/CLIProxyAPI`), recusado para o produto e para qualquer texto de integrante. Ele usa os logins de assinatura fora dos programas a que pertencem: tem um disfarce de Claude Code (`config.example.yaml:486`), se apresenta como o Codex (`Originator: codex_cli_rs` em `internal/api/server_routes.go:447`) e alterna grupos de contas (README, linhas 134 a 140). Isso contraria a regra de cada pessoa usar a própria IA com o próprio login. A cláusula correspondente dos termos da OpenAI não foi lida.
- **Os modelos do `earshot`** (torch, 1,1 GB), **o GSAP** (a licença dele cita ferramentas de animação sem código), **o HyperFrames**, **o fluxo do `take-one`** (só macOS, e o próprio texto fala em 1 a 2 horas e 0,4 a 0,7 milhão de tokens por sessão), **a clonagem e o `--assets` do `reanimate`** e **as trilhas do Mixkit** (as nossas são originais).

## 5. Ordem sugerida

1. Motor: palco 3D (aprovado). Serve à "interface em 3D" e ao movimento de câmera sobre um diagrama com o vídeo num plano inclinado (12:17 do vídeo estudado).
2. App `transcription`.
3. Estúdio: `rough-cut` com notas faladas e áudio à parte (A, B, G).
4. Estúdio: `edit-video` para vídeos de até uns 3 min, com os layouts, a cena presa à palavra, a curva, as fronteiras, o mapa de ocupação e a legenda (C, D, E, F, H), mais a memória da marca (I).
5. Captura em 2x com recortes e o estilo "interface em 3D"; print de notícia (K).
6. Peças longas (M, N, O, P, Q).
7. Assinatura da marca (J), mídia gerada, clipes de terceiros (L).
8. O teste do recorte de pessoa corre em paralelo e não trava nada.

## 6. Quem mexe em quê

O `accept`, os comandos de áudio e a tabela das redes do `video-render` foram escritos na sessão que fez o `motion-carousel`. Enquanto as duas sessões estiverem ativas, mudança nesses arquivos é combinada antes (D, E, F, G e Q tocam neles).

Desde 2026-11-08 a captura, o navegador e o comando `film` são do trabalho de páginas (`docs/PLANO-PAGINAS.md`), e o som (seção 1.3) foi mexido por esta frente. O `changelog` de uma versão sem tag do motor é dividido: cada frente relê e só acrescenta frases, e quem mexe por último empacota e passa o SHA-256 para o `docs/PLANO-PAGINAS.md`.

## 7. O que foi estudado

| Fonte | O que veio dela | Quando |
|---|---|---|
| Felipe Borges (dois vídeos, o repositório `showreel-interface`, as páginas do Notion) e o artigo do 0xMovez | a base da 1.0: página como função do tempo, renderização quadro a quadro, briefing completo, prévia antes do final | 2026-10-06 e 07 |
| Flute (`webprodigies-org/flute`, MIT, 0.1.2) | câmera 3D, foco por profundidade, camadas; o método de exportar é o mesmo do nosso motor, sem som | 2026-10-10 |
| Mateus Dias, vídeo `61u9wOT-Cds` e a skill `yt-ddiasmatt-animation` | as seções 2.1 a 2.3 | 2026-10-10 |
| AI LABS, vídeos `p565AqELA8M` e `oTWUyW_bR-g`, e os repositórios `huashu-motion`, `rossark-motion-skill`, `take-one`, `reanimate`, `argo`, `explainroo`, `video-director`, `earshot` e `CLIProxyAPI` | os três defeitos de som da seção 1.3, a seção 2.4 e o que foi recusado na seção 4 | 2026-11-08 |

Os dois vídeos de 2026-11-08 foram lidos só pela análise de imagem e som do `video-analysis`, porque o YouTube recusou as legendas (HTTP 429). As análises ficam em `C:\AppsProjects\flyee-workspace\video-analyses\yt-p565AqELA8M\` e `yt-oTWUyW_bR-g\` (`descriptions/flyee-avaliacao.md`). Os repositórios não foram executados, e as licenças só foram lidas onde a seção 4 cita.

As análises do último ficam fora do repositório, em `C:\AppsProjects\flyee-workspace\video-analyses\yt-61u9wOT-Cds\`: `descriptions/estudio-conteudo.md`, `descriptions/estudio-edicao.md`, `transcript.md` e `skill-do-video.md`. A descrição automática atribui a renderização ao Remotion; a fala (14:39) diz que só a máscara usa essa ferramenta, e a skill descreve um motor próprio de página capturada.

O que o vídeo mostra, com tempos:

- **00:00 a 00:48**, o gancho: palavra gigante atrás da pessoa, legenda parcial com destaque, cartões com trechos de vídeo, telas cheias na cor do canal. Medido: 13 cortes no primeiro minuto e 2 no segundo.
- **02:40**: tela do computador cheia, a pessoa num cartão à direita e painéis pequenos junto ao cartão.
- **03:32**: câmera num cartão e um painel animado ao lado.
- **10:50**, lido no terminal: o mapa de enquadramento (média da silhueta em 48 quadros, com grade); o gancho de 0 a 49,7 s escrito pelo agente principal e 7 atos de 118 a 182 s escritos em paralelo; b-roll gerado; biblioteca de ícones.
- **11:42 a 12:00**: o pedido falado de remoção de fundo e de palavras atrás da pessoa (o efeito pronto aparece em 00:01, 00:33 e 13:30). **12:17 a 12:25**: movimento de câmera sobre um funil, com o vídeo num plano inclinado. **12:44**: o painel "nota para a IA". **13:03 a 13:16**: rosto recortado e uma foto junto às mãos, com o crédito da foto na tela.
- **14:14**: b-roll gerado por um serviço de vídeo. **15:25**: trechos baixados do YouTube. **15:36**: prints de notícia com marca-texto, dentro de um teaser que ele reproduz.
- **Do minuto 16 em diante**: quase só a câmera (medido: 1 corte no minuto 16, nenhum no 17). **17:39**: tela final.
