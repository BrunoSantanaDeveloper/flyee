# Under the hood

This guide shows how YouTube research arrives at each number, why it measures the way it does and what it keeps in your project. Use it to check the math, fine-tune a search or make sense of a strange result.

## How it works

A topic search goes through six stages: search, filter, measure each channel's normal, work out the multiplier, read the details of the top videos and rank. Speech, comments, a single channel's normal and the title measurement are separate requests that reuse whatever was already read.

### 1. Search

Your AI turns the topic into 3 to 6 searches, and the app accepts up to 8 in one research. A single search skews the sample: the technical term reaches one audience, the everyday term another, and the question a person would type a third.

Each search brings up to 40 videos (5 to 100 if you ask), using YouTube's own filters: upload date (last week, last month, last year or no filter), videos only, with no channels or playlists, and, in a Shorts search, short length. The order is YouTube's relevance unless you ask for the most viewed or the most recent. Live streams in progress and scheduled premieres are left out. Searches run three at a time, and each video keeps the list of searches that found it.

### 2. Filter

- **Language.** YouTube's search mixes languages. The app guesses each title's language (English, Portuguese or Spanish) and keeps only your project's language. Titles too short to tell stay in. The top videos get a second check, against the language the video itself declares, because search shows foreign titles already translated. A video found to be in another language at that point drops out, and the next one in line takes its place.
- **Format.** By default, long videos only, over 3 minutes. In a Shorts search, only those up to 3 minutes. A video with unknown length stays in.
- **Minimum views.** Videos under 500 views are dropped.

The full collection, before the filters, is saved so you can check it.

### 3. Measure each channel's normal

For every channel left, the app opens the channel's uploads page, on the videos tab or the Shorts tab to match the video found, and reads the last 30 uploads. The normal is the median of their views. Median rather than average, because a single viral video would drag the average up and hide exactly what you are trying to see.

The channel page shows rounded views ("6.4K"), which is enough for a median. The app reads that page in English, the version where rounded numbers come through without reading errors. A channel needs at least 5 uploads with views to have a normal.

Up to 60 channels are measured per search (up to 150 if you ask), starting with the ones that have the most videos in the sample, four at a time. Each channel's normal is kept for 7 days, so the next search that finds the same channel does not have to open its page again.

### 4. Pick the base and work out the multiplier

The multiplier is the video's views divided by the base. The base is chosen in this order:

| Base | Where it comes from | Confidence weight |
|---|---|---|
| channel median | the last 30 uploads on the same tab | 1.0 |
| sample median | the same channel's videos in this search, when there are 3 or more | 0.9 |
| subscribers | the channel's subscriber count, never less than 500 | 0.6 |

With none of the three, the video has no multiplier. Subscribers are a weak stand-in: a channel with 1 million subscribers can have a normal of 20 thousand views. That is why, measured against subscribers, the bands change (explosive from 10×, outlier from 5×, above from 1× and normal from 0.1×), and the video gets the "no channel median" flag. The floor of 500 subscribers keeps tiny channels from producing absurd multipliers.

Measured against the channel or the sample, the bands are: explosive from 10×, outlier from 3×, above from 1.5×, normal from 0.5× and weak below that.

### 5. Read the details of the top videos

Search brings views, length and channel, but not the date, likes, comments or subscribers. For those the app opens each video's page, which is much slower, so it does this only for the top videos: 15 by default (0 to 50), picked by the highest multipliers. Up to a third of those slots go to the most viewed videos that ended up without a base, so their subscriber counts can at least serve as an approximation.

These pages also give the chapters, up to 15 tags, the start of the description, whether there are captions, and the most replayed moments: up to three peaks from YouTube's most replayed graph, spaced apart, ignoring the start of the video, which is always high.

### 6. Rank

The ranking follows an index:

**index = multiplier (capped at 25) × engagement weight × freshness weight × base confidence weight**

- **Engagement** is likes plus comments, divided by views. Its weight goes from 1.00 to 1.50 and tops out at 10% engagement.
- **Freshness** is 1.25 up to 30 days, 1.10 up to 90 days, 1.00 up to a year and 0.85 after that.
- **The cap of 25** stops a tiny channel with one 300× video from taking over the ranking.

The index only sets the order. When explaining a video, the AI cites the views, the multiplier and the base. You can ask for another order: by multiplier, by views per day or by views. Views per day are the views divided by the days since publication; they separate the video that just took off from the one that piled up views over years.

Each video can carry flags: small channel (fewer than 5 thousand subscribers), less than 7 days old, more than 1 year old, Short (up to 3 minutes) and no channel median. The search carries caveats when the sample has fewer than 60 videos, when channels went unmeasured, when a search or a details read failed, when videos in other languages were dropped and when there is no date filter.

### A video's speech

The transcript comes from the captions, without downloading the video. The app picks the captions closest to what was said: those in the video's original language, the ones written by the channel first and, failing that, YouTube's automatic captions. It avoids YouTube's automatic translation of the captions, which often fails. When the original language is unknown, it tries Portuguese and then English.

The text is grouped into reading blocks of up to about 12 seconds, each with its start time. The app counts the spoken words, leaving out sound tags such as "[Music]", and works out the pace in words per minute when there are at least 30 seconds of speech. That is the creator's real speaking pace.

### Comments

The app reads top-level comments, without replies: by default the 100 most relevant, in YouTube's order. You can ask for 10 to 500, or for the newest ones. For each comment it keeps the text, the likes, whether it is pinned, whether the channel itself wrote it and how long ago it was posted. The author's name is never kept.

### Titles

On a search already done, the app analyzes the high-performing titles in four parts.

1. **The list.** The titles that went furthest above their own channel's normal, from the highest down, and those that stayed below the normal, each with the traits it carries. The reading starts here: it shows the mechanism the tables sum up.
2. **The triggers.** Eight ways of pulling the click, counted by the words that mark them:
   - result: money, time, a number with a unit;
   - curiosity: "this", "the secret", "why", "the X that";
   - direct search: "how to", "step by step", "tutorial", "beginners";
   - contrarian: "stop", "don't", "myth", "nobody tells";
   - cost or mistake: "mistake", "avoid", "losing", "wasting";
   - experiment: "I tried", "for 30 days", "challenge";
   - list: "5 tips", "top 10";
   - comparison: "vs", "X x Y", "better than", "which one".

   A curiosity title with none of these words is not counted, so the number is a floor.
3. **The form.** Having a number; a tool or brand name, when the topic's names are given; parentheses or brackets; starting with "How" (or "Como" in Portuguese); being a question; first person; "without X"; one word in capitals; talking to "you"; a superlative; a year; two parts split by a colon, a bar or a dash; an emoji. And length: the median number of characters in the sample and among the outliers, and the multiplier in four ranges (up to 40, 41 to 60, 61 to 80 and over 80 characters).
4. **The words.** The words and word pairs found in at least 5 titles, leaving out the search words, which are in all of them. Any number counts as N, so "7 days" and "30 days" add up together.

For each trait and each word, the app compares the median multiplier of the titles that have it with that of the titles that don't, and shows how many titles are in each group. A group with fewer than 5 titles is marked as a hint.

The same analysis works on your channel: after reading your latest uploads, the app measures your titles against your own normal. It shows what your audience has already responded to. With about 30 videos, almost every group is small, and the views on the channel's tab come rounded by YouTube.

The app suggests names in the titles that look like tools or brands, for you and the AI to confirm before using them, and lets you leave off-topic videos out of the count. Search picks up words with other meanings and neighboring niches, and they skew the traits.

The result shows what goes along with the titles that did well in this sample. It does not prove cause, and another topic or time window gives other numbers. With so many traits and words measured at once, one of them looks strong by chance: what shows up both on the topic and on your channel is worth more.

## The files inside

Everything goes into the `youtube-research/` folder in your project. The Markdown reports are written in Portuguese.

| File | What it keeps |
|---|---|
| `outliers/<search>/outliers.md` | the report to read: the top 30 of the ranking, the caveats and how to read them |
| `outliers/<search>/outliers.csv` | every video, in the Brazilian spreadsheet format (semicolons between columns, commas for decimals) |
| `outliers/<search>/outliers.json` | everything: the searches, the options used, the sample, the caveats and every video with all its metrics |
| `outliers/<search>/raw.json` | the search results before the filters |
| `outliers/<search>/titulos.md` and `titulos.json` | the title analysis of the topic; each new analysis overwrites the previous one |
| `channels/<channel>/channel.md` and `channel.json` | a channel's normal and its latest uploads, with multiplier and band |
| `channels/<channel>/titulos.md` and `titulos.json` | the title analysis of the channel, against its own normal |
| `videos/<id>/video.json` | a video's public data |
| `videos/<id>/transcript.md` and `transcript.json` | the speech in timed blocks, for reading, and the passages with start and end times, for other apps |
| `videos/<id>/comments.md` and `comments.json` | the comments, numbered, with their likes |
| `cache/channels/` | the normal of every channel already measured, per tab |

Each search's folder is named after the first search term and the date, or whatever name you ask for. A new search with the same first search term on the same day overwrites the previous one.

In the report, an empty cell is data the app did not read or YouTube did not show: date, views per day and engagement exist only for the videos read in detail, and a video with no band and no multiplier had no base to compare against.

The app reuses what it has already read: a channel's normal for 7 days, a video's data for 1 day (views keep climbing), comments for 7 days and a transcript forever. The files are yours: you can open, copy and delete them. Deleting the `cache/` folder or a video's folder only makes the app read everything again next time. To ignore what was already read without deleting anything, ask for the search to be redone from scratch.

## Advanced requests

| To change | Ask like this |
|---|---|
| the time window | "Search only what came out in the last week." or "Search with no date filter." |
| the format | "Run the same search with Shorts only." |
| the language | "Run a separate search in Spanish on the same topic." or "Don't filter by language." |
| the sample size | "Use 6 searches, bring up to 80 videos per search and measure up to 100 channels." |
| the details | "Read the date, likes and comments of the top 30." |
| a views cutoff | "Ignore videos with fewer than 10 thousand views." |
| the order | "Sort by views per day." or "Search for YouTube's most viewed videos." |
| the name and the data | "Save this search as airfryer-october." or "Redo it without reusing what was already read." |
| a channel in depth | "Read the last 60 uploads from my channel." or "Measure the Shorts of the channel @example." |
| the comments | "Bring the 300 most relevant comments on this video." or "I want the newest ones." |
| titles | "Measure the titles counting Ninja, Cosori and Philips as brands, without the off-topic videos." |
| stricter titles | "Use only the videos measured against their own channel, and treat any group with fewer than 10 titles as a hint." |
| your channel's titles | "Analyze the titles of my channel @mychannel: which ones beat my normal and what do they have in common?" |
| a longer list | "List the 30 titles that went furthest above the normal." |
| several videos | "Get the speech of these 5 videos." Up to 20 fit in one request. |
| the history | "What have I already researched in this project?" |

With no date filter, old videos are compared with the channel's normal today: check views per day before drawing conclusions. Shorts and long videos in the same search skew the ranking, so prefer two separate searches.

## When something goes wrong

| What you see | What happened | What the AI does |
|---|---|---|
| yt-dlp is missing | the program is not on the computer | says so in one sentence and installs it after your yes; if the install needs something from you, it shows that single step |
| YouTube asked to confirm you are not a robot, or limited requests | a temporary refusal of automated requests | updates yt-dlp, waits a few minutes and repeats with fewer searches, channels or videos |
| one search failed | the others carry on | delivers the result and says which search failed |
| unmeasured channels | the channel limit, or a failure opening the page | uses the sample median or the subscribers, and the caveat says how many |
| no captions | the video has none, or YouTube did not deliver them at that moment | offers three options: you paste the transcript into a file, the Video analysis app listens to the audio, or you move on without that video |
| private, members-only, age-restricted or removed video | the app reads only what is public, without signing in | moves on without that video |
| the channel has no such tab | for example, it never posted Shorts | uses the other tab |
| no connection | the app could not reach YouTube | asks you to check the internet and tries again |

When reading a video fails, the AI does not try another route on its own, such as another site or another tool. It tells you what failed and you choose. A new yt-dlp error is usually fixed by updating it.

## When a number looks odd

- **A huge multiplier, like 300× or 3,000×.** It is almost always a small channel or a subscriber base. Look at the base and the views. In the ranking, the multiplier counts for at most 25.
- **Very high views and very low engagement.** It may be bought views or a viral hit outside the niche. Don't take it as a pattern.
- **An old video at the top.** Check the "more than 1 year" flag and the views per day: views piled up over years are not demand today.
- **A video in another language in the list.** The filter recognizes English, Portuguese and Spanish from the title. Ask for it to be left out of the reading.
- **Your channel's normal looks low.** The newest videos are still gathering views. The channel list goes from newest to oldest, so the first ones will still grow.
- **The search took a while.** Most of the time goes into measuring the channels. The next search on the same topic reuses what was already measured, and you can ask for fewer searches or fewer channels.

## With other apps

The **YouTube script** app calls this one to prove the demand for a video idea, measure the titles that worked on the topic before suggesting yours, read the speech of reference videos and of your own videos (to learn your voice) and find questions in the comments that nobody has answered. Without this app installed, YouTube script still works, but the video idea comes without proof of demand.

Other apps use the same functions your AI uses, and the result goes into the same `youtube-research/` folder, with the app's name at the start of the search's name. Everything that was researched sits in one place, and one app reuses what another has already read.

When a video has no captions, this app does not try to listen to the audio. That is what the **Video analysis** app is for: it watches the video, picture and sound.

## Privacy

- The app reads only public YouTube pages: search, a channel's uploads page, each video's page, captions and comments. It sees what any visitor sees without signing in.
- It never signs in to a YouTube account, never uses your browser's login and uses no key.
- It never downloads the video. Captions pass through a temporary folder that is deleted right after.
- Requests go from your computer straight to YouTube, like a visit to the site, and YouTube sees them coming from your connection.
- Commenters' names are never kept.
- Everything the app writes stays in the `youtube-research/` folder of your project. None of it goes to flyee.club.
- When it finishes, the AI records with flyee.club that the app was used, with the app's name, version and trail, plus technical details such as the flyee versions. The topic, the searches, the videos and the results never go into that record.
