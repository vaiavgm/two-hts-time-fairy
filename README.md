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

## Running and stopping

Start the bot with `npm start` (`node app/bot.js`). A single failing command or event only logs an error. If 10 unexpected errors happen within a minute, a fatal login problem occurs, or Discord invalidates the session, the bot waits 15 seconds and then exits with code 1; the 15 seconds keep a host that restarts it immediately from burning through Discord's daily limit of new gateway sessions. Turn on the automatic restart after a crash in the host's panel, otherwise the bot stays offline after such an exit.

A stop or restart from the panel (SIGTERM) or Ctrl+C closes the Discord connection and exits with code 0; a second signal exits at once.

## AI track comments

When a "Now Playing: Track by Author [m:ss]" message is posted, the bot can add one short comment at a random point between 40% and 85% of the track (a new "Now Playing" in the same channel cancels the pending one). The 3:30 length warning is separate and always fixed text.

Configure it in `.env` (see `.env.example`):

- `AI_ENABLED=true` turns it on. `AI_PROVIDER` is the main provider (`anthropic`, `openai` or `gemini`), `AI_FALLBACK` an ordered, comma-separated list tried if it fails.
- Each provider has `*_API_KEY`, optional `*_MODEL` and optional `*_BASE_URL` (the OpenAI one also works with OpenAI-compatible servers such as Ollama or OpenRouter).
- `app/ai/prompts.txt`: one prompt per line, `{track}` and `{author}` are filled in. Edit freely, no restart needed.
- `app/ai/fallback.txt`: generic compliments, one picked at random when no provider works. Same placeholders.
- Try a provider without Discord: `node scripts/ai-test.js "Track" "Author" openai`

## Gendom 3 and Gendom 4

Two party games that share one engine (`app/system/gendom.js`, shuffle logic in `app/system/gendom-logic.js`):

- **Gendom 3**: players send a word (e.g. "dank") and get a random genre combined with somebody else's word (e.g. "wet Techno").
- **Gendom 4**: players write a little sentence in four parts: **who** (`the dog`, singular so it fits the verbs; a plural still reads fine, e.g. "The students eats pizza"), **does what** (`eats pizza`), **where** (`in the kitchen`), **when** (`at midnight`). The parts are shuffled, so everybody gets a sentence made of other players' parts, e.g. "The telephone eats pizza on the moon after school."

Everything players see is ephemeral (no DMs). One round per channel and game, kept in memory only: a bot restart ends all rounds.

Players:

- `/gendom3 join word:<word>` or `/gendom4 join who:<…> does-what:<…> where:<…> when:<…>` joins the round (the bot announces the join, the entry stays secret). Joining again before the themes are out changes your entry. There is deliberately no way to leave a round: `join` is the only command, everybody is removed when the round is closed, and anybody who does not want to play can simply ignore their theme. An entry with a blank part (or one without any letter or digit) is rejected with a private message naming the part and giving examples.
- `/gendom3 theme` / `/gendom4 theme` shows your theme again, privately.

Hosts, via `/admin gendom3 <action>` or `/admin gendom4 <action>`:

- `start [minutes]` opens a round in the current channel and posts how to play. It also posts a status message that the bot edits as players join (`3 players joined`, then a numbered list of names, each marked `joined`, later `theme ready`, finally `closed`). Edits are merged, at most one every 2 seconds, and the list is cut off with `... and N more` before Discord's message limit. With `minutes` (clamped to 1-60; unset means no limit) the status message has a line `N minutes left to join` (whole minutes, fractions floored, refreshed every minute; in the last minute it changes to `Less than 50 seconds left to join!` and is refreshed every 10 seconds, six more edits in total, far below Discord's limit for message edits; no line without a limit) and the channel gets a reminder one minute before the end ("hurry up"; not for a one minute round). When the time is up the themes are handed out automatically, exactly as if the host had run `distribute` (same private replies, same summary in the channel). With fewer than 2 players at that point nothing is handed out: the bot says so, the countdown line disappears, and the host can wait for more players and `distribute`, or `close` the round. Running `distribute` or `close` before the time is up cancels the timer. After `distribute` the status message says `Latecomers may still use /gendom4 join.` and keeps listing latecomers. The status message and the reminder are normal channel messages, so the bot needs permission to send messages there; without it the round still works, just without them.
- `distribute` hands out the themes (at least 2 players). The private replies go out in batches of 5 with a pause of a second between them, so a big round takes a little while and does not run into Discord's rate limits. Players whose join message is younger than 14 minutes get an ephemeral reply to it; everybody else is mentioned once and uses `theme`. The players are put in a random order and each part is taken from the player a random number of places further on, a different number per part, so nobody gets their own words and every word is used exactly once. In Gendom 4 the four parts come from four different players when there are at least 5 players; with fewer, the count wraps around and one player may provide two parts, but never both **who** and **does what** (that would just be the start of their original sentence) unless there are only 2 players. Identical text from two players is avoided where possible.
- Players joining after `distribute` get a theme immediately: their words are added to a pool of all words, and they draw from it (never their own words, from different players where possible). Drawn words are removed from the pool, so the next latecomer does not get the same ones; since every latecomer adds as many words as they take, the pool never runs out.
- `list` posts everybody's theme publicly (without pinging). With `sources:True`, the names of the players whose words make up each theme follow it, in order: `@player: The telephone eats pizza on the moon after school. (Anna, Ben, Cleo, Dan)`.
- `kick user:<player>` removes a player's entry before `distribute` (for example something offensive); the player can join again. Afterwards nobody can be removed, because their words are part of other players' themes. Nothing is pinged.
- `close` ends the round, stops further joins and frees its memory.

Who may use these: bot admins (`app/system/auth.js`), members with the `@moderator` role and server Administrators (rules in `app/system/game-admin.js`). To add another game, add its module name to `GAME_APPS` there and export `start`/`distribute`/`list`/`close` functions from the module (a Gendom-style game gets them all from `createGame` in `app/system/gendom.js`, see `app/modules/gendom4.js`).

`/admin slash activate|deactivate module:<module> confirm:True` enables or disables a module's slash command (`time`, `tarot`, `dice`, `randomgif`, `reactionrole`) on the current server. Bot admins only. `/admin` is visible to everybody in the command picker; to hide it, set `setDefaultMemberPermissions(PermissionFlagsBits.Administrator)` on it, but then bot admins who are not server Administrators on a server can no longer use it unless a server admin allows them under Server Settings > Integrations.

### Slash commands per server

`app/system/command-registry.js` decides which commands each server has and makes Discord match (`guild.commands.set`):

- `/admin` is always there.
- Default modules (a module exporting `defaultEnabled: true`, currently `time`) are added to every managed server at startup, so a bot update that introduces one shows up without any manual step. If an admin switches one off on a server (`/admin slash deactivate`), that is remembered in `command-opt-outs.json` and it stays off until it is activated again.
- Other permanent modules are the ones switched on with `/admin slash activate`; Discord remembers them and the bot re-reads them at startup. `/reactionrole` is such a module (it is marked `defaultEnabled: false`): it never appears on a server by itself, only after `/admin slash activate module:reactionrole`, and `deactivate` removes it again.
- Game commands exist only while a round runs: `/admin gendom3 start` adds `/gendom3` to the server (likewise for `gendom4`), and `close` removes it again once the last round of that server is over (rounds are per channel, the command is per server).
- At every startup the bot syncs each server that already has commands from it: permanent and default commands are kept or added, changed definitions (descriptions, options) are updated (Discord is not called at all if a server already matches), game commands (no round survives a restart) and unknown leftovers are removed. A server is left alone if an unknown command could belong to a module that failed to load.

The opt-out file is written to `DATA_DIR` (default `./data`, see `.env.example`), which must survive restarts. If it is lost, the only effect is that default commands switched off by an admin come back at the next startup.

`deploy-commands.js` still registers `/admin` and `/time` from `config.json`. `/admin` changed (subcommands, the `gendom3`/`gendom4` groups with `list sources`, `start minutes` and `kick user`; it is now limited to servers), so re-register it with `node deploy-commands.js prod` (or `test`).

Tests for the game logic: `npm test`.
