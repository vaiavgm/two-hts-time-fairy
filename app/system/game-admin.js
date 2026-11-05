// Access rules and dispatch for minigame host actions (start, distribute, list, close), used by /admin.
// A game module offers an action by exporting a function of that name; it gets the interaction and returns
// a string, a reply payload, or an array of those (the first is the reply, the others follow-ups).

const { canControlGames } = require("./auth");

const GAME_ACTIONS = ["start", "distribute", "list", "close"];

function isGameAction(command)
{
    return GAME_ACTIONS.includes(command);
}

// Bot admins, @moderator members and server Administrators may control games (see auth.js)
function mayControlGames(user, member)
{
    return canControlGames(user, member);
}

async function runGameAction(interaction, commands, app, command)
{
    const target = commands.get(app);
    if (!target || typeof target[command] !== "function")
    {
        return `The app **${app}** does not support the "${command}" command.`;
    }
    return target[command](interaction);
}

module.exports = { GAME_ACTIONS, isGameAction, mayControlGames, runGameAction };
