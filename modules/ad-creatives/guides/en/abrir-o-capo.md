# Ad creatives: under the hood

This guide opens the app: what happens at each stage, where each file lives, the rules your AI does not break and how to ask for fine changes. The app writes in Brazilian Portuguese.

## A campaign is a folder

Everything lives in `anuncios/<campanha>/` inside your project. One campaign per folder, and each brand in its own project: what the app learns about one brand never reaches another.

| File | What it keeps |
|---|---|
| `briefing.md` | the offer, the page, the event, the budget, the audience, the ad name pattern and what cannot be said |
| `verba.json` | the budget math, with Meta's source and the date it was checked |
| `pesquisa/links.md` | the Ad Library links and the collection script |
| `pesquisa/capturas/` | your screenshots, one folder per competitor |
| `pesquisa/leituras/` | what the AI read in each screenshot, with the text as it appears |
| `pesquisa/apify/` | what Apify collected, as it came, with the cost of each collection |
| `evidencias.json` and `evidencias.md` | every data point with its origin (screenshot, link, what you said) and its date |
| `conceitos.json` and `conceitos.md` | the concepts and their cards |
| `pecas/<conceito>/` | the `peca.json` (the scenes), the page, the preview and the final video |
| `textos.json` | the check of the ad texts |
| `entrega/` | the named videos, the covers, `nomes.json` and `textos.md` |
| `lancamento.md` and `relatorio.json` | the launch notes and everything that was checked |
| `diario.json` | the approvals, the rounds and the hypothesis of each concept |

## Research without a login

Meta's Ad Library is public, but it turns away anyone who arrives without a browser. So you open the links and save the screenshots, and the AI reads each one. The app never uses your Meta login, cookie or session.

The collection rule is to capture the first 10 active ads of each competitor, in screen order, without choosing. Choosing the pretty ones hides what the competitor really pays for. The app sorts afterwards, by time running:

- **kept ad**: running for 30 days or more, paid month after month;
- **market pattern**: the same choice (angle, hook, proof, style) in two competitors or more;
- **indication**: a competitor with fewer than 3 active ads does not make a pattern on its own.

The AI copies dates and numbers as they appear on screen ("Veiculação iniciada em 3 de jul de 2026", "3 anúncios usam esse criativo e esse texto"), and the app converts them. A missing screenshot drops the card: data without an origin does not go in.

## The Apify collection

With an Apify key, the app does the same research on its own: a public collector reads the Ad Library, without your Meta account, and returns each ad with its start date, versions, text and the address of its video. The app keeps what came in `pesquisa/apify/` and puts each ad in the evidence with its origin and date. Every collection carries an item limit and a spending cap that Apify itself enforces; above an estimated cost of US$ 1, the AI asks first. Repeating the same collection within 24 hours costs nothing again. The collector charges per ad collected, from your Apify account's credit; the price checked is kept in the app, with its date.

## The other apps

When they are in the project, three apps bring more evidence, each piece with its origin and date:

- **Instagram research** measures your profile and your competitors': the posts that went far past their own profile's normal come in, with the normal beside them, Reels and static posts always apart;
- **Instagram research and YouTube research** bring the most liked comments of posts and videos on the theme, without who wrote them: the audience's words;
- **Video analysis** breaks down the ad a competitor has kept running the longest: the hook, the proof, the structure and the lines, second by second.

## Concepts and confidence

Each concept starts from a barrier (what stops the purchase) or a motivator (what pulls it), with an angle, a hook in the first 3 seconds, a proof and a visual style. The campaign tests three, all three in the same ad set.

Confidence is counted by the app, never written by hand: no kind of source in favour is a bet, one is low, two is medium, three or more is high. The kinds are a competitor's ad, measured organic content, the audience's words and your own result. The card also shows the evidence against, when there is some. Evidence that arrives after your yes changes the confidence, and the AI tells you what changed; changing the text of an approved concept asks for your yes again.

The app refuses two concepts with the same visual style and the same hook family (the test would not tell them apart), a proof with a real person without your material and any promise of results on the card.

## The budget math

Meta says an ad set's learning stabilizes with at least 50 optimization events over 7 days. With your daily budget and the cost of each event, the app computes the daily floor of an ad set (cost × 50 ÷ 7) and the most an event can cost (budget × 7 ÷ 50). Without the cost per event, it shows only the maximum and asks. When the math does not close, the three ways out are yours: an earlier event in the funnel, more budget, or starting knowing the first week serves to compare the creatives.

## The pieces

Each piece is a page that the Video engine app renders frame by frame. It lives only in the band the ads interface does not cover: in the vertical of Stories and Reels, Meta takes 14% at the top, 35% at the bottom and 6% on each side, and the clear zone is 875 by 978 px. Words come in one by one, the highlight gets an underline that runs across, the product screen scrolls, and the button is tapped before the end, so no scene stands still.

The engine's check measures, in the preview and in the final video: the cover (frame 0 with readable text), the safe area, the text size (44 px at least), cuts on the beat, flashes, still time and loudness (−14 LUFS). A page without the text and logo boxes never counts as checked.

The same page recomposes in 4:5 for the feed video, and the feed image (4:5 or 1:1) brings together the hook, the product screen, the logo and the button. Both are checked against the Instagram feed's zone: the engine's network table does not have the feed's ad zone yet, and the delivery says so.

The music and the effects are generated on your computer and are yours to use in ads.

## Texts and names

The text check (`copy`) blocks promises of results (guaranteed sales, return, "it will sell"), the terms you forbade in the brief and sentences that state a condition of the viewer, such as "Você sofre de…", which Meta's personal attributes policy refuses. It warns, without blocking, when a text goes past the limits of Meta's Ads Guide: 125 characters before "see more" in the feed, 44 visible in Reels and 27 in the headline.

Each ad name follows your site's pattern, when the site picks the page by `utm_content`, or `<conceito>-<formato>-<gancho>-v<n>`. The `nomes.json` file ties each name to each file: that is how the result of each piece comes back to the next round.

## Test Reels

Before paying, the vertical videos can go out as test Reels, which Instagram shows only to people who do not follow the profile. After 72 hours, the AI reads the screenshot of each one's statistics and records the result as your own result, the strongest kind of evidence for the next round. With a few hundred accounts reached, a small difference is an indication, and the AI says so.

## Advanced requests

- "Show me the evidence against the second concept."
- "Use the product in use template in the trust concept, with the screen in materiais."
- "Swap the soundtrack of the third video for a calmer one and redo the preview."
- "Redo the budget math with R$ 45 per event."
- "Write in the journal that the campaign started today and that the structure fit."

## Privacy

Screenshots, readings and pieces stay in your project. The app connects only to your brand's site, to copy the logo, colours and screens, and to Apify, when you saved the key. The key stays on your computer, outside every project, and never goes through the conversation. No customer or patient data goes into the pieces: recreated screens use made up data.
