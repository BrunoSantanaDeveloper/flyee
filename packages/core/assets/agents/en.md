# flyee.club

This project uses flyee.club apps, installed and updated by the `npx flyee` CLI. Each app is a set of skills, scripts and references under `.flyee/modules/<app>/`, with bridges in `.agents/skills/` and `.claude/skills/` so this AI can find them.

Rules for the AI in this project:

- Before doing a task an installed app covers, load its skill and follow it.
- Never edit files under `.flyee/`: `npx flyee update` replaces them. Local adjustments live in the project, not inside the app.
- To see installed apps, update, open an app's guide or see what is new, use the `flyee` skill (/flyee) or run `npx flyee status --json`.
- When an app asks for an external key, use the environment variable it declares; never ask for the key in plain text or write it into a project file.
- After using an app for real work, record the use with `npx flyee track tool.executed --module <app>`. Only the app name and version leave the machine, never content.

## Installed apps

{{apps}}

flyee core {{core_version}}. Dashboard, guides and help: {{site}}
