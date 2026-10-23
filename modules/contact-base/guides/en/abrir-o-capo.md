# Under the hood

How the base is read, grouped and turned into a sequence on the inside.

## The inventory without a record leaving the project

The app reads the exports by their headers, in Portuguese or English: e-mail, phone, name, sign-up date, last use, last contact, status or plan, orders, revenue, source, consent, unsubscribe. It normalizes the e-mail (lower case) and the phone (digits only, with the country and area codes; an 8 or 9 digit number is marked as missing the area code), removes duplicates by e-mail and then by phone, merging what one line had and the other lacked, and drops columns that are no use for writing to anyone (national ID, address, birth date). A patient, dependent or third-party column refuses the whole file: the app reads the brand's users and contacts only.

The file other apps read, the inventory, carries counts only: total, duplicates, invalid, per group, per use, per source, how many have had no contact for six months. The clean list lives in another file, in the project folder, and never leaves the machine.

## The groups

Four groups by the relationship with the brand: customers (paying today), former customers (paid and left), tried (used without paying) and never activated (signed up and did not use). Three bands by use: active (used in the last 30 days), stalled (between 30 and 180) and inactive (more than 180, or never). And one more mark: six months or more without contact, which decides the first message.

## The legal basis as method

Each group has eight fields: how people came in, the text they accepted, the data present, the last contact and the unsubscribes, where the list is kept, the legal basis (consent, legitimate interest or performance of a contract), the contact ceiling and the retention. While a field is empty, the group's sequence stays pending. There is no signature and no ceremony: it is a record made once and amended when the brand changes. Whoever asked to leave receives no marketing in any group; transactional messages are not part of the sequence.

## The re-permission

Anyone who has received nothing for six months or more first gets the question whether they still want to receive, in two short messages five days apart, with a one-click link to stay. Whoever does not click leaves the sequence and is kept only so as not to be contacted again. The script accepts no other first message for that group: it is what protects the sender's reputation, because people who do not want to receive complain, and complaints bring delivery down for everyone.

## The segments and the cap

Engagement is measured by use and orders, never by e-mail opens alone: the iPhone's mail app opens everything by itself. Windows of 30, 90 and 180 days; new and repeat customers; the best customers as the top 10% by revenue; a simple RFM (recency, frequency and value in quintiles) when the base has orders and revenue. The cap: one marketing message every 16 hours, three a week, five only in the peak week and with an end date; whoever bought in the last seven days stays out of promotions.

## The sequence

Nine possible messages, anchored in the plan's warm-up and peak (or in a target date, with the warm-up starting seven days before and the peak lasting four): the re-permission, the news, the invitation to try, the proof, the list, the early access, the opening, the reminder and the last day. Each with a date and weekday, the audience within the group, the job, a subject of up to 45 characters, the call and the link under the plan's single rule, with the message's name in place of the ad's name. Two messages on the same day are pushed apart; a date already past enters today, and the warning says so. The offer ladder per group ensures that whoever already pays never pays more than whoever enters now.

## What the app does not do

It does not send, does not enter an e-mail or messaging tool, asks for no password and gives no legal advice.
