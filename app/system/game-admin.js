// The minigames and their host actions, run by /admin app:<game> action:<action> (who may run them: canControlGames in auth.js).
// To add a game, add its module name to GAME_APPS and export a function per action; it returns a string, a payload, or an array of those (first = reply).

const GAME_APPS = ["gendom3", "gendom4"];

// options: /admin options the action reads; required: options it cannot run without
const GAME_ACTIONS = [
    { name: "start", description: "Open a round in this channel, optionally with a time limit", options: ["minutes"] },
    { name: "distribute", description: "Hand out the themes now to everybody who joined" },
    { name: "list", description: "Post everybody's theme publicly (without pinging them)", options: ["sources"] },
    { name: "kick", description: "Remove a player's entry before the themes are handed out", required: ["user"] },
    { name: "close", description: "End the round in this channel (the themes are gone afterwards)" },
];

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

module.exports = { GAME_APPS, GAME_ACTIONS, runGameAction };
