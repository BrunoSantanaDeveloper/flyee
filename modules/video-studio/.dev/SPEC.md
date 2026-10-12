# video-studio 1.0 — build spec (operator material, never ships)

App: `modules/video-studio` (slug `video-studio`, title "Estúdio de vídeo" / "Video studio", type `workflow`, trail `divulgar`). Skill: `skills/motion-video/SKILL.md` (1.0). 1.1 will add `skills/edit-video` and more; nothing in 1.0 may block that.

## 0. What 1.0 does

The member asks their AI for an animated video ("Faça um vídeo animado", or a full brief like the Notion prompt). The app:

1. measures how complete the request is (completo / parcial / vazio) and asks only what is missing: 0 questions for a complete request, at most 3 for a partial one, a guided brief of up to 3 rounds × 4 questions (12 max) for an empty one, with a "decida por mim" exit in every round;
2. captures the brand (logo, colours, fonts, real screens, products, published numbers) through the Motor de vídeo's `capture`, keeps a brand kit, and asks to confirm a brand found only by search or with low confidence;
3. writes the complete brief back ("Vou fazer assim: …") and, on the guided path, waits for the yes;
4. drafts `roteiro.json` (scenes on a beat grid) from one of four story templates, builds `pagina.html` from the template, makes the music (arc) and the effects, renders a phone-size preview with sound, runs the Motor's checks, and waits for the preview yes;
5. renders the final 1080×1920 video, mixes at −14 LUFS, checks it again, writes the cover and the delivery notes.

Scope 1.0: motion from scratch only, vertical 9:16 (1080×1920), 6–20 s, no keys, networks Reels / TikTok / Shorts. Requests to edit a recording, to generate scenes with AI, for other formats or a reference video get a plain answer about what this version does and the offer of the animated piece (1.1 adds them). The reference question exists in 1.0, with named styles; a link in 1.0 is acknowledged and the member is asked to describe in one sentence what they like in it (1.1 studies it with the video-analysis app).

## 1. House rules (every builder)

- Repo rules are in your context (CLAUDE.md, .claude/rules). Authoring reference: `docs/COMO-CRIAR-UM-APP.md`. Everything under `modules/video-studio/` except `tests/` ships to members and is read by their AIs: plain pt-BR, no internal names (never Claude, Anthropic, HyperFrames, Remotion, Puppeteer, Playwright, GitHub, "operador", "repositório"), no links the platform did not give, no install commands (`winget/brew/apt/pip/npm install`) and never "no seu terminal": `npm run validate video-studio` refuses them. Programs are installed by the AI with `npx flyee need <programa> --yes --json`; other apps with `npx flyee add <app> --yes --json`.
- Zero npm dependencies, Node 20+ APIs only, ESM `.mjs`. Windows first: `path.join`, `spawn` with argument arrays and no shell, no PATH assumptions; must also work on macOS and Linux.
- CLI convention (same as `video-analysis`, `video-render`, `motion-carousel`): `node .flyee/modules/video-studio/scripts/studio.mjs <command> [options] [--json]`; only JSON on stdout with `--json`, progress on stderr; errors are `AppError(code, message, fix)` with stable English snake_case codes and pt-BR message/fix; exit 2 for `usage`, 1 for other errors; command/option/field names in English, human text in pt-BR.
- This app never imports another app's code: copy what you need (e.g. `video-render/scripts/lib/util.mjs`) into `video-studio/scripts/lib/`. It talks to the Motor only through `.flyee/modules/video-render/scripts/render.mjs <command> --json` as documented in `modules/video-render/references/interface.md`.
- **Ownership.** Touch only the files your task lists, all under `modules/video-studio/`. Never edit anything in `modules/video-render/`, `modules/motion-carousel/`, `modules/video-analysis/`, `packages/`, `docs/`, the catalog or the manifest of another app. Another session owns parts of `modules/video-render`; if you find a bug there, report it in your result, do not fix it.
- `modules/motion-carousel/` is the closest finished sibling (same author conventions, same engine bridge): read it as a reference implementation — `scripts/lib/engine.mjs`, `scripts/lib/project.mjs`, `scripts/carousel.mjs`, `tests/carousel.test.mjs` (fake engine), `runtime/carousel.js` (components) — and mirror its patterns. Do not import from it.
- Generated test media goes to the system temp folder or `C:\Users\tribo\AppData\Local\Temp\claude\c--AppsProjects-flyee\4c649bee-3620-4fa4-929d-3d7b860fadcf\scratchpad\studio\<your-part>\`, never into the repository. Tests: `node --test modules/video-studio/tests/<name>.test.mjs` (node:test + node:assert/strict); tests that need ffmpeg or a browser skip cleanly when missing.
- Real engine on this machine: `node modules/video-render/scripts/render.mjs check --json` (ffmpeg 9 + Microsoft Edge present). Its runtime library is `modules/video-render/runtime/motion.js` (API in `modules/video-render/references/pagina.md` and `motion.md`).

## 2. Files in the member's project

```
estudio-de-video/
  marcas/<marca>/marca.json          brand kit (script-owned), assets/ (logo copy)
  <slug>/
    pedido.json                      the state of this video (script-owned; the AI never edits it)
    briefing.md                      the brief in pt-BR, regenerated from pedido.json
    roteiro.json                     scenes on the beat grid (the AI may edit; the script validates)
    pagina.html                      the video page, built from a template + roteiro.json
    motion.js                        copied from .flyee/modules/video-render/runtime/motion.js
    studio.js                        copied from this app's runtime/studio.js
    assets/                          copies of the brand files the page uses (logo, screens, photos)
    materiais/                       the member's own files (LEIA-ME.txt explains what goes there)
    audio/                           trilha.wav, trilha.beats.json, eventos.json, efeitos.wav
    previa/                          previa.mp4 (540×960 with sound), quadros/folha.png, aceite.json
    entrega/                         <slug>.mp4 (1080×1920), capa.png, notas.md, relatorio.json
capturas/<site>/                     written by the Motor's capture (screens, logo, captura.json)
```

`<slug>`: ASCII kebab-case, ≤ 40 chars, from the brand + kind ("lojax-lancamento"); a taken slug gets `-2`, `-3`. `<marca>`: ASCII slug of the brand name or host.

## 3. `pedido.json` (format_version 1; fields are only ever added in later versions)

```json
{
  "format_version": 1,
  "app": { "name": "video-studio", "version": "1.0.0" },
  "slug": "lojax-lancamento",
  "created_at": "ISO", "updated_at": "ISO",
  "request": "the literal request text",
  "route": "motion",
  "unsupported": [ { "kind": "edit|generated|format|reference_study|long", "evidence": "..." } ],
  "sufficiency": "vazio|parcial|completo",
  "mode": "guided|partial|complete",
  "fields": {
    "<field>": { "value": "...", "source": "pedido|resposta|captura|marca|inferido|padrao", "evidence": "short text: the words matched, the page, the answer" }
  },
  "asked": ["marca", "objetivo"],
  "rounds": [ { "n": 1, "ids": ["marca", "objetivo", "onde", "duracao"], "at": "ISO", "answered": true } ],
  "answers": [ { "id": "objetivo", "value": "vender", "at": "ISO" } ],
  "brand": { "slug": "lojax", "kit": "estudio-de-video/marcas/lojax/marca.json", "found_by": "pedido|projeto|busca|resposta|null", "confirmed": false },
  "approvals": { "brief": null, "preview": null },
  "status": "intake|capture|brief|build|preview|final|delivered",
  "next_step": { "action": "ask|capture|confirm_brand|echo|approve_brief|build|preview|approve_preview|final|deliver|done", "command": "the exact next command for the AI, or null", "say": "one pt-BR sentence the AI can tell the member" },
  "history": [ { "at": "ISO", "step": "intake", "note": "short" } ]
}
```

### Fields (motion route)

| field | values | required for | inferred from the request (examples) | default (source `padrao`) |
|---|---|---|---|---|
| `brand` | `{ name, site, handle }` | all | URL, `@handle`, "da Loja X", "para o Notion"; project `README.md` first https URL / `package.json` `homepage`; a single saved kit | none (question `marca`) |
| `objective` | `apresentar` `vender` `lancar` `explicar` `portfolio` | all | anúncio/promo/oferta/venda→vender; lançamento/novidade/lançar→lancar; tutorial/como funciona/explica/passo a passo→explicar; showreel/portfólio/meu trabalho→portfolio; apresentar/institucional→apresentar | `apresentar` |
| `subject` | free text (what the video promotes) | all | "da coleção X", "do produto Y", price/date phrases | `marca em geral` |
| `destinations` | subset of `reels` `tiktok` `shorts` | — | Reels/Instagram→reels; TikTok→tiktok; Shorts/YouTube Shorts→shorts; "redes"/"stories"→reels+tiktok+shorts (stories noted) | all three |
| `duration` | 6–20 (s) | — | "15 segundos", "15 s", "20s", "de 20 a 25 segundos" (clamp to 20 and note) | 15; 20 when objective = vender |
| `template` | `lancamento` `interface` `oferta` `lista` | story | "lista de estados", "estados da interface"→interface; "3 dicas", "erros", "passos"→lista; preço/promo/desconto→oferta; else from objective (vender→oferta, explicar→lista, others→lancamento) | from objective |
| `points` | array of 2–5 short texts | story | numbered lines, "três recursos: a, b e c", bullet lists | from the capture (section headings) |
| `hook` | text ≤ 6 words | story | a quoted sentence ("abre com '…'"), "gancho: …" | the site's headline, shortened |
| `proof` | `{ text, value, source }` | — | "um número: …", a stated metric | a number published on the site, or none (never invented) |
| `tone` | `confianca` `vontade` `surpresa` `proximidade` | style | sério/profissional→confianca; vende/compra/agora→vontade; impressionante/uau/surpreenda→surpresa; leve/divertido/próximo→proximidade | by objective (vender→vontade, portfolio→surpresa, else confianca) |
| `style` | one of the named styles in `references/estilos.md` (ids: `interface-narra`, `interface-que-se-transforma`, `limpo`, `tipografia-cinetica`, `vitrine`) or `{ reference: url, description }` | style | "estilo Apple"/limpo/minimalista→limpo; tipografia/texto grande→tipografia-cinetica; interface/telas→interface-narra; morph/transforma→interface-que-se-transforma; vitrine/produtos/catálogo→vitrine; a video link → reference | by template |
| `music` | `{ mode: "music|synth|file|none", style, file }` | — | "sem música"/"só efeitos"→none; "minha música" + file→file; "loop"→synth | `music` with a style by tone |
| `closing` | `{ kind: "site|perfil|whatsapp|bio|frase", text }` | style | "link na bio", "chama no WhatsApp", "comente X", a URL | `site` with the brand site, else `perfil` with the handle |
| `skip_preview` | bool | — | "faz direto", "não precisa me mostrar", request starting with `/goal` | false |

"Story fields" = template, points, hook. "Style fields" = tone, style, closing.

### Sufficiency (deterministic, in `lib/intake.mjs`)

- `completo`: brand, objective and subject known (from `pedido`, `projeto` or a kit) AND at least two story fields present in the request.
- `parcial`: brand known AND at least one of objective/subject known AND at least one story field present. (A request with a brand but no story at all is `vazio` for the story: rounds 2 and 3 run.)
- `vazio`: anything else.

Modes: `completo` → `complete` (0 questions; the AI shows the `linha` and starts). `parcial` → `partial` (at most 3 questions in one round, highest priority first: marca > assunto > objetivo > pontos > onde > duracao > som; the rest become defaults stated in the `linha`; no brief approval gate). `vazio` → `guided` (rounds below; then the echo and `approve brief`).

### Guided rounds (each ≤ 4 questions; a question is skipped when its field is known; an empty round is skipped)

1. **O vídeo:** `marca`, `objetivo`, `onde` (multi), `duracao`.
   → then `capture` when the brand has a site.
2. **A história** (options filled from the capture when there is one): `assunto`, `roteiro` (the recommended template first, described in one line), `pontos` (multi, from the site's sections; free text allowed), `numero` (only when the capture found a published number; otherwise asked as "Tem algum resultado que prove que funciona?" with "Não mostrar números" as default).
3. **O jeito:** `sentimento`, `referencia` (named styles; "Tenho um vídeo de referência" → free text link + one-sentence description), `som`, `fechamento` (options only with real data: the site, the handle, WhatsApp only when the capture found a wa.me link, "Escrevo a minha").

Every round shows the line "Responda só o que quiser; o que ficar sem resposta, eu decido pelo que já sei." and `answer <slug> --decide` fills the round's unanswered questions with their defaults (source `padrao`). At most 12 questions in the whole guided path.

### The echo (`brief` command)

`briefing.md` and the returned `echo` text: at most 10 lines, plain pt-BR, in this order: what (duration, format, destinations, brand and site), the goal, the story scene by scene in one sentence each (hook in quotes, the product, the points, the proof with its source page, the closing), the tone and style, the sound, the estimated time to the preview. Then the question `aprovar_briefing`: "Posso construir assim?" with "Pode construir" / "Quero mudar algo (diga o quê)". Changes come back through `answer` (or edits of `roteiro.json` after build).

### `linha` (complete and partial modes)

One sentence ≤ 300 chars: "Vou fazer um vídeo animado de 15 s da Loja X (lojax.com.br), na vertical para Reels, TikTok e Shorts, com o logo, as cores e as telas reais do site, trilha original na batida e, no fim, o logo com lojax.com.br. Prévia em uns 10 minutos." + "Já comecei; se quiser mudar algo, é só dizer." when no questions are pending.

### Questions in the JSON output

Each question: `{ id, field, round, text, options: [{ label, value, description }], default, multi, free_text, free_text_only, note }`. Plus, per round:
- `ask_user_question`: the payload for a structured question tool: `[{ question, header (≤ 12 chars), options: [{ label, description }], multiSelect }]` with 2–4 options each (the recommended option first, its label ending in " (recomendado)"); questions with `free_text_only` are left out of it and listed in `ask_in_text`.
- `chat_text`: the same round as one numbered message with lettered options and "(padrão)" on the default, ending with "Responda só o que quiser mudar (por exemplo, 2b) ou \"ok\" para seguir com os padrões.".

The question texts, options, defaults and conditions live in `references/perguntas.json` (data, pt-BR), not in code.

## 4. `roteiro.json` (format_version 1)

```json
{
  "format_version": 1,
  "title": "Loja X — lançamento",
  "template": "lancamento",
  "style": "interface-narra",
  "format": "9:16", "width": 1080, "height": 1920, "fps": 30,
  "bpm": 128, "beats_per_bar": 4, "bars": 8, "duration": 15,
  "music": { "mode": "music", "style": "energetic", "seed": 7, "file": null },
  "palette": { "background": "#0F0F10", "surface": "#1B1B1E", "text": "#F4F1EA", "accent": "#E8473C", "muted": "#9A9AA0" },
  "fonts": { "headline": "Inter, 'Segoe UI', Arial, sans-serif", "body": "Inter, 'Segoe UI', Arial, sans-serif" },
  "brand": { "name": "Loja X", "site": "lojax.com.br", "handle": "@lojax", "logo": "assets/logo.png" },
  "scenes": [
    { "n": 1, "role": "gancho", "bars": 1, "text": "Roupa de treino que dura", "events": [ { "beat": 0, "type": "impact" } ] },
    { "n": 2, "role": "produto", "bars": 2, "screen": "assets/mobile.png", "text": "Loja X", "events": [ { "beat": 0, "type": "whoosh" } ] },
    { "n": 3, "role": "ponto", "bars": 1, "text": "Linha Easy", "image": "assets/produto-1.png", "events": [ { "beat": 0, "type": "pop" } ] },
    { "n": 6, "role": "prova", "bars": 1, "value": 12000, "prefix": "+", "suffix": " clientes", "text": "clientes", "source": "lojax.com.br (página inicial, 2026-10-07)", "events": [ { "beat": 0, "type": "tick" } ] },
    { "n": 8, "role": "fechamento", "bars": 1, "text": "lojax.com.br", "logo": true, "events": [ { "beat": 0, "type": "impact" } ] }
  ],
  "loop": false
}
```

- Timing: `beat_s = 60 / bpm`, `bar_s = beats_per_bar × beat_s`; scene k starts at `sum(bars before) × bar_s`; `duration = bars × bar_s` exactly. Cuts (`film.cuts`) are the scene starts after the first. An event `{ beat, type, gain_db?, direction? }` is placed at `start + beat × beat_s` (beat may be fractional, e.g. 0.5); event types are the Motor's `sfx` types (`impact`, `kick`, `thump`, `whoosh`, `swish`, `riser`, `click`, `tick`, `pop`, `ding`, `shutter`, `pluck`, `blip`).
- Duration → bars and bpm: choose integer `bars` and `bpm` in [100, 140] so that `bars × 4 × 60 / bpm` equals the requested duration within 0.01 s, preferring bpm closest to 120 (15 s → 8 bars at 128 BPM; 20 s → 10 bars at 120; 6 s → 3 bars at 120; 12 s → 6 bars at 120). When impossible, round the duration to the nearest whole bar at 120 BPM and say so in a warning.
- Asset paths are relative to the page folder (`assets/…`); `build` copies brand files there.
- Roles per template are in `references/roteiros.json` (below). Text limits (validated): hook ≤ 6 words, point ≤ 5 words (+ optional `detail` ≤ 10 words), closing ≤ 6 words.

### `references/roteiros.json` (template specs; data shared by the page templates and the allocator)

```json
{
  "format_version": 1,
  "templates": {
    "lancamento": {
      "label": "Lançamento",
      "description": "o problema em poucas palavras, o produto se montando, três recursos com uma ação real e a assinatura",
      "objectives": ["apresentar", "lancar", "portfolio"],
      "scenes": [
        { "role": "gancho", "bars": [1, 2], "slots": ["text"] },
        { "role": "produto", "bars": [1, 2], "slots": ["screen", "text?"] },
        { "role": "ponto", "repeat": [2, 4], "bars": [1, 1], "slots": ["text", "detail?", "image?", "screen?"] },
        { "role": "prova", "optional": true, "bars": [1, 1], "slots": ["value", "prefix?", "suffix?", "text", "source"] },
        { "role": "fechamento", "bars": [1, 2], "slots": ["text", "logo"] }
      ]
    },
    "interface": { "...": "one container that changes state; roles: logo, estado (repeat 4-10), fechamento" },
    "oferta": { "...": "roles: gancho, produto (photo/screen big), preco (value + old value?), prazo (date/countdown, optional), fechamento" },
    "lista": { "...": "roles: gancho, item (repeat 3-5, numbered), fechamento" }
  }
}
```

The allocator (`lib/roteiro.mjs` → `draftRoteiro`) fills `bars` per scene within each `[min, max]` so the total equals the chosen bars, giving extra bars first to `produto`/`preco`/`fechamento`, never more than `max`.

## 5. The page (`runtime/templates/<template>.html` + `runtime/studio.js`)

- A complete standalone HTML page per template (`lancamento.html`, `interface.html`, `oferta.html`, `lista.html`) that renders ANY valid roteiro of its template. It includes `<script src="motion.js"></script>` and `<script src="studio.js"></script>` (both copied next to the page by `build`) and one data block written by `build`:
  `<script id="roteiro" type="application/json">__ROTEIRO__</script>` (the JSON with `</` escaped as `<\/`).
- The page follows the Motor's page contract (`modules/video-render/references/pagina.md`): `Motion.setup({ duration, width, height, fps, background })`, `window.seek(t)` draws any instant (pure function of time, no timers, no `Math.random`, no CSS transitions), `film.cuts` = scene starts, `window.setFormat` (recomposes for 4:5/1:1/16:9; 1.0 renders 9:16 only but the page must not break), `window.boxes(t)` declares every text (`role: "text"` with `size` in px), the logo (`role: "logo"`) and UI (`role: "ui"`) for the Motor's `accept`. All text, logo and faces stay inside `Motion.safeArea(format)`.
- `studio.js`: a component library over `Motion.*` (canvas 2D): kinetic headline (words in on beats, spring "heavy", fitText into the safe width), card, phone frame with a real screenshot (rounded corners, shadow), cursor that moves along a `Motion.track` path and clicks (scale pulse + ripple) on beats, number counter (rolls to the value over 1 beat, then holds), price tag, list item with index, logo lockup + closing text, background (palette background with a large slow-drifting shape at 3% contrast via `Motion.noise1d`), transitions driven by an element (zoom-through on the hook text, card → full screen, whip with directional motion blur faked by stretched copies), image loading helper (preload all assets before the first seek; `seek` returns a promise when an image is not decoded yet), safe-area helpers. Everything a pure function of `t` and the roteiro.
- Quality bar: these templates ARE the product. Follow `modules/video-render/references/motion.md` (springs, anticipation → burst → settle, the element becomes the transition, one accent, two type roles, banned looks: centered title on a gradient, everything fading in, corner labels, glow on UI, particle bursts, crossfades between chapters). Something new on screen every 2–4 s; frame 0 is already a readable cover (the hook text settled at t = 0 or within the first 0.2 s with frame 0 readable — the Motor's `first_frame_readable` checks it); the last frame holds the closing.
- Missing assets degrade gracefully: no screen → a drawn device frame with the brand colour and the text; no logo → the brand name set in the headline font; no image → a coloured card with the text.

## 6. The script (`scripts/studio.mjs`)

Commands (all accept `--json`; `<slug>` is the folder name under `estudio-de-video/`):

| Command | Does | Returns (besides ok/command/interface_version/app) |
|---|---|---|
| `check` | Motor installed (`.flyee/modules/video-render/scripts/render.mjs`) and its `check` (`modes.render`, `install`); video-analysis installed (for 1.1, informative) | `version`, `features` (1.0 list), `video_render` `{ installed, version, install }`, `engine` (the Motor's check fields), `modes`, `install`, `guides` |
| `intake --request <file> [--slug <s>] [--force]` | reads the literal request (UTF-8 file written by the AI), infers fields, measures sufficiency, finds the brand in the project, creates `estudio-de-video/<slug>/pedido.json` + `materiais/LEIA-ME.txt` | `slug`, `dir`, `sufficiency`, `mode`, `fields` (value + source), `missing`, `unsupported`, `linha`, `round` (null or `{ n, questions, ask_user_question, ask_in_text, chat_text, note }`), `next_step` |
| `answer <slug> <id> <value…>` / `answer <slug> --file <answers.json>` / `answer <slug> --decide` | records answers (option value or free text; multi as comma-separated), recomputes, advances | same shape as `intake` |
| `capture <slug> [--url <site>] [--refresh]` | runs the Motor's `capture` into `capturas/<site>/` (skips when a kit newer than 90 days exists, unless `--refresh`), writes the brand kit, fills inferable fields with source `captura` (headline→hook, sections→points candidates, published numbers→proof candidates, wa.me→closing option, colours/fonts/logo) | `brand` (summary), `kit`, `capture_dir`, `confirm` (a `conferir_marca` question when found by search or with weak signals), `round`, `next_step`, `warnings` |
| `brief <slug>` | writes `briefing.md`, returns the echo | `echo`, `briefing`, `question` (`aprovar_briefing`), `next_step` |
| `approve <slug> brief|preview [--note <text>]` | records the approval | `approvals`, `next_step` |
| `build <slug> [--force]` | drafts `roteiro.json` (if absent or `--force`), copies `motion.js` (from the Motor) and `studio.js`, copies brand assets into `assets/`, writes `pagina.html` from the template with the roteiro, writes `audio/eventos.json` | `roteiro`, `page`, `scenes` (n, role, start, end, text), `duration`, `bpm`, `bars`, `next_step` |
| `preview <slug>` | music (Motor `music` with `--duration` = roteiro duration, `--bpm`, `--style`, `--seed`; `synth` when `music.mode` = synth; the member's file measured with `beats`; nothing when `none`), effects (Motor `sfx --events`), Motor `preview` (540×960), `mix` (music + effects, `--fade-out 0.4` unless loop), Motor `frames --beats` (one per beat → `previa/quadros/folha.png`), Motor `accept <page> --format 9:16 --safe instagram-feed --beats <beats> --video <previa.mp4>` (+ `--networks <destinations>` when the Motor's accept supports it: detect from its `help`/check or a `usage` error and retry without) | `preview` (file), `sheet`, `frames[]`, `accept` (passed, checks), `texts` (every on-screen string with its time and source), `question` (`previa_ok`), `next_step`, `warnings` |
| `final <slug> [--direct]` | refuses without the preview approval (`preview_not_approved`) unless `--direct` or `skip_preview`; Motor `render` (1080×1920, `--sub 2`), `mix`, cover `capa.png` (frame 0 via `frames --times 0`), `accept` with `--video`; writes `entrega/notas.md` (which file goes where, suggested post text, the AI-label/paid-partnership reminders when they apply, music source, what the checks said) and `relatorio.json` | `file`, `cover`, `notes`, `accept`, `loudness`, `next_step` |
| `status <slug>` / `list` | the state and `next_step` (resume after a closed window) / the videos of the project | |
| `open <slug> [previa|final|folha|briefing|pasta]` | opens the file in the member's player/viewer (`cmd /c start "" <file>` on Windows, `open`, `xdg-open`) | `file` |

Stable error codes: `usage`, `file_not_found`, `invalid_json`, `video_not_found`, `video_render_missing`, `video_render_failed`, `runtime_missing`, `request_empty`, `question_unknown`, `answer_invalid`, `brand_unknown`, `capture_failed` (pass-through of the Motor's capture codes), `roteiro_invalid`, `preview_not_approved`, `brief_not_approved`, `exists`, plus the Motor's own codes passed through.

`next_step.command` always holds the exact next command (with `node .flyee/modules/video-studio/scripts/studio.mjs …`), so the skill text stays short and every AI does the same thing.

## 7. Tests and eval

- `tests/intake.test.mjs` (pure): the four canonical requests (below) → sufficiency, mode, number of questions, question ids; answers flow to the echo; `--decide`; unsupported detection; duration/bpm/bars solver; slugging.
- `tests/studio.test.mjs`: the commands in a temp project with a fake Motor (`.flyee/modules/video-render/scripts/render.mjs` that writes stand-in files and returns canned JSON, plus the real `runtime/motion.js` copied) — like `modules/motion-carousel/tests/carousel.test.mjs`.
- `tests/templates.test.mjs`: each template builds a page from a sample roteiro and, when a browser and ffmpeg exist, the real Motor renders 1 s of it at scale 0.25 and `accept` passes `page`, `first_frame_readable`, `safe_area`, `text_size`.
- Canonical requests: R1 "Faça um vídeo animado" (vazio → round 1 with 4 questions); R2 "Faz um vídeo de 15 segundos da lojax.com.br para o Reels" (brand + destination, no story → vazio for the story: round 1 skipped except objetivo/duracao known? objetivo unknown → round 1 asks objetivo only; then capture; then rounds 2 and 3); R3 the Notion-style brief (P3: product + URL, story with 5 numbered beats, 120 BPM music, 16:9 first then 9:16 → completo, 0 questions, `unsupported` notes 16:9 for 1.0); R4 "Quero um anúncio de 20 s da insiderstore.com.br com as peças da coleção, fecha com o link na bio" (parcial → ≤ 3 questions).
- `tests/eval.json` (operator-only): 6–8 cases with prompt, assertions (file_exists) and rubric.
