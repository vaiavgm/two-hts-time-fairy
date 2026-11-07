# Gendom 3 and Gendom 4

Two party games sharing one engine (`app/system/gendom.js`, shuffle logic in `app/system/gendom-logic.js`).

- **Gendom 3**: players send a word (e.g. `dank`) and get a random genre combined with somebody else's word (e.g. `wet Techno`).
- **Gendom 4**: players write a sentence in four parts: **who** (`the dog`, singular so it fits the verbs; a plural still reads fine, e.g. `The students eats pizza`), **does what** (`eats pizza`), **where** (`in the kitchen`) and **when** (`at midnight`). The parts are shuffled, so everybody gets a sentence made of other players' parts, e.g. `The telephone eats pizza on the moon after school.`

Everything players see is ephemeral (no DMs). One round per channel and game, kept in memory only: a bot restart ends all rounds.

## Players

- `/gendom3 join word:<word>` or `/gendom4 join who:<…> does-what:<…> where:<…> when:<…>` joins the round. The bot announces the join; the entry itself stays secret.
- Joining again before the themes are out changes your entry.
- There is deliberately no way to leave a round. Anybody who does not want to play can ignore their theme. Everybody is removed when the round is closed.
- An entry with a blank part (or a part without any letter or digit) is rejected with a private message naming the part and giving examples.
- `/gendom3 theme` or `/gendom4 theme` shows your theme again, privately.

## Hosts

Hosts use `/admin app:gendom3 action:<action>` or `/admin app:gendom4 action:<action>`. Allowed users are listed in [Permissions](#permissions) below.

| Action | What it does |
| --- | --- |
| `start`, optional `minutes` | Opens a round in the current channel and posts how to play, plus a status message the bot edits as players join. |
| `distribute` | Hands out the themes (at least 2 players). |
| `list` | Posts everybody's theme publicly, without pinging. |
| `list sources:True` | As `list`, with the names of the players whose words make up each theme. |
| `kick` with `user:<player>` | Removes a player's entry before `distribute`. |
| `close` | Ends the round, stops joins and frees its memory. |

### `start`

- The status message lists joined players (`3 players joined`, then a numbered list marked `joined`, later `theme ready`, finally `closed`). Edits are merged and sent at most once every 2 seconds. The list is cut off with `... and N more` before Discord's message limit.
- With `minutes` (clamped to 1–60; unset means no limit), the status message shows `N minutes left to join`, refreshed every minute. In the last minute it changes to `Less than 50 seconds left to join!` and is refreshed every 10 seconds.
- The channel gets a reminder one minute before the end (not for a one-minute round).
- When time is up the themes are handed out automatically, exactly as if the host had run `distribute`.
- With fewer than 2 players at that point nothing is handed out. The bot says so, the countdown line disappears, and the host can wait for more players and `distribute`, or `close` the round.
- Running `distribute` or `close` before the time is up cancels the timer.
- The status message and reminder are normal channel messages, so the bot needs permission to send messages there. Without it the round still works, just without them.

### `distribute`

- Private replies go out in batches of 5 with a pause of one second between them, so large rounds stay under Discord's rate limits.
- Players whose join message is younger than 14 minutes get an ephemeral reply to it. Everybody else is mentioned once and uses `theme`.
- Players are put in random order. Each part is taken from a player a random number of places further on, with a different number per part, so nobody gets their own words and every word is used exactly once.
- Gendom 4 takes its four parts from four different players when there are at least 5 players. With fewer, the count wraps around and one player may provide two parts, but never both **who** and **does what** (that would just restore their original sentence), unless there are only 2 players.
- Identical text from two players is avoided where possible.
- After `distribute` the status message says `Latecomers may still use /gendom4 join.` and keeps listing latecomers.

### Latecomers

Players joining after `distribute` get a theme immediately. Their words join a pool of all words, and they draw from it, never from their own words and preferably from different players. Drawn words leave the pool, so the next latecomer does not get the same ones. Every latecomer adds as many words as they take, so the pool never runs out.

### `list sources:True`

```
@player: The telephone eats pizza on the moon after school. (Anna, Ben, Cleo, Dan)
```

### `kick`

Removes a player's entry before `distribute`, for example something offensive. The player can join again. After `distribute` nobody can be removed, because their words are part of other players' themes.

## Adding another game

Add the module name to `GAME_APPS` in `app/system/game-admin.js` and export `start`, `distribute`, `list` and `close` from the module. A Gendom-style game gets them all from `createGame` in `app/system/gendom.js`; see `app/modules/gendom4.js`.

## Permissions

Who may run host actions (rules in `app/system/game-admin.js`):

- bot admins (`app/system/auth.js`)
- members with the `@moderator` role
- server Administrators
