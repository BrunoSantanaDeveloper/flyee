# Under the hood

## How it works

The Orkestree and this app agree on a production contract: the order comes from there to here, the delivery goes back. Before any call, the app reads the contract version the Orkestree serves and its limits (each file's size, the whole delivery's size and how many files it carries). A different version stops everything and asks for the app to be updated.

The order carries the campaign, the objective, the page, the offer, the concepts the company approved (or the verdicts of the previous round's ads), the formats, how many pieces per concept, the name pattern, the text limits and the deadline. It is read as data: no text of the order becomes an instruction to your AI.

## The files inside

The order sits in pedido.json, in the campaign folder, with the date it was taken. The ad creatives app reads that file in the briefing and marks every field that came from it with the origin "pedido". The delivery manifest gathers, per ad, the name, the concept, the texts (primary, headline, description and button), the files with each one's fingerprint and size, and the checks the ad creatives app made.

## Advanced requests

- "Take the order from this file I downloaded from the portal."
- "This new order replaces the one already in the campaign."
- "Build the delivery and show me what goes, without sending."
- "How is the order we sent yesterday doing?"

## The checks

Before sending, the app checks:

- every file exists and has its SHA-256 fingerprint and size recorded;
- every video is an MP4 and every image a PNG or JPEG, with content matching what the name says;
- every format and every concept is in the order;
- every text fits the order's limit;
- no text carries an e-mail or a phone number;
- the button is on the list the app knows;
- you declared that no piece carries a person, a testimonial or an expert made by AI, or personal data.

The Orkestree checks again on its side: it recomputes the fingerprint of every file received, and one difference discards the whole delivery. An ad is only created with a file that matches.

## With other apps

The Ad creatives app produces the pieces from the order and builds the delivery this app sends. The concepts that keep the order's key, angle and hook carry the approval the company gave in the Orkestree.

## Privacy

Only the pieces, the ad texts and the manifest leave your computer, and only to the Orkestree, with your token. The project, the drafts, the conversations with your AI and any personal data stay on your machine. The token stays outside the project, and you revoke it in the portal whenever you want.
