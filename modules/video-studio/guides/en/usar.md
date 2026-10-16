# How to use it

Video studio makes vertical animated videos for Reels, TikTok and Shorts. You say what you want to promote and your AI handles the rest: it asks only what is missing, fetches your brand's real logo, colours and screens, writes the storyboard, composes original music and hands you a video that is ready to post and already checked against each network's rules.

## Who it is for

Anyone who needs to promote a product, a service, a sale or an app and does not want to commission an animation for every post. You get a 6 to 20 second video at 1080×1920, made of moving text, screens of your product, numbers you have already published and sound in rhythm. Every cut lands on a beat of the music.

The music is composed on your own computer, with nothing licensed from third parties, so the video can go out as a regular post or as a paid ad.

## Ask like this

Ask the way it comes to mind. The more your request says, the fewer questions you get, and a complete request gets none at all.

> "Make an animated video."

> "I want a 15-second Reel introducing my clothing shop."

> "Make a list of 5 mistakes that stain your teeth, for my clinic's profile."

> "Make a step by step of how to book an appointment in our app: download the app, pick a time and confirm with your name."

> "A 20-second Reels ad for Loja Aurora, lojaaurora.com.br: wool coat for R$ 199 until Sunday. Open with 'Winter is here. So is wool.' and close with 'link in bio'."

> "Launch video for my booking app, meuapp.com.br. Open with 'No more spreadsheets'. Show: booking a slot, automatic reminders and paying by phone. Close with the logo and the address."

## What happens on your side

**The conversation.** With a complete request, the AI tells you in one sentence what it is going to make and starts. With an almost complete one, it asks three questions at most and moves on. With a short one, like "make an animated video", it runs up to three quick rounds:

1. The video: which brand it is for, what it should do, where you will post it and how long it runs.
2. The story: what the video promotes, which storyboard, which three things to show (or, in a step by step, which steps) and whether there is a number that proves it works.
3. The feel: what viewers should feel at the end, the style, the sound and how the video closes.

Each round has four questions at most, each with ready-made options. Answer only what you care about. "You decide" closes the round with the defaults, and "you decide the rest" covers every round still to come.

**The visit to your site.** Between the first and second rounds, the AI visits the brand's site and brings back the logo, colours, fonts, screens and published numbers. It takes a minute or two, which is why the next questions already mention your own products and wording. If the brand was found by name only, or the site calls itself something else, the AI asks you to confirm it before going on.

**The plan.** After the rounds, the AI writes out the whole plan for the video and waits for your yes before building it. A complete or almost complete request skips this stop: the opening sentence already stated the plan, and you can change anything at any time.

**The preview.** You get a phone-sized draft with sound that opens in your video player. Before showing it, the AI looks at the frames itself and fixes what it finds wrong. Along with it come the texts that appear on screen, with the source of every number. The final video is only made after your yes. If you say "go straight to the final, no need to show me", the AI still makes the preview and checks the frames, then carries on to the final without stopping.

**The final video.** It comes out at 1080×1920, with the sound at the loudness the networks use, plus a cover image and posting notes. The AI opens the video for you and tells you what the checks found.

**The programs.** The app uses ffmpeg and a browser that runs without opening a window. On Windows, Microsoft Edge is already there; on Mac and Linux, the AI installs Chromium if there is no browser. The rendering is done by another flyee app, the Video engine. If a program is missing, the AI tells you in one sentence and installs it. If the Video engine is missing, it tells you what that app declares and installs it after your yes. It all happens in the chat, and you never type a command.

**The time.** Allow 10 to 15 minutes until the preview of a 15-second video, and a few more for the final. The AI gives you an estimate before it starts. The work runs on your AI plan, since your AI is the one writing, looking at the frames and fixing.

## What you get

Everything lives in the `estudio-de-video/` folder of your project, one folder per video, for example `estudio-de-video/loja-aurora-oferta/`. Inside it:

| Folder or file | What it holds |
|---|---|
| `entrega/` | the final MP4, the cover (`capa.png`), the posting notes (`notas.md`) and the check report |
| `previa/` | the preview with sound and a sheet with one frame per beat |
| `briefing.md` | the video plan, with where each decision came from (what you said, what came from the site, what is a default), written when the AI shows you the plan |
| `roteiro.json` | the scenes, texts and timings, which the AI edits when you ask for changes |
| `materiais/` | the files you want in the video |

The notes tell you where and how to post on each network, suggest a caption built only from what is in the video, say where the music came from and list what is still your call before publishing.

Outside the video folders sit `estudio-de-video/marcas/`, with the saved brand, and `capturas/`, with the screens copied from the site. From the second video of the same brand on, nothing about the brand is asked again.

## Tips for a better result

- Give the brand's site, its @ or just its name. If the address is already written somewhere in your project, the AI finds it on its own.
- Put in the materials folder whatever the site does not show. A good logo (SVG, or PNG at least 200 px tall) goes with "logo" in its file name. Screenshots of pages behind a login go with "tela" or "print" in the name. Product photos are used in file-name order: 1-coat.jpg, 2-boots.jpg. Ask the AI to open the folder for you.
- Give real numbers. Prices, deadlines and results only appear if you state them or if they are published on the site. Without real proof, the video shows no proof.
- Your own music only goes in if you hold the rights to use it in posts and ads.
- Never put passwords or documents in the materials folder.
- Watch the preview calmly. The checks measure readability, the safe area, rhythm and loudness; whether you like the result is up to you.

## How to ask for changes

Talk to it the way you would talk to whoever edited the video:

> "Change the opening to 'Winter is here. So is wool.'"

> "The price scene goes by too fast. Give it more time."

> "Use the vitrine style."

> "Drop the music and keep only the sound effects."

> "Pick up the shop video where we left off."

Any change to text, timing or music produces a new preview, which you see before the final. If you change an answer after approving the plan, your yes still stands and the next preview already shows the change. To pick up another day, just ask: the AI resumes where it stopped.

## Limits of this version

- Vertical animated videos only (1080×1920), from 6 to 20 seconds. A longer request comes out at 20.
- The app does not edit your recordings, does not generate scenes or people and does not deliver other formats. If you ask, the AI explains and offers the animated video instead.
- It does not watch reference videos yet. The AI asks you to say in one sentence what you like about one and picks the closest style.
- Screens behind a login only get in through your screenshots.
- It needs an AI that can read images, because the AI looks at the frames to judge the video.
- It speaks Brazilian Portuguese: the questions, the plan and the posting notes are written in Portuguese, and numbers and prices follow the Brazilian format (R$ 199,90).
- The app does not post anything. You post through each network's own app.
