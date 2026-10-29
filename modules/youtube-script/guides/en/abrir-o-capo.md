# Under the hood

Ask an AI for a whole script at once and it tends to come out generic, assume things that never happened and turn into an ad when the video shows something of yours. The YouTube script app works in stages to avoid that: the AI writes with you, and nothing goes into the spoken text without a source.

Version 1.1.0 is built for Brazilian Portuguese: the files keep Portuguese names and headings, and the automatic check knows Portuguese phrasing. Reference videos can be in any language.

## How it works

### 1. Your channel profile and your rules

`canal.md` is read before every script. It holds your audience and what they already know, the channel's promise, your formats, your proof, your speaking pace, how you refer to yourself (Portuguese marks gender in words like "cansado" and "cansada") and whether your channel uses YouTube's A/B test.

Your voice is captured with examples, not adjectives: how you address viewers, vocabulary, rhythm, verbal tics, humor, how you open and close, three reference lines from your own material and three lines you would never say. The preferred source is something you wrote, then the speech from 5 to 8 of your videos. For a new channel, it borrows the mechanics of 2 to 4 creators you name, never their content, and flags each borrowed trait ("emprestado de referências, confirme") until you confirm it. Speaking pace is never borrowed: it stays at 180 words per minute until measured from your own videos.

"Regras do criador" (creator's rules) holds the "Nunca dizer" list (never say: exact terms the check blocks), the "Nunca fazer" list (never do: checked by the critique) and your usual ask at the end of a video. "Histórias e opiniões" (stories and opinions) holds how you got started, what you stand for, what bothers you about the usual way and the cases you tell. That is where each script's origin story and opinion come from, with nothing invented. Only you change the profile: the AI shows the line it wants to save and saves it with your yes.

### 2. The brief and the fact sheet

`briefing.md` does the diagnosis before a single line is written: how much the audience already knows (it decides how the video opens), the central idea (if another channel in your niche could record the same script, it's still just a topic), one dominant motive and what the video is worth to someone who never clicks anything. If you only brought a topic, the AI proposes five angles with the strength and risk of each. The app reads two yes/no answers: if something in the video is yours, the check starts looking for ad-like lines; if the result doesn't exist yet, the checklist opens with what you need to do and film first.

When the video shows a tool, a product or a service, the AI reads its sources (official documentation, README, website) and builds the fact sheet in `verdade.md`: what it does, the real steps, how it works inside, the craft rules with their numbers, the limits, the cost, the time and what stays out of the spoken text. Every line about it comes from there, and the critique checks it.

### 3. Research and measured titles

With YouTube research, the AI turns your topic into 3 to 6 searches and finds the outliers: videos that did far better than their own channel's normal. A pattern is something repeated in two or more of them; something seen in only one is a bet, and many videos below normal for everyone means a saturated topic.

Then it analyzes the high-performing titles: the list of those that went furthest above the normal and of those that stayed below, with the traits of each; the triggers (result, curiosity, direct search, contrarian, cost or mistake, experiment, list, comparison); the form (a number, a tool name, parentheses, starting with "Como" (how), a question, first person, "sem X" (without X), a word in capitals, "você" (you), a year); and the words that keep coming back. With your channel read, it does the same on your videos, against your own normal. For each trait and each word you get the median multiplier with and without it and the size of each group. The number shows what went along with the result, never the cause, and a small group is only a hint.

It also reads the speech of 2 or 3 outliers (the opening, the blocks, where they pay off the promise, the most replayed moments) and up to 100 comments per video, sorted into doubts, objections and requests in viewers' own words. A question that keeps coming up and that no top video answered well is the best central idea available. Every fact gets a source and a date: three independent sources that agree let the script state it, two become "according to…", one becomes a caveat or gets cut, and none becomes a mark. Without the app, this stage is skipped and the brief notes that the topic is a bet.

### 4. The reference video

A video that worked, even from another country, shows a flow that already held attention. In `referencia.md`, the AI maps it beat by beat: what the reference does, how it says it (quoted with the timestamp) and how that works in your video, written from scratch with your facts. One part adapts it to your audience (currency, common software, search terms, platform habits) and another lists what's left out (exaggeration, promises that don't hold where you are, invitations to the other creator's community). The copy test happens right in the map. The reference is never named in the spoken text; credit, if you want, goes in the description. You approve the map before the structure.

### 5. Title and thumbnail

Packaging comes first because without the click, the best script is never seen. Titles start from the high-performing ones: the AI reads the list of those that went furthest above the normal on the topic and, once your channel has been read, on your channel, and adapts their mechanism to your way of speaking, copying none. You get five titles from different triggers (result, curiosity, direct search, contrarian, cost or mistake, experiment, list, comparison), each with the measured trigger, trait or word behind it when there's data. The two or three thumbnail ideas have one subject, four words at most and nothing in the bottom right corner, where YouTube shows the length. YouTube's A/B test now compares titles, thumbnails or both and picks by watch time: with it, you get up to three titles and three thumbnails with the same promise, each variant changing one element, always with real frames from the video. Each title and thumbnail pair goes through the click test, and the stage ends with the promise in one sentence and the block where the video pays it off, before the last third. The check reads the chosen title and warns if, by then, the speech hasn't said a number, an acronym or a name it promises.

### 6. Hooks and structure

You get three or four hooks from different families, out of fourteen (result first, contrarian, confession, experiment and others). If you wrote your own, it goes in word for word and is the recommended one when it passes the blind test: does someone who sees only the opening understand what's going on and come away with a question that matters?

The arc: the hook within 30 seconds, the contract (what the viewer gets and why to trust you) by 45 to 60 seconds, 3 to 5 blocks named after results (they become the chapters), a twist after the middle, the promise paid off before the last third and an ending with one ask. The skeleton depends on the type of video; the "tool in use" one, for "how I use X for Y" videos, has 11 beats. With a reference, the map sets the order. Open loops are listed, and each must be paid off. If the result doesn't exist yet, the recording plan comes first, in `gravacao.md`: first it happens, then it gets written.

### 7. Writing

The text is written to be spoken: one idea per sentence, most of them 8 to 20 words, "you" rather than "people", the example before the rule and only experiences you actually told. Every block is fully written. What only you know is a gap in a finished sentence: `[CONFIRMAR: …]` (confirm) for a fact, `[ESCOLHER: …]` (choose) for your decision, `[fonte: …]` (source) for where a number comes from. Production marks like `[TELA 8s: …]` (screen), `[B-ROLL: …]` and `[PAUSA 2s]` (pause) guide recording and editing and are never spoken; a time inside them adds to the length. In a screen tutorial, `[TELA 00:12 a 00:31: …]` ties the words to that stretch of the recording.

Then the spoken text goes through `texto-natural`, the writing review that comes with flyee, to remove what still sounds like AI. Your profile outranks it: your way of talking stays, text you wrote doesn't change, and no fact gets added.

### 8. Check, critique and delivery

The script is only ready when the automatic check finds no blockers. The critique comes from outside: a subagent, a second AI that gets only the video's files, your profile and the check's result, without the conversation. If your AI's tool can't open subagents, the critique is a separate stage that starts by reading only the opening. Both are covered under "The checks".

## The files inside

Everything lives in `roteiros/`: the profile and the topic ideas at the top, and one folder per video.

| File | What it holds | Who changes it |
|---|---|---|
| `canal.md` | profile, voice, pace, rules, stories and opinions | you, or the AI with your yes |
| `briefing.md` | the diagnosis, your answers, what's still yours to say, what the AI decided | the AI; correct an answer that changed |
| `verdade.md` | the fact sheet for each tool or product | the AI, from the sources |
| `pesquisa.md` and `referencia.md` | the topic data and the reference map | the AI; you approve the map |
| `embalagem.md` and `estrutura.md` | titles, thumbnails, hooks and blocks | the AI; you choose and adjust |
| `gravacao.md` | the recording plan and the map of a screen recording | the AI; you carry it out |
| `roteiro.md` | the spoken text, block by block, with the marks | you and the AI |
| `revisao.md` | the check summary, the scores and the rounds | the AI |
| `descricao.md` | the description, estimated chapters and pinned comment | the AI; you fill in the links |
| `checklist.md` | what to film first, every open mark, and what to check and answer when publishing (the thumbnail, the audience, AI use, paid promotion, the A/B test) | generated by the app |
| `roteiro-completo.md` and `roteiro.docx` | everything in one file, and the script in Word with marks in gray | generated by the app |
| `teleprompter.txt` | spoken words only, one sentence per line | generated once no marks are left |

- The AI never deletes what you wrote: it shows the change and only writes over a file with your yes. Older versions can stay as `roteiro-v1.md`.
- The "Nunca dizer" list takes one term per line, in quotes when it has more than one word. In `embalagem.md`, each title is in quotes so it can be measured.
- The Word file is for reading and notes. If you change something there, tell the AI: it carries the change into `roteiro.md` and regenerates the other files.
- `lint.json`, when it shows up, is the check result the critique reads. Partner apps write to `youtube-research/` and `video-analyses/`.

## Advanced requests

- "Build my voice from my channel's videos: (your YouTube @)."
- "My channel is new. I talk a lot like these creators: (the channels)."
- "Follow the flow of this video from another country, adapted for my audience: (the address)."
- "It's a Short." The hook goes in the first second, and the ending can loop back to the start.
- "Just titles and thumbnails" or "just a hook for this video."
- "This topic is trending: only research the last month."
- "I haven't run the test yet. Give me the recording plan first."
- "Decide the rest for me." The decisions are logged in the brief and listed again at delivery.

## The checks

The automatic check gives the same result for the same text every time. It catches patterns and doesn't judge whether a sentence is good: that's the critique's job. Its word lists are in Portuguese; the examples below are English equivalents.

### What blocks

Any of these and the script isn't ready:

- an opening that makes viewers leave, in the first three sentences: a greeting ("hey guys"), a welcome, "in this video I'm going to show you", "before we start", "my name is", "did you know";
- asking viewers to subscribe or like in the opening;
- every open mark, plus leftovers like "TODO" or an empty source;
- a term from your "Nunca dizer" list;
- a guaranteed result with money, weight or health;
- a title over 100 characters, YouTube's limit.

### What warns

Fix it, or keep it and note the reason in the review:

- a sentence over 30 words, a hook longer than 45 seconds (5 for a Short) and a script with fewer than 3 blocks;
- AI-sounding formulas ("let's dive in", "in summary", "so far you've seen", the "X, not Y" contrast) and written-style connectors ("furthermore", "nevertheless");
- a number, a comparison or "studies show" without a source mark;
- "nobody shows this" without saying where you looked ("almost nobody" is an opinion and passes);
- ad lines outside a sponsor block ("coupon", "only today") and, in a video about something of yours, a price, a plan, a version or a store in the spoken text;
- an ending that stops on the goodbye or asks for more than two things;
- a mark standing in for the speech, or a block that is mostly marks;
- an estimated length more than 15% off the plan;
- in a tutorial, speech longer than its stretch of screen;
- a mark left in the description.

### What it only notes

Five or more numbers in one paragraph, a paragraph over 90 words, four very short sentences in a row, a block longer than two and a half minutes, chapters YouTube wouldn't accept (it needs 3 or more, each 10 seconds or longer), a chapter with a working name, screen time with no speech and no cut marked, and a title without quotes.

### The critique

The critique scores nine criteria from 1 to 10. Three are gates and need 7 or more: hook, promise paid off and facts. The other six need 6 or more: structure, flow, spoken style, creator's voice, central idea and value, ending. Scoring starts at 6, and 8 or more is only for work clearly above average. The average decides nothing, and every score comes with the reason and the exact spot.

Seven defects fail a script on their own: an invented fact or experience of yours, a title promise not paid off, an opening that fails the blind test, a promise of a cure or a sure gain, a claim about the tool the fact sheet doesn't support, an ad-like feel in a video about something of yours, and a line that narrates something you haven't lived yet.

The verdict is approve, revise or redo, with required changes kept apart from suggestions. There are two rounds of fixes at most, and each fix is checked by a new critique that didn't see the previous one. If the second round still doesn't approve, the script is delivered as a draft with the defect spelled out: the bar never drops to get a score. For a script written before the result exists, a draft is normal until the marks are filled in.

## With other apps

- **YouTube research**: outliers, measured titles, the speech of videos (yours too, for voice and pace), any channel's normal and the comments, with no key and no paid account. It uses yt-dlp, which the AI installs after telling you.
- **Video analysis**: watches a video without captions and your screen recording, with timestamps and the exact text on each screen.
- **texto-natural**: the writing review that comes with flyee. It works on Portuguese text, and your profile outranks it.
- The fact sheet reads the documentation of any flyee.club app installed in the project that shows up in the video.

Partner apps are installed only with your yes, after the AI tells you what each one declares. Without them you still get the script, minus that data.

## Privacy

- The check and the files the app generates are made on your computer: the app reads your project files, writes to `roteiros/` and doesn't connect to the internet.
- YouTube research runs searches and reads public videos, captions and comments on YouTube itself. It keeps everything in your project and stores comments without their authors' names.
- Video analysis only sends your recording to Google, for Gemini to watch, if you say yes. Otherwise it pulls still images from the recording on your computer and your AI looks at them. If you use a Gemini key, you paste it into a page the AI opens in your browser; it stays on your computer, outside the project.
- Your AI reads the conversation and the files through its own service, as in any work you do with it.
- At the end, the AI records with flyee.club that the app was used: the app's name and version, never the text, the topic or the files.

## When something doesn't go as expected

- **The script never gets to ready.** There are open marks, and the checklist shows each one. Fill them in with the AI and ask it to check again.
- **The teleprompter file won't generate.** It waits for the last mark. The Word file comes earlier, with the marks visible.
- **YouTube didn't hand over a video's speech.** The AI offers three ways forward: you paste the transcript, Video analysis watches the video, or the script goes on without it. It won't try another route on its own.
- **YouTube refused the research.** It usually passes: the AI updates the program that reads YouTube, waits a few minutes and tries again with fewer searches.
- **The length didn't match the recorded video.** Ask the AI to measure your pace from your videos, or tell it how long the video ran and ask it to adjust your profile.
- **The check flags a number that is yours.** Tell the AI where it comes from, and it marks the source.
- **The critique failed the script twice.** The fix is almost always in the angle or the structure, not in the sentences.
