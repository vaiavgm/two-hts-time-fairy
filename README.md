This is a reboot of the 2HTSTimeBot, which was discontinued.

The bot shall serve the 2HTS community with queries regarding time, and also provide some utility for mini games or silly jokes


Bot invitation link:
https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=268553280&scope=bot%20applications.commands

Fake bot invitation link:
https://discord.com/api/oauth2/authorize?client_id=888106813789200405&permissions=268553280&scope=bot%20applications.commands

The links request the minimum permissions the bot needs: View Channels, Send Messages, Embed Links, Attach Files, Add Reactions, Read Message History and Manage Roles (for /reactionrole; the bot's role must be above the roles it hands out). The Message Content intent must also be enabled in the Discord developer portal.

Registering slash commands (run from a machine that has the `.env`):

    node deploy-commands.js prod     # the real TimeFairy
    node deploy-commands.js test     # the FakeFairy
    node deploy-commands.js prod --clear-global   # also remove leftover global commands (duplicates)

The target is always given explicitly; the TESTING setting in `.env` only affects which bot `app/bot.js` runs as.

## AI track comments

When a "Now Playing: Track by Author [m:ss]" message is posted, the bot can add one short comment at a random point between 40% and 85% of the track (a new "Now Playing" in the same channel cancels the pending one). The 3:30 length warning is separate and always fixed text.

Configure it in `.env` (see `.env.example`):

- `AI_ENABLED=true` turns it on. `AI_PROVIDER` is the main provider (`anthropic`, `openai` or `gemini`), `AI_FALLBACK` an ordered, comma-separated list tried if it fails.
- Each provider has `*_API_KEY`, optional `*_MODEL` and optional `*_BASE_URL` (the OpenAI one also works with OpenAI-compatible servers such as Ollama or OpenRouter).
- `app/ai/prompts.txt`: one prompt per line, `{track}` and `{author}` are filled in. Edit freely, no restart needed.
- `app/ai/fallback.txt`: generic compliments, one picked at random when no provider works. Same placeholders.
- Try a provider without Discord: `node scripts/ai-test.js "Track" "Author" openai`

## Gendom 3

Players send a word (e.g. "dank") and get a random genre combined with somebody else's word (e.g. "wet Techno"). Everything players see is ephemeral (no DMs). One round per channel, kept in memory only: a bot restart ends all rounds.

Players:

- `/gendom3 join word:<word>` joins the round (the bot announces the join, the word stays secret). Joining again before the themes are out changes your word.
- `/gendom3 theme` shows your theme again, privately.

Hosts, via `/admin gendom3 <action>`:

- `start` opens a round in the current channel.
- `distribute` hands out the themes (at least 2 players). Players whose join message is younger than 14 minutes get an ephemeral reply to it; everybody else is mentioned once and uses `/gendom3 theme`. Nobody gets their own word; identical text from two players is avoided where possible. Players joining afterwards get a theme immediately (words may repeat, never their own).
- `list` posts everybody's theme publicly (without pinging).
- `close` ends the round, stops further joins and frees its memory.

Who may use these: bot admins (`app/system/auth.js`), members with the `@moderator` role and server Administrators (rules in `app/system/game-admin.js`). To add another game, add its module name to `GAME_APPS` there and export `start`/`distribute`/`list`/`close` functions from the module.

`/admin slash activate|deactivate module:<module> confirm:True` enables or disables a module's slash command (`time`, `tarot`, `dice`, `randomgif`, `reactionrole`) on the current server. Bot admins only. `/admin` is visible to everybody in the command picker; to hide it, set `setDefaultMemberPermissions(PermissionFlagsBits.Administrator)` on it, but then bot admins who are not server Administrators on a server can no longer use it unless a server admin allows them under Server Settings > Integrations.

### Slash commands per server

`app/system/command-registry.js` decides which commands each server has and makes Discord match (`guild.commands.set`):

- `/admin` is always there.
- Default modules (a module exporting `defaultEnabled: true`, currently `time`) are added to every managed server at startup, so a bot update that introduces one shows up without any manual step. If an admin switches one off on a server (`/admin slash deactivate`), that is remembered in `command-opt-outs.json` and it stays off until it is activated again.
- Other permanent modules are the ones switched on with `/admin slash activate`; Discord remembers them and the bot re-reads them at startup.
- Game commands exist only while a round runs: `/admin gendom3 start` adds `/gendom3` to the server, and `close` removes it again once the last round of that server is over (rounds are per channel, the command is per server).
- At every startup the bot syncs each server that already has commands from it: permanent and default commands are kept or added, changed definitions (descriptions, options) are updated, game commands (no round survives a restart) and unknown leftovers are removed. A server is left alone if an unknown command could belong to a module that failed to load.

The opt-out file is written to `DATA_DIR` (default `./data`, see `.env.example`), which must survive restarts. If it is lost, the only effect is that default commands switched off by an admin come back at the next startup.

`deploy-commands.js` still registers `/admin` and `/time` from `config.json`. `/admin` changed (subcommands), so re-register it with `node deploy-commands.js prod` (or `test`).

Tests for the game logic: `npm test`.
