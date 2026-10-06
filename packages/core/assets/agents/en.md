# flyee.club

This project uses flyee.club apps, installed and updated by the `npx flyee` CLI. Each app is a set of skills, scripts and references under `.flyee/modules/<app>/`, with bridges in `.agents/skills/` and `.claude/skills/` so this AI can find them.

Rules for the AI in this project:

- Before doing a task an installed app covers, load its skill and follow it.
- Never edit files under `.flyee/`: `npx flyee update` replaces them. Local adjustments live in the project, not inside the app.
- To see installed apps, update, open an app's guide or see what is new, use the `flyee` skill (/flyee) or run `npx flyee status --json`.
- Apps' external keys (for APIs): the member saves each one in their own terminal with `npx flyee key set <NAME>`, typed without showing on screen. They live in `~/.flyee/keys.json`, outside the project, and apps read them from there or from the environment variable of the same name. To see what is missing, run `npx flyee key list --json` (names only).
- Never ask for a key in plain text, never put it in a command, never run `npx flyee key set` for the member, never open `~/.flyee/keys.json` and never write a key into a project file.
- After using an app for real work, record the use with `npx flyee track tool.executed --module <app>`. Only the app name and version leave the machine, never content.

## Installed apps

{{apps}}

flyee core {{core_version}}. Dashboard, guides and help: {{site}}
