# How to use it

Instagram research shows which Reels and posts did far better than their own profile's normal, and by how much. It is for anyone who posts or advertises on Instagram and wants to choose the next post, or the next ad, from what has already worked with the audience, with numbers rather than hunches.

A Reel with 500 thousand plays on a profile that always gets 500 thousand tells you little. A Reel with 40 thousand on a profile that usually gets 4 thousand tells you a lot: the topic or the hook carried the post beyond its usual audience. Those are outliers. The app finds them on your profile and on the profiles of your niche, and your AI explains why each one probably took off and what they have in common.

You can ask your AI for a search directly. Other flyee.club apps also use this one behind the scenes, for example to look for proof of what works before proposing an ad.

## Ask like this

- "Analyze my Instagram profile @myprofile: what's my normal, and which Reels beat it?"
- "Compare these profiles and show me the Reels that beat their normal the most: @profile1, @profile2, @profile3."
- "What do my competitors post that gets the best results?"
- "Which Reels length works best in this niche?"
- "What does the audience ask in the comments of this Reel?", followed by the post's address.

The profiles are enough. If something is missing, your AI will ask. The app does not look up profiles by topic: if you ask for suggestions, the AI proposes a list and checks it with you before researching.

## Two ways to collect the numbers

**With no key, from your screenshots.** You open the Reels tab of each profile, on your phone or computer, and take two or three screenshots while scrolling. Each thumbnail shows how many times the video was played. You save the images in a folder of your project and tell the AI where they are. It reads the numbers as they appear on screen, and the app does the math. If a number is unreadable, the AI asks for a sharper screenshot instead of guessing.

**With an Apify key, automatically.** Apify is a service that collects public Instagram data without using your account, and charges for usage from the credit you have there. With the key, the AI collects the last 30 posts of each profile on its own, with plays, likes, comments, length, date and paid partnership, and also the comments of a post.

To turn on automatic collection, ask your AI: "turn on automatic collection for Instagram research". It shows you where to create the account and the token on Apify and opens a page in your browser, where you paste the token and click Save. The key never goes through the chat and is stored only on this computer, outside your projects. In a Claude Code cloud session, where that page does not open, the key stays as a network secret of the session's environment, which the session uses without seeing it; the AI tells you where to keep it.

## What automatic collection costs

From Apify's price list of October 2026:

| Collection | Approximate cost |
|---|---|
| one profile, 30 posts | US$ 0.08 |
| ten profiles, 30 posts each | US$ 0.81 |
| 100 comments on a post | US$ 0.26 |

Before any collection above US$ 1, the AI tells you the amount and waits for your yes. Every collection has a ceiling, and what was collected in the last 24 hours is reused without being charged again.

## What happens

1. **The check.** The AI sees whether the Apify key is saved. Without it, it goes on with screenshots.
2. **Your request.** The AI confirms the profiles and what you want to decide: what to post, what to advertise, which format to use.
3. **The collection.** With the key, it takes one to a few minutes. Without it, the AI asks for the screenshots and reads each one.
4. **The reading.** The chat gets a reading, not a table: the 5 to 8 posts that matter most, with plays, multiplier and the likely reason each one took off; the patterns that show up in two or more outliers; the length that works; the caveats about the sample.
5. **Going deeper, if you want.** The comments of the biggest outliers, grouped into questions, objections and requests.

## What you get

Everything goes into the `instagram-research/` folder of your project.

| File | What it holds |
|---|---|
| `profiles/<profile>/profile.md` | the profile's normal and its posts against that normal |
| `profiles/<profile>/profile.csv` | the spreadsheet with every post, which opens in Excel and Google Sheets |
| `outliers/<search>/outliers.md` | the ranking across profiles, with bands, notices and caveats |
| `outliers/<search>/outliers.csv` | the spreadsheet of the search |
| `posts/<post>/comments.md` | a post's comments, without the names of who wrote them |
| `leituras/` | the readings of your screenshots |

## How to read an outlier

The number that matters is the **multiplier**: the Reel's plays divided by the profile's normal. The normal is the median of the profile's latest posts, leaving pinned ones out. A Reel with 40 thousand plays on a profile whose normal is 4 thousand has a 10× multiplier. Photo posts and carousels have no plays: they are measured by likes plus comments, against their own normal, in a separate ranking.

| Multiplier | Band | What it means |
|---|---|---|
| 10× or more | explosive | far above the profile; worth studying closely |
| 3× or more | outlier | a strong signal that can be repeated |
| 1.5× or more | above | it worked, but it may have been the execution rather than the topic |
| 0.5× or more | normal | as expected; teaches little |
| below 0.5× | weak | the topic did not draw the audience, or the execution failed |

A few notices prevent wrong conclusions:

- **asks for comments**: the post asked for a comment in exchange for something, and the number measures the request, not interest in the topic.
- **paid partnership**: part of the reach was bought.
- **under 7 days**: the number will still change.
- **normal from few posts**: the profile has 3 or 4 posts with the number; it counts as a hint.
- **hidden likes**: the profile hides likes, so engagement is left out.

The report is ordered by an index that also weighs engagement and the post's age. The index only orders: to explain a post, the AI cites plays, multiplier and the profile's normal. A pattern only counts when it shows up in two or more outliers. In a single post it is a bet, and the AI says so.

## Tips

- Measure your own profile first. Knowing your normal shows what a good result looks like for you.
- Compare with profiles of your size. A huge profile impresses with its numbers and teaches little through its multiplier.
- Five to fifteen profiles in your niche give a better reading than two or three.
- Take the mechanism, never a copy: the hook and the format, in your own way.
- Ask for the comments of the biggest outliers. A question that keeps coming up and nobody answered is a topic, and sometimes it is the ad.

## Limits

- Public profiles only. The app never uses your Instagram account and never asks for your password.
- Screenshots only give the Reels' plays. Length, likes, date and comments need automatic collection or opening post by post.
- The reason a post took off is a hypothesis drawn from the caption, the length and what you tell the AI. The AI does not watch Instagram videos.
- With fewer than 5 profiles or fewer than 60 Reels in total, patterns are hints, and the report says so.
- Collecting Instagram data with automated tools may go against Meta's terms of use, even when the data is public. Use the research to study what works, never to copy other profiles' posts.
- The app publishes nothing and does not touch your ad account.
