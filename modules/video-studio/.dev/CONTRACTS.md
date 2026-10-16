# video-studio 1.0 — contracts between the parts (section 8 of SPEC.md)

> Since 1.1.0 (2026-10-16) there are five template specs: `passos` joined the four of 1.0. The rule below holds for every one of them.

Three builders work in parallel against these contracts. They are fixed: build to them, and report (do not silently change) anything you could not honour.

Already on disk, shared and FROZEN (import, never edit):
- `modules/video-studio/scripts/lib/util.mjs`: AppError, usage, parseArgs, parseTime, parseNumber, parseList, formatTime, round, shortHash, sha256File, slugify, toPosix, displayPath, fileUrl, isFile, isDir, readJson, requireJson, ensureDir, writeFileAtomic, writeJson, removeDir, tempDir, run, mapLimit, sleep, progress, projectRoot, resolveInput, seededRandom, clamp, WINDOWS, MAC.
- `modules/video-studio/references/roteiros.json`: the four template specs. A builder may only ADD optional slots and must report it.

## Part A — intake

Files: `scripts/lib/request.mjs`, `scripts/lib/intake.mjs`, `references/perguntas.json`, `tests/intake.test.mjs`.

```js
// request.mjs
export function parseRequest(text)
//  → { fields: { [name]: { value, source: "pedido", evidence } },
//      unsupported: [{ kind, evidence }],
//      signals: { urls, handles, quoted, numbered_lines, video_links } }

// intake.mjs
export function loadBank(appDir)        // reads and validates references/perguntas.json
export function loadTemplates(appDir)   // reads references/roteiros.json
export function newState({ request, slug = null, appVersion, now, project = {} })
//  project = { site: string|null, kits: [{ slug, name, site }] }, found by Part C in the member's
//  project; a single kit or a project site fills `brand` with source "marca" / "projeto"
export function assess(state)           // → { sufficiency, mode, missing: [field], story_present: [field], style_present: [field] }
export function planRound(state, bank, { kit = null } = {})
//  → null when nothing is pending, else
//    { n, title, questions: [...], ask_user_question: [...], ask_in_text: [...], chat_text, note }
export function applyAnswers(state, answers, bank, { kit = null, now } = {})
//  answers = { [questionId]: value } (an option `value`, free text, or comma-separated values for
//  a multi question) → { state, errors: [{ id, code, message }] }
export function decideRound(state, bank, { kit = null, now } = {})   // the pending round gets its defaults → state
export function fillDefaults(state, templates, { kit = null } = {})  // every empty field gets its default (source "padrao" or "captura") → state
export function mergeKit(state, kit)    // capture results into fields (hook from the headline, point candidates,
                                        // proof candidates, closing options), source "captura" → state
export function linha(state, { minutes = 10 } = {})   // the one-line plan (pt-BR, ≤ 300 chars)
export function echo(state, templates)  // → { lines: [...], text, markdown, question: { id: "aprovar_briefing", text, options } }
export function nextStep(state, { scriptCommand })    // → { action, command, say }
export function solveTiming(seconds)    // → { bars, bpm, duration, beat_s, bar_s, exact }
export function slugFor(state)          // ASCII slug ≤ 40 from the brand + template/objective
export const FIELDS, OBJECTIVES, TONES, STYLES, DESTINATIONS, TEMPLATES   // enumerations (ids as in SPEC section 3)
```

`state` is exactly the `pedido.json` object of SPEC section 3. Pure functions: no file writes, no clock (the caller passes `now` as an ISO string), no randomness.

`nextStep` order: a pending round → `ask`; a brand with a site and no kit → `capture`; a brand found by search and not confirmed → `confirm_brand`; guided mode without `approvals.brief` → `echo`, then `approve_brief`; no roteiro yet → `build`; no preview → `preview`; preview not approved (and not `skip_preview`) → `approve_preview`; no final → `final`; then `done`. Part C tells it what exists through `state.files = { kit: bool, roteiro: bool, preview: bool, final: bool }` and `state.status`. `command` is the full command line (`<scriptCommand> <command> <slug> … --json`), or null when the next move is a question to the member.

## Part B — runtime and method

Files: `runtime/studio.js`, `runtime/templates/lancamento.html`, `runtime/templates/interface.html`, `runtime/templates/oferta.html`, `runtime/templates/lista.html`, `references/roteiros.md`, `references/pagina-do-video.md`, `references/estilos.md`, `tests/templates.test.mjs`, `tests/fixtures/roteiros/*.json` (and small test assets under `tests/fixtures/assets/` if needed).

- Each template is a full page with `<script src="motion.js"></script>`, `<script src="studio.js"></script>` and one data block: `<script id="roteiro" type="application/json">__ROTEIRO__</script>`. Part C replaces the literal token `__ROTEIRO__` with the roteiro JSON (with `</` escaped as `<\/`). The page must render ANY roteiro valid for its template per `references/roteiros.json`, and expose `window.film`, `window.seek`, `window.setFormat` and `window.boxes` as SPEC section 5 says.
- `studio.js` defines `window.Studio` with at least: `Studio.load()` (parses the roteiro block, computes the timeline, preloads the images, returns a promise that resolves when the page can draw), `Studio.roteiro`, `Studio.timeline` = `{ scenes: [{ ...scene, start, end, beats }], beat_s, bar_s, duration, cuts }`, `Studio.palette`, `Studio.fonts`, `Studio.style` (the preset for the roteiro's `style` id) and the drawing components. The component API is yours; document it in `references/pagina-do-video.md`.
- Style ids (fixed): `interface-narra`, `interface-que-se-transforma`, `limpo`, `tipografia-cinetica`, `vitrine`.
- Scene timing: `beat_s = 60 / bpm`; `bar_s = beats_per_bar × beat_s`; a scene lasts `bars × bar_s` (bars is a multiple of 0.25); scene k starts at the sum of the previous ones; `film.cuts` = the starts of scenes 2…n; an event `{ beat, type }` of a scene sounds at `start + beat × beat_s` (the page does not play sound; the times matter for visuals that hit with the sound).

## Part C — the script

Files: `scripts/studio.mjs`, `scripts/lib/engine.mjs`, `scripts/lib/project.mjs`, `scripts/lib/brand.mjs`, `scripts/lib/roteiro.mjs`, `tests/studio.test.mjs`, `tests/fixtures/engine/` (a fake Motor for the tests).

- `engine.mjs`: the bridge to the Motor (adapt `modules/motion-carousel/scripts/lib/engine.mjs`): `findVideoRender`, `requireVideoRender`, `engineArgs` builders for `check`, `capture`, `music`, `synth`, `beats`, `sfx`, `preview`, `render`, `frames`, `mix`, `accept`, `probe`, and `runEngine`.
- `brand.mjs`: `kitFromCapture(captura, { foundBy, now })` → the brand kit below; `readKit`, `writeKit`, `listKits(root)`, `findProjectSite(root)` (the first https URL of README.md, or `homepage` of package.json), `kitAgeDays`.
- `roteiro.mjs`: `validateRoteiro(roteiro, templates)` (stable `roteiro_invalid` errors that name the scene and the field), `timeline(roteiro)` (scene starts and ends, cuts, absolute event times), `draftRoteiro(state, kit, templates)` (scenes from the template and the fields; bars allocated within each scene's `[min, max]` so the total equals the solved bars, extra bars going first to `produto`/`preco`/`fechamento`), `eventsFile(roteiro)` (the `{ duration, events: [{ t, type, … }] }` object the Motor's `sfx --events` reads), `onScreenTexts(roteiro)` (every string with its time and source, for the preview message).
- `project.mjs`: the folder layout (SPEC section 2), slugs, `materiais/LEIA-ME.txt`, reading and writing `pedido.json` atomically, `briefing.md`, page building (`__ROTEIRO__` replacement, copying `motion.js` from the Motor and `studio.js` from this app, copying brand assets into `assets/`), `entrega/notas.md`.
- `studio.mjs`: the commands of SPEC section 6, calling Part A for every intake decision and question text.

### The brand kit: `estudio-de-video/marcas/<marca>/marca.json` (format_version 1)

Built from the Motor's `captura.json` (see `capture` in `modules/video-render/references/interface.md`; generate a real one from `modules/video-render/tests/fixtures/site/index.html` to see the exact shape before writing the mapper):

```json
{
  "format_version": 1,
  "slug": "lojax", "name": "Loja X", "site": "https://lojax.com.br", "host": "lojax.com.br", "handle": "@lojax",
  "captured_at": "ISO", "capture_dir": "capturas/lojax-com-br",
  "found_by": "pedido|projeto|busca|resposta", "confirmed": true,
  "headline": "…", "description": "…",
  "colors": { "primary": "#E8473C", "background": "#FFFFFF", "text": "#111111", "palette": [ { "hex": "#E8473C", "role": "botões", "share": 0.08 } ] },
  "fonts": { "headline": "Inter", "body": "Inter" },
  "logo": { "file": "estudio-de-video/marcas/lojax/assets/logo.png", "source": "cabeçalho do site" },
  "screens": { "mobile": "capturas/lojax-com-br/mobile.png", "mobile_full": "…", "desktop": "…", "desktop_full": "…" },
  "sections": ["Linha Easy", "Tabela de tamanhos", "Frete grátis"],
  "products": [ { "name": "Top Fitness", "price": "R$ 199" } ],
  "numbers": [ { "text": "+12 mil clientes", "value": 12000, "page": "página inicial" } ],
  "cta": ["Comprar agora"],
  "social": { "instagram": "https://instagram.com/lojax", "whatsapp": null },
  "sector_cues": ["varejo"], "has_login_area": false,
  "decisions": {}, "warnings": []
}
```

Parts A and B read only `kit.name`, `kit.site`, `kit.host`, `kit.handle`, `kit.headline`, `kit.sections`, `kit.products`, `kit.numbers`, `kit.cta`, `kit.social`, `kit.colors`, `kit.fonts`, `kit.logo` and `kit.screens`; any of them may be missing or empty, and nothing may break when they are.
