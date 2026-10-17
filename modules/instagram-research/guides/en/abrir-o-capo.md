# Under the hood

This guide shows how Instagram research reaches each number, why it measures that way and what is kept in your project. Use it to check the math, fine-tune a search or understand a strange result.

## How it works

A search goes through five steps: gathering each profile's posts, separating Reels from static posts, measuring each profile's normal, comparing each post with that normal, and ordering. A post's comments are a separate request.

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

## The files inside

Everything goes into `instagram-research/`, at the root of the project.

| File | What it holds |
|---|---|
| `profiles/<profile>/profile.json` | the profile's full result: source, normals, every post with its metrics and notices |
| `profiles/<profile>/profile.md` and `profile.csv` | the report and the spreadsheet |
| `profiles/<profile>/raw.json` | Apify's raw collection, with the date and the number of posts requested |
| `profiles/<profile>/leitura.json` | your screenshot reading, as it was imported |
| `outliers/<search>/` | the ranking across profiles in `.json`, `.md` and `.csv` |
| `posts/<post code>/comments.json` and `comments.md` | a post's comments |
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

## The checks

- **Reading.** The app checks the version, the type, the @, the date, the screenshot it came from and every number. Any problem comes back with the field's path, and nothing is half imported.
- **Cost.** No collection runs without a post limit and a spending limit. Above an estimated US$ 1, nothing runs without your yes.
- **A profile that does not exist.** It comes back as a notice, and the other profiles in the search go on. So does a profile with no posts or a private one.
- **An incomplete collection.** If fewer posts arrive than requested, the report says how many came.
- **A low normal.** Below 200 plays, the report warns that few plays already make a high multiplier.

## When a number looks strange

- **A huge multiplier on a small profile.** Check the normal: with a normal of 50 plays, a Reel with 2 thousand plays gives 40×. The signal is real, but the base is small.
- **A post with many comments and few likes.** Look for the "asks for comments" notice.
- **A profile with no multipliers.** Fewer than 3 posts with the number: there is no normal.
- **Plays different from what you see in the Instagram app.** The number changes over time, and the screenshot shows the rounded value. For the median, the difference does not matter.

## With other apps

Other flyee.club apps use this one behind the scenes to look for proof of what works on Instagram: a profile's normal, a niche's outliers and the audience's questions in the comments. If an app asks for the research and this one is not installed, the AI offers to install it, and the other app goes on without that data, saying what was left out.

## Privacy

- The app never uses your Instagram account, never asks for a password and never opens Instagram for you.
- The Apify key stays only on your computer, outside your projects, and goes only to Apify's API address, in the connection header. The app refuses to send it anywhere else.
- Apify receives only the @ of the profiles and the addresses of the posts you research.
- Comments are kept without the names of who wrote them.
- Screenshots stay in your project, and only your AI reads them.
