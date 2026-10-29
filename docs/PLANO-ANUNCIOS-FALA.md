# Anúncios com pessoa falando: plano de implementação

**Objetivo:** num pedido de criativos com vídeos de fala que o integrante já tem (fundadora, especialista, cliente com autorização), de qualquer marca, a primeira prévia sai do próprio `ad-creatives` (`footage`, `edit`, `piece`, `preview`, `final`, `deliver`), sem motor escrito à parte e sem entrega montada à mão, e já cumpre o checklist da seção 6 de `.entrada/flyee-melhorias-anuncios-com-fala.md`; o integrante só aprova a fala montada, os textos novos da tela e a peça.

Origem: `.entrada/flyee-melhorias-anuncios-com-fala.md` (2026-10-26), escrito a partir de uma campanha real cuja primeira versão passou em todas as conferências automáticas e foi reprovada. Vale a D22 de `docs/PLANO-ANUNCIOS.md`: tudo aqui é produto, nenhum aceite ou fixture se vincula a uma marca do operador. Este plano continua a numeração daquele: decisões a partir de D34, épicos a partir do 12.

> Auditado contra o código em 2026-10-26 (HEAD `2dd73e2`, árvore limpa). Três auditorias de leitura, uma por app (`ad-creatives`, `video-render`, `video-analysis` com o que cruza os apps), e reproduções no rascunho da sessão com o motor deste HEAD. Legenda: ✅ existe · 🟡 parcial · ⬜ não existe · ⚠️ correção.
>
> Versões de hoje, todas com tag (qualquer mudança pede `npm run apps -- bump`): `ad-creatives` 1.2.0, `video-render` 1.0.2, `video-analysis` 1.0.1. Quem chama o motor: `ad-creatives`, `motion-carousel` 1.1.2 e `video-studio` 1.1.1. Quem chama a análise: `ad-creatives` e `youtube-script`.

## Correções ao documento de entrada

O que o documento afirma e o código contradiz. Os arquivos a corrigir estão nas tarefas indicadas.

1. ⚠️ **O defeito 1 tem duas faces.** O compressor da trilha usa a voz como chave (`video-render/scripts/lib/ffmpeg.mjs:217-218`) e nada estende a voz (`apad` não aparece no motor), então a trilha acaba na última palavra. Com efeitos na mistura, como o `ad-creatives` sempre manda (`ad-creatives/scripts/lib/engine.mjs:76-83`), a mistura segue só com os efeitos (`amix … duration=longest`, `ffmpeg.mjs:231`) e o fechamento fica mudo: −91 dB de 4 a 10 s com voz de 3 s; com `apad=whole_dur=10` na voz, −24 dB. Sem efeitos, a mistura acaba com a voz e o `-shortest` da montagem (`commands/audio.mjs:76`) corta o vídeo junto: vídeo e trilha de 10 s (300 quadros) com voz de 6 s saíram com 5,9 s (177 quadros), com ou sem `--duration 10`. Sem voz, 10 s e 300 quadros. Tarefa T12.1.
2. ⚠️ **`references/pagina-anuncio.md` já está certo** (linha 14 descreve `ads_meta_feed`). O texto velho sobre a zona do feed está em `guides/pt-BR/abrir-o-capo.md:67`, `guides/en/abrir-o-capo.md:67`, `references/lancamento.md:10` e no comentário de `scripts/ads.mjs:1112-1113`. Tarefa T12.7.
3. ⚠️ **Quem procura `ads_meta_feed` é o `ads.mjs`, não o `pieces.mjs`**: `ads.mjs:708-711` (zona do layout), `:1128` (final), `lib/sequence.mjs:17` e `lib/report.mjs:198`.
4. ⚠️ **O 4:5 só fica errado na prévia.** O `final` confere o 4:5 com o vídeo e `--networks ads_meta_feed` (`ads.mjs:1128-1129`); o `preview` confere o 4:5 só pela página, com `--safe instagram-feed` (`ads.mjs:942`), isto é, a zona orgânica 120/200/72/72 (`video-render/references/redes.json:8`), e não a de anúncio, 135/135/108/108, em que a página foi desenhada. Tarefa T12.7.
5. ⚠️ **No defeito 4, a pasta temporária única já existe** (`mkdtempSync`, `video-render/scripts/lib/util.mjs:193-195`), e o erro não se reproduziu: dois `render` e um `frames` ao mesmo tempo (página de exemplo, escala 0,25) terminaram sem `browser_timeout`, sem `EPERM` e sem perfil deixado na pasta temporária. A carga da campanha (quadro cheio, peças de 30 s, `--sub 2`) não foi repetida. O que falta mesmo: trava ou fila por máquina, limpeza de órfãos ao começar, e um defeito que o documento não cita: dois `frames` da mesma página usam a mesma pasta `quadros/` e apagam os quadros um do outro (`render.mjs:291`, `:303`). Tarefa T12.4.
6. ⚠️ **O defeito 2 mora em outro lugar.** O `mix` passa `video: null` ao `mixAudio` (`commands/audio.mjs:421-422`), então o `-shortest` de `ffmpeg.mjs:258` nunca roda por ali; o que corta é o `-shortest` de `finalizeMix` (`commands/audio.mjs:76`) e o de `muxAudio` (`ffmpeg.mjs:123-126`, usado pelo `render --audio` em `renderer.mjs:207`). Tarefa T12.2.
7. ⚠️ **O `drawtext` também está no `video-analysis`.** Além das etiquetas da folha do motor (`ffmpeg.mjs:145`, fonte `C:/Windows/Fonts/segoeui.ttf` em `tools.mjs:151-164`), ele carimba as grades de quadros da análise (`video-analysis/scripts/lib/frames.mjs:270`). Tarefa T12.5.
8. ⚠️ **O tempo de cada palavra tem duas fontes que o documento não cita.** O ffmpeg que o app já instala (9.0.2, `Gyan.FFmpeg` no winget) traz o filtro `whisper`: na prova de 2026-10-26, 15,8 s de fala em português viraram 68 palavras com tempo em 12,7 s, sem chave e sem programa novo. E as legendas automáticas do YouTube em json3 trazem o deslocamento de cada palavra, que `video-analysis/scripts/lib/captions.mjs:28` e `youtube-research/scripts/lib/captions.mjs:28` descartam ao juntar os trechos. Tarefa T13.1.

## 0. Decisões que o implementador não inventa

| # | Decisão | Valor | Onde mora |
|---|---|---|---|
| D34 | Versões | Proposto: a próxima versão de correção do `video-render` e o `ad-creatives` 1.2.1 só com as correções do ÉPICO 12; depois `video-analysis` 1.1.0, `video-render` 1.1.0 e `ad-creatives` 1.3.0 com o tipo `fala`. ⚠️ Em 2026-10-29 a sessão flyee-c5 deixou na árvore, sem commit, `video-render` 1.0.3, `video-analysis` 1.0.2 e `motion-carousel` 1.1.3 com um limite de tempo nos processos (`timeoutMs` em `run()`, erro `tool_timeout` nas duas interfaces). O ÉPICO 12 sai como `video-render` 1.0.4 ou depois, e a análise segue como 1.1.0. As versões de entrada (a gratuita de cada app) não mudam | manifestos (`version`, `changelog`); tags `<slug>@<versão>` |
| D35 | Onde mora o tempo de cada palavra | Proposto: um comando novo `words` no `video-analysis`, aditivo na interface 1 (`references/interface.md:149`). Ele já instala ffmpeg e yt-dlp, já lê legendas e já pede o sim para enviar arquivo ao Google. ⚠️ Isso troca o app `transcription` aprovado em `docs/PLANO-VIDEO.md:15`; se o operador mantiver o app separado, o ÉPICO 13 muda de pasta e nada mais | `video-analysis` manifesto e interface; `docs/PLANO-VIDEO.md` |
| D36 | Motor da transcrição | Proposto: sem chave, o filtro `whisper` do ffmpeg com modelo ggml (`base`, 148 MB; `small`, 488 MB, se a prova em português pedir), e as fronteiras ajustadas às pausas medidas no áudio. Para link do YouTube, as palavras do json3. Com chave: em aberto (não confiei no Gemini para tempo por palavra e não o testei para isso; o Scribe da ElevenLabs devolve, mas é uma chave nova). O modelo é fato da máquina: baixado uma vez para `~/.flyee/modelos/`, com SHA-256 fixo, nunca dentro do projeto | `video-analysis/references/modelos.json` (URL, SHA-256, tamanho); permissão `network` do host do modelo |
| D37 | Rosto quadro a quadro | Proposto: o detector de pontos do rosto do MediaPipe (licença Apache 2.0) rodando no navegador que o motor já controla, sem programa novo. Modelo e runtime baixados uma vez com SHA-256 para `~/.flyee/modelos/`, ou dentro do pacote se couberem; decide-se na prova da T14.1. Detector Haar nunca | `video-render/references/modelos.json`; permissão `network` |
| D38 | Legenda queimada | Proposto: por região e cor, sem OCR. A IA marca numa folha de quadros com grade a região e a cor de cada bloco; o script mede a presença quadro a quadro só nessa região, antes e depois do render. OCR só se a prova mostrar que não basta | `video-render`, comando `burned` |
| D39 | Autorização de quem aparece | Proposto: o método da D30, por pessoa e não por grupo. Nome, papel, se é o próprio integrante, como autorizou (mensagem, contrato, áudio), data, escopo (anúncio pago, redes, prazo) e o texto aceito. Campo vazio deixa a pessoa `pendente` e o vídeo dela não entra. Sem documento e sem cerimônia | `anuncios/<campanha>/pessoas.json`; `ad-creatives/scripts/lib/people.mjs`; `references/fala.md` |
| D40 | Fonte do site no vídeo | Proposto: a licença da fonte para vídeo de anúncio é perguntada uma vez e a resposta fica no projeto; sem resposta, a peça usa a fonte livre mais parecida de uma lista curta e diz qual | resposta em `anuncios/<campanha>/briefing.md`; lista em `video-render/references/fontes-livres.json` |
| D41 | Gemini nas conferências | Proposto: opcional, com a chave que o integrante já tem. Sem chave, a montagem passa pelo leitor cético e pelas medições, e a revisão final pela leitura dos quadros pela IA. Todo achado do Gemini volta como `a_conferir`. A voz de um terceiro só vai ao Google com o sim do integrante, dito que a voz da cliente vai junto | skill do `ad-creatives`; `video-analysis` |
| D42 | Números de montagem e de layout | Proposto: os da seção 4 do documento de entrada (pausa de 120 ms, fade de 20 a 40 ms, fala completa 0,3 s antes do fechamento, legenda de até 6% do quadro, 2 linhas e 30 caracteres, corpo de 48 a 52 px, logo de 96 px e nunca abaixo de 80, folgas de 24 px, entrada do texto 50 a 80 ms antes da fala, telas a até 0,35x, cascata de 0,7 s com 0,12 s, fechamento parado por 3 s). Saíram de uma campanha: entram rotulados com a fonte e a data e são revistos com a segunda | `video-render/references/fala.json`, lido pelo runtime, pelo `accept` e pelo `edit` |
| D43 | Leitor cético | Proposto: uma passada que lê só o texto corrido montado, com perguntas fixas, num subagente quando a ferramenta tiver; sem subagente, a própria IA lendo só o arquivo do texto. O veredito de cada junção fica gravado no `voz.json`; o script recusa `piece` sem esse registro ou com junção `sem_sentido` | `ad-creatives`, comando `edit`; `references/fala.md` |
| D44 | Interface da Meta na prévia | Proposto: desenho genérico (coluna de ícones, texto do anúncio, botão), sem logotipo da Meta, só na prévia; o arquivo entregue nunca a leva | `video-render`, `preview --ui` |
| D45 | Corte curto | Proposto: quando a fala montada tem um trecho de 15 a 20 s que se sustenta sozinho, o `edit` propõe a versão curta além da inteira, e o integrante escolhe testar as duas | `ad-creatives`, `edit` |
| D46 | Material do teste de aceitação | Em aberto. Marca fictícia (D22), site local com página inicial, página de planos e uma fonte livre própria. Para os dois vídeos de fala com legenda queimada colorida e figurinha, e a gravação de tela com zoom: o operador grava (o mais fiel ao caso real, sem licença de terceiro) ou vêm de um banco com licença que permita obra derivada | fixtures pequenas em `modules/*/tests/fixtures/`; o material de vídeo fora do repositório, numa pasta de aceitação |
| D47 | Arquivos compartilhados do motor | Decidido pela invariante 13 de `docs/PLANO-ANUNCIOS.md:99`: `accept`, comandos de som e `redes.json` só mudam depois de conferir as sessões ativas | este plano |

## 0.5 Convenções que valem para todas as tarefas

- **Fronteira.** Tudo em `modules/<slug>/` fora de `tests/`, `.dev/` e `*.dev.md` vai para o integrante: pt-BR, sem nome interno, e cada `.md`, texto do manifesto e frase impressa pelos scripts passa pelo `text-lint` (`packages/module-tools/src/text-lint.mjs`): sem travessão, sem exclamação, sem emoji.
- **O integrante não abre o terminal.** Programas pelo `need` (só gerenciador de pacotes: `packages/cli/src/commands/need.ts:53`); modelos pelo próprio app, com SHA-256 conferido antes de usar. Chave: variável de ambiente primeiro, depois `~/.flyee/keys.json`.
- **O projeto é a pasta.** Vídeos de origem, voz montada, transcrição, rostos, legendas e autorizações ficam em `anuncios/<campanha>/`; só os modelos, que são da máquina, ficam em `~/.flyee/modelos/`.
- **Interfaces só crescem.** `video-render` e `video-analysis` seguem na interface 1, com comandos e campos novos aditivos; `peca.json` v1 continua válido (`ad-creatives/scripts/lib/pieces.mjs:11`).
- **Números com rótulo e fonte (D23).** Nenhum número da oferta sai de estimativa; a economia é calculada pelo script.
- **Testes** em `modules/<slug>/tests/*.test.mjs`, sem subpastas; Windows primeiro, depois macOS e Linux.
- **Peça sem `window.boxes(t)` conta como reprovada** (invariante 14 de `docs/PLANO-ANUNCIOS.md`; `ads.mjs:913-925`).

## Invariantes

1. **Vídeo de um terceiro sem autorização registrada não entra em peça** (`consent_missing`). Rosto e voz publicados sem o sim da pessoa é o erro que não se desfaz depois que o anúncio roda.
2. **A montagem nunca muda o que a pessoa afirmou.** Nada de reordenar falas num sentido novo, nenhum corte dentro de palavra, nenhuma frase final sem fim.
3. **A duração sai da fala.** Nunca cortar a fala para caber num número.
4. **Achado do Gemini nunca vira veredito sozinho.** Volta como `a_conferir` e é conferido com quadros e medições antes de aprovar ou reprovar.
5. **Mudou a voz, um vídeo de origem ou o `voz.json`, a aprovação cai.** Eles entram no hash da aprovação, que hoje cobre só a página, o runtime e as imagens (`ads.mjs:692-696`).
6. **`--kind fala` nunca vira peça animada em silêncio.** Hoje o `piece` ignora `--kind` (opção global usada pelo `journal`, `ads.mjs:52`, `:1405`).
7. **A interface simulada da Meta nunca vai para o arquivo entregue.**
8. **Cor fora do design system e fonte sem licença respondida não entram na peça.**
9. **Vídeo, voz e transcrição do integrante e de terceiros não saem da máquina sem o sim dele, a cada envio,** e nunca entram em telemetria.

## ÉPICO 12: correções que valem para qualquer peça com voz

**Bloqueia:** nada; sai primeiro, como `video-render` 1.0.4 ou depois (D34) e `ad-creatives` 1.2.1.

⚠️ Os números de linha deste épico foram lidos no HEAD `2dd73e2`. Depois disso a árvore ganhou o limite de tempo da sessão flyee-c5 (D34) em `util.mjs`, `ffmpeg.mjs`, `browser.mjs`, `tools.mjs` e nos comandos `accept` e de som do motor; as funções e os argumentos do ffmpeg não mudaram, mas as linhas podem ter andado. Reconferir cada citação ao começar a tarefa. Mudanças de comportamento dela que este épico herda: a grade com rótulo que trava cai na grade sem rótulo (até a T12.5 tirar o `drawtext`), o codificador do render para de esperar quando o ffmpeg morre no meio, e fora do Windows os programas rodam no próprio grupo de processos.

### T12.1: a voz mais curta corta a peça
**Estado: ⚠️ reproduzido em 2026-10-26** (correção 1 acima): `ffmpeg.mjs:217-218` e `:231`; nenhum teste do motor cobre `--voice` (89 testes: `accept` 31, `audio` 17, `capture` 20, `core` 12, `synth` 9).
- Estender a voz com silêncio até a duração do vídeo antes do compressor e da mistura (`apad=whole_dur`), e nunca deixar a fonte mais curta decidir a duração da saída.
- Testes com os arquivos da reprodução, gerados no próprio teste: vídeo e trilha de 10 s, voz de 6 s, com e sem efeitos.
- **Aceite:** nos dois casos a saída tem 10,0 s e 300 quadros, e nenhuma janela de 0,5 s entre o fim da voz e o fim do vídeo fica abaixo de −40 dB (hoje dá −91 dB); o caso sem voz continua igual.

### T12.2: o `mix` perde o último quadro
**Estado: ⚠️ reproduzido em 2026-10-26.** Vídeo de 892 quadros a 30 fps com trilha de 29,733292 s saiu do `mix` com 891 quadros; o mesmo par direto com `-shortest` deu 890, sem ele 892. O corte está em `finalizeMix` (`commands/audio.mjs:76`) e em `muxAudio` (`ffmpeg.mjs:123-126`), não onde o documento diz (correção 6).
- Estender o áudio até a duração do vídeo antes de codificar, nos dois lugares, em vez de `-shortest`.
- **Aceite:** teste com esses dois arquivos devolve 892 quadros pelo `mix` e pelo `render --audio`.

### T12.3: a folha de contato carimba o tempo errado
**Estado: ⚠️ reproduzido em 2026-10-26.** Num vídeo em que o brilho de cada quadro codifica o número dele, o quadrinho rotulado t mostrou o quadro de t + 0,18 a 0,21 s, em todos os oito; a auditoria mediu t + 0,2333 s. A folha passa o vídeo pelo filtro `fps` e carimba o `pts` da saída dele (`ffmpeg.mjs:142-147`, `render.mjs:333-338`). O `frames`, que busca o instante exato, não tem o problema (`render.mjs:302-310`).
- Tirar cada quadro no instante exato do rótulo, como o `frames`, e carimbar sem `drawtext` (T12.5).
- **Aceite:** o teste da rampa de brilho: cada quadrinho mostra o quadro `round(t × fps)`.

### T12.4: comandos de navegador ao mesmo tempo
**Estado: 🟡** (correção 5). Pastas temporárias únicas ✅ (`util.mjs:193-195`); a pasta de relatórios de falha do navegador é uma só para todos (`%TEMP%/flyee-crashpad`, `browser.mjs:17-19`, `:135`); a varredura só apaga perfis com 15 min ou mais e sem uso (`browser.mjs:28-84`); `killProcessTree` só mata a própria árvore no `close()` (`:91-107`, `:309-313`); limpeza de órfãos ⬜; trava ou fila por máquina ⬜; até `min(4, núcleos − 1)` navegadores por comando (`renderer.mjs:114-119`) com prazos fixos de 20 e 30 s (`browser.mjs:12`, `renderer.mjs:165`); dois `frames` da mesma página apagam os quadros um do outro (`render.mjs:291`, `:303`).
- Pasta de quadros única por chamada do `frames`, ou o resultado de uma chamada nunca apagado por outra.
- Reproduzir na carga da campanha: dois `render` de 30 s em 1080×1920 com `--sub 2` e um `accept` com vídeo, ao mesmo tempo. Só o que falhar ganha a trava por máquina com fila e a limpeza dos órfãos.
- **Aceite:** dois `frames` simultâneos da mesma página devolvem os quadros dos dois; o script de reprodução passa três vezes seguidas, sem `browser_timeout`, sem `EPERM` e sem processo do navegador do motor vivo depois.

### T12.5: `drawtext` no Windows
**Estado: 🟡** usado na folha do motor (`ffmpeg.mjs:145`, ligado em `render.mjs:337`) e nas grades do `video-analysis` (`lib/frames.mjs:270`); o travamento não se reproduziu: a folha da T12.3 carimbou os oito rótulos sem travar nesta máquina. O documento atribui o travamento ao fontconfig, que monta o cache na primeira vez.
- Carimbar o tempo pelo navegador ou com uma imagem pronta sobreposta, nas folhas do motor e nas grades da análise; o da análise sai no `video-analysis` 1.1.0 (ÉPICO 13).
- **Aceite:** `grep drawtext modules/*/scripts` sem resultado; as folhas e as grades continuam com o tempo legível.

### T12.6: as conferências `audio_continuity` e `frame_count`
**Estado: ⬜** O `accept` tem `page`, `first_frame_readable`, `safe_area`, `text_size`, `cuts_on_beat`, `loop_seamless`, `flashes`, `dead_time`, `loudness`, `format_supported` e `duration` (`lib/accept.mjs:11-13`). O volume é medido só integrado (`commands/accept.mjs:646-655`), e é por isso que o fechamento mudo passou; a contagem de quadros do ffprobe existe (`ffmpeg.mjs:104`) e o `accept` não usa (`commands/accept.mjs:421-429`).
- `audio_continuity`: volume por janela de 0,5 s; reprova silêncio digital ou queda brusca onde há trilha, e trilha que some antes do fim.
- `frame_count`: quadros contados contra duração × fps.
- **Aceite:** um mix feito com o código de antes da T12.1 reprova em `audio_continuity`; o de depois passa; o vídeo de 891 quadros reprova em `frame_count`.

### T12.7: `ad-creatives` 1.2.1, o 4:5 da prévia e os textos velhos
**Estado: ⚠️** (correções 2 e 4).
- O `preview` confere o 4:5 em `ads_meta_feed`, como o `final`.
- Corrigir os quatro textos da correção 2.
- O motor falso dos testes ganha `ads_meta_feed` (hoje não tem: `tests/fixtures/engine/render.mjs:140`), e o ramo 4:5 do `final` ganha teste de comando.
- O mix do 4:5 no `final` deixa de descartar os avisos e a medida de volume (`ads.mjs:1127`).
- **Aceite:** `commands.test.mjs` prova que o `preview` 4:5 chama `accept` com `ads_meta_feed`; `validate` sem avisos.

## ÉPICO 13: o tempo de cada palavra (`video-analysis` 1.1.0)

**Bloqueia:** o inventário (T15.2), a montagem (T15.3) e a legenda (T15.4). Depende da D35 e da D36.

### T13.1: prova do filtro `whisper`
**Estado: 🟡** Windows provado em 2026-10-26: ffmpeg 9.0.2 com `--enable-whisper`, modelo `base`, `language=pt`, `max_len=1`, `format=json`: 15,8 s de fala viraram 68 palavras com início e fim em ms, em 12,7 s de CPU. Achado: o JSON do filtro não escapa aspas dentro do texto (`"text":""Não"`), então a leitura precisa ser tolerante. Não verificado: macOS (o ffmpeg do Homebrew pode vir sem o filtro), Linux (o ffmpeg do apt pode ser anterior à versão 8.0, a primeira com o filtro), a precisão contra pausas (a amostra tinha trilha por baixo da voz) e `base` contra `small` em português.
- Repetir com duas gravações limpas de fala, uma de cada tipo da D46: medir o erro das fronteiras contra marcas feitas à mão e o erro de palavras nos dois modelos.
- Rodar no macOS e no Linux; onde o ffmpeg não tiver o filtro, decidir a saída (o `whisper.cpp` pelo gerenciador de pacotes onde houver, ou o tipo `fala` só no Windows e no macOS no começo).
- **Aceite:** uma tabela neste plano com erro de fronteira, erro de palavras e tempo por minuto de fala nos três sistemas, e a D36 fechada.

### T13.2: comando `words`
**Estado: ⬜** nenhuma transcrição para arquivo local hoje (só `.srt` ou `.vtt` ao lado do vídeo: `video.mjs:211-222`); legendas do YouTube por trecho, sem palavra (`lib/captions.mjs:28`); áudio sozinho recusado antes de qualquer coisa (`lib/frames.mjs:31` devolve `no_video_track`, e a tabela de tipos de `lib/source.mjs:45-61` só tem vídeo).
- `words <vídeo|áudio|link> --json` grava `palavras.json`: cada palavra com início, fim, a pausa depois e a origem (`whisper`, `youtube`, `legenda`); fronteiras de frase ajustadas ao mínimo de energia medido.
- Aceitar arquivo só de áudio (wav, mp3, m4a).
- Guardar o deslocamento de cada palavra do json3 do YouTube em vez de descartá-lo.
- Baixar o modelo uma vez para `~/.flyee/modelos/` e conferir o SHA-256 antes de usar.
- **Aceite:** testes de unidade com um json3 de fixture que tem palavras e com uma saída do filtro com aspas sem escape; um teste de ponta a ponta, pulado sem o filtro, que transcreve um wav de fixture e acerta as fronteiras marcadas à mão em até 60 ms.

### T13.3: comando `check-edit` (o `conferir-montagem` do documento)
**Estado: ⬜** nenhum modo devolve achados estruturados; o Gemini responde no formato de descrição (`lib/description.mjs:7-20`) e o chamador só recebe o caminho de um `.md` (`video.mjs:586`).
- Entrada: o áudio montado e o texto esperado. Saída JSON: a transcrição com tempos; para cada junção, se a frase seguinte continua a anterior com sentido e se alguma palavra foi cortada; se a última frase termina completa; se a fala termina antes do fechamento.
- Sem chave: devolve as medições (energia em cada corte, as palavras em volta de cada junção, a última frase) e as perguntas para a IA responder. Com chave: as mesmas perguntas ao Gemini, e cada achado marcado `a_conferir`.
- **Aceite:** com a chave falsa dos testes, um áudio de fixture com uma palavra cortada numa junção devolve essa junção com `palavra_cortada` e `a_conferir`; sem chave, devolve as medições e as perguntas.

### T13.4: comando `review` (a `revisao-final` do documento)
**Estado: ⬜** o Gemini nunca é conferido; o único cuidado é o "(provável)" do próprio pedido (`lib/description.mjs:32`).
- As seis perguntas fixas da seção 3.3 do documento de entrada, com tempos; cada achado `a_conferir`, com o instante e o tipo (fala, legenda, rosto, texto, som) para o app conferir com quadros e medições.
- **Aceite:** com a chave falsa, um achado sobre som num trecho que a fixture mede como silêncio sai `a_conferir`, e a função de conferência do `ad-creatives` (T15.5) o descarta.

### T13.5: interface, skill, guias e pacote
**Estado: ⬜**
- `references/interface.md` (comandos novos, aditivos na interface 1), skill, guias pt-BR e en, changelog, casos de avaliação, `validate`, `pack`.
- **Aceite:** `validate` sem avisos; `npm run test:apps` verde.

## ÉPICO 14: o motor para a fala (`video-render` 1.1.0)

**Bloqueia:** a peça `fala` (T15.4 em diante). As provas da T14.1 e da T14.3 decidem a D37 e a D40.

### T14.1: comando `track`, o rosto quadro a quadro
**Estado: ⬜** nada no repositório detecta rosto (procurados haar, landmark, mediapipe, opencv, cv2, cascade, face-api, dlib); não há comando `track` (`render.mjs:61`, `:484-510`). ⚠️ `Motion.track` já existe e é outra coisa, a ajuda de molas por quadro-chave (`runtime/motion.js:56-60`): o comando pode se chamar `track`, mas as funções do runtime precisam de outro nome.
- Prova primeiro: o detector de pontos do rosto rodando no navegador do motor, sobre os vídeos da D46.
- A cada 0,1 s: caixa do rosto, sobrancelhas, olhos, boca, queixo, abertura dos olhos e da boca.
- Função que, dada a tabela, o selo do logo e o cartão de legenda, devolve o deslocamento por instante (olhos 24 px abaixo do selo, boca 24 px acima da legenda, rosto dentro da zona livre).
- **Aceite:** em 10 quadros marcados à mão, sobrancelhas e olhos a até 10 px; um vídeo de 30 s processado em menos de 60 s; o mesmo resultado em duas rodadas.

### T14.2: comando `burned`, a legenda queimada
**Estado: ⬜** procurados ocr, tesseract, burned, burn-in, queimad, detectText: nada; `captions.burn_in` de `redes.json:241` é só uma dica de rede.
- Recebe os blocos (região, cor dominante, intervalo) marcados pela IA numa folha de quadros com grade e mede a presença quadro a quadro só na região; depois do render, conta os quadros que ainda mostram qualquer bloco.
- **Aceite:** num vídeo de fixture com legenda colorida e um letreiro da mesma cor ao fundo, conta zero quadros depois de uma peça que cobre a legenda, e não conta o letreiro.

### T14.3: `capture` grava o design system (`ds.json`)
**Estado: 🟡** o `captura.json` (`lib/capture.mjs:1781-1801`, marca em `:1330-1356`) já traz logo, cores primária, de fundo e de texto com uma paleta (`:1295-1297`) e as famílias de fonte com os `@font-face` (`:1170-1176`, `:1305`). Falta: os arquivos das fontes (as URLs ficam gravadas, mas só imagens são baixadas, `:1406`, `:1429-1452`, e folhas de estilo de outro domínio são puladas, `:1162-1166`); tamanhos e pesos por papel e `letter-spacing` (só `largest_size` e `body_size`, `:1057-1061`); cores de superfície, texto secundário, destaque escuro e borda (o `ad-creatives` hoje deriva superfície e cor apagada sozinho, `pieces.mjs:458-466`); raios (só o do botão, descartado em `brand.cta`, `:1088`, `:1343`), sombras e espaçamento; recortes de componentes, o bloco de preço (preços são só texto, `:1216`, `:1345`), a biblioteca de ícones e a folha.
- Fontes com o arquivo de cada `@font-face` (família, pesos, `letter-spacing` dos títulos), escala de tipos, tokens de cor por papel, raios, sombras e espaçamento.
- Componentes com recorte e estilos: botão principal, cartão, selo, e o bloco de preço da página de planos ou de checkout (preço antigo, economia, preço novo, unidade, botão, garantia).
- Biblioteca de ícones, quando o site usa uma conhecida; a folha dos componentes recortados.
- **Aceite:** sobre o site local da D46, `ds.json` traz a fonte própria com o arquivo, as cores por papel e o bloco de preço com os quatro números que a página mostra.

### T14.4: runtime da fala
**Estado: ⬜** nenhum dos dez componentes existe; a API pública de hoje está em `runtime/motion.js:307-313`. Há `seekVideo` e `loadVideo` (`:224-235`), sem prazo próprio: um `seeked` que não chega vira `browser_timeout` de 30 s. O navegador roda com `--mute-audio` (`browser.mjs:117`), então o som da peça vem só do `mix`. `Motion.SAFE["9:16"]` é 250/500/70/180 (`motion.js:209`), a zona orgânica, não a `ads_meta` (`redes.json:239`: 270/672/65/140).
- `speechFrame`, `captionCard`, `logoSeal`, `matteBase`, `matteFooter`, `coverCard`, `heroCover`, `openToFull`, `screenInsert` e `offerClose`, com as regras das seções 4.2 a 4.7 do documento de entrada e os números da D42; todos leem o `ds.json` e declaram as próprias caixas em `window.boxes(t)`, inclusive `face`.
- A gravação de tela com zoom próprio estabilizada por pontos de referência antes do recorte.
- **Aceite:** uma página de teste com cada componente passa no `accept` atual e nas conferências novas da T14.5, nos dois formatos.

### T14.5: as conferências novas do `accept`
**Estado: ⬜** `--voice` não existe; o papel `face` só entra na área segura (`lib/accept.mjs:195`); as caixas guardam só papel, posição, tamanho, corpo e texto (`commands/accept.mjs:83-100`), e `Motion.domBoxes` também descarta a opacidade. ⚠️ `text_over_text` pede a opacidade no contrato das caixas, o que muda `references/interface.md` e `references/aceite.md` do motor, arquivos da D47.
- `speech_complete`, `cut_inside_word`, `caption_density`, `logo_size`, `face_clear`, `burned_text`, `text_over_text`, a conferência das cores e fontes do `ds.json` e a da capa (olhos abertos e boca fechada pelo `track`); `--voice <voz.wav>` ou o `voz.json` declarado pela página.
- **Aceite:** para cada conferência, uma página ou um vídeo de fixture que passa e um que reprova.

### T14.6: `preview --ui reels|stories|feed`
**Estado: 🟡** no motor, a prévia é só um render com `preview: true` (`render.mjs:492-494`), sem opção de interface (`:46-51`). A página de telefone da prévia do `motion-carousel` desenha a interface do post do Instagram em volta da mídia (`motion-carousel/runtime/preview.html:64-85`), não por cima, e não tem Reels nem Stories; serve de ponto de partida.
- A interface genérica da D44 por cima da prévia, medida pelas zonas `ads_meta` e `ads_meta_feed` de `redes.json`.
- **Aceite:** a folha da prévia com `--ui reels` mostra a base fosca da seção 4.4 sob a coluna de ícones; o arquivo final não muda.

## ÉPICO 15: o tipo `fala` no `ad-creatives` 1.3.0

**Bloqueia:** o ÉPICO 16. Depende dos ÉPICOs 13 e 14.

### T15.1: material e pessoas
**Estado: ⬜** o app não lê vídeo do integrante: `collectAssets` lê logo, até 2 fontes e até 4 imagens de tela (`ads.mjs:732-769`); autorização é só um arquivo existir em `materiais/` para três tipos de prova (`lib/concepts.mjs:96-101`).
- Vídeos em `materiais/` ou links dos posts do próprio integrante; `pessoas.json` pela D39; a pergunta pelos originais sem legenda e sem figurinha logo no começo.
- **Aceite:** um vídeo de terceiro sem autorização dá `consent_missing` em `footage`; com os campos preenchidos, entra.

### T15.2: comando `footage`, o inventário
**Estado: ⬜** (`ads.mjs:1677-1728` não tem `footage`).
- `pesquisa/videos.json` por vídeo: as palavras (`words`), o rosto (`track`), os blocos queimados (`burned`), molduras pretas, flashes, cortes e trechos tremidos, e os instantes de olho fechado e boca aberta.
- **Aceite:** sobre os vídeos da D46, o inventário acha a legenda colorida, a figurinha e o corte de câmera de cada um.

### T15.3: comando `edit`, a montagem
**Estado: ⬜**
- A IA propõe a fala por unidades de raciocínio (seção 4.1); o script confere as regras que dá para medir (corte em pausa de 120 ms ou mais, fade de 20 a 40 ms, nada de fala nos 40 ms em volta de cada corte, última frase completa, fechamento na primeira batida depois do fim da última palavra mais 0,3 s) e grava `voz.json`, `voz.wav` e o texto corrido.
- As três conferências: o leitor cético (D43), o `check-edit` (com a chave) e a energia. Depois, `approve <campanha> fala <conceito>`.
- O corte curto da D45.
- **Aceite:** testes de unidade das regras medidas (um corte dentro de palavra e uma frase final cortada são recusados); caso de avaliação com uma montagem que junta a premissa à conclusão sem a ponte, que a IA precisa recusar pelo leitor cético. ⚠️ Esse segundo caso é julgamento da IA: o script só garante que nenhuma peça sai sem o veredito gravado de cada junção.

### T15.4: `peca.json` v2 e `piece --kind fala`
**Estado: ⬜** `PIECE_VERSION = 1`, duração de 6 a 15 s e só 9:16 (`pieces.mjs:11-13`, `:198`, `:202`).
- Os campos da seção 3.1 do documento de entrada; a legenda gerada das palavras pelas regras da seção 4.3 (sem separar artigo, possessivo ou preposição do substantivo); as telas com `at: auto`; o fechamento com `offer: auto` lido do `ds.json` ou do briefing; a trilha composta para a duração final, com a batida no toque do botão.
- Voz, vídeos de origem e `voz.json` entram no hash da aprovação (invariante 5), e o campo que marca um conceito como `fala` entra no conteúdo aprovado dos conceitos (`concepts.mjs:56-58`); a peça v1 continua igual, e as contas que supõem `duration` e `bpm` fixos (`pieces.mjs:356-377`, `ads.mjs:885-910`, `:1079`) passam a ler a duração da fala.
- A lista dos textos novos da tela volta para o integrante aprovar.
- **Aceite:** testes de `checkPiece` para v1 e v2; uma peça `fala` de fixture monta, e mudar o `voz.json` derruba a aprovação.

### T15.5: prévia e final com o checklist
**Estado: ⬜**
- O checklist da seção 6 dentro do `preview` e do `final`, nos dois formatos; a prévia com `--ui`; a revisão do Gemini (opcional) com cada achado conferido antes de aprovar ou reprovar.
- **Aceite:** a peça de fixture passa em todos os itens nos dois formatos; uma variação com o logo a 60 px reprova em `logo_size`.

### T15.6: `deliver`
**Estado: ⬜** o `deliver` recusa tudo que não passou pelo `final` do próprio app (`ads.mjs:1328-1335`), sobrescreve `entrega/` (`:1337-1343`) e nunca sobe o `-v<n>`, que vem do `concept.version` escrito pela IA (`concepts.mjs:124`).
- Aceita peças `fala`; move a entrega anterior para `entrega/v<n>-anterior/` e sobe o `-v<n>` no nome (D21); aceita uma peça de fora com o relatório do `accept` ao lado.
- ⚠️ `references/interface.md:28` mostra `files[].file` como caminho inteiro, mas o código grava só o nome do arquivo (`ads.mjs:1344`): acertar um dos dois sem quebrar quem lê.
- **Aceite:** duas entregas seguidas deixam `v1-anterior/` e nomes terminados em `-v2`.

### T15.7: skill, referências e guias
**Estado: ⬜** a skill não tem passo para fala (`skills/ad-creatives/SKILL.md:16`, `:28`, `:71`); `references/conceitos.md:13` e `guides/*/usar.md` dizem que a versão com pessoa real "fica como roteiro para ele gravar"; `references/matriz.md:20` promete um caminho que nenhum código faz.
- O processo da seção 5 na skill; `references/fala.md` (método); `conceitos.md`, `matriz.md`, `politica-meta.md`, README e guias pt-BR e en; casos de avaliação; changelog.
- **Aceite:** `validate` sem avisos; o `text-lint` limpo; casos de avaliação novos para inventário, montagem, peça e entrega.

## ÉPICO 16: aceitação do conjunto e fechamento

### T16.1: o teste da seção 9 do documento de entrada
**Estado: ⬜**
- O fluxo inteiro no workspace, do briefing à entrega, com o material da D46, sem nenhum arquivo escrito à mão fora do `peca.json` e do `conceitos.json`, e todos os itens do checklist passando nos dois formatos.
- Os dois casos negativos: a montagem sem a ponte, recusada (caso de avaliação, ver T15.3), e o mix com a voz mais curta, reprovado em `audio_continuity`.
- **Aceite:** a pasta `anuncios/<campanha>/entrega/` com as peças, os relatórios e os nomes, conferida por outra pessoa.

### T16.2: documentos, pacote e entrega
**Estado: ⬜**
- ⚠️ Corrigir `docs/PLANO-ANUNCIOS.md` onde diz que peça com pessoa falando fica fora (`:97`, `:184`, `:187`, `:403`, `:624`, `:691`, `:723`) e `docs/PLANO-VIDEO.md:15` se a D35 for aceita; atualizar `CLAUDE.md` ("Where things stand").
- `npm run ci:verify`, `pack` de cada app, commit pelo operador, tags e rascunhos na plataforma; publicar continua sendo o clique do operador.
- **Aceite:** `npm run ci:verify` verde; cada rascunho na plataforma com o SHA-256 igual ao do `pack`; os sete trechos de `docs/PLANO-ANUNCIOS.md` corrigidos.

## Ordem e caminho crítico

1. ÉPICO 12, sozinho e logo: corrige peças com voz que já existem.
2. As provas T13.1 e T14.1 em paralelo: decidem a D36 e a D37 antes de escrever comando.
3. ÉPICO 13 e as T14.1 e T14.2: liberam o inventário (T15.2).
4. T14.3, T14.4 e T14.5: liberam a peça (T15.4 e T15.5).
5. ÉPICO 15 na ordem das tarefas; a T14.6 antes da prévia mostrada ao integrante.
6. ÉPICO 16.

## Diferente do documento de entrada, e por quê

- **O tempo de cada palavra sai do `whisper` do ffmpeg com as fronteiras ajustadas às pausas, não de alinhamento forçado.** O filtro já vem no programa que o app instala, e a legenda troca nas pausas. Alinhamento forçado só entra se a prova da T13.1 mostrar fronteiras ruins demais.
- **O mínimo do `ds.json` vem antes do runtime da fala.** O documento põe a captura do design system por último, mas os componentes leem dele; o que fica para depois é a biblioteca de ícones e a folha dos componentes.
- **A montagem sem a ponte é recusada pela IA, não pelo script.** Sentido não se mede; o script garante que nenhuma junção fica sem o veredito gravado.

## Riscos

| Risco | Sinal mais cedo |
|---|---|
| O ffmpeg do macOS e do Linux sem o filtro `whisper` | A T13.1 nos três sistemas |
| O detector de rosto lento ou instável no navegador sem janela | A prova da T14.1 |
| Link de post do Instagram exige login para baixar | O primeiro link na T15.1; os arquivos em `materiais/` continuam o caminho base |
| A detecção por cor confunde cenário com legenda | A fixture com letreiro da mesma cor na T14.2 |
| Licença de fonte que não cobre vídeo de anúncio | A pergunta da D40 no primeiro uso real |
| Escopo grande para uma versão só | Cada épico sai num pacote próprio; o `ad-creatives` 1.3.0 só depois dos ÉPICOs 13 e 14 |
| Outra sessão mexendo no motor | Conferir as sessões ativas antes de cada tarefa do ÉPICO 12 e do 14 (D47) |

## O que este plano não cobre e o que não foi verificado

- Nada rodou contra a plataforma, e nenhum vídeo real de anúncio com fala passou pelo fluxo.
- A precisão do `whisper` contra pausas não foi medida (a amostra tinha trilha), nem o filtro no macOS e no Linux (o Docker da imagem Linux não estava ligado).
- O defeito 4 não foi repetido na carga da campanha; as medidas de volume e de microssegundos citadas no documento de entrada não foram refeitas: as reproduções daqui usam arquivos sintéticos.
- O detector de rosto do MediaPipe, a estabilização das gravações de tela e a detecção de legenda queimada não foram provados.
- O download de links do Instagram, a interface atual dos Reels e dos Stories para a D44 e o Scribe da ElevenLabs não foram avaliados.
- Os números da D42 vêm de uma campanha só.
