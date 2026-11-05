// Access rules and dispatch for minigame host actions, used by /admin (one subcommand group per game:
// /admin gendom3 start). To add a game, add its module name to GAME_APPS and export a function per
// action from the module. An action gets the interaction and returns a string, a reply payload, or an
// array of those (the first is the reply, the others follow-ups).

const { canControlGames } = require("./auth");

const GAME_APPS = ["gendom3"];

const GAME_ACTIONS = [
    { name: "start", description: "Open a round in this channel" },
    { name: "distribute", description: "Hand out the themes to everybody who joined" },
    { name: "list", description: "Post everybody's theme publicly" },
    { name: "close", description: "End the round in this channel and free its memory" },
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
