# Under the hood

How the read is made on the inside, for whoever wants to know why an ad got the verdict it got.

## The contract before the number

No report argues mid-campaign about what a new customer is or which week counts. The measurement contract fixes that once: the kind of business and its referee (paid accounts by origin for software; contracts for a service; new-customer orders for a store; bookings for a local business), the goal, the week, net revenue, the new customer, the field where the origin is recorded, the optimization event, the allowable cost per result, the margin and how much revenue per real spent breaks even. Each item is verified, informed or unknown, and the read uses only what is not unknown.

## What the page shows, and what it does not

The app reads the page's public HTML and looks for the signatures of the tags: the Meta Pixel and its number, Google Analytics 4, Google's library, Tag Manager, the Google Ads tag, TikTok, LinkedIn, and the signs of a cookie notice and of a consent gate. It says "present in the served HTML", never "fires": whether a tag fires and with which event only the platform's own test shows, which is why the tracking plan carries that test script. A page that injects its tags only after consent is said to do so, because part of the visits falls outside measurement.

## The single link rule

Five fields in every link: channel, medium, plan, the ad's or the send's name, and the audience or keyword. Values in lower case, without accents or spaces, because reports split the two spellings; the ad name is the exception, letter by letter, because it is what links the click to the piece. A link missing one of the five does not pass.

## The origin ledger

Each lead, sign-up, activation and purchase is one line with date, stage, origin, medium, campaign, content, partner, value and a pseudonym. The pseudonym is born from the e-mail and a salt kept in the contract, through a digest function that does not go back; the e-mail disappears. An exported list enters only through its origin columns; name and phone are dropped and the read says they were. It is what makes it possible to say, in December, that a purchase came from an October ad without keeping who the person is.

## Reading an export without inventing

The reader accepts Portuguese and English, comma or semicolon, decimal comma and the byte order mark Excel puts at the start. Each header is matched to a field; what does not match goes to a list of ignored columns, and a field the export does not carry is "missing", never zero. The totals line at the end is dropped. Lines of the same ad on different days are summed, and the ratios (CTR, CPM, frequency) recomputed from the counts, because ratios do not add up.

## Noise and the minimum sample

Conversions behave like a Poisson count: the relative uncertainty is about 1 divided by the square root of n. With 10 results, 32%; with 30, 18%; with 100, 10%. Hence the minimum sample: 1,000 impressions and 30 clicks to read hook and CTR, 30 results to read cost. Below that the verdict is "insufficient data" and the text says with how much it becomes readable. Pieces are ranked by spend before any judgment, so a R$ 30 piece with 2 results does not look better than a R$ 900 one.

## The verdicts

Cut: zero results after 3 times the allowable cost spent, or cost above 2 times the allowable after 3 times spent with 10 results or more. Scale: 30 results or more within the allowable, and the origin ledger agrees. Iterate: the piece passes 1,000 impressions and 30 clicks and fails at one point: fewer than 20% pass the 3 seconds (hook), link CTR below 0.5% (middle), or the page converts less than half the table's median (page). Hold: cost between 1.0 and 1.5 times the allowable. At the threshold, 0.8 to 1.3 times with fewer than 30 results, the read shows both interpretations with the noise range, and the choice stays with you. For Google Search, a search term with 10 clicks or more, no conversion and at least 1 time the allowable spent becomes a negative.

Each threshold is a labelled rule of thumb with the date it was checked. The plan may carry its own rules, and the account's history replaces the rules once it exists.

## The moves and the before and after

Each move has an object, a text, a why, a certainty, a check date and a trip-wire. When you say you did it, the date goes in and the move becomes readable 14 days later: a 7-day window after, 3 days of maturation (late conversions), against the 7 days before, from the export covering each window. A second move on the same object within that period makes both unreadable, and the read says "cannot tell" and why. A budget raise is judged by the extra results per day and what each one cost, never by the new average.

## Claims and truth

Adding up what Meta, Google and e-mail claim, the total exceeds real sales, because each one counts the same sale. The claim ratio (claimed purchases divided by the ledger's purchases) normally sits between 1.2 and 1.4. Above 1.5, someone counts twice; below 1, tracking is losing conversions. When the platform and the ledger tell different stories, both appear side by side, never the average.
