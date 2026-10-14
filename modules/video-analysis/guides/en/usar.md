# How to use it

Video analysis watches a video for you, picture and sound, and gives you a timed description: what appears on screen, what is said, the text that pops up, the cuts and the editing style. Use it to study a reference video, turn a lesson into notes, or find out what a video shows without sitting through all of it. It works with YouTube videos, videos from other sites and files on your computer.

A transcript only gives you the speech. It leaves out the demo on screen, the chart nobody reads aloud, the caption that stays up for two seconds, the reaction of the person on camera. This app's description has a section just for that, "Only in the picture", and every point comes with its time.

You can use it on its own, by asking your AI. Other flyee.club apps use it too: YouTube script, for example, calls Video analysis to read a video that has no captions and to write the narration over your screen recording.

## Ask like this

Paste the link or name the file along with your request:

- "Analyze this video and tell me what shows on screen beyond what is said", with the YouTube link.
- "Study the editing of this reference video: cut rhythm, captions, transitions and music."
- "Pull out the slides and the code shown in this lesson: lessons/module-3.mp4"
- "Analyze only minutes 10 to 15 of this video."
- "In the video you analyzed, what was written on screen around the two-minute mark?"

## What happens

1. **Your AI checks the computer.** The app relies on two programs: ffmpeg, which reads the video, and yt-dlp, which downloads videos from the web. They are usually installed along with the app, once you say yes. If one is missing, your AI tells you in a sentence and installs it on its own, which can take a few minutes. In rare cases the system needs something only you can do, such as the administrator password on Linux; your AI shows you that single step.
2. **The video gets watched.** In local mode, the app downloads the video, measures cuts and silences and builds image grids; your AI looks at every grid, in order, reads the speech and writes the description. In Gemini mode, Gemini watches the video and the app saves the description. If the video is a file on your computer, your AI asks first whether it may send it to Google.
3. **You get the summary.** Your AI shows the summary, the highlights of what only the picture shows and where the description was saved. From there, ask anything about the video: the answers cite the times and, when a detail is missing, your AI looks at the exact frame.

How long it takes depends on the length of the video and on your connection. Downloading and measuring a short video is quick; your AI then needs a little longer to look at the images and write. For a long video, it may suggest working in parts.

## What you get

Everything stays in your project, in the `video-analyses/` folder, with one subfolder per video:

| File | What it holds |
|---|---|
| `descriptions/` | the descriptions, one per focus or question |
| `transcript.md` | the speech with times, when the video has captions |
| `index.md` | the reading guide your AI follows in local mode |
| `analysis.json` | the measured data: cuts, shots, silences and frames |
| `media/` | the frames and image grids |

The downloaded video is deleted at the end unless you ask to keep it. A video that was already analyzed is not analyzed again: the same request, from you or from another app, gets the saved description right away.

## The two modes

**Local mode, no key.** The app downloads the video, takes frames at every scene change, measures cuts and silences and builds image grids with each frame's time. Your AI looks at the grids, reads the speech and writes the description. This uses a little of your AI plan: a few images per video.

**Gemini mode, with your Google key.** Gemini watches the whole video, with sound, and the app writes the description in the same format. Public YouTube videos are read straight from YouTube, with nothing downloaded. Once the key is saved, the app picks on its own: Gemini for YouTube, local mode for everything else. If Gemini fails, the app carries on in local mode and tells you.

Without the key, everything works in local mode: the description, the three focuses, questions, extra frames and the cut and silence measurements. The key adds the whole video with sound (music and sound effects as well as speech) and reads public YouTube videos without downloading them. It also spares your AI plan and gives you a way out when YouTube refuses a download.

### Turning on Gemini mode

Ask your AI: "turn on Gemini mode for video analysis". It shows you the Google AI Studio address, https://aistudio.google.com/apikey, where you create the key with your Google account. Google does not charge for it in ordinary use. Your AI then opens a page in your browser: paste the key there and click Save. The key is stored only on this computer, outside your projects, and every flyee.club app that uses the same key finds it there. It never goes through the chat. If you paste the key into the chat by mistake, delete it in Google AI Studio and create a new one.

## Tips

- **Say what to look for.** "Study the editing" gets you the hook, cut rhythm, framing, captions, transitions, music and a list of what to reproduce. "Pull out the slides" or "the steps of this lesson" gets you slides, code, diagrams and every step shown on screen. Otherwise the description is general: what the video shows and says, moment by moment.
- **Ask about a moment.** Give the rough time. Your AI answers from the description and, if a detail is missing, looks at the frame from that instant.
- **Ask for a part of a long video.** "Only minutes 10 to 15" gives a more detailed analysis, because the frames are concentrated there.
- **Have the captions in a file?** Put the .srt or .vtt file in the same folder as the video, with the same name. The speech then goes into the description with its times.
- **To start over**, ask "redo the analysis". To keep the downloaded video, ask "keep the video".

## Limits

- In local mode, your AI sees frames, not the motion between them. Anything it infers about that gap is marked "(likely)".
- In local mode, the speech comes from the video's captions or from a caption file next to it. Without captions, the description says the audio was not transcribed. Gemini mode listens to the sound.
- The app does not identify people by their face. A name only appears when it is spoken, written in the video, or comes from the title or the channel.
- Private, members-only and age-restricted videos need a login. In those cases, hand over the video file instead.
- Live streams only after they end. Playlists, one video at a time.
- By address, Gemini only reads public YouTube videos. Unlisted videos are downloaded and uploaded.
- Google limits each key: requests per minute and, in ordinary use, hours of YouTube video per day. When the limit runs out, the app tells you and carries on in local mode.
- YouTube sometimes refuses automatic downloads. Your AI updates yt-dlp, which usually fixes it; if not, use Gemini mode or the video file.
- Downloading YouTube videos may go against YouTube's Terms of Service. Prefer videos you have the right to use, or Gemini mode. Use the analyses to study and draw ideas from, not to republish other people's content.
