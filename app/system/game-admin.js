// Access rules and dispatch for minigame host actions, used by /admin app:<game> action:<action>.
// To add a game, add its module name to GAME_APPS and export a function per action; it returns a string, a payload, or an array of those (first = reply).

const { canControlGames } = require("./auth");

const GAME_APPS = ["gendom3", "gendom4"];

// options: /admin options the action reads; required: options it cannot run without
const GAME_ACTIONS = [
    { name: "start", description: "Open a round in this channel, optionally with a time limit", options: ["minutes"] },
    { name: "distribute", description: "Hand out the themes now to everybody who joined" },
    { name: "list", description: "Post everybody's theme publicly (without pinging them)", options: ["sources"] },
    { name: "kick", description: "Remove a player's entry before the themes are handed out", required: ["user"] },
    { name: "close", description: "End the round in this channel (the themes are gone afterwards)" },
];

// True if the name is a game whose host actions /admin runs.
// name: module name, e.g. "gendom3"
function isGameApp(name)
{
    return GAME_APPS.includes(name);
}

// Bot admins, @moderator members and server Administrators may control games (see auth.js).
// user: the Discord user running the action
// member: the same user as a member of the server, or null outside a server
function mayControlGames(user, member)
{
    return canControlGames(user, member);
}

// Runs a game's host action and returns its result.
// commands: the loaded command modules by name
// app: game module name
// action: action name, e.g. "start"
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
