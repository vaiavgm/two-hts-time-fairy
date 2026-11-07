// Access rules and dispatch for minigame host actions, used by /admin (one subcommand group per game:
// /admin gendom3 start). To add a game, add its module name to GAME_APPS and export a function per
// action from the module. An action gets the interaction (with the action's options, if any) and returns a
// string, a reply payload, or an array of those (the first is the reply, the others follow-ups).

const { canControlGames } = require("./auth");

const GAME_APPS = ["gendom3", "gendom4"];

const GAME_ACTIONS = [
    {
        name: "start",
        description: "Open a round in this channel, optionally with a time limit",
        integerOptions: [{ name: "minutes", description: "Time limit in minutes (1-60, other values are clamped). Empty: no limit" }],
    },
    { name: "distribute", description: "Hand out the themes now to everybody who joined" },
    {
        name: "list",
        description: "Post everybody's theme publicly (without pinging them)",
        booleanOptions: [{ name: "sources", description: "Also name the players whose words make up each theme" }],
    },
    {
        name: "kick",
        description: "Remove a player's entry before the themes are handed out",
        userOptions: [{ name: "user", description: "The player to remove", required: true }],
    },
    { name: "close", description: "End the round in this channel (the themes are gone afterwards)" },
];

function isGameApp(name)
{
    return GAME_APPS.includes(name);
}

// Bot admins, @moderator members and server Administrators may control games (see auth.js)
function mayControlGames(user, member)
{
    return canControlGames(user, member);
}

async function runGameAction(interaction, commands, app, action)
{
    const target = commands.get(app);
    if (!target || typeof target[action] !== "function")
    {
        return `The app **${app}** does not support the "${action}" command.`;
    }
    return target[action](interaction);
}

module.exports = { GAME_APPS, GAME_ACTIONS, isGameApp, mayControlGames, runGameAction };
