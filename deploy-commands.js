// to update slash commands, execute
// node deploy-commands.js

require("dotenv").config();
const fs = require("fs");

let clientId, servers, token;
const local_testing = process.env.TESTING;

if (local_testing !== undefined)
{
    console.log("TESTING is set, updating FakeFairy");
    ({ clientId, servers } = require("./config-local.json"));
    token = process.env.FAKE_TOKEN;
}
else
{
    console.log("Production mode, updating TimeFairy (set 'TESTING=true' in .env for FakeFairy)");
    ({ clientId, servers } = require("./config.json"));
    token = process.env.DISCORD_TOKEN;
}

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

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

// applicationCommands updates commands on all servers, but will take up to one hour
/*
(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );
  }
  catch (error) {
    console.error(error);
  }
})();
*/