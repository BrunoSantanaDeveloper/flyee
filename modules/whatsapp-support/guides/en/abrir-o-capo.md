# Inside WhatsApp support

## The pieces

- **Chatwoot**, community edition: the inbox and the team's panel. The app pins a version and never changes its code.
- **Support bot**: a small service with no database and no dependencies that receives Chatwoot's events, asks your system and the AI, and replies or hands over to the team.
- **OpenWA**, only for the WhatsApp Web connection, with the plugin that links it to Chatwoot.
- **Your system**: creates each customer's Chatwoot account, the team members as agents, the bot of each account, single sign-on, the connect and settings screens, and the lookups the bot may run.

## One login

The person clicks "Support" in your system. The system's server asks Chatwoot for a sign-in link that lasts five minutes and works once, and the panel opens already signed in. Everyone who signs in is an agent: inbox, bot and integration settings stay with the service account the system created, which nobody uses to sign in. In frame mode, the panel opens inside a page of your system, with its menu around it.

## Who answers

Only the people the system marks as the support team get into the panel. For the platform's own support, that is the support team and the super admin; when each customer of the system serves its own customers, it is the team the customer chose and whoever manages that customer. Each customer has its own Chatwoot account, with its own number, conversations and team, and no one at one customer sees another. There is no limit on agents. A conversation the bot hands over goes in turn to whoever is online.

Whoever leaves the team also leaves Chatwoot, and the conversations that were theirs go back to the queue. A daily check removes anyone left behind, because a panel session lasts up to two months.

## The panel in your brand

The app saves your system's name, logos and addresses in Chatwoot, plus a theme built from your choices: the main color becomes a twelve-step scale in light and dark mode, and each place where Chatwoot hardcoded its own color gets a rule of its own. Features the customer does not use disappear from the menu through Chatwoot's own settings; anything else that must go is hidden with CSS, never deleted. A browser check signs in as a test person, opens the screens, confirms the color and what was hidden, and saves screenshots.

## Inside the bot

- It answers Chatwoot right away and thinks afterwards, because Chatwoot only waits five seconds. If the bot does not answer, Chatwoot itself hands the conversation to the team.
- It gathers the messages a customer sends in a row before replying.
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

## Privacy

Tokens and keys live in your environment's secret store and in your system's database, encrypted, never in versioned files. The AI receives the messages, the configured knowledge, the contact's first name (which can be turned off) and the lookup results; the phone number stays between the bot and your system.

## Updating without rework

The app's base lives in a folder the project never edits, with each file's hash recorded. Updating replaces that folder, stops if any of its files was changed, and shows what changed in the template screens you adapted. Then the theme and the checks run again.
