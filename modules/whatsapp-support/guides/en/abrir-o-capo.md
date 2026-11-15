# Inside WhatsApp support

## The pieces

- **Chatwoot**, community edition: the inbox and the team's panel. The app pins a version and never changes its code.
- **Support bot**: a small service with no database and no dependencies that receives Chatwoot's events, asks your system and the AI, and replies or hands over to the team.
- **OpenWA**, only for the WhatsApp Web connection, with the plugin that links it to Chatwoot.
- **Your system**: creates each customer's Chatwoot account, the team members as agents, the bot of each account, single sign-on, the connect and settings screens, and the lookups the bot may run.

Two systems can share one server. Each has its own installation, with its own database, files, numbers and secrets and a memory cap, and a single entry point serves the domains of both. A failure of the server takes both down; when that cannot happen, each system goes to its own server.

## One login

The person clicks "Support" in your system. The system's server asks Chatwoot for a sign-in link that lasts five minutes and works once, and the panel opens already signed in. Everyone who signs in is an agent: inbox, bot and integration settings stay with the service account the system created, which nobody uses to sign in. In frame mode, the panel opens inside a page of your system, with its menu around it.

## Who answers

Only the people the system marks as the support team get into the panel. For the platform's own support, that is the support team and the super admin; when each customer of the system serves its own customers, it is the team the customer chose and whoever manages that customer. Each customer has its own Chatwoot account, with its own number, conversations and team, and no one at one customer sees another. There is no limit on agents. A conversation the bot hands over goes in turn to whoever is online.

Whoever leaves the team also leaves Chatwoot, and the conversations that were theirs go back to the queue. A daily check removes anyone left behind, because a panel session lasts up to two months.

To talk outside a customer conversation, the team has groups inside the panel. Each group is an internal inbox, with no number and no bot, seen only by its members, with one fixed conversation where everyone writes and calls a colleague with @ in a note. Nothing written in a group leaves the panel. Whoever runs the support desk creates the groups on a screen in the system, chooses who takes part and the labels, and archives a group that is no longer needed, keeping its history.

## The panel in your brand

The app saves your system's name, logos and addresses in Chatwoot, plus a theme built from your choices: the main color becomes a twelve-step scale in light and dark mode, and each place where Chatwoot hardcoded its own color gets a rule of its own. Features the customer does not use disappear from the menu through Chatwoot's own settings; anything else that must go is hidden with CSS, never deleted. A browser check signs in as a test person, opens the screens, confirms the color and what was hidden, and saves screenshots.

## Inside the bot

- It reads what the person sends. Photos and screenshots go with the message to the AI. Voice messages are cut into parts and transcribed. A video becomes a grid of frames spread over the whole video, plus the transcribed speech, so even a long video is read. The cutting and the grid happen on the server itself, without calling an AI; the transcription uses the cheapest model the system has, on the bot's server or in the system itself. When nothing can transcribe, the bot's screen does not even show the option to listen to voice messages. The team is called only when nothing could be read, and gets the transcript in a note.
- It reads the files the person sends. From a PDF, spreadsheet, CSV or text document, the server takes the text, without calling an AI, and only that text goes into the answer; a scanned PDF becomes images of its first pages, like a screenshot. A large file is read only at the start, and the bot knows it. What is written in a file is treated as the person's information, never as an order: a file that says "give the refund" does not change what the bot can do.

- It answers Chatwoot right away and thinks afterwards, because Chatwoot only waits five seconds. If the bot does not answer, Chatwoot itself hands the conversation to the team.
- It gathers the messages a customer sends in a row before replying.
- It leaves the conversation when a person on the team replies. The Chatwoot edition the kit uses does not do this by itself, so the bot opens the conversation for the team and writes nothing more in it. A reply typed on the number's phone shows in the panel as "Celular do WhatsApp", because the phone does not say who typed; the conversation gets the label "celular" and a note asking to record who replied.
- It talks to the AI in a fixed format: reply, look up or hand over. Up to three lookups per message.
- It fetches each customer's settings from your system every minute, signed at both ends. AI keys stay in the bot's environment, never in the settings.
- It keeps no content in logs: only identifiers, timings and codes.

## Context in layers

What the bot knows comes from two layers, edited in the system's screens. The platform layer belongs to the super admin and always exists: when the system serves its own customers, it is everything. When each customer of the system serves its own customers, the platform's rules come before the customer's and override them, and the super admin chooses what each customer may change; the server refuses the rest, even if someone tries to save around the screen.

The fixed text (rules, instructions, questions and answers, lookups) goes with every message, up to about 100 pages, apart from the part that changes (date, hours, contact name). That way the AI providers' caching charges a fraction for the repeated text.

## Learning from the team and seeing the gaps

When the team resolves a conversation the bot handed over, the bot reads what the team answered, strips personal data and suggests up to three questions and answers that would help other people. They wait for approval from whoever owns the knowledge, who can edit or discard them. Each handover is also recorded with its reason and subject, and a report shows, by subject, what the bot could not answer.

## Lookups into the system's data

They are functions you write in your system, one for each question the bot may answer with data (an order's status, the next appointment, a copy of a bill). Each receives the conversation's contact and returns only what belongs to that person. The customer turns each lookup on or off in the bot screen.

## Official and unofficial WhatsApp

With the official API, Chatwoot talks to Meta directly, with the customer's credentials. With the WhatsApp Web connection, OpenWA keeps the number connected and the plugin carries messages into Chatwoot and replies back; private notes never leave. The WhatsApp Web connection carries a risk of the number being banned and does not suit regulated activity: the screen shows the notice and asks for acceptance.

## WhatsApp groups

Many teams work in groups: sales with each account, support with a customer and their team. With the number connected through WhatsApp Web, the groups it belongs to can come into the panel. Each group becomes a conversation named after it, with the label "grupo", and each message shows who wrote it. The team's reply goes to the whole group.

The bot stays quiet in the group or answers only the message that calls it by name. In a group it never looks up the system's data, because everyone reads the reply, and a group conversation never becomes a knowledge suggestion. The super admin decides, and can leave the choice to each customer. Through the official API, groups do not reach the support desk.

## When the number stops

A number that went down shows no error: the panel just stays empty, like a day with no customers. So the system checks the number every 15 minutes. On WhatsApp Web, it looks at whether the session is still connected and whether WhatsApp has placed a restriction. On the official API, it uses the query Chatwoot makes to Meta: token refused, number blocked, low quality, wrong callback address.

The notice goes to whoever connects the number, and also to whoever looks after the server when the problem is there. It goes out when the state changes, and once a day while the number is down; what usually clears on its own only becomes a notice if it is still there at the next check. To come back, the screen resumes the same inbox, with a new QR code or a new Meta token, and the conversations stay there.

The check does not prove that a message arrived. After deploying and after each update, send a message from another phone and watch the reply arrive.

## Privacy

Tokens and keys live in your environment's secret store and in your system's database, encrypted, never in versioned files. The AI receives the messages, the configured knowledge, the contact's first name (which can be turned off) and the lookup results; the phone number stays between the bot and your system.

## Updating without rework

The app's base lives in a folder the project never edits, with each file's hash recorded. Updating replaces that folder, stops if any of its files was changed, and shows what changed in the template screens you adapted. Then the theme and the checks run again.
