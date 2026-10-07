// Per-guild slash command management, used by the /admin command.
// To make another module available there, add it as a choice in admin.js, e.g. { name: "dice", value: "dice" }
// Uses discord.js' own guild command manager, so no separate REST client, token or client ID is needed.

function getCommandData(filename)
{
    const command = require(`../modules/${filename}`);

    if (!command || !command.data)
    {
        throw new Error(`Invalid command file: ${filename}.js`);
    }
    return command.data.toJSON();
}

async function addCommandsToGuild(interaction, filename)
{
    const guild = interaction.guild;
    if (!guild) return "Slash commands can only be managed from within a server.";

    try
    {
        const data = getCommandData(filename);
        // creates the command, or updates it if a command with that name already exists
        await guild.commands.create(data);
        return `Added slash command **/${data.name}** to guild **${guild.name}** (module: **${filename}**).`;
    }
    catch (error)
    {
        console.error(error);
        return `Could not add the slash command for module **${filename}**: ${error.message.split("
")[0]}`;
    }
}

async function removeCommandsFromGuild(interaction, filename)
{
    const guild = interaction.guild;
    if (!guild) return "Slash commands can only be managed from within a server.";

    try
    {
        const data = getCommandData(filename);
        const registered = (await guild.commands.fetch()).find(cmd => cmd.name === data.name);

        if (!registered)
        {
            return `Slash command **/${data.name}** is not registered in guild **${guild.name}**.`;
        }

        await guild.commands.delete(registered);
        return `Removed slash command **/${data.name}** from guild **${guild.name}** (module: **${filename}**).`;
    }
    catch (error)
    {
        console.error(error);
        return `Could not remove the slash command for module **${filename}**: ${error.message.split("
")[0]}`;
    }
}

async function removeAllCommandsFromGuild(interaction)
{
    const guild = interaction.guild;
    if (!guild) return "Slash commands can only be managed from within a server.";

    try
    {
        await guild.commands.set([]);
        return `[ADMIN] Removed all slash commands from guild **${guild.name}**`;
    }
    catch (error)
    {
        console.error(error);
        return `Could not remove the slash commands: ${error.message.split("
")[0]}`;
    }
}

module.exports = {
    addCommandsToGuild,
    removeCommandsFromGuild,
    removeAllCommandsFromGuild,
};
