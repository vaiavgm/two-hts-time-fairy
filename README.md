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

Admins (the list in `app/system/auth.js`), via `/admin application:gendom3 command:...`:

- `start` opens a round in the current channel.
- `distribute` hands out the themes (at least 2 players). Players whose join message is younger than 14 minutes get an ephemeral reply to it; everybody else is mentioned once and uses `/gendom3 theme`. Nobody gets their own word; identical text from two players is avoided where possible. Players joining afterwards get a theme immediately (words may repeat, never their own).
- `list` posts everybody's theme publicly (without pinging).
- `close` ends the round, stops further joins and frees its memory.

The command definition changed (subcommands), so re-register it: `node deploy-commands.js prod` (or `test`), or `/admin application:gendom3 command:Activate Slash Command confirm:confirm`.

Tests for the game logic: `npm test`.
