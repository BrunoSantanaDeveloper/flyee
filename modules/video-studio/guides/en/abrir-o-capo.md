# Under the hood

This guide opens up Video studio: the stages every video goes through and why each one exists, the files it leaves in your project, the requests that go beyond the basics, the checks, and what leaves your computer. You need none of it to use the app. It helps you understand the result and ask for exactly what you want.

## How it works

Every video goes through the same stages: the request, the questions, the brand, the plan, the storyboard, the preview and the final video. The app records each video's progress and always tells the AI what comes next. That is why the AI picks up where it left off after a break and never skips a stage: the final is refused until the current preview has your yes, unless you asked it to go straight through.

### 1. The request is measured

The AI saves your request word for word, and the app looks in it for the brand, the goal, the subject and three story elements: the kind of storyboard, the points to show and the opening line.

| The request has | What happens |
|---|---|
| brand, goal, subject and two story elements | no questions: the AI states the plan in one sentence and starts |
| brand, goal or subject, and one story element | one round of three questions at most; the rest takes the defaults |
| less than that | up to three guided rounds (the video, the story, the feel), four questions at most in each, and the full plan for you to approve |

Asking what the request already said is tiresome, and building a vague request without asking produces a generic video. The app also never asks what it can find on its own: the site address written in your project's README.md or package.json, and anything about a brand it has already saved.

The questions come ready-made, and the first option of each is the recommended one. Anything left unanswered takes the default: 15 seconds (20 when the goal is selling), all three networks, the feeling that suits the goal, the storyboard's own style, the music that suits the feeling and, at the end, the logo with the site, the @ or "Link na bio". The plan you are shown is kept in `briefing.md`, with where each decision came from.

### 2. The real brand

The Video engine visits the site with a browser that opens no window and copies what is published: logo, colours, fonts, headline, description, phone and desktop screens, products with prices, numbers with the page they came from, calls to action and social links. The studio keeps this as the brand kit in `estudio-de-video/marcas/`, and the full capture stays in `capturas/`.

The app uses only what it captured or what you gave it, because a logo redrawn from memory, a "similar" colour or an invented number make the video look like someone else's. Whatever is missing becomes a warning, never a guess: with no clear accent colour, the video uses a neutral grey; with no logo, it writes the brand name.

The kit is good for 90 days. Within that time, a new video for the same brand does not visit the site again unless you ask. The AI asks you to confirm when the brand was found by searching, when the site calls itself something else or when the page looks temporary. If the site blocks the browser, does not load or is just a parked domain, the video carries on with a neutral look and the AI asks for the logo and two or three images in the materials folder. Your own logo in that folder replaces the site's.

### 3. The storyboard

Every video starts from one of five storyboards, which set the scenes, their order and how long each one can last:

| Storyboard | What for | The scenes |
|---|---|---|
| Launch (lançamento) | introducing or launching | hook, the product assembling on screen, 2 to 4 features, a number that proves it (if there is one) and sign-off |
| Morphing interface (interface que se transforma) | showing how an app or a site works | the brand icon, 4 to 10 states of a single element (button, field, loading, done, card, chart, list, notice, search) and sign-off |
| Offer (oferta) | selling | hook, the product, the price landing on screen, the deadline (if there is one) and call to action |
| List (lista) | teaching or giving opinions in loose points | hook, 3 to 5 numbered items and call to action |
| Step by step (passo a passo) | explaining how something works or how it is done | hook, 2 to 5 steps in order joined by a path that moves forward, the result (when you say what it is) and call to action |

The goal picks the storyboard: selling calls for the offer, explaining for the step by step, introducing and launching for the launch. Tips, mistakes and reasons that do not depend on their order go to the list. The interface comes in when you ask for it or pick it in the question about the story. The material breaks ties: good screens lean towards the launch or the interface, photos with a price towards the offer, no images at all towards the list or the step by step. Each scene takes 4 to 6 words of main text and up to 10 of detail, because on a phone a long sentence only fits in small type. A longer text is refused with the name of the scene and the field.

The first draft comes from the plan and the brand, and every text keeps its source: that is what appears next to each number in the preview. Before rendering, the AI reads the scenes and fixes anything too long or that makes no sense.

### 4. The style

The storyboard says what happens; the style says how it looks and moves.

| Style | What it looks like | Suits |
|---|---|---|
| The interface tells the story (interface-narra) | dark background, real screens inside a phone, a cursor that clicks on the beat, quick cuts | apps, sites, systems, courses |
| Morphing interface (interface-que-se-transforma) | light background, one element changing shape on every beat, no cuts | explaining a short flow |
| Clean (limpo) | the site's own colours, little per scene, calm movement | premium brands, health, professional services |
| Moving type (tipografia-cinetica) | dark background, huge capital letters hitting the screen | lists, tips, videos without good images |
| Shop window (vitrine) | warm light background, the product edge to edge, the price on a plate | shops, food, fashion, offers |

They all use only the brand's colours and fonts, with a contrast of 4.5:1 or more on all running text. If the brand's text colour is unreadable on the background, the page uses near-black or white instead. The logo is never recoloured, rotated or blurred; if it would vanish into the background, it gets a plate behind it.

### 5. Sound on the beat

The video runs on a beat grid, the same one as the music: a tempo between 100 and 140 beats per minute, scenes measured in four-beat bars, and every scene change on a beat. A 15-second video is 8 bars at 128; a 20-second one, 10 bars at 120. A cut that misses the beat is the most common flaw of a rushed video, and the grid rules it out.

The engine composes the music on your computer, at the video's exact length and tempo, in one of six styles (clean, energetic, warm, minimal, cinematic, playful) chosen from the feeling of the video. The sound effects marked in the storyboard move the picture too: on an impact the title lands with a jolt, on a click the cursor presses, on a tick a counter starts rolling.

With your own song, the engine measures its beat and the video follows that tempo, read at half or double speed to stay between 80 and 160 beats per minute. An unclear beat triggers a warning, and a song shorter than the video leaves the end without music. The final sound is mixed at -14 LUFS with peaks below -1 dBTP, and it fades out over the last 0.4 seconds.

### 6. The page and the preview

The video is a web page that can draw any instant of it, written from the storyboard's template and from `roteiro.json`. The engine opens it in a browser without a window, takes 30 frames per second and joins them.

The preview comes out at 540×960 with sound, plus a sheet with one frame per beat. Before showing it, the AI scores that sheet from 1 to 10 (opening, readability on a phone, movement, variety, faithfulness to the brand, sound), fixes the three worst problems and renders again. That makes at least two rounds, until everything reaches 8 or the fifth round, when it tells you what stayed below. The automatic checks measure size, position and timing, but they cannot tell that a sentence makes no sense; the AI sees that, and then you do.

The preview comes with the on-screen texts and the source of each one, sometimes other opening lines taken from the site and, when the request uses words like publi, parceria or collab, the question of whether the video is paid advertising.

### 7. The final video and delivery

With your yes, the final comes out at 1080×1920 with motion blur and is checked again, this time on the file that will be posted. The cover is the first frame. The delivery notes say where to post, suggest a caption (built only from what is in the video), say where the music came from and list what is still up to you: the rights to your own song, an unconfirmed brand, the proof number and its source page, the price and the deadline, your industry's advertising rules (health, dentistry, law, betting, political advertising, children's audiences) and the labels for paid partnerships and AI content, the latter only if you add generated photos or voices. If the video changes after your yes, that yes no longer counts and a new preview comes before the final.

## The files inside

Each video has a folder in `estudio-de-video/` named after the brand and the storyboard, such as `loja-aurora-oferta` (a repeated name gets `-2`). File and folder names are in Portuguese:

| File or folder | What it keeps | Can you ask for changes? |
|---|---|---|
| `pedido.json` | the progress: answers, approvals, history | no: only the app writes to it |
| `briefing.md` | the plan, with where each decision came from | through the chat |
| `roteiro.json` | scenes, texts, bars, effects, tempo, music, colours, fonts and style | yes: almost every change goes through here, and the app checks it again |
| `roteiro.anterior.json` | the hand-adjusted storyboard, kept when the video was rewritten from the plan | lets you recover an adjustment |
| `pagina.html` | the page that draws the video | for fine-tuning one scene; it is rewritten on every rebuild, and the AI pastes the adjustment back |
| `assets/` | copies of the logo, screens and photos in use | no: replace the original |
| `materiais/` | your files and a LEIA-ME.txt | it is your folder; the app only reads it |
| `audio/` | the music, the effects and the beat grid | no: it changes through the storyboard |
| `previa/`, `entrega/` | the preview and the frame sheet; the final video, cover, notes and reports | no: redo it through the chat |

The video folder also holds `motion.js` and `studio.js`, the page's libraries, and `render/`, with silent intermediate renders. Outside the video folders are `estudio-de-video/pedido.txt` (the latest request, word for word), `estudio-de-video/marcas/` (one `marca.json` per brand, with what was captured, the decisions you have already made and the copy of the logo) and `capturas/` (the full capture of each site). To fix the brand for good, ask for a new visit to the site or put the right logo in the materials folder. A video's colours live in its storyboard.

## Advanced requests

Everything is asked in words. The AI turns the request into a storyboard change or an app option and makes a new preview.

| Ask like this | What changes inside |
|---|---|
| "Use the clean style." | the style |
| "Make it a list of five common mistakes." | the storyboard and the scenes |
| "Highlight the word 'family' in the fourth feature." | the highlighted word in that scene |
| "In the third scene, show the pricing part of the site." | how far the site's screen scrolls |
| "Give more time to the item with a detail." | the scene's bars |
| "Make the video faster." | the tempo and, with it, the length |
| "Use calmer music." or "Effects only, no music." | the music |
| "Use my song, it's in the materials folder." | the music becomes your file, and the cuts follow its beat |
| "Use our brand book colours: #1E3A8A and #FFFFFF." | this video's colours |
| "In scene 4, show a before and after in two cards." | the scene's drawing, adjusted in the page |
| "Visit the site again, we changed the logo." | a new capture of the brand |
| "Go straight to the final, no need to show me." | no stop for your yes at the preview |
| "Start this video over." | the video goes back to the start; your materials stay |

Other formats (4:5, 1:1, 16:9) and videos over 20 seconds are outside this version. A project can hold several brands, but for different clients it is better to use one project each, so one client's brand, videos and captures never mix with another's.

## The checks

Before the preview and again on the final, the Video engine checks what can be measured. Each item comes out as ✓ passed, ✗ failed, △ warning or ○ not measured. Sizes refer to a frame 1080 pixels wide.

| Item | The limit |
|---|---|
| The video page | it opens and draws without errors; an error here stops the checks |
| Readable cover | the first frame, which becomes the thumbnail, already has text of 44 px or more |
| Text and logo clear of the buttons | no text or logo in the areas the chosen networks cover with buttons, name and caption |
| Text size | 44 px passes; 60% to 100% of that is a warning; below 60% fails |
| Cuts on the beat | every cut within 1 frame of the beat |
| Flashes | more than 3 sudden light changes in 1 second is a warning, never a failure |
| Still time | 1.5 seconds or more with nothing changing is a warning, never a failure |
| Loudness | -14 LUFS (within 1.5) with peaks up to -1 dBTP passes; a peak between -1 and 0 is a warning; anything else fails |
| Format and length, per network | what Reels, TikTok and Shorts accept and recommend |
| The final file | anything other than 1080×1920, or silent when the storyboard has sound, fails; a length more than 0.15 seconds off the storyboard is a warning |

The checks cannot tell whether the text makes sense, whether the scene looks good, whether the brand is the right one or whether the price still holds. That is for the AI's eye and yours.

When an item fails, the AI does not call the video done. Each failure comes with what to do, and the AI fixes it, renders again and checks again: fewer words rather than smaller type, the text moved back inside the clear area, timings fixed in the storyboard's bars (never in the page), the first scene's text already in place on the first frame. If you decide to post it anyway, the AI tells you exactly what failed. The reports are in `previa/aceite.json` and `entrega/relatorio.json`.

## With other apps

The studio shares the work with the Video engine, another flyee.club app installed in the same project. The studio handles the decisions: the questions, the plan, the brand kit, the storyboard, the page and the notes. The engine handles the machinery: the site visit, the music and effects, the beat of your song, the rendering, the mixing and the checks, the same checks other flyee.club video apps use. If the engine is missing, the AI tells you what it declares and installs it after your yes.

In this version the studio does not call the video analysis app, so reference videos are not watched: the AI asks you to describe one in a sentence.

## Privacy

- The app's only connection is the visit to the brand's site. When you give only the name, the AI searches the web for the official site and shows you the address before using it.
- The app sends nothing from your computer. The music is composed, and the video rendered, mixed and checked, on your machine.
- Your files are read where they are and never changed; the video uses copies.
- There is no key and no outside account in this version.
- Your AI reads the request, your answers, the texts and the frame sheet the way it reads anything you show it, within your AI plan.
- At the end of a video, the AI records with flyee.club that the app was used: the event and the app's name, never the request, the brand, the texts or the files.
- Never put passwords in the materials folder: anything in it can end up in the video.

## Troubleshooting

| What happens | What to do |
|---|---|
| The site blocked the browser, did not load or does not have the brand yet | give another address, or put the logo and two or three images in the materials folder |
| The AI found the wrong brand | say it is not that one and give the right site |
| The logo looks jagged, or the name appears instead of it | put the logo in the materials folder as SVG, or as PNG at least 200 px tall |
| The logo sits on a coloured plate | it has the same colour as the background; send the version for light or dark backgrounds, or keep the plate |
| Screens from inside your system do not show up | the app only sees what is public; add screenshots with "tela" or "print" in the file name |
| The beat of your song is unclear | check the cuts in the preview; if they miss the beat, change the song or use the original music |
| The end of the video has no music | your song is shorter than the video; use a longer one or ask for a shorter video |
| An adjustment made in the page disappeared | the page is rewritten on every rebuild; ask for the adjustment again |
