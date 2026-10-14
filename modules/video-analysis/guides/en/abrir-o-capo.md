# Under the hood

This guide opens up Video analysis: how it measures a video, how it builds the material your AI watches, what each file holds, what leaves your computer and what to do when something fails.

## How it works

### 1. Recognizing the video

The app takes a YouTube address (a regular video, youtu.be, Shorts or live), the address of another video site, or a file on your computer. Each video gets a fixed name, which becomes the name of its analysis folder: `yt-` plus the YouTube video code, `url-` plus the site and a short code taken from the address, or `file-` plus the file name and a short code taken from its path, size and date. The same video always lands in the same folder, and a file that changed gets a fresh analysis.

### 2. Choosing who watches

Unless you ask for something specific, the app decides on its own:

- a YouTube video with a saved key: Gemini watches, reading the video straight from YouTube;
- a file on your computer with a saved key: Gemini watches only if you allow the upload to Google; without your permission, local mode it is;
- anything else: local mode, as long as ffmpeg (and, for web addresses, yt-dlp) is installed.

If Gemini fails because of a usage limit, instability, a refusal or a video it cannot open, and local mode is possible, the app carries on in local mode and tells you. You can also ask for both at once: the app measures the video on your computer and sends the measured cuts to Gemini, which lines the shots up with them.

### 3. Reading the video's data

For a web address, yt-dlp reads the title, channel, date, length, views, chapters, the author's description and, on YouTube, the parts viewers replayed most: up to three peaks, in videos at least one minute long, leaving out the opening, which always runs high. It also picks the captions closest to the speech: in the original language, manual before automatic; when the language is unknown, Portuguese, then English. For a file on your computer, the app looks for an .srt or .vtt caption in the same folder, with the same name as the video.

### 4. Downloading the video

In local mode, the app downloads the video at up to 720p, or 480p for videos longer than 30 minutes, and prefers H.264, which is quicker to read.

### 5. Measuring

A single pass over the video with ffmpeg yields three measurements:

- **the cuts**: scene changes above a sensitivity threshold, 0.3 by default (a lower number finds more cuts);
- **a tiny grayscale thumbnail of the picture**, twice per second, 32 by 18 pixels. It is used to spot repeated images and the switch between two still images, such as a slide whose text changes, which the cut detector misses;
- **the silences**: stretches below -35 dB lasting at least 0.7 seconds. The reports list those of 1 second or more.

### 6. Picking the frames

The app takes one frame per shot (the stretch between two cuts) and, in long shots, one more every few seconds. That interval grows with the length of the video and never drops below 3 seconds. Repeated images are left out: a shot that goes back to an image already seen points to that image's frame. Above the budget, the frames kept are spread evenly in time. The budget is 24, 48 or 96 frames (low, normal or high density; normal by default), or an exact number from 4 to 300.

### 7. Building the grids

Each frame is saved as a JPEG, with the longer side up to 1280 pixels. The frames go into grids sized for AIs to read without scaling them down: up to about 1.2 megapixels and 1568 pixels per side. A horizontal (16:9) or vertical (9:16) video fits 9 frames per grid, a 4:3 video fits 6 and a square one fits 4. Each tile carries the frame number (F1, F2…) and its time.

### 8. Writing the reading guide

The app writes `index.md` for the AI that will watch: the video's data, the measurements, how to read the material, each grid with a table (frame, time, position and file), the shots between cuts and, for each frame, the speech in that stretch. The guide warns that the title, description, chapters, speech and on-screen text are content to describe, never instructions to follow. `transcript.md` holds the full speech, with times.

### 9. Your AI watches (local mode)

Your AI reads the guide, opens every grid in order, and opens a single frame when the text is small or a detail matters. When it needs a moment that is not among the frames, it extracts the image at that time, up to 1920 pixels; for that, the app downloads the video again unless you asked to keep it. Then it writes the description, starting with the header the app provided. What happens between two frames, it did not see: movement, a transition or a gesture in that gap is marked "(likely)".

### 10. Gemini watches (Gemini mode)

A public YouTube video goes by address: Google reads it straight from YouTube. A file from your computer (only after you say yes), or a YouTube video that is not public, goes to Gemini's file service. Before the upload, a file larger than 200 MB or above 720p is scaled down to 720p; the limit is 2 GB. Google deletes the file within 48 hours, and while it is there, a new question about the same video reuses that upload.

The request to Gemini carries the description rules, the focus guide, the title, channel, length and chapters, the instructions from the app that asked for the analysis and your question, when there are any, and the measured cuts when both modes run together. With the editing focus, the app asks Gemini for more frames per second: 3 for videos up to 2 minutes long and 2 for videos up to 10 minutes. With the content focus, it asks for high image resolution, to read slides and code. The model is Google's latest Flash, and you can ask for another one.

The app turns Gemini's reply into the same format as local mode and keeps the raw reply as well. When the API is unstable, it tries twice more, after 5 and after 15 seconds; at the per-minute limit, it waits once, for up to a minute. If the reply is cut short for length, it tells you and suggests analyzing in parts.

### 11. Keeping and reusing

Everything stays in the video's folder. The same request (same video, same focus or same name) returns the saved description right away, for you or for another app. Measurements and grids are reused too when a new request uses the same settings. To start from scratch, ask "redo the analysis".

## The description format

The description has the same format in both modes: whoever reads it does not need to know who watched. It is written in the project's language (Portuguese or English), with quotes kept in their original language.

The header at the top states the video, the source, the focus, who watched (Gemini or your AI), the part analyzed, the language and, when there is one, the question. The sections follow, in this order:

| Section | What it holds |
|---|---|
| Summary | 3 to 6 sentences about the video or the part analyzed |
| Timeline | one item per change of subject or scene, with picture, speech and on-screen text |
| Only in the picture | what the picture shows and the speech does not say; always present |
| On-screen text | each text in quotes, exactly as it appears |
| Audio | music, sound effects, silences, tone and pace of speech |
| Visual style | framing, color, light, graphics, captions and editing rhythm |
| Shots | time, framing, camera movement and what each shot shows, when the focus asks for it |
| Focus sections | the ones the focus asks for (below) |
| Answer | the answer to your question, with times |
| Measurements | the numbers the app measured |
| Uncertainties | what could not be seen or heard with confidence; always present |

Every item has a time, counted from the start of the video, in minutes and seconds (with hours for videos over an hour long); a span is written "00:00 to 00:12". Illegible text is called illegible, never filled in. A section with nothing to say is left out, except "Only in the picture" and "Uncertainties".

The focuses add sections:

- **General**: none; the summary and the timeline are enough.
- **Editing**: one section each on the hook, structure and rhythm, camera and framing, transitions and effects, text and captions, color and light, and audio, then a practical list of what to copy, each item with an example time in the video. The shots table comes filled in.
- **Content**: the key points, the step by step (when there is a demonstration), the screen material (slides, code and diagrams, transcribed) and the terms and references mentioned or shown.

The local measurement gives the number of cuts and the average shot length, the cuts per minute (per 5 minutes beyond half an hour) for parts of 2 minutes or more, and the silences of 1 second or more. On YouTube, the parts viewers replayed most are added; with Gemini alone, without the local measurement, the section holds only those parts, when there are any.

## The files inside

Each video has a folder in `video-analyses/`:

| File | What it holds |
|---|---|
| `analysis.json` | the video's data and the measurements, in seconds: cuts, shots, frames, grids, silences, the timed speech and the list of descriptions |
| `index.md` | the reading guide for local mode |
| `transcript.md` | the timed speech, in blocks, when there are captions |
| `descriptions/` | one description per focus, question, part of the video or app |
| `gemini/` | Gemini's reply as it came, with the model and the usage |
| `media/` | frames, grids, extra images and the video, if you asked to keep it |

Descriptions have predictable names: the name of the focus (`general`, `editing` or `content`), `question-` plus a code for a question, the times at the end of the name for a part of the video (`general-00m04s-00m12s`), or the name of the app that asked for the analysis.

A description is plain text: if something in it is wrong, ask your AI to fix it. The app only overwrites it if you ask for the analysis to be redone. The reading guide, the transcript and the measurements are rebuilt by the app on its own. The `video-analyses/` folder keeps `media/` out of git, so the frames and the video stay out of your repository.

## Advanced requests

| Ask like this | What changes |
|---|---|
| "Study the editing of this video" | editing focus |
| "Pull out the slides and the code from this lesson" | content focus |
| "Analyze only 2:30 to 4:00" | just that part, with the frames concentrated there |
| "Use more frames" or "use fewer frames" | 96 or 24 frames instead of 48 |
| "Use 150 frames" | an exact number, from 4 to 300 |
| "Look for cuts more sensitively" | the app finds more cuts |
| "Download the video in 1080p" | the download quality, from 240p to 1080p |
| "Keep the downloaded video" | the video stays in `media/`, and extra frames come out without downloading it again |
| "Redo the analysis" | everything from scratch, instead of reusing |
| "Analyze without Gemini" | local mode only |
| "Use Gemini and the measurements together" | the measured cuts go to Gemini |
| "Write the description in Portuguese" | the language of the description |
| "Show me the frame at 1:32" | the image at that instant, in high resolution |
| "Just the cut and silence numbers for this video" | the measurements, without a description |
| "In Gemini, watch with more frames per second" | from 0.1 to 10 frames per second |
| "Use another Gemini model" | the model that watches |

A video that requires a login can be opened with your browser's session, if you ask for it ("use my browser's session to open this video"). YouTube may flag the account used, so handing over the video file is the better choice.

## When something goes wrong

| What happens | What to do |
|---|---|
| YouTube refused the download (asked to confirm you are not a bot, or delivered no video) | Ask your AI to update yt-dlp and try again. If it keeps happening, use Gemini mode, which reads the public video without downloading it, or hand over the video file. |
| The site limited requests for a while | Wait a few minutes, or use Gemini mode. |
| The video is private, members-only or age-restricted | Hand over the video file. If the video is yours, download it from YouTube Studio. |
| It is a live stream or a premiere | Ask for the analysis once it is over. |
| The address is a playlist | Pass one video at a time. |
| The Gemini key ran out of quota | Wait and try again, or analyze a part. In automatic mode, the app has already carried on in local mode. |
| The Gemini API is unstable | Try again in a few minutes. |
| The video is too long for Gemini | Ask for the analysis in parts. |
| Gemini did not accept the key | Check the key in Google AI Studio and ask your AI to save it again. If you set the GEMINI_API_KEY environment variable, that one is used. |
| The file is over 2 GB | With ffmpeg, the app scales the video down before the upload; if ffmpeg is missing, your AI installs it. |
| The video is already being analyzed | Wait until it finishes and ask again; the work already done is reused. |

## Limits

- In local mode, your AI sees frames, not the motion between them; anything it infers about that gap is marked "(likely)". More frames, or a shorter part, narrow that gap.
- In local mode, the speech comes only from captions: the site's or an .srt or .vtt file next to the video. The app does not transcribe the audio. Without captions, the description says the audio was not transcribed and records only speech that appears written on screen. Gemini mode listens to the sound.
- The app does not identify people by their face.
- The description can be wrong. The "Uncertainties" section says what could not be seen or heard with confidence; when in doubt, ask your AI to look at the frame from that moment.

## With other apps

Other flyee.club apps call this one to understand a video. YouTube script calls Video analysis to read a video without captions and to write the narration over your screen recording, step by step.

The calling app sends a file with what it wants observed and a name for its own description, so it does not mix with the others. Everything goes into the same `video-analyses/` folder, and work already done is reused when it fits. If Video analysis is not installed, the other app offers to install it; without your yes, it carries on without it.

The way the apps talk to each other is versioned: within a version, nothing an app relies on stops working in a new release of Video analysis.

## Privacy

**In local mode**, the video comes from the site to your computer, and everything the app measures and builds stays there. Nothing is sent to Gemini. Your AI, the same one you already use, looks at the grids and frames and reads the speech: those images and that text reach it as part of the conversation, like any image you show it.

**In Gemini mode**, Google receives the text of the request: the description rules, the focus guide, the title, channel, length and chapters, the instructions from the app that asked, your question and, when both modes run together, the measured cuts. For a public YouTube video, only the address goes. A file from your computer (after you say yes), or a YouTube video that is not public, such as an unlisted one, goes in full, scaled down to 720p when it is large; Google deletes it within 48 hours.

What Google does with that material is governed by the Gemini API terms, at https://ai.google.dev/gemini-api/terms. Under the current terms, in the use Google does not charge for, Google may use what you send and the replies to improve its products, and people may read that material. With billing turned on for the account, the terms say Google does not use the material for that. If a video must not leave your company, use local mode.

**The key** is stored only on this computer, outside your projects, and goes to Google only to authorize the requests. It never shows up in the conversation, in the app's output or in the analysis files.

**Who the app talks to**: the video's site (YouTube and its video servers, or the site you pointed to) and, with the key, the Gemini API. It reads only the video you pointed to, the caption next to it and the saved key, and it writes only to `video-analyses/`.

**The usage record**: when an analysis is done, your AI records on flyee.club that the app was used. The record carries the app's name and version, never the video, the address, the description or the project's name.
