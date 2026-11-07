# Inside WhatsApp support

## The pieces

- **Chatwoot**, community edition: the inbox and the team's panel. The app pins a version and never changes its code.
- **Support bot**: a small service with no database and no dependencies that receives Chatwoot's events, asks your system and the AI, and replies or hands over to the team.
- **OpenWA**, only for the WhatsApp Web connection, with the plugin that links it to Chatwoot.
- **Your system**: creates each customer's Chatwoot account, the team members as agents, the bot of each account, single sign-on, the connect and settings screens, and the lookups the bot may run.

## One login

The person clicks "Support" in your system. The system's server asks Chatwoot for a sign-in link that lasts five minutes and works once, and the panel opens already signed in. Everyone who signs in is an agent: inbox, bot and integration settings stay with the service account the system created, which nobody uses to sign in. In frame mode, the panel opens inside a page of your system, with its menu around it.

## The panel in your brand

The app saves your system's name, logos and addresses in Chatwoot, plus a theme built from your choices: the main color becomes a twelve-step scale in light and dark mode, and each place where Chatwoot hardcoded its own color gets a rule of its own. Features the customer does not use disappear from the menu through Chatwoot's own settings; anything else that must go is hidden with CSS, never deleted. A browser check signs in as a test person, opens the screens, confirms the color and what was hidden, and saves screenshots.

## Inside the bot

- It answers Chatwoot right away and thinks afterwards, because Chatwoot only waits five seconds. If the bot does not answer, Chatwoot itself hands the conversation to the team.
- It gathers the messages a customer sends in a row before replying.
- It talks to the AI in a fixed format: reply, look up or hand over. Up to three lookups per message.
- It fetches each customer's settings from your system every minute, signed at both ends. AI keys stay in the bot's environment, never in the settings.
- It keeps no content in logs: only identifiers, timings and codes.

## Lookups into the system's data

They are functions you write in your system, one for each question the bot may answer with data (an order's status, the next appointment, a copy of a bill). Each receives the conversation's contact and returns only what belongs to that person. The customer turns each lookup on or off in the bot screen.

## Official and unofficial WhatsApp

With the official API, Chatwoot talks to Meta directly, with the customer's credentials. With the WhatsApp Web connection, OpenWA keeps the number connected and the plugin carries messages into Chatwoot and replies back; private notes never leave. The WhatsApp Web connection carries a risk of the number being banned and does not suit regulated activity: the screen shows the notice and asks for acceptance.

## Privacy

Tokens and keys live in your environment's secret store and in your system's database, encrypted, never in versioned files. The AI receives the messages, the configured knowledge, the contact's first name (which can be turned off) and the lookup results; the phone number stays between the bot and your system.

## Updating without rework

The app's base lives in a folder the project never edits, with each file's hash recorded. Updating replaces that folder, stops if any of its files was changed, and shows what changed in the template screens you adapted. Then the theme and the checks run again.
