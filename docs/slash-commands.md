# Slash commands per server

`app/system/command-registry.js` decides which commands each server has and makes Discord match them (`guild.commands.set`).

## Which commands a server gets

- **`/admin`** and **`/version`** are always there. `/version` shows the short hash, branch and date of the commit checked out in the local `.git` folder, read once at startup. It is not re-read while the bot runs, so a later pull does not change it until a restart. Ephemeral, bot admins only.
- **Default modules** (exporting `defaultEnabled: true`, currently `time`) are added to every managed server at startup. A bot update that adds one shows up without a manual step. If an admin switches one off (`/admin slash deactivate`), that is stored in `command-opt-outs.json` and stays off until it is activated again.
- **Other permanent modules** are switched on with `/admin slash activate module:<name>`. Discord remembers them and the bot re-reads them at startup. `/reactionrole` is one of these (`defaultEnabled: false`): it never appears by itself, and `deactivate` removes it again.
- **Game commands** (`/gendom3`, `/gendom4`) exist only while a round runs. `/admin gendom3 start` adds the command to the server; `close` removes it once the server's last round is over. Rounds are per channel, the command is per server. See [gendom.md](gendom.md).

## Startup sync

At every startup the bot syncs each server that already has commands from it:

- permanent and default commands are kept or added;
- changed definitions (descriptions, options) are updated; if a server already matches, Discord is not called at all;
- game commands (no round survives a restart) and unknown leftovers are removed;
- a server is left alone if an unknown command could belong to a module that failed to load.

## Opt-out file

`command-opt-outs.json` is written to `DATA_DIR` (default `./data`). It must survive restarts. If it is lost, the only effect is that default commands an admin switched off come back at the next startup.

## Registering commands with Discord

`node deploy-commands.js <prod|test>` registers `/admin` and `/time` from `config.json` (prod) or `config-local.json` (test). After `/admin` changed (subcommands, the `gendom3`/`gendom4` groups, `start minutes`, `kick user`, server-only), re-register it once with `node deploy-commands.js prod`.
