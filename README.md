# 2HTS Time Fairy

A Discord bot for the 2HTS community. It is a reboot of the discontinued 2HTSTimeBot: it answers time questions and offers small utilities, mini games and adds a bit of silliness.

## Features

| Command | What it does | Enabled |
| --- | --- | --- |
| `/time` | Shows the time until the next compo | on every server |
| `/roll` | Rolls dice, e.g. `2d6` or `d20`, optionally with advantage | per server |
| `/tarot` | A private tarot reading about your past, present or future | per server |
| `/randomgif` | Creates a randomized animated GIF | per server |
| `/reactionrole` | Posts a message where members pick their roles | per server |
| `/gendom3`, `/gendom4` | Party games, see [docs/gendom.md](docs/gendom.md) | while a round runs |
| `/admin` | Bot and server administration | always |

Optionally the bot also comments on "Now Playing" posts with AI, see [AI track comments](#ai-track-comments).

Module names (the `app` option of `/admin`) are `time`, `dice`, `tarot`, `randomgif`, `reactionrole`. The `dice` module provides the `/roll` command. `ping` and `react` exist as modules but are not enabled on servers by default.

## Requirements

- **Node.js 24 (LTS) or newer** and npm 11 or newer.
- A Discord application with a bot user. The **Message Content** intent must be enabled in the Discord developer portal.
- `canvas` (used for GIFs) ships prebuilt binaries for common platforms. On other platforms it compiles from source and needs the Cairo development libraries.

## Inviting the bot

The invite links request only the permissions the bot needs: View Channels, Send Messages, Embed Links, Attach Files, Add Reactions, Read Message History and Manage Roles (for `/reactionrole`; the bot's role must be above the roles it hands out).

- **TimeFairy** (production): `https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=268553280&scope=bot%20applications.commands`
- **FakeFairy** (test bot): `https://discord.com/api/oauth2/authorize?client_id=888106813789200405&permissions=268553280&scope=bot%20applications.commands`

## Setup

```bash
git clone https://github.com/vaiavgm/two-hts-time-fairy.git
cd two-hts-time-fairy
npm install
cp .env.example .env     # then fill in the tokens, see Configuration
```

1. Set `DISCORD_TOKEN` (TimeFairy) and, if you want the test bot, `FAKE_TOKEN` (FakeFairy) in `.env`.
2. Check `config.json` (production servers) and `config-local.json` (test servers). These hold the server IDs that `deploy-commands.js` registers commands on.
3. Register the slash commands once, and again after command changes:

   ```bash
   node deploy-commands.js prod     # TimeFairy
   node deploy-commands.js test     # FakeFairy
   node deploy-commands.js prod --clear-global   # also remove leftover global commands (duplicates)
   ```

   The target is always given explicitly. The `TESTING` setting in `.env` does not decide which bot is deployed.
4. Start the bot with `npm start`.

## Configuration

All settings live in `.env` (see `.env.example`).

| Variable | Purpose |
| --- | --- |
| `DISCORD_TOKEN` | Token of the production bot (TimeFairy) |
| `FAKE_TOKEN` | Token of the test bot (FakeFairy) |
| `TESTING` | **Set to any value** to run as FakeFairy. The check is "is the variable defined", so an empty `TESTING=` also switches to FakeFairy. Remove the line for production. |
| `CHORUS_BOT_ID`, `CHORUS_CHANNEL_ID` | Optional Chorus relay, see [Now Playing channels and Chorus relay](#now-playing-channels-and-chorus-relay) |
| `DATA_DIR` | Folder for small runtime files, default `./data`. Must survive restarts. |
| `AI_*`, `ANTHROPIC_*`, `OPENAI_*`, `GEMINI_*` | Optional AI track comments, see below |

`TESTING` only decides which token `app/bot.js` logs in with. It does not change slash command registration.

## Running

`npm start` runs `node app/bot.js`.

- A single failing command or event only logs an error.
- If 10 unexpected errors happen within a minute, a fatal login problem occurs, or Discord invalidates the session, the bot waits 15 seconds and exits with code 1. The delay stops a host that restarts it immediately from using up Discord's daily limit of new gateway sessions. Turn on automatic restart after a crash in your host's panel, otherwise the bot stays offline after such an exit.
- A stop or restart signal (SIGTERM, e.g. from a host panel) or Ctrl+C closes the Discord connection and exits with code 0. A second signal exits at once.

### Automatic restart on push

`.github/workflows/restart-bot.yml` restarts the bot on the SparkedHost panel after every push or merge into `main` (changes to only docs, tests or Markdown are skipped). The panel's startup command then runs `git pull` and `npm install`, so the new code goes live. It can also be started by hand under Actions → Restart bot → Run workflow.

1. In the panel, open Account → API Credentials and create a key.
2. In GitHub, open the repo's Settings → Secrets and variables → Actions and add the secret `PANEL_API_KEY` with that key.
3. Optional repository variables: `PANEL_URL` (default `https://control.sparkedhost.us`) and `PANEL_SERVER_ID` (default `2e318161`).

If the run fails with HTTP 401 or 403 and an HTML page, the key is wrong or Cloudflare blocked the request.

## Commands for server admins

`/admin` is visible to everybody in the command picker. Its actions are limited to bot admins, server Administrators and members with the `@moderator` role.

`/admin` is a single command: pick `app`, then `action`. The `action` list only shows what the chosen app supports. The remaining options (`minutes`, `sources`, `user`, `confirm`) say in their description which action reads them. Options an action does not read are ignored, and the bot says so privately.

- `/admin app:<module> action:activate|deactivate confirm:True` enables or disables a module's slash command on the current server. Bot admins only.
- `/admin app:gendom3 action:…` and `/admin app:gendom4 action:…` run the party games, see [docs/gendom.md](docs/gendom.md).
- `/admin app:nowplaying action:register|unregister|channels` chooses the channels that get Chorus entries, length warnings and AI comments, see [Now Playing channels and Chorus relay](#now-playing-channels-and-chorus-relay). Bot admins only.

To hide `/admin` from non-admins, set `setDefaultMemberPermissions(PermissionFlagsBits.Administrator)` on it. Then bot admins who are not server Administrators can only use it if a server admin allows them under Server Settings → Integrations.

How the commands end up on each server is described in [docs/slash-commands.md](docs/slash-commands.md).

## Now Playing channels and Chorus relay

The bot only posts track-related messages (Chorus entries, the 3:30 length warning, AI comments) in channels a bot admin registered. Every other channel and server stays quiet, even while a party runs.

- `/admin app:nowplaying action:register` registers the current channel, `unregister` removes it, `channels` lists the server's registered channels. Bot admins only.
- The list is stored in `DATA_DIR/now-playing-channels.json`.
- "Now Playing: Track by Author [m:ss]" posts typed by track reporters (see `app/system/auth.js`) are only handled in registered channels.

Chorus, the bot that runs the listening party, posts its entries in its own server. Instead of people copying them, Time Fairy can copy them itself:

1. Invite Time Fairy to the Chorus server. It only needs View Channel and Read Message History in the Chorus channel. It never posts there.
2. Set `CHORUS_BOT_ID` (Chorus's user ID) and `CHORUS_CHANNEL_ID` (where Chorus posts) in `.env`. Discord: enable Developer Mode, then right-click > Copy ID.
3. Restart the bot. The startup log says whether the relay is on and how many channels are registered.

Each entry is posted into every registered channel as `Now Playing: Track by Author [m:ss]` with the round and entry number below it. The length warning and the AI comment follow there. Copying by hand still works. A track announced both ways in the same channel within its length is only handled once.

## AI track comments

When a "Now Playing: Track by Author [m:ss]" message is posted, the bot can add one short comment at a random point between 40% and 85% of the track. A new "Now Playing" in the same channel cancels the pending comment. The 3:30 length warning is separate and always uses fixed text.

- `AI_ENABLED=true` turns it on.
- `AI_PROVIDER` is the main provider (`anthropic`, `openai` or `gemini`). `AI_FALLBACK` is an ordered, comma-separated list tried if it fails.
- Each provider has `*_API_KEY`, optional `*_MODEL` and optional `*_BASE_URL`. The OpenAI setting also works with OpenAI-compatible servers such as Ollama or OpenRouter.
- `app/ai/prompts.txt`: one prompt per line. `{track}` and `{author}` are filled in. Edit freely, no restart needed.
- `app/ai/fallback.txt`: generic compliments, one picked at random when no provider works. Same placeholders.
- Test a provider without Discord: `node scripts/ai-test.js "Track" "Author" openai`

## Development

```bash
npm test         # unit tests (node --test)
npm run lint     # ESLint
```

Project layout:

```
app/bot.js            entry point, login and event handling
app/modules/          slash commands (one file per command)
app/system/           shared logic: command registry, admin rules, games
app/ai/               AI track comments and providers
scripts/              helper scripts, e.g. ai-test.js
test/                 tests for command registry and games
deploy-commands.js    registers slash commands with Discord
```

### Visual Studio

The repository includes a Visual Studio solution for Node.js projects: `two-hts-time-fairy.sln` and `two-hts-time-fairy.njsproj` (plus `two-hts-time-fairy2.esproj`). Open the `.sln` with the Node.js workload installed. The VS Code debug configuration is in `.vscode/launch.json`. Files that are specific to your own machine (`.vs/`, `*.suo`, `*.user`) are ignored by git.

## Documentation

- [docs/gendom.md](docs/gendom.md): Gendom 3 and Gendom 4 rules, host actions and permissions
- [docs/slash-commands.md](docs/slash-commands.md): how commands are registered per server
