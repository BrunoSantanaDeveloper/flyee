# How to use

When your company uses the Orkestree to manage its ads, it orders the pieces for each campaign. This app brings the order into your project, your AI produces the pieces with the ad creatives app on your AI plan, and the delivery goes back checked, file by file, for a person of the company to approve before it goes live.

## Ask like this

- "Is there an Orkestree order for me?"
- "Go ahead and produce the order for the November campaign."
- "The pieces are ready. Send the delivery to the Orkestree."
- "Did the Orkestree send any ad back? Redo only those."

## What happens

1. The first time, your AI opens a page in your browser for you to paste the production token you created in the Orkestree portal.
2. It shows the open orders, one sentence each: the campaign, how many pieces and the deadline. Nothing is produced before your yes.
3. With the yes, the order goes into the campaign folder. The ad creatives app reads the page, the event, the offer, the dates and the name pattern from it, and asks only what the order does not carry, in one message. The concepts come already approved by the company.
4. You see each piece's preview, as always.
5. Before sending, it asks one thing only: does any piece carry a person, a testimonial or an expert made by AI, or personal data? With your answer that none does, it checks the delivery against the order and sends it.
6. A person of the company reads and approves it in the Orkestree. If they send an ad back, the order returns with the reason, and your AI redoes only that one.

## What you receive

| File | What it is |
|---|---|
| anuncios/(campaign)/pedido.json | the order as the Orkestree sent it |
| anuncios/(campaign)/entrega/manifesto.json | the checked delivery, with the texts and each file's fingerprint |
| anuncios/(campaign)/entrega/envio.json | when it was sent and the order's state |

## Tips

- Without the token, ask your AI to take the order from the file the portal gives. The checked delivery stays in the folder, and you upload the manifest and the files on the order's delivery screen.
- If a text goes over the order's limit, your AI says which one and by how many characters: shorten it with the ad creatives app and send again.

## Limits

- The app does not touch the ad account. The Orkestree creates the ad, after the company approves.
- In this version, ad orders only. Content orders for the social networks come in a later version.
- Your AI never produces on its own, on a schedule: the order waits for you.
