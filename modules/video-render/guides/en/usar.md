# How to use it

The Video engine turns an animated page into a video ready to post. You describe the video to your AI, and it writes a page that can draw any moment. The engine photographs that page frame by frame, adds original music and sound effects on the beat, checks what each network requires and hands you the file in the format you asked for: 9:16 for Reels, TikTok and Shorts, 4:5 for the feed, 16:9 for YouTube, or a custom size.

It is for anyone who needs short videos that look like their brand without opening an editor: a launch Reel, a feature demo, an intro sting, an animated slide. It can also check a video you already have before it goes out.

## On its own or through other apps

You can use the engine directly, by talking to your AI. Other flyee.club apps also run on it: **Video studio**, which makes animated videos for Reels, TikTok and Shorts from your request, and **Motion carousel**, which makes Instagram carousels where every slide is a short looping video. Those apps write the page and leave the rendering, the sound and the checks to the engine. If one of them needs the engine and it is not installed yet, your AI tells you what it will be able to do on your computer and installs it once you say yes.

## Ask like this

- "Make a 15-second Reel about my product launch, with original music on the beat."
- "Capture my brand's website and use the real logo, colors and screens in the video: mybrand.com"
- "Make a preview and show me the frames before the final video."
- "Put a lo-fi loop on this slide, with a click when the button appears."
- "Render the same video in 9:16, 4:5 and 16:9."
- "Check whether this video works for Reels, TikTok and Shorts."

## What happens

Everything happens in the chat with your AI. It runs every step; you answer and decide.

1. **Your computer, the first time.** The engine needs ffmpeg, the program that assembles the video, and a browser. If ffmpeg is missing, your AI tells you in one sentence and installs it, with your okay. On Windows the browser is Microsoft Edge, which comes with the system; on Mac and Linux, the AI installs Chromium if there is no browser. In rare cases the install needs something only you can do, such as an administrator password on Linux: the AI shows you that single step and waits.
2. **No key.** The engine uses no account or key from any service, so there is no key page to fill in.
3. **The real brand.** Logo, colors, fonts, screens and numbers come from your website, which the engine visits and photographs, or from files you send. Anything that is in neither place, the AI asks you for instead of making it up.
4. **Sound first.** The AI composes the music before animating, because the beat decides where the cuts land. If you bring your own track, the engine measures its tempo; when the reading is uncertain, the AI asks you for the BPM.
5. **The preview.** Before the final video, the AI renders a half-size preview and photographs frames to check the video before showing it to you. If you want to see the preview or the frame sheet, just ask.
6. **The checks.** Before delivering, the engine checks the cover, the text against the network's buttons, the text size on a phone, the cuts on the beat, the loop seam, flashes, dead time, loudness and, for each destination network, the format and the length.
7. **Delivery.** The AI opens the video in your computer's player and tells you where each file is and what the checks found. Each item comes with a mark: ✓ passed · ✗ failed · △ warning · ○ not measured. When an item fails, the AI fixes it and checks again; posting it anyway is your call, knowing what failed.

**How long it takes.** Every second of video at 30 frames per second is 30 photographs, so a 15-second Reel has 450. The time depends on your computer and on what the page draws. The preview comes out faster; the final video with motion blur takes two to four times as long as a plain render. A 45 to 60 second film is another scale: it takes hours, with review rounds, and the AI warns you before it starts.

## What you get

Everything stays on your computer, in the folder the AI picks for the video:

| Where | What |
|---|---|
| the video's folder | `pagina.html`, the page that draws the video, and `motion.js`, the animation library it uses |
| next to the page | the preview (`previa.mp4`) and the final video as .mp4, or as .mov and .webm for a transparent layer |
| `quadros/` | photos of the checked moments and the contact sheet (`folha.png`) |
| next to the finished video | the contact sheet, the phone test and the check report (`.aceite.json`) |
| the folder the AI chooses | the music and the effects (`.wav`), with each track's beat grid next to it (`.beats.json`) |
| `capturas/` | one folder per website, with the brand it read (`captura.json`), desktop and phone screens, the recorded scrolls and the logo |

The music and the effects are generated on your computer, with no third-party music, and can go in posts and ads.

## Tips

- Say which network the video is for right away. The format, the length and the area clear of buttons all follow from it.
- Give the address of your brand's website, or send the logo and images. With real material, the video uses your identity instead of something close to it.
- Ask for the preview when you want a say halfway through. It is there to make mistakes cheap.
- To ask for a change, name the moment and what changes: "at second 3, make the title bigger", "hold the logo one second longer at the end", "swap the music for something calmer".
- Want a different track in the same style? Ask for "another version of the same track". Each version has a seed number, and the same seed rebuilds the same music, so you can always go back.
- On a phone, two short lines read better than one long line. Ask for less text per scene rather than smaller letters.
- If you use your own music, make sure first that you have the rights to use it in the post or the ad.

## Limits

- The engine does not record or create a voice. It mixes in a narration you bring, with the music dipping while you speak.
- It does not create photos or illustrations. It uses your website's screens and images or the files you send.
- It does not post or schedule. It hands you the files, ready to upload.
- Fonts come from your computer. On another machine without the same fonts, the video comes out different.
- The checks measure what can be measured. Whether the video is good is for you to judge, with the AI looking at the frames.
- Networks change their limits without notice. The engine's table was checked on October 7, 2026.
- Some websites block automated visits. When that happens, the AI asks you for the screens. Only capture your own brand's website or one you have the right to use.
- Music from the networks' own libraries cannot go in an exported file: it only works inside the network.
