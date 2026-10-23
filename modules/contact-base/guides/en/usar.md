# How to use

You have a contact base (customers, people who tried, people who only signed up) and want to use it in a campaign. Your AI cleans and counts the base without a single record leaving the project, records with you why the brand may write to each group, separates active people from those who stopped and writes the e-mail sequence with the plan's dates. You send, from your own tool.

## Ask like this

- "I have a spreadsheet of old contacts and I want to use it in the campaign. Help me clean it and build the sequence."
- "How many of my base can still receive e-mail?"
- "Build the sequence for the people who tried and did not subscribe."
- "What do I need on record before writing to the base?"

## What happens

1. You export the list of users or contacts from your tool, as CSV, and the AI takes the inventory: removes duplicates, sets aside invalid e-mails, completes phones with the country and area codes, groups (who pays, who paid and left, who tried, who only signed up) and counts. You hear three lines: how many can receive, how many per group, how many have had no contact for six months.
2. It records with you the legal basis of each group, in one message with up to four questions: how people came in, what they read, where the list is kept, why the brand may write, how many messages a week. While something is missing, that group's sequence stays pending.
3. It separates the segments by use and purchases, never by e-mail opens alone, and sets the cap: one marketing message every 16 hours, three a week, five only in the peak week.
4. It writes each group's sequence, anchored in the plan: for anyone who has not heard from the brand in six months, first the question whether they still want to receive; then the news, the invitation to try, the proof, the list, the early access, the opening, the reminder and the last day. Each message with a date, a short subject, a call and a link.
5. It writes the body of each message, with the footer that says who writes, where the contact came from and how to leave, and reviews the text so it sounds like a person. You send from your tool, on the sequence's dates.

## What you receive

| Where | What |
|---|---|
| contatos/base-limpa.csv | the clean list, with each person's groups; it stays in the project and never leaves the machine |
| contatos/inventario.json | counts only |
| contatos/base-legal.md | the legal basis of each group |
| contatos/segmentos.json | the segments, the message cap and the offer ladder |
| contatos/regua.md | each group's sequence, with dates, subjects, calls and links |

## Tips

- Export the list with the sign-up, last-use and last-contact dates: that is how the AI separates active people from those who stopped and knows who needs the re-permission.
- Export users and contacts only. A list with patient, dependent or third-party data is refused.
- Without the media plan, say the target date: the sequence anchors on it.

## Limits

- The app sends nothing and does not enter your e-mail or messaging tool.
- The legal basis is method, not legal advice.
- Whoever asked to leave receives no more marketing, on any channel.
- The thresholds are dated rules of thumb; your own history counts more once it exists.
- The app speaks Brazilian Portuguese: the documents and the messages are written in Portuguese.

## By WhatsApp

The same sequence goes out by WhatsApp in four touches (the question whether they still want to hear from you, one to one; the early access; the opening; the last day), only to those who agreed to receive it there. Each message is a short template your provider approves two days before, through the official API or one to one, never a blast from an ordinary number. Agreeing to e-mail is not agreeing to WhatsApp: while the text people accepted does not mention WhatsApp or messages, the sequence stays pending.

## Before the first send

The AI checks in public DNS whether the domain that sends your e-mails is authenticated (SPF, DMARC and DKIM), as Gmail and Outlook require from bulk senders. What is missing comes with what to create, in words for whoever manages your DNS; what depends on a real message or on your tool's report (one-click unsubscribe, complaints, bounces) stays for you to confirm. A dormant list comes back in batches: first those who used the product recently, and the batch doubles while the numbers stay clean.

## The Meta audience

To advertise to your base or exclude your customers from the ads, the AI prepares the custom audience as hashes only: e-mail and phone scrambled as Meta asks, only for those who may receive marketing and did not ask to leave, plus the exclusion list of current customers. Under 100 people the file is not written, and that audience stays in the sequence. You upload it, with the steps beside it; the match rate Meta shows is the one that counts.

## The customer voice and the support

Before writing an ad or an e-mail, the AI prepares the seven-question questionnaire and the script of a 20-minute conversation. You listen to five to eight customers and five to eight people who tried and left; their sentences enter as said, with a first name or profession only, and become evidence for the creatives. And the peak support file is ready for you to fill: who answers, how fast, the answers to the objections, who covers the weekend.
