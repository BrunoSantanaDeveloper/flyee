# How to use it

The YouTube script app writes the script for a video with you: the title, the thumbnail, every spoken word and the description. It is for people who make YouTube videos, talking to the camera or showing their screen, long videos or Shorts, on a brand-new channel or one with years of uploads. The words sound like you, and every number has a source. Before you hit record, the text gets a review. Your AI does the work; you answer and decide. Version 1.1.0 is built for scripts in Brazilian Portuguese (more on that under Limits).

## Ask like this

Say it to your AI the way you'd say it to a person:

- "I want to record a 10-minute video on how I prep a week of lunches without getting sick of them. Can you help me with the script?"
- "I want a video in the style of this one, but on my topic: (paste the video's address)"
- "What should I record for my channel this week?"
- "Improve this script before I record it: (paste the text or say where the file is)"
- "I recorded my screen for a tutorial. Write the narration over the recording."
- "I'm going to try sleeping 8 hours a night for 7 days. Give me the script for the video."

## What happens

1. The first time, your AI builds a profile of your channel. It asks short rounds of questions, four at most, each with a suggested answer: who you talk to, what the channel promises, your usual format, the proof you have and what you ask viewers for at the end. Your voice comes from something you wrote, from the speech in your videos or, for a new channel, from the way 2 to 4 creators you name talk, always asking "do you talk like this?". It also asks what you never say on camera, how you got started and what you stand for. All of this carries over to later videos.
2. For each video, it only asks what's missing: the topic, who it's for, the length, the proof you have, whether anything in the video is yours, whether the result already exists and whether there's a reference video. When the video shows a tool or a product, the AI reads its documentation and writes a fact sheet of what it really does. No line of the script goes beyond it.
3. With the YouTube research app, it finds the videos on your topic that did far better than their own channel's normal, measures which title traits go along with those results and reads what viewers ask in the comments. If you brought a reference video, it maps what that video does, beat by beat, and shows you before moving on.
4. Title and thumbnail come before the words. You get five titles of different kinds, each saying which data it came from, and two or three thumbnail ideas (three variants if your channel uses YouTube's thumbnail test). The AI says which one it would pick and why, and you choose.
5. Then come three or four hook options and the blocks of the video, each with a name and a time. If you wrote your own hook, it goes in word for word as one of the options. You adjust them before any text is written. When the video shows something that hasn't happened yet (a test, a recipe, an app in use), you get a recording plan first: you do it and film it, and the words are written around what actually happened.
6. The AI writes the hook and the first block and shows you. You react ("shorter", "I wouldn't say it like that") and it carries on block by block. Anything only you know is marked inside the sentence with a `[CONFIRMAR: …]` tag (Portuguese for "confirm") instead of being made up.
7. Before you record, the script goes through a pass that removes the AI feel, an automatic check and a critique with fresh eyes. The check catches openings that make viewers leave, sentences that run too long, numbers without a source, the words you never say and lines that sound like an ad. The critique gives scores and separates what must change from what is only a suggestion. Changes go in when you say yes.
8. At the end you get the description with chapters, a checklist of what to do before publishing, the full document, the script as a Word file and, once no marks are left, the teleprompter text.

Data comes from the YouTube research app, and reading videos from the Video analysis app. If one of them is missing, the AI tells you in one sentence what it does and installs it only if you say yes. Without them you still get the script, just without that data.

Research takes 1 to 10 minutes, and the AI warns you first. Installing a partner app can take a few minutes the first time. The rest moves at the pace of your answers. If you say "decide the rest for me", the AI keeps going, notes every decision and lists them at the end, but it won't invent facts: whatever only you know becomes a mark, listed at delivery.

## What you get

Everything goes in the `roteiros/` folder of your project (Portuguese for "scripts"): your channel profile, and one folder per video. File names are in Portuguese:

| File | What is in it |
|---|---|
| `canal.md` | the channel profile: audience, voice, stories, opinions and your rules |
| `briefing.md` | what the video is, who it's for, what it must prove and what the AI decided for you |
| `embalagem.md` | titles, thumbnails and the video's promise |
| `estrutura.md` | hooks, timed blocks and the moments that hold attention |
| `roteiro.md` and `roteiro.docx` | the script, also as a Word file |
| `revisao.md` | the critique's scores and what changed |
| `descricao.md` | the description, with everything you used and the chapters |
| `checklist.md` | what to do first, what to fill in and what to check before publishing |
| `roteiro-completo.md` | everything in one file, to read or send to whoever edits |
| `teleprompter.txt` | only the spoken words, one sentence per line |

Depending on the video, you'll also see the fact sheet (`verdade.md`), the research (`pesquisa.md`), the reference map (`referencia.md`) and the recording plan (`gravacao.md`). When you ask what to record, the topic ideas go in a file named `pautas-` plus the date.

## Tips

- The best source for your voice is something you wrote, like an old script or a long post. One paragraph you rewrote yourself is worth more than three transcripts.
- When something doesn't sound like you, say how you'd put it. If the correction applies to every video ("I never say guys"), the AI shows you the line it will add to your rules and saves it only when you agree. Corrections and opinions you sign off on stay in the profile for the next videos.
- Bring proof: numbers you measured, cases, screens, your own stories.
- If the video shows something you made, sell or earn from, say so. The script then talks like someone who built it and is showing it: one sentence of disclosure, no prices in the spoken text and the link in the description.
- In Portuguese, some words change with the speaker's gender ("cansado" or "cansada", tired). Tell the AI which form is yours; without that, the script avoids those words.

## Limits

- Language: the app is built for Brazilian Portuguese. Reference videos can be in any language, and the AI can follow the same steps in another language, but the check only recognizes Portuguese openings, AI phrasing, ad lines and claims, and the final writing review is made for Portuguese. Sentence length, timing, chapters, titles, open marks and your never-say list are checked in any language.
- It doesn't make anything up. A number, case, result or story of yours only goes in if it came from you or from a cited source. Anything missing is marked, and the script is only ready when every mark is filled in.
- It doesn't narrate what hasn't happened. For a test or a demo, you do it first and the words come after.
- Length is an estimate based on your speaking pace. Until it's measured from your videos, the app assumes 180 words per minute. Chapter times are estimates too: check them in the edited video.
- It doesn't record, edit or publish the video. Thumbnails come as ideas, not as images.
- Measured titles show what went along with videos that did well, never the cause. Nobody outside YouTube knows how the algorithm weighs things, and the app promises no views.
- If YouTube won't hand over a video's speech, the AI tells you and asks whether you'll paste the text, whether it should use Video analysis or whether to go on without that video.
