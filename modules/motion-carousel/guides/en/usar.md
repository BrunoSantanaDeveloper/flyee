# How to use it

Motion carousel makes Instagram carousels where every slide is a short video that loops without a visible jump. Lines land on the beat, a number counts up, cards appear one by one, and the music carries on from one slide to the next. You give the topic. Your AI writes, designs, animates, makes the soundtrack, checks the result and hands you videos ready to post, with a preview of how they look on a phone.

It is for anyone who posts to the feed and wants a carousel that moves: people who teach, launch a course or a product, or argue a point. You don't need to know video editing, and you don't need photos: the slides are made of type, shapes and color.

## Ask like this

- "Make an animated carousel about planning your week on Sunday."
- "Make an animated carousel about why people give up on the gym in February, noir theme, 5 slides."
- "Create a video carousel for the launch of my phone photography course: 4 slides, a blue look, ending with 'comment PHOTO'."
- "Redo slide 3 of the gym carousel with a new line: 'Pain without a scoreboard never becomes a habit'."

## What happens

1. **Your AI checks your computer.** The first time, it looks for everything the app uses. Rendering comes from another flyee.club app, the Video engine: if it is missing, your AI tells you in one sentence what it does and what it touches, and installs it only after you say yes. If ffmpeg (the program that assembles the videos) or a browser to photograph the frames is missing, it tells you and installs it. Microsoft Edge already comes with Windows. You don't type anything. Only when an install needs something only you can give, such as an administrator password, does the AI show you that one step and wait.
2. **It asks what's missing, all at once.** The topic, who it's for, what people take away by the last slide, the tone, the word people should comment at the end and what they get for commenting. It decides the rest and tells you: how many slides (5 by default), the colors, the music style and how long each slide runs. You can change any of these choices.
3. **It writes and designs the slides.** A hook that makes people stop, the points (one idea per slide) and the closing call to action. Before spending time on video, the AI photographs each slide beat by beat, looks at the pictures and checks the feed's measurements. Whatever fails, it fixes.
4. **You see the preview.** The AI makes a quick version at half size and opens a page in your browser that looks like a phone. You swipe through the slides, see the "1/5" counter and turn the sound on with the "Som" (sound) button: the preview starts muted, like the feed. The "Grade" (grid) button shows every slide side by side, playing together. The AI tells you what it saw in the frames and asks what to change before the final version.
5. **It makes the final version.** It renders at full size and checks everything again, now including still stretches, flashes and loudness. It also runs a readability test at phone size. Then it hands over the folder, the videos in order, how to post them, the result of every check and a suggested caption with the call-to-action word.

**How long it takes.** Each slide is photographed frame by frame. Count on about thirty seconds per slide for the preview and a minute per slide for the final version, plus the checks. A busy computer takes longer. If the work gets interrupted, ask your AI to carry on: finished slides are kept.

## No key, no account

Everything runs on your computer: the slides, the soundtrack generated right there, the preview, the checks and the delivery. Nothing needs a key or an account, and rendering doesn't use the internet.

The slides are made of type, shapes and color, in one of five visual themes or in your brand's colors. Your logo can go in: you send the file, and the AI puts it in the carousel's folder. This version doesn't use photos or generated images.

## What you get

Each carousel gets a folder inside your project:

| Where | What it is |
|---|---|
| `carrosseis/<name>/out/` | the final slides (`01.mp4`, `02.mp4` and so on), with sound, ready to post |
| `carrosseis/<name>/preview.html` | the phone-style preview; open it in your browser whenever you like |
| `carrosseis/<name>/brief.md` | the brief: topic, audience, promise, tone, the slides and the call to action |
| `carrosseis/<name>/relatorio.json` | the result of the latest check, slide by slide |
| `carrosseis/<name>/assets/` | what you bring in: a logo, your own music |

The other files in the folder (the storyboard, the slide pages, the soundtrack, the quick previews) are working material: they let the AI redo only what changed.

**To post**, open the Instagram app, pick the files in `out/` in order and publish them as a single carousel. The app never posts anything for you.

## Tips and changes

- **Say who it's for and what they take away.** With a clear audience and promise, the hook comes out stronger than from a bare topic.
- **Give the numbers, if there are any.** The AI only puts numbers on a slide when you gave them or named the source, and it never promises reach or engagement.
- **Ask for changes slide by slide.** "Change the line on slide 3", "I want different music", "make slide 2 longer". Only what changed is redone.
- **Use your own music, if you like.** Put the file in the carousel's folder and say it's yours to use. The AI measures the tempo and fits the slides to it. Only use music you have the right to use in the post.
- **Bring your brand.** Give the colors (background, text and highlight) and send your logo as a PNG with a transparent background.
- **Watch the preview with the sound on.** The checks measure what can be measured. Whether you like it is your call.

## Limits

- The app doesn't post: you do, through the Instagram app.
- A carousel has 2 to 20 slides, and each slide runs 3 to 60 seconds. Three to seven slides is what usually fits one idea.
- The format is 4:5 (1080×1350), the one recommended for the feed. 3:4 (1080×1440) works too.
- The motion is drawn: the app doesn't generate AI video.
- No photos and no generated images in this version: the slides are type, shapes and color, with your logo when you want it.
- The fonts come from your computer: Inter when it is installed, otherwise the system font. On another computer, the same slide may break its lines in different places.
- Sound only plays once a person turns the audio on in the feed. The motion has to tell the story on its own.
- Your AI needs to read images to judge the slides, as Claude Code does.
