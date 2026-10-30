# How to use it

YouTube research shows which videos on a topic did far better than their own channel's normal, and by how much. It is for anyone who makes or plans YouTube videos and wants to choose the next topic from demand that has already shown up, with numbers rather than hunches.

A video with 1 million views on a channel that always gets 1 million tells you little. A video with 80 thousand views on a channel that usually gets 8 thousand tells you a lot: the topic, the angle or the title pulled in an audience that would not have come on its own. Those are outliers. The app finds them, and your AI explains why they took off, what they have in common, what is already saturated and what nobody has covered well.

The app can also bring you a video's speech (from its captions, without downloading the video), the most relevant comments, the normal of any channel, yours included, and the analysis of high-performing titles: those that went furthest above the normal, and the triggers and words that go along with the videos that did well, on the topic or only on your channel. It also brings the thumbnails of videos and of your channel, side by side and with how far each video went above the normal, so your AI can see your visual pattern and what repeats in the ones that did well. Everything comes from public YouTube pages, with no key and no login.

You can ask your AI for a search directly. The YouTube script app also uses this one behind the scenes, to research the topic before proposing a video idea, measure titles and read the speech of reference videos.

## Ask like this

- "Research what's working on YouTube about personal finance for freelancers and tell me which video I should make."
- "Which air fryer videos took off in the last month?"
- "What's the normal for my channel @mychannel, and which videos beat it?"
- "Get the speech of this video and show me how it hooks people at the start", followed by the video's address.
- "What does the audience ask in the comments of the biggest outliers from that search?"
- "What kind of title works on this topic? Show me with numbers."
- "Which titles on my channel beat my normal, and what do they have in common?"

A topic, a channel or a video address is enough. If something is missing, your AI will ask.

## What happens

1. **The YouTube reader.** The app reads YouTube through yt-dlp, an open-source program that is usually installed along with the app. If it is missing, your AI tells you in one sentence and installs it after your yes, without you typing anything. If the install needs something only you can do, such as the administrator password, the AI shows you that single step.
2. **Your request.** The AI checks the topic, the audience, the format (long videos or Shorts) and the time window: the last month for something trending, the last year (the default) for an evergreen topic. If something is missing, it asks once, with all its questions together.
3. **The search.** The AI turns the topic into 3 to 6 searches (the technical term, the everyday term, the audience's pain point, the question they would type), and the app measures the normal of every channel it finds. It takes one to ten minutes, depending on the searches and channels, and the AI lets you know first.
4. **The reading.** The chat gets a reading, not a table: the 5 to 8 videos that matter most, with views, multiplier and the likely reason each one took off; the patterns that show up in two or more outliers; what is saturated; the gaps; the caveats about the sample. First, the AI drops anything off topic and tells you how many videos it removed.
5. **Going deeper, if you want.** The speech and comments of the biggest outliers, a channel's normal, the title analysis of the topic and of your channel.

No key, no YouTube account, no page to approve.

## What you get

Everything goes into the `youtube-research/` folder in your project. Each search gets its own folder, named after the first search term and the date.

| File | What it holds |
|---|---|
| `outliers/<search>/outliers.md` | the report: ranking with band, multiplier, views, views per day, engagement and flags, plus the caveats |
| `outliers/<search>/outliers.csv` | the spreadsheet with every video |
| `outliers/<search>/titulos.md` | the high-performing titles of the topic, when you ask for them |
| `channels/<channel>/channel.md` | a channel's normal and its latest uploads |
| `channels/<channel>/titulos.md` | the channel's titles that beat its normal, when you ask for them |
| `videos/<video id>/transcript.md` | the speech, with the time of each passage |
| `videos/<video id>/comments.md` | the most relevant comments, without the authors' names |

The report files are written in Portuguese, and the spreadsheet uses the Brazilian format (semicolons between columns, commas for decimals). Your AI reads them and walks you through them in English.

## How to read an outlier

The number that matters is the **multiplier**: the video's views divided by the channel's normal. The normal is the median views of the channel's last 30 uploads, long videos only or Shorts only, to match the video. A video with 80 thousand views on a channel whose normal is 8 thousand has a multiplier of 10×.

| Multiplier | Band (label in the report) | What it means |
|---|---|---|
| 10× or more | explosive (explosivo) | demand far above the channel; worth a close look |
| 3× or more | outlier (outlier) | a strong signal you can repeat |
| 1.5× or more | above (acima) | it worked, but the title or thumbnail may explain it more than the topic |
| 0.5× or more | normal (normal) | within what the channel usually gets; little to learn |
| below 0.5× | weak (fraco) | the topic did not pull that audience, or the execution failed |

Check the base too. The best one is the channel's own normal. Without it, the app compares the video with the channel's other videos in the same search and, as a last resort, with its subscribers. Measured against subscribers, the number is only a hint and comes with the "no channel median" flag ("sem a mediana do canal" in the report).

Other flags keep you from drawing the wrong conclusion:

- **small channel** (canal pequeno): fewer than 5 thousand subscribers; the multiplier climbs easily, so look at the views.
- **less than 7 days** (menos de 7 dias): the number will still change.
- **more than 1 year** (mais de 1 ano): compared with the channel's normal today; look at views per day.
- **Short**: up to 3 minutes; don't compare it with a long video.

The report is sorted by an index that also weighs engagement and the video's age. The index only sets the order: to explain a video, the AI cites views, multiplier and base. And a pattern only counts when it shows up in two or more outliers. In a single video it is a bet, and the AI says so.

## Tips

- Say the audience and the format in the request: "for beginners", "Shorts only".
- If your niche is also big in another language, ask for a separate search in that language.
- Take the mechanism, never the title. Copying an outlier's title is the most common mistake; what is worth repeating is the angle, the promise and the format, done your way.
- Measure your own channel too. Knowing your normal tells you what a good result looks like for you.
- Ask for the comments on the biggest outliers. A question that keeps coming up and nobody has answered is a video idea.
- A new search on the same topic runs faster: each channel's normal is kept for a week.

## Limits

- Public only: private, members-only and age-restricted videos are left out, because the app never signs in to an account.
- The sample is whatever YouTube's search shows. Below 60 videos, patterns are a hint, and the report says so.
- Dates, likes, comment counts and subscribers are read only for the top videos, 15 by default.
- Views on a channel's page are rounded by YouTube ("6.4K"). That is enough to work out the normal.
- The language filter recognizes English, Portuguese and Spanish from the title. A video in another language can still slip through; ask to leave it out of the reading.
- The speech comes from the captions. Without captions there is no transcript here, and the AI offers three options: you paste the transcript into a file, the Video analysis app listens to the audio, or you move on without that video.
- The title analysis shows what goes along with the titles that did well in this sample, not the cause. The titles on the list show the mechanism; copying one of them is the most common mistake.
- Sometimes YouTube refuses automated requests for a while. The AI updates yt-dlp, waits a few minutes and tries again with fewer searches.
- The report files are in Portuguese; the AI explains them in English.
- The app doesn't download videos and doesn't publish anything.
