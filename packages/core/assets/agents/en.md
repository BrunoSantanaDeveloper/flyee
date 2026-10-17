# flyee.club

This project uses flyee.club apps, installed and updated by the flyee CLI, which you always run as `npx --yes flyee@latest <command>`: `--yes` answers the question npx asks before downloading, and `@latest` always uses the same copy. Each app is a set of skills, scripts and references under `.flyee/modules/<app>/`, with bridges in `.agents/skills/` and `.claude/skills/` so this AI can find them.

**The member does not use the terminal: you run everything.** They only confirm in the conversation what you will do, approve the login in the browser and paste keys in a page the CLI opens in their browser.

Rules for the AI in this project:

- Before doing a task an installed app covers, load its skill and follow it.
- One project per brand or client, each in its own folder. What the apps learn (the voice, the brand) and what they deliver stays in the project's folder, and a brand's work always goes in its folder: do not ask the member where to keep it. If the brand or client has no project yet, say in one sentence that you will create it and run `npx --yes flyee@latest new <name> --yes --json` (10-minute time limit), which takes the apps of this project. To take apps this project does not have (`--apps a,b`), run it first with `--dry-run --json`, say in one sentence what each new app asks for (permissions, keys, programs) and wait for the yes. The CLI creates the folder inside the folder that holds the projects and returns its path in `path`. With `next_step` as `work_in_folder`, go on in this conversation: run the apps' commands and scripts with the project's folder as the working directory and read the apps' skills in `<folder>/.flyee/modules/<app>/skills/`; with `open_folder`, follow the result's message. In a folder that holds projects, each app command (`status`, `add`, `update`, `remove`) applies to one brand's project: run it with that brand's folder as the working directory. `npx --yes flyee@latest projects --json` lists the projects on this machine.
- Portuguese text meant for an audience (a script, a post, a caption, a page): before delivering it, review it with the `texto-natural` skill, which removes the marks of AI-generated text. A voice the member defined in an app takes precedence over it.
- Programs an app uses (ffmpeg, yt-dlp and others): install them yourself with `npx --yes flyee@latest need <program> --yes --json`, after saying in one sentence what you will install. Use a long time limit (10 minutes). Only when the result carries `needs_member` (an administrator password, a missing package manager), show the member the one step it gives. Never hand them install commands to run.
- Apps' external keys (for APIs): run `npx --yes flyee@latest key set <NAME> --browser --json` yourself. It opens a page in the member's browser where they paste the key; it lives in `~/.flyee/keys.json`, outside the project, and never goes through the conversation. To see what is missing, `npx --yes flyee@latest key list --json` (names only).
- Never ask for a key in plain text, never put it in a command, never open `~/.flyee/keys.json` and never write a key into a project file.
- Expired connection or disconnected machine: run `npx --yes flyee@latest login` yourself with a 5-minute time limit; the member only approves in the browser.
- Never edit files under `.flyee/`: `npx --yes flyee@latest update` replaces them. Local adjustments live in the project, not inside the app.
- To see installed apps, update, open an app's guide or see what is new, use the `flyee` skill (/flyee) or run `npx --yes flyee@latest status --json`.
- After using an app for real work, record the use with `npx --yes flyee@latest track tool.executed --module <app>`. Only the app name and version leave the machine, never content.

## Installed apps

{{apps}}

flyee core {{core_version}}. Dashboard, guides and help: {{site}}
