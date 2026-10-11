# flyee.club

This project uses flyee.club apps, installed and updated by the `npx flyee` CLI. Each app is a set of skills, scripts and references under `.flyee/modules/<app>/`, with bridges in `.agents/skills/` and `.claude/skills/` so this AI can find them.

**The member does not use the terminal: you run everything.** They only confirm in the conversation what you will do, approve the login in the browser and paste keys in a page the CLI opens in their browser.

Rules for the AI in this project:

- Before doing a task an installed app covers, load its skill and follow it.
- Portuguese text meant for an audience (a script, a post, a caption, a page): before delivering it, review it with the `texto-natural` skill, which removes the marks of AI-generated text. A voice the member defined in an app takes precedence over it.
- Programs an app uses (ffmpeg, yt-dlp and others): install them yourself with `npx flyee need <program> --yes --json`, after saying in one sentence what you will install. Use a long time limit (10 minutes). Only when the result carries `needs_member` (an administrator password, a missing package manager), show the member the one step it gives. Never hand them install commands to run.
- Apps' external keys (for APIs): run `npx flyee key set <NAME> --json` yourself. It opens a page in the member's browser where they paste the key; it lives in `~/.flyee/keys.json`, outside the project, and never goes through the conversation. To see what is missing, `npx flyee key list --json` (names only).
- Never ask for a key in plain text, never put it in a command, never open `~/.flyee/keys.json` and never write a key into a project file.
- Expired connection or disconnected machine: run `npx flyee login` yourself with a 5-minute time limit; the member only approves in the browser.
- Never edit files under `.flyee/`: `npx flyee update` replaces them. Local adjustments live in the project, not inside the app.
- To see installed apps, update, open an app's guide or see what is new, use the `flyee` skill (/flyee) or run `npx flyee status --json`.
- After using an app for real work, record the use with `npx flyee track tool.executed --module <app>`. Only the app name and version leave the machine, never content.

## Installed apps

{{apps}}

flyee core {{core_version}}. Dashboard, guides and help: {{site}}
