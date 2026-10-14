# Under the hood

This guide opens up Motion carousel: how a topic becomes a set of videos that fit together, why each rule exists, and what you can ask your AI for beyond the simple request.

## How it works

### 1. The brief and the storyboard

Everything starts from a short brief agreed in the conversation and kept in `brief.md`: topic, audience, promise, tone, slide structure and call to action. From it comes the storyboard (`storyboard.json`), which describes the whole carousel: format, tempo, soundtrack, slide order, how many bars each slide lasts and the sound effects.

The default tempo is 120 beats per minute: a beat lasts half a second, and a bar of 4 beats lasts 2 seconds. A regular slide has 3 bars (6 s). The call to action gets 4 (8 s), so people have time to read and act. At 30 frames per second, each beat falls on exactly 15 frames; at 100 and at 90 beats per minute the math also works out.

### 2. Why whole bars

There is one soundtrack for the whole carousel, cut at the start of each bar: if every slide has 3 bars, slide 3 plays the track from 12 to 18 seconds. Each slice starts and ends on a downbeat, so the loop restarts on the beat and the next slide picks up the music where the previous one stopped. A 6.3 second slice would make the music stumble on every loop.

### 3. Slide roles

| Role | Where | What it holds |
|---|---|---|
| Hook | first | the carousel's cover: a line of 2 to 8 words, on up to 3 lines |
| Point | middle | one idea and a device that proves it: a counter, a bar chart, cards, lines that come back one per beat, or a bouncing ball |
| Photo | middle | an idea with a photo: the background fills the frame, a cut-out sits on top, the text sits on a gradient |
| Call to action | last | the ask, what people get, and a button with the word to comment |

The default is 5 slides: the hook, three points and the call to action. The hook and the call to action can carry a photo too. Each role has a starting template, and the app ships two complete reference carousels: five slides about the gym in February and three slides with photos.

### 4. The cover and the loop

Each slide is a page that can draw any instant of its own loop, always the same for the same instant. That is why the app can photograph a slide frame by frame, at 30 frames per second, and redo one slide without touching the others.

Instagram shows the first frame of each video as its cover until it plays. So every slide is born finished on its first frame: title, text and device in place, nothing on its way in. Motion comes from leaving and returning. The supporting lines leave on the first half beat and come back one per beat, the title leaves near the end and lands back with an impact, the counter disappears and comes back counting, the button shrinks and pops again. On the last frame everything is as it was on the first, so the loop closes without a jump.

### 5. Motion without pauses

Something moves within the first second or two, and no stretch goes past 1.25 s without a gesture (two and a half beats at 120). One gesture at a time, always on the beat, and text never bounces. On the final video, the check warns from 1.5 s of still time. It measures how much the whole screen changes: the background light, the bar ruler and the swipe arrow move all the time, but they don't keep a stretch alive. What does is a large element leaving and coming back, such as the title, a card or the button.

### 6. One color and one accent

One theme per carousel, the same on every slide: background, text, a gray for labels and a single accent. The accent marks only the key word of the title, the slide's device and the continuity marks, such as the bar ruler and the progress pills, which look the same on every slide.

| Theme | Colors | Suits |
|---|---|---|
| noir | near black, ivory text, gold accent, fine grain | strong opinions, provocation |
| cobalt | blue, white text, orange accent | launches, products, energy |
| paper | light background, terracotta accent | teaching, method, calm |
| forest | dark green, lime accent | health, nature, routine |
| mono | black and white | a brand that already has too much color |

The type is one family in two weights. Titles run up to 3 lines, and no text goes below 44 px.

### 7. Music on the beat

The soundtrack is synthesized on your computer, with no third-party music, in five styles:

| Style | How it sounds | Suits |
|---|---|---|
| clean | soft kick, claps, a sparse arpeggio | explainers, tutorials |
| noir | a dark synth bed, a long bass line | strong opinions, provocation |
| upbeat | a kick on every beat, a bright melody | launches, news |
| lofi | a swung beat, vinyl crackle | routine, behind the scenes |
| pulse | one synth pulse per beat | products, technology, data |

The same seed always gives the same track; changing the seed changes the key and the melody, not the style. On top, each slide gets its own effects, one per visible gesture: an impact when the title lands, a tick for each line, a pop for each card. There are 13 types, with balanced factory levels. Each slide is mixed to −14 LUFS, the networks' loudness, with a true peak up to −1 dBTP and no fade at the end, because it loops.

### 8. Look before judging

The AI never calls a slide good without looking at it. Before rendering, it builds a sheet for each slide with one frame per beat and opens the cover at full size. After the final render, it looks at the sheet of the finished video and at a readability test 360 px wide, the size of a phone. It also runs the carousel through a list against generic writing: could the hook belong to any niche? Does a title start with "Discover"? Is there a number without a source? A "yes" means a slide to redo.

### 9. Redo only what changed

The app keeps a fingerprint of every part. Changing a sound effect redoes only that slide's sound. Editing a slide, or an image it uses, redoes its video and its sound. Changing the soundtrack's style or seed redoes the track and the mixes without photographing a single frame. Progress is saved slide by slide: an interrupted render picks up where it stopped, and a half-made slide never counts as done.

## The files inside

Everything for one carousel lives in `carrosseis/<name>/`:

| File | What it holds | Changes |
|---|---|---|
| `brief.md` | the brief | ask freely |
| `storyboard.json` | the storyboard | ask; the AI updates the pages with it |
| `slides/01.html` and so on | each slide: text, positions, colors and motion | ask for text, color, gesture or device |
| `assets/` | the images (each generated one with a `.json` beside it holding the prompt), the logo, your own music | replace a file, and only the slides that use it are redone |
| `out/` | the final slides with sound | what you post |
| `audio/`, `previa/`, `renders/` | the soundtrack and effects, the previews with their contact sheets, the final slides without sound | made by the app |
| `preview.html`, `relatorio.json` | the preview and the latest check | rebuilt on every render and every check |
| `carousel.json`, `motion.js`, `carousel.js` | the record of what has been rendered and the slides' libraries | leave them alone |

The page is what paints the slide. The theme, the seed and the storyboard's lines are copied into the pages when the folder is created; after that, changing a color or a line means changing the page, and the AI keeps the storyboard up to date. Tempo and bars live in both places and change together.

## Advanced requests

- "Use the lofi soundtrack." Or: "Change the soundtrack's seed, I want another take."
- "Leave the first bar without drums, so the hook can breathe."
- "Use my own music, trilha.mp3. It's mine." The app measures its tempo. If it matches the storyboard (within 1.5 beats per minute, or at double or half), the beats line up; if not, the AI adjusts the storyboard and the pages to the measured tempo. If the music ends before the carousel does, the last slides have no music.
- "Start the music at the chorus, 42 seconds in."
- "Use my brand colors: background #0B1F3A, text #F5F5F5, labels #8FA3BF and highlight #FFB000." A custom theme takes these four colors and has to keep the contrast between background and text.
- "Put my logo at the top, in place of the label." As a PNG with a transparent background; the check treats it like text.
- "Make it 3:4." The templates were designed for 4:5, and 3:4 only adds room at the bottom.
- "Give slide 2 four bars." Or: "Change the tempo to 100."
- "On slide 2, a counter up to 1,234 and a chart with these numbers." The numbers come from you. The counter writes numbers in Brazilian format (1.234,5).
- "Start from the ready-made example so I can see how it looks." The app copies the gym example or the photo example.
- "Add motion blur to the final render." It helps when something crosses the screen fast.
- "I want 8 slides." The app takes up to 20; above 7, only when you ask.

## The checks

In the check's summary, ✓ means passed, ✗ failed, △ is a warning and ○ means not measured.

On each slide:

| Check | What it requires | When it doesn't pass |
|---|---|---|
| Page | the slide opens, draws every instant and has a duration | fails, with the error in the message |
| Readable first frame | at least one text of 44 px or more on the first frame | fails |
| Safe area | every text and every logo, at every instant, inside the 72 px margin and clear of Instagram's two corners: the "1/N" counter (170×80 px, top right) and the sound button (100×100 px, bottom right) | fails |
| Text size | the slide's smallest text | fails below 26.4 px; warns below 44 px |
| Loop | the last frame matches the first, with a similarity of 0.985 or more | warns from 0.95 to 0.985; fails below that |
| Flashes | on the final video, up to 3 sudden light changes per second | warns |
| Still time | on the final video, no still stretch of 1.5 s or more | warns and names the stretch |
| Loudness | on the final video, −14 LUFS within 1.5 LU, true peak up to −1 dBTP | warns when the peak is above −1; fails outside the margin or with the peak above 0 |

Before the render only the pages are read, so flashes, still time and loudness stay unmeasured. So do cuts on the beat, because a slide has gestures, not cuts.

For the whole set, it fails on: fewer than 2 or more than 20 slides; a slide shorter than 3 or longer than 60 s; a page that doesn't last the storyboard's bars (within one frame); slides of different sizes; an unreadable cover on slide 1. It warns when the last slide isn't the call to action, or when the carousel runs past 90 s, where few people reach the end.

**When something fails**, the AI fixes the slide, photographs it again and rechecks only what changed, until no failure is left. Still time is solved by moving a large element that leaves and returns into the quiet stretch; failed loudness, by turning down the slide's strongest effects and mixing again. At delivery, the AI reports every item, warnings included. The check measures; whether you like the result is your call.

## The images

Each image comes from the first path available, in this order:

1. **Your own AI**, when it generates images in the conversation.
2. **Codex signed in to your ChatGPT account.** The images count against your plan, with no key, take about a minute and a half each and are made one at a time. If your Codex settings name a model your account doesn't accept, the app tries again with the default model, without changing your settings, and the wait can double. A Codex signed in with an OpenAI API key stays out of the automatic order, because each image would be billed to that key: the AI only uses it if you ask.
3. **The Gemini key**, if you saved one. About 15 seconds per image.
4. **Your own photos**, whenever the subject is you, your product or your place, or when no path above exists. JPEG or PNG, at least 1080 px on the short side; vertical photos work better in 4:5.
5. **No photos:** the graphic style.

Prompts are written in English, which the models understand best, with the same lighting and style words across the whole carousel so the photos look like one shoot. The AI opens every image before using it and asks again when it comes back with a border, text nobody asked for or a deformed hand.

**Cut-outs** of an object are automatic. Codex returns the image with a transparent background; with Gemini, it comes on a flat green that the app removes (blue if the object is green). A whole cut-out usually ends up 60% to 90% transparent: below 30%, the background didn't come off; above 97%, the object went with it, and the app warns. A cut-out person only comes from your own photo with the background already removed, because generating it again would change the face.

**On the slide**, one main photo, no collage. Text sits on a gradient or on the darkened photo, in the theme's text color, never over a face or the cut-out. The background moves a little and the cut-out moves more, which gives depth, and both return to place at the end of the slide. The AI doesn't generate real people's faces, other brands' logos or products, or text inside the image. Generated images may carry an invisible watermark that identifies their origin.

## With other apps

Motion carousel plans: the storyboard, the timing, the files. The Video engine, another flyee.club app, does the rendering. Slide by slide, it opens the page in a windowless browser, photographs the frames, encodes the video, synthesizes the soundtrack and the effects, measures the beats of your own music, mixes at the networks' loudness and checks the result. The slides' `motion.js` library comes from it, with the beat grid and the springs of the motion. When the Video engine is updated, the next render redoes the slides and the soundtrack with the new version.

## Privacy

- **Rendering happens on your computer.** The windowless browser, ffmpeg and the soundtrack synthesis run there, with no internet. The app publishes nothing and sends your files nowhere.
- **Generated images.** Through Codex, the description (and the reference image, if there is one) goes to OpenAI through your account. Through Gemini, it goes to Google with your key. A photo of yours only leaves your computer if it is used as a reference to generate another image.
- **The conversation.** The contact sheets and images the AI opens to judge the slides enter your conversation with it, like any file it reads.
- **The key.** It stays only on your computer, in `~/.flyee/keys.json`, outside every project. It never goes through the conversation and is never written into the project. An environment variable named GEMINI_API_KEY, if you prefer one, takes precedence.
- **The usage record.** When a carousel is done, the AI records with flyee.club that the app was used: the app's name and version, never the content, the text, the images or file names.

## When something goes wrong

- **The Video engine is missing.** Your AI tells you what it does and what it touches and, with your yes, installs it. Without it there is no render.
- **ffmpeg or the browser is missing.** Your AI installs it. On a Mac without Homebrew, or on Linux when it asks for the administrator password, it shows you the one step that depends on you. On Windows, the browser is Microsoft Edge, which comes with the system.
- **The render stopped halfway.** Ask your AI to carry on: finished slides are kept.
- **The preview is silent.** It starts that way, like the feed. Click "Som" (sound) or press M; the arrow keys move between slides.
- **The preview shows an old version.** It shows the latest render, quick or final. Ask for a new render.
- **A line came out smaller than the others.** The line is too long: ask for fewer words instead of accepting smaller type.
- **The music drifted off the beat.** Its tempo is different. The AI adjusts the storyboard to the measured tempo, or you choose another track; if the beat isn't clear, it asks you for the tempo.
- **The cut-out has a green edge or holes.** The AI adjusts the background removal and generates again.
- **Codex hit your plan's limit, or the Gemini key was not accepted.** Wait, take the other path or use your own photos. A rejected key is checked in Google AI Studio and saved again on the page your AI opens, which lasts 15 minutes.
- **The slide looks different on another computer.** The fonts come from the computer that renders: make the preview and the final version on the same computer.
