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
