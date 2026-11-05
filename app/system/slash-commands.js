// Per-guild slash command management, used by /admin slash activate|deactivate.
// The command registry (command-registry.js) keeps the list of commands per server and makes Discord match it.
// To make another module available there, add it to SLASH_MODULES in admin.js.

const registry = require("./command-registry");

// Error messages can carry long stack/require traces; only show the first line to users
function firstLine(error)
{
    return String(error.message).split(/\r?\n/)[0];
}

function commandName(moduleName)
{
    const command = require(`../modules/${moduleName}`);

    if (!command || !command.data)
    {
        throw new Error(`Invalid command file: ${moduleName}.js`);
    }
    return command.data.name;
}

async function addCommandsToGuild(interaction, moduleName)
{
    const guild = interaction.guild;
    if (!guild) return "Slash commands can only be managed from within a server.";

    try
    {
        const name = commandName(moduleName);
        await registry.setPermanent(guild, moduleName, true);
        return `Added slash command **/${name}** to guild **${guild.name}** (module: **${moduleName}**).`;
    }
    catch (error)
    {
        console.error(error);
        return `Could not add the slash command for module **${moduleName}**: ${firstLine(error)}`;
    }
}

async function removeCommandsFromGuild(interaction, moduleName)
{
    const guild = interaction.guild;
    if (!guild) return "Slash commands can only be managed from within a server.";

    try
    {
        const name = commandName(moduleName);
        await registry.setPermanent(guild, moduleName, false);
        return `Removed slash command **/${name}** from guild **${guild.name}** (module: **${moduleName}**).`;
    }
    catch (error)
    {
        console.error(error);
        return `Could not remove the slash command for module **${moduleName}**: ${firstLine(error)}`;
    }
}

module.exports = {
    addCommandsToGuild,
    removeCommandsFromGuild,
};
