# Under the hood

This guide shows how Instagram research reaches each number, why it measures that way and what is kept in your project. Use it to check the math, fine-tune a search or understand a strange result.

## How it works

A search goes through five steps: gathering each profile's posts, separating Reels from static posts, measuring each profile's normal, comparing each post with that normal, and ordering. A post's comments, the caption traits and a Reel's video are separate requests, made over a finished search.

### 1. Gathering the posts

For each profile, the app first looks at what the project already has: a collection under 24 hours old with at least the number of posts requested, or a reading of your screenshots. Only what is missing gets collected. So repeating a search on the same day costs nothing again, and a profile you read by hand never becomes a paid collection unless you ask.

With the Apify key, the missing profiles go into a single collection through Apify's Instagram post collector, which reads public pages without logging in. The default is each profile's last 30 posts, leaving pinned ones out. Before running, the app estimates the cost from the collector's highest listed price. Above US$ 1, it stops and returns the amount so the AI can ask you. Every collection carries two limits that Apify itself enforces: the maximum number of posts and the maximum spend, one and a half times the estimate, never less than US$ 0.05.

Without the key, the AI asks for screenshots of the Reels tab and writes down what it reads, number by number, in a reading file. The app converts each text ("12,3 mil", "1,2 mi", "987", "12.3K") and refuses what it cannot understand, naming the exact field. The AI never converts a number on its own: that way, a reading mistake shows up as a mistake, not as a plausible number in the middle of the math.

### 2. Separating Reels from static posts

Reels are measured by plays. Photos and carousels have no plays: they are measured by likes plus comments. The two scales do not compare, so each type has its own normal and its own ranking. A carousel with 300 likes and a Reel with 3 thousand plays never compete for the same spot.

When a profile hides its likes, Instagram returns a number that is not real. The app keeps those likes as unknown, never as zero, and flags the post with "hidden likes".

### 3. Measuring each profile's normal

The normal is the median of each type's number across the collected posts. It is a median, not an average, because a single viral post would pull the average up and hide exactly what you want to see. Pinned posts are left out: they tend to be the profile's biggest and would skew the yardstick.

With 5 posts or more, the normal is measured. With 3 or 4, it is a hint, and every post from that profile carries the notice. With fewer than 3, the profile has no normal for that type, and the multipliers stay empty.

### 4. Comparing each post with the normal

The multiplier is the post's number divided by the profile's normal. It falls into a band: explosive from 10×, outlier from 3×, above from 1.5×, normal from 0.5× and weak below that.

Each post also gets notices:

- **asks for comments**: 20 comments or more, and more than one comment for every two likes. It is the "comment ME and I'll send it to you", which inflates the number with a request, not with interest.
- **paid partnership**: the post is marked as a paid partnership on Instagram.
- **under 7 days** and **over 1 year**: the number will still change, or it was compared with today's normal of a profile that may have changed.

Reels with a known length go into three ranges (up to 20 s, 21 to 60 s, over 60 s), each with its median plays and median multiplier. To compare ranges, look at the multiplier, because each profile has its own size.

### 5. Ordering

The default order is an index: the multiplier, capped at 25 so a tiny profile does not dominate, times three weights.

| Weight | Value |
|---|---|
| engagement (likes plus comments over plays) | from 1.00 to 1.50, saturating at 10% |
| freshness | 1.25 up to 30 days, 1.10 up to 90, 1.00 up to 365, 0.85 after |
| confidence in the normal | 1 measured, 0.8 hint |

The index only orders. To explain a post, the AI cites the plays, the multiplier and the profile's normal. You can ask for the order by plain multiplier or by the raw number.

### Comments

With the key, the app collects a post's comments through Apify's Instagram comment collector, 100 by default and 500 at most, and keeps only the text, likes, replies and date, from most liked to least. The name of who wrote each comment is not kept. Comments are kept for 7 days.

### Captions

Since version 1.1.0, each post's caption is kept whole, as its author wrote it: the line breaks, the hashtags and the request at the end. Before, the app kept only the first 300 characters, on a single line, and the end of the caption was lost. The reports show only the start of each caption, on one line; the `.json` and the spreadsheet keep the whole text.

Over a finished search, the app measures the caption traits, with the same method the YouTube research app uses for titles. For each trait, it splits the posts into two groups, those with it and those without, and computes each group's median multiplier and how many posts it holds. The traits are:

| Trait | What the app looks for |
|---|---|
| question | a question mark in the caption |
| number in the first line | a number in the text up to the first line break |
| first person | "eu", "meu", "minha", "comigo", verbs such as "testei" and "fiz", and in English "I", "my" |
| line-by-line list | 3 or more lines that start with a number ("1."), a bullet or an emoji |
| hashtags at the end, hashtags inline | where the hashtags sit relative to the text |
| request to the audience | comment, save, share or tag someone, go to the link in bio, send a direct message; each one apart and all together |

Besides the traits, the length of the first line (up to 40 characters, 41 to 80, 81 to 125, over 125), the length of the whole caption and the number of hashtags come in ranges, with each range's median multiplier and number of posts, and with the median of those sizes among the outliers.

The care taken in the math:

- **Reels and static posts are in separate tables**, because one multiplier measures plays and the other likes plus comments.
- **Paid partnerships are left out**, because part of their reach was bought. You can also take out posts that are off topic.
- **A small group is a hint.** With fewer than 5 posts on one side (you can ask for another minimum), the report marks the trait. With fewer than 30 captions in total, the whole search is a hint.
- **The rules read Portuguese and English**, without the links, hashtags and mentions, and each label in the report says what was looked for. Styled letters, such as bold made with symbols, are read as plain letters. A request written another way is left out: the app does not guess.
- **Going together is not cause.** The report says so at the end, and so does the AI.

### A Reel's video

Collection through Apify brings, for each Reel, the link to its video on Instagram's media servers. That link is signed and carries the time it stops working; the signature prevents changing that time. The app reads that time in the link itself and shows it on each Reel, which is why the AI offers to watch right after the collection.

When you ask to watch, the app downloads the video of the chosen Reels, 1 to 5 at a time, never the whole collection. Before downloading, it checks that the link still works; an expired link is not even called. The download comes only from Instagram's media servers, without your account and without the Apify key, with a size ceiling per video (100 MB, or more, up to 500 MB, if you ask). The file is saved whole or not at all: a download that is interrupted, too big or not an MP4 video is deleted. Next to the video, `video.json` records which collection the link came from, when it was made and when the video was downloaded. Then the Video analysis app watches the file in your project.

## The files inside

Everything goes into `instagram-research/`, at the root of the project.

| File | What it holds |
|---|---|
| `profiles/<profile>/profile.json` | the profile's full result: source, normals, every post with its metrics and notices |
| `profiles/<profile>/profile.md` and `profile.csv` | the report and the spreadsheet |
| `profiles/<profile>/raw.json` | Apify's raw collection, with the date and the number of posts requested |
| `profiles/<profile>/leitura.json` | your screenshot reading, as it was imported |
| `outliers/<search>/` | the ranking across profiles in `.json`, `.md` and `.csv` |
| `outliers/<search>/legendas.md` and `legendas.json` | the caption traits: both medians and each group's size, the size ranges and what was left out of the count |
| `profiles/<profile>/legendas.md` and `legendas.json` | the same, for a single profile |
| `posts/<post code>/comments.json` and `comments.md` | a post's comments |
| `posts/<post code>/video.mp4` and `video.json` | a Reel's video and where it came from; the video stays out of git |
| `leituras/` | the readings the AI writes before importing |

The spreadsheet uses semicolons and decimal commas, as Excel in Portuguese expects. Text that starts with `=`, `+`, `-` or `@` gets an apostrophe in front, so no caption turns into a formula when opened.

You can delete any folder: the app collects or reads again when it needs to. Deleting `raw.json` makes the next search collect that profile again, at a cost.

## Advanced requests

- "Research 50 posts from each profile, not 30." More posts give a steadier normal, at a higher cost.
- "Collect again, even if it's from today." The AI asks for a fresh collection without reusing.
- "Use only my readings, don't collect anything." The AI uses only what you brought in screenshots.
- "Order by multiplier, without the index."
- "Measure that profile's carousels too, opening post by post." Without the key, each post has to be opened to read the likes; the AI asks first whether it is worth the work.
- "Combine my reading of @profile with the collection of the others." A search across profiles accepts collected and read profiles together, and the report states each one's source.
- "Measure the captions again without these two posts, which are about something else." The posts taken out come back in the report, in the part about what was left out of the count.
- "Measure the captions of my profile only." With a single profile the groups are small, and almost everything comes out as a hint.
- "Download the video of that Reel even if it is big." The ceiling goes up to 500 MB.

## The checks

- **Reading.** The app checks the version, the type, the @, the date, the screenshot it came from and every number. Any problem comes back with the field's path, and nothing is half imported.
- **Cost.** No collection runs without a post limit and a spending limit. Above an estimated US$ 1, nothing runs without your yes.
- **A profile that does not exist.** It comes back as a notice, and the other profiles in the search go on. So does a profile with no posts or a private one.
- **An incomplete collection.** If fewer posts arrive than requested, the report says how many came.
- **A low normal.** Below 200 plays, the report warns that few plays already make a high multiplier.
- **A cut caption.** In a screenshot reading, a caption that ends cut at "more" is refused, because its end, where the hashtags and the request sit, is missing.
- **An old search.** The caption traits of a search made before version 1.1.0 come with the notice that only the start of each caption was kept.
- **Video.** An expired link, a server that is not Instagram's, a file above the ceiling or one that is not a video: each case comes back with its reason, without stopping the other videos of the same request.

## When a number looks strange

- **A huge multiplier on a small profile.** Check the normal: with a normal of 50 plays, a Reel with 2 thousand plays gives 40×. The signal is real, but the base is small.
- **A post with many comments and few likes.** Look for the "asks for comments" notice.
- **A profile with no multipliers.** Fewer than 3 posts with the number: there is no normal.
- **Plays different from what you see in the Instagram app.** The number changes over time, and the screenshot shows the rounded value. For the median, the difference does not matter.

## With other apps

Other flyee.club apps use this one behind the scenes to look for proof of what works on Instagram: a profile's normal, a niche's outliers, the traits of the captions that did well and the audience's questions in the comments. If an app asks for the research and this one is not installed, the AI offers to install it, and the other app goes on without that data, saying what was left out.

This app also uses another one: to watch a Reel, it hands the downloaded video to the Video analysis app. If that app is not in the project, the AI says in one sentence that it will install it, and installs it; if that fails, the search goes on without watching, and the reason a post took off stays a hypothesis.

## Privacy

- The app never uses your Instagram account, never asks for a password and never opens Instagram for you.
- The Apify key stays only on your computer, outside your projects, and goes only to Apify's API address, in the connection header. The app refuses to send it anywhere else.
- Apify receives only the @ of the profiles and the addresses of the posts you research.
- To download a video, the app only calls Instagram's media servers, through the collection's link, without your account and without the Apify key. The video stays in your project, and goes elsewhere only if you agree, for example when Video analysis asks whether it may send it to Gemini.
- Comments are kept without the names of who wrote them.
- Screenshots stay in your project, and only your AI reads them.
