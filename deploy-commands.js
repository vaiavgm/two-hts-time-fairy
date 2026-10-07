// Registers the slash commands with Discord. Say explicitly which bot to update:
//   node deploy-commands.js prod                  updates the real TimeFairy
//   node deploy-commands.js test                  updates the FakeFairy
//   node deploy-commands.js <prod|test> --clear-global
//        additionally removes that bot's GLOBAL commands, e.g. to get rid of duplicates left over
//        from an old global registration (this script only registers per-server commands)
// The target is deliberately not taken from TESTING in .env, so a leftover setting cannot send
// production commands to the wrong bot.

require("dotenv").config();
const fs = require("fs");

const target = process.argv[2];
const clearGlobal = process.argv.includes("--clear-global");

let clientId, servers, token;

if (target === "test")
{
    console.log("Updating FakeFairy (config-local.json, FAKE_TOKEN)");
    ({ clientId, servers } = require("./config-local.json"));
    token = process.env.FAKE_TOKEN;
}
else if (target === "prod")
{
    console.log("Updating TimeFairy (config.json, DISCORD_TOKEN)");
    ({ clientId, servers } = require("./config.json"));
    token = process.env.DISCORD_TOKEN;
}
else
{
    console.error("Usage: node deploy-commands.js <prod|test> [--clear-global]");
    process.exit(1);
}

if (!token)
{
    console.error(`No token found for "${target}" in .env (${target === "test" ? "FAKE_TOKEN" : "DISCORD_TOKEN"}).`);
    process.exit(1);
}
console.log(`Application ID: ${clientId}`);

const { REST, Routes } = require("discord.js");

const commands = [];

// do not load the skipped slash commands, but load all other modules
const usedFiles = ["admin.js", "time.js"];
const moduleFiles = fs.readdirSync("./app/modules/").filter(file => file.endsWith(".js") && usedFiles.some(usedFile => file.startsWith(usedFile)));

// Grab the SlashCommandBuilder::toJSON() output of each command's data for deployment
for (const file of moduleFiles)
{
    const command = require(`./app/modules/${file}`);
    if (!command || !command.data) continue;
    //  log output for debugging a broken command
    // console.log(command);
    commands.push(command.data.toJSON());
}

class slash_command_target_server
{
    constructor(serverId)
    {
        this.request = new REST({ version: "10" }).setToken(token);
        this.serverId = serverId;
    }
}

const rest_requests = [];

// get the value for each server within config.json
for (const server of servers)
{
    const values = [];
    for (const k in server)
    {
        values.push(server[k]);
    }

    const server_id = values[0];

    // console.log(server_id);
    rest_requests.push(new slash_command_target_server(server_id));
}

for (const rest of rest_requests)
{

    (async () =>
    {
        try
        {
            const response = await rest.request.put(
                // applicationGuildCommands updates commands immediately, but only works for known guildIds (servers)
                Routes.applicationGuildCommands(clientId, rest.serverId),
                { body: commands },
            );

            response.forEach((command) =>
            {
                console.log(`Command ${command.name} created with ID: ${command.id}`);
            });
            console.log("Successfully registered application commands for server " + rest.serverId + ".");

        }
        catch (error)
        {
            console.error(error);
        }
    })();
}

if (clearGlobal)
{
    (async () =>
    {
        try
        {
            await new REST({ version: "10" }).setToken(token).put(Routes.applicationCommands(clientId), { body: [] });
            console.log("Removed all global commands for application " + clientId + ".");
        }
        catch (error)
        {
            console.error(error);
        }
    })();
}

// To register on all servers at once instead (takes up to an hour to propagate), use Routes.applicationCommands(clientId).
