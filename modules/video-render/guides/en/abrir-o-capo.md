# Under the hood

The Video engine from the inside: the stages of a video and the reason for each one, the files, the requests that go beyond the basics and the checks before delivery. Everything runs on your computer, and your AI carries out every step.

## How it works

### 1. A page that draws time

The engine animates nothing by itself. Your AI writes an HTML page that can draw any moment: ask for second 3.5 and it paints exactly what appears there. The engine opens that page in a browser with no window, asks for one moment at a time, photographs the screen and hands the photo to ffmpeg, which assembles the video.

The reason is repeatability. Since every frame depends only on time, rendering twice gives the same video, and changing one line of the page changes only what that line draws. That is why the page uses no clock, no unseeded randomness and none of the browser's own animations; when a video comes out different on every render, the AI fixes the page. A signature of the frames proves that two renders match.

The page also declares where the text, the logo and any face sit at every moment. Those boxes are what the checks use to measure the cover, the safe area and the text size.

### 2. Sound comes before animation

The music is composed before any movement, because its beat grid decides where every cut, entrance and hit lands. There are two kinds of track, both made in code on your computer, with no third-party music:

| | Track with an arc | Loop track |
|---|---|---|
| For | a video watched from start to end, such as a 15 to 20 second Reel or an ad | a loop and the slides of a carousel |
| Shape | intro, build, peak and a final hit on the last downbeat | whole bars that repeat with no click at the seam |
| Styles | clean, energetic, warm, minimal, cinematic and playful | clean, noir, upbeat, lo-fi and pulse |
| Tempo | 40 to 220 BPM, 1 to 600 seconds long | 60 to 200 BPM, 1 to 64 bars |

Each track comes with its grid, a file holding the moment of every beat. For the track with an arc, the grid also marks the peak (the drop), where the video puts its biggest change of scene. The same seed rebuilds the same track on any computer.

If you bring your own music, the engine measures its tempo and builds the same kind of grid. The reading comes with a confidence score from 0 to 1; below 0.5, the AI confirms the BPM with you before animating. The sound effects (impact, click, whoosh, bell, typing, camera shutter and more) are synthesized too, each one on a gesture you can see on screen.

### 3. Photographing, frame by frame

The windowless browser can be Microsoft Edge, Google Chrome, Chromium or Brave. It opens with a new, empty profile, without your logins, and that profile is deleted at the end. For a video of 120 frames or more, on a computer with at least 4 cores, the engine splits the work across up to 4 browsers.

For motion blur, the engine photographs 2 or 4 subframes per frame and blends them: whatever moves fast blurs on its own, and whatever stands still stays sharp. That takes two to four times as long to render, so it is saved for the final video.

### 4. Looking before showing

The AI never describes a video it has not seen. To look, it has four tools:

- the preview, a quick render at half size;
- frames at chosen moments, or one per beat, gathered on a contact sheet;
- the strip, 12 consecutive frames around a transition;
- the phone test, one frame per second at 360 px wide.

The work goes in rounds: the AI gives a score from 1 to 10 to the hook in the first 2 seconds, legibility on a phone, the motion, variety, faithfulness to the brand and sync with the sound; then it fixes the three worst problems and re-renders only the affected seconds. There are at least 3 rounds, until every score reaches 8 and the checks pass; if it cannot get there, the AI tells you where it stopped and why.

### 5. The mix

Music, effects and voice go under the silent video, which is copied with no loss of quality. With a voice, the music dips while you speak (10 dB by default) and comes back when you stop. The mix goes through the audio twice: the first pass measures, the second brings the result to −14 LUFS with a true peak of at most −1 dBTP. That is the level YouTube and most players use to even out videos; the other networks do not publish their target, and this level plays at the same volume on all of them.

### 6. Checking and delivering

The checks run on the page, before the final render, and again on the finished video, after the mix. The report is saved next to the video, which the AI opens in your computer's player.

## The animation method

The page follows a method written for short product videos:

- **Springs instead of fixed curves.** What comes in speeds up and settles with weight; text and logos never bounce.
- **An element becomes the transition.** The card becomes the screen, the tag becomes a streak, and the eye always has something to follow.
- **Burst and silence.** Near-still stretches alternate with fast cuts, and the biggest change lands on the peak of the music.
- **Variety.** At least 4 different framings in 15 seconds.
- **Left out:** a centered title over a gradient with everything fading in, particles, lens flares, vignettes, grain and crossfades between chapters.

## The files inside

| File | What it holds | What you can ask for |
|---|---|---|
| `pagina.html` | the scenes, texts, colors, timings and cuts of the video | any change: "replace the title in the second scene", "hold the logo one more second" |
| `motion.js` | the animation library the page uses, copied from the engine | nothing; it comes ready |
| the track (`.wav`) and the grid (`.beats.json`) | the music and the moment of each beat | another style, another tempo or another version; the grid is rebuilt with the track, never by hand |
| the effects (`.wav`) and their list (`.json`) | the sounds and the moment of each one | move, remove or add an effect |
| `previa.mp4` and `quadros/` | the preview and the check photos | nothing; the next round redoes and replaces them |
| the silent video and the final video | the render without sound and the video with the mix | a new render after a change in the page or the sound |
| `.aceite.json` | the check report, item by item, with what to change | nothing; it is the record of what was checked |
| `capturas/`, one folder per website | `captura.json` with the brand it read (name, logo, colors, fonts, buttons, numbers, prices and social links), desktop and phone screens, the full page, the recorded scrolls and the logo | a fix for anything that came out wrong: give the right color or send the logo, and the AI uses what you said |

If a file already has the name the engine is about to write, it is replaced; the AI picks the names and warns you before overwriting a page of yours.

## Advanced requests

**Formats**

- "Render the same page in 9:16, 4:5, 1:1 and 16:9 and show me a sheet of each." The page recomposes its layout for each format instead of being cropped. The named formats are 9:16 (1080×1920), 4:5 (1080×1350), 3:4 (1080×1440), 1:1 (1080×1080) and 16:9 (1920×1080); a custom size such as 720×1280 works too.
- "Make the cover: the frame at second 0 as a PNG, at Reels size." A 9:16 video shows cropped to 4:5 in the feed and to 1:1 on the profile grid, so what matters sits in the center.
- "Render only from second 4 to second 8" or "at 60 frames per second" (the engine takes 1 to 120).

**Networks**

- "Check it for Reels, TikTok and Shorts." With several networks, the largest margin on each side wins, and a video that passes fits all three.
- "This video is a Meta ad." Ad interfaces cover more than regular posts, up to 672 px at the bottom, and the AI designs for that area from the start.

**Music and effects**

- "A track with an arc, cinematic style, at 100 BPM, 20 seconds long."
- "A noir loop, 8 bars at 120 BPM, with no drums in the first bar."
- "A steady bed with no peak, to sit under my voice."
- "Another version of the same track" or "a track in A minor".
- "An impact when the title comes in, a whoosh at every scene change and typing sounds while the text appears."
- "Use this song, which I have a license for, and put the cuts on its beats."

**Voice and loudness**

- "Put my narration on top and lower the music while I talk."
- "Bring the music down 3 dB and the effects up."
- "End the music with a half-second fade." In a loop, the track ends dry so it joins the start.

**Picture and delivery**

- "Make a transparent layer of the animations so I can put it over my own footage in my editor." It comes out as .mov (ProRes 4444) or .webm (VP9), which keep transparency.
- "The file is too big for TikTok: render a smaller file." Stronger compression shrinks the file with almost no visible change.

**Website capture**

- "Capture my brand's website without recording the scroll" or "without downloading the logo".
- "Capture it with the phone at 430 px wide." The phone goes from 280 to 1080 px (390 by default); the desktop, from 800 to 3840 px (1440 by default).

## The checks

The checks measure what usually goes wrong without showing in the preview. Each item comes back with a mark: ✓ passed · ✗ failed · △ warning · ○ not measured. "Not measured" means the item was missing what it needs: the page, the video, the beat grid, a request to check the loop, or sound.

| Item | What it measures | Passes | Warns | Fails |
|---|---|---|---|---|
| Page | it opens, draws every moment, declares its length, accepts the format and throws no error | all good | not applicable | any problem; the checks stop there |
| Cover | the first frame has text at the minimum size | 44 px or more in a 1080-wide frame | not applicable | no text, or smaller text |
| Safe area | text, logo and face clear of the network's buttons and captions | everything inside, with 1 px of slack | not applicable | something outside, with the moment and how many pixels |
| Text size | the smallest text in the video | the minimum or more | between 60% of the minimum and the minimum | below 60% (26.4 px when the minimum is 44) |
| Cuts on the beat | each cut against the nearest beat | all within 1 frame (33 ms at 30 frames per second); for a video without its page, 70% within 2 frames | not applicable | fewer than that |
| Loop seam | how alike the last frame and the first are | 0.985 or more | 0.95 to 0.985 | below 0.95 |
| Flashes | sudden changes of light in any 1-second window | up to 3 | more than 3 | never |
| Dead time | stretches where the picture does not change | under 1.5 s | 1.5 s or more | never |
| Loudness | integrated loudness and true peak | −14 LUFS, with 1.5 LU of slack, and peak at most −1 dBTP | right loudness, peak between −1 and 0 dBTP | loudness out of range, or peak above 0 dBTP |
| Format, per network | whether the network takes the format | takes it, and it is the one it recommends | takes it, but recommends another | does not take it |
| Length, per network | the length against the network's minimum, maximum and recommendation | within the recommendation | above the recommendation | below the minimum or above the maximum |

A few details matter:

- **The minimum text size grows with the frame width.** It is 44 px at 1080 wide and 78 px in a 1920-wide 16:9, which shows at phone width in the feed; for big screens (YouTube on a computer or a TV), the AI uses 26.7 px at 1920.
- **The safe area depends on the destination.** On Reels, the interface covers 250 px at the top, 420 at the bottom and 180 on the right; on TikTok, 160, 400 and 160; on Shorts, 230, 500 and 170. On an Instagram carousel, there is a 72 px margin and two reserved corners: the "1/N" counter (170×80 px, top right) and the sound button (100×100 px, bottom right).
- **Flashes and dead time only warn.** More than 3 flashes per second are uncomfortable and, in some people, trigger seizures. Two still seconds in a vertical video and the thumb scrolls on. Text being typed and a slow zoom count as movement.

**When something fails.** The AI applies the fix the item suggests, renders again and checks again. A warning does not fail the video: the AI tells you what it saw and you decide. You can choose to post with a failed item; the AI delivers it telling you which item and why, and never calls a failed video ready without saying so.

### The networks it checks

| Network | Format | Accepted length | Recommended |
|---|---|---|---|
| Instagram Reels | 9:16 | 3 s to 3 min | up to 90 s |
| Instagram Stories | 9:16 | 1 to 60 s | up to 15 s |
| Instagram feed | 4:5 (also 1:1 and 16:9) | 3 s to 15 min | up to 60 s |
| TikTok | 9:16 | 3 s to 10 min | up to 60 s |
| YouTube Shorts | 9:16 (also 1:1) | 1 s to 3 min | up to 60 s |
| YouTube | 16:9 | 1 s to 12 h | no recommendation |
| LinkedIn | 9:16 (also 4:5, 1:1 and 16:9) | 3 s to 10 min | up to 90 s |
| X | 16:9 (also 1:1 and 9:16) | 0.5 s to 2 min 20 s | up to 60 s |
| WhatsApp Status | 9:16 | 1 to 60 s | up to 30 s |
| Kwai | 9:16 | 3 to 60 s | up to 30 s |
| Meta ads (Reels and Stories) | 9:16 | 1 to 60 s | up to 15 s |
| TikTok ads | 9:16 | 5 to 60 s | up to 34 s |

The table was checked against public sources on October 7, 2026; where a value could not be confirmed, it uses the most cautious one. When the file goes over a network's upload limit, the checks warn you. If you name no networks, a finished video is checked against the usual ones for its format: 9:16 against Reels, TikTok and Shorts; 4:5 and 1:1 against the Instagram feed; 16:9 against YouTube.

## With other apps

- **Video studio.** Makes animated videos for Reels, TikTok and Shorts from your request. It asks the questions, writes the page with your brand and uses the engine to capture the website, compose the music, render and check.
- **Motion carousel.** Makes Instagram carousels with a short looping video on every slide. It uses the engine to render and check each slide, against the carousel area and the loop seam, and to generate one loop track for the whole carousel, with each slide playing its own stretch.

Each app keeps what it makes in its own folder in your project, outside the engine's install folder, which is replaced on every update; within the same interface version, an engine update only adds things. If the engine is missing, your AI tells you what it will be able to do on your computer and installs it once you say yes. Without it, the other app hands you the page and tells you what the engine would do with it.

## Privacy

The engine runs on your computer and sends no files anywhere. It only goes online in three situations:

- **When it captures a website.** The windowless browser visits the address you gave and downloads images only: the logo, the icons and the share image, up to 10 MB each. Nothing from your computer is sent, and nothing from the website runs outside the browser.
- **When rendering, only if the page itself uses something from outside**, such as a web font.
- **When installing programs.** ffmpeg, and Chromium on Mac and Linux, come from your system's package manager.

After a task, the AI records on flyee.club that the app was used: the event name, the app and its version, the flyee versions on your computer and whether the project is yours or a client's. Files, texts, paths and project names never go. The record waits in a queue, in a file in the flyee folder, which the AI can open for you.

What never leaves your computer: the pages, the videos, the tracks, your voice, the captures and the reports.

## Common problems

| What happens | What to ask your AI |
|---|---|
| The video comes out different on every render | "Make the page predictable: no clock, no randomness and no browser animations." |
| Blank frames, or the page threw an error | "Show me the page's errors and fix them." |
| The font looks different on another computer | "Put the font files next to the page." |
| The website blocked the capture | Send the screens yourself, or ask to "capture another address on the same site". |
| The address has no website yet | Send the logo and two or three images. A "coming soon" page is captured with a warning: confirm that the logo and colors are yours. |
| The beat reading of your music was uncertain | Give the BPM if you know it, or ask to "use an original track instead". |
| Rendering takes too long | Use the preview for adjustments and keep motion blur for the final video. |
| No browser on Windows | Microsoft Edge comes with Windows: check that it is installed. |
| The install needs you (an administrator password on Linux, a missing Homebrew on Mac) | The AI shows the single step and waits. Afterwards, ask it to "check again what is missing". |
