let token, clientId;
if (process.env.TESTING !== undefined)
{
    token = process.env.FAKE_TOKEN;
    clientId = process.env.FAKE_CLIENT_ID;
}
else
{
    token = process.env.DISCORD_TOKEN;
    clientId = process.env.DISCORD_CLIENT_ID;
}

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

const request_methods = {
    PUT: "put",
    POST: "post",
    GET: "get",
    DELETE: "delete",
};


function getCommandsFromFile(file)
{
    try
    {
        const command = require(`../modules/${file}`);

        if (!command || !command.data)
        {
            throw new Error(`Invalid command file: ${file}.js`);
        }
        return command.data;
    }
    catch (error)
    {
        console.error(error);
        return [];
    }
}


async function executeDiscordApiRequest(request_method, guild, commands)
{
    // Create a new REST client for sending requests to the Discord API
    const rest = new REST({ version: "10" }).setToken(token);

    console.log("Executing " + request_method);

    try
    {
        let response;
        switch (request_method)
        {
        case request_methods.PUT:
            response = await rest.put(
                Routes.applicationGuildCommands(clientId, guild.id),
                { body: commands },
            );
            break;
        case request_methods.POST:
            for (let i = 0; i < commands.length; i++)
            {
                response = await rest.post(
                    Routes.applicationGuildCommands(clientId, guild.id),
                    { body: commands[i] },
                );
            }
            break;
        case request_methods.DELETE:
            for (let i = 0; i < commands.length; i++)
            {
                response = await rest.delete(
                    Routes.applicationGuildCommands(clientId, guild.id),
                    { body: commands[i] },
                );
            }
        }

        return response.data;
    }
    catch (error)
    {
        console.error(error);
    }
}

async function addCommandsToGuild(interaction, filename)
{
    const commands = getCommandsFromFile(filename);

    const guild = interaction.guild;
    // let commandNames;

    // Send a request to the Discord API to register the new slash commands in the guild
    await executeDiscordApiRequest(
        request_methods.POST,
        guild,
        [commands],
    );

    return `Attempting to add slash commands to guild **${guild.name}** for module: **${filename}**`;
}

async function removeCommandsFromGuild(interaction, filename)
{
    const rest = new REST({ version: "10" }).setToken(token);
    const cmds = await rest.get(Routes.applicationGuildCommands(clientId, guild.id));
    cmds.forEach(command =>
    {
        console.log(`Command ${command.name} has ID ${command.id}`);
    });


    const commands = getCommandsFromFile(filename);
    const guild = interaction.guild;

    // Send a request to the Discord API to delete the slash commands from the guild
    await executeDiscordApiRequest(
        request_methods.DELETE,
        guild,
        [commands],
    );

    return `Attempting to remove slash commands from guild **${guild.name}** for module: **${filename}**`;
}

async function removeAllCommandsFromGuild(interaction)
{
    const guild = interaction.guild;

    // const commands = await client.application?.commands.fetch();
    const guildCommands = await guild.commands.fetch();
    console.log("Registered Guild Commands:");
    for (const cmd in guildCommands)
    {
        console.log(cmd);
    }

    // Send a request to the Discord API to delete all slash commands from the guild
    await executeDiscordApiRequest(
        request_methods.PUT,
        guild,
        [],
    );
    return `Removed all slash commands from guild **${guild.name}**`;
}

module.exports = {
    addCommandsToGuild,
    removeCommandsFromGuild,
    removeAllCommandsFromGuild,
};