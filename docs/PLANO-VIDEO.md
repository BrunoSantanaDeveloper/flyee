# Plano dos apps de vídeo: a 1.1

Complementa a linha P3 de `docs/PLANO.md`. A 1.0 (`video-render` e `video-studio`, construídos em 2026-10-07, não publicados) faz vídeo animado do zero, 9:16, de 6 a 20 s, sem chave. Este arquivo guarda o que entra na 1.1, o que foi proposto e ainda espera o sim do operador, o que precisa de teste antes de virar promessa e de onde cada ideia veio. A especificação de construção de cada parte vai para `modules/<app>/.dev/` quando a parte começar.

Regra de versão que continua valendo: a 1.0 é a versão gratuita e sai reduzida de propósito; a 1.1 sai no mesmo dia.

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

## 3. Testar antes de prometer

**Recorte de pessoa** (palavras atrás de quem fala, fundo trocado pela grade da marca; no vídeo em 00:01, 00:33 e 13:30) e **elementos presos às mãos** (13:03). O vídeo diz que a máscara usa "Remotion"; a skill enviada não mostra como é feito, e só o `SKILL.md` veio, sem as referências nem os scripts.

Caminhos a medir: um modelo de segmentação rodando dentro do navegador do motor (nada a instalar) ou um app `tool` à parte. Medir a qualidade da borda em cabelo e mãos, o tempo por minuto de vídeo, o tamanho que isso acrescenta ao pacote e se o resultado se repete entre renderizações.

Os elementos junto às mãos podem começar sem rastreamento: a IA lê os quadros com a grade de coordenadas (item F) e posiciona à mão nos poucos segundos da cena.

## 4. O que não adotamos

- **Depender de um modelo e de um nível de esforço.** Ele só chega a bom resultado com o modelo mais caro em esforço alto. No Estúdio a qualidade fica nos roteiros, nos modelos de página e nas conferências, para funcionar com a IA que o integrante tiver.
- **Remotion.** Licença paga acima de três pessoas; decisão de 2026-10-07.
- **Uma skill escrita à mão por canal**, com caminhos fixos da máquina do autor, Python e shell de macOS. Nossos apps são Node, Windows primeiro, e a identidade do canal é dado da marca (itens I e J), não código.
- **Transcrição paga obrigatória.** O modo sem chave vem primeiro; a chave é opcional.

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

## 7. O que foi estudado

| Fonte | O que veio dela | Quando |
|---|---|---|
| Felipe Borges (dois vídeos, o repositório `showreel-interface`, as páginas do Notion) e o artigo do 0xMovez | a base da 1.0: página como função do tempo, renderização quadro a quadro, briefing completo, prévia antes do final | 2026-10-06 e 07 |
| Flute (`webprodigies-org/flute`, MIT, 0.1.2) | câmera 3D, foco por profundidade, camadas; o método de exportar é o mesmo do nosso motor, sem som | 2026-10-10 |
| Mateus Dias, vídeo `61u9wOT-Cds` e a skill `yt-ddiasmatt-animation` | a seção 2 inteira | 2026-10-10 |

As análises do último ficam fora do repositório, em `C:\AppsProjects\flyee-workspace\video-analyses\yt-61u9wOT-Cds\`: `descriptions/estudio-conteudo.md`, `descriptions/estudio-edicao.md`, `transcript.md` e `skill-do-video.md`. A descrição automática atribui a renderização ao Remotion; a fala (14:39) diz que só a máscara usa essa ferramenta, e a skill descreve um motor próprio de página capturada.

O que o vídeo mostra, com tempos:

- **00:00 a 00:48**, o gancho: palavra gigante atrás da pessoa, legenda parcial com destaque, cartões com trechos de vídeo, telas cheias na cor do canal. Medido: 13 cortes no primeiro minuto e 2 no segundo.
- **02:40**: tela do computador cheia, a pessoa num cartão à direita e painéis pequenos junto ao cartão.
- **03:32**: câmera num cartão e um painel animado ao lado.
- **10:50**, lido no terminal: o mapa de enquadramento (média da silhueta em 48 quadros, com grade); o gancho de 0 a 49,7 s escrito pelo agente principal e 7 atos de 118 a 182 s escritos em paralelo; b-roll gerado; biblioteca de ícones.
- **11:42 a 12:00**: o pedido falado de remoção de fundo e de palavras atrás da pessoa (o efeito pronto aparece em 00:01, 00:33 e 13:30). **12:17 a 12:25**: movimento de câmera sobre um funil, com o vídeo num plano inclinado. **12:44**: o painel "nota para a IA". **13:03 a 13:16**: rosto recortado e uma foto junto às mãos, com o crédito da foto na tela.
- **14:14**: b-roll gerado por um serviço de vídeo. **15:25**: trechos baixados do YouTube. **15:36**: prints de notícia com marca-texto, dentro de um teaser que ele reproduz.
- **Do minuto 16 em diante**: quase só a câmera (medido: 1 corte no minuto 16, nenhum no 17). **17:39**: tela final.
