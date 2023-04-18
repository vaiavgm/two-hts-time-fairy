// to update slash commands for the FakeFairy, execute
// node deploy-commands-local.js

require("dotenv").config();
const fs = require("fs");

const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

// eslint-disable-next-line no-unused-vars
const { clientId, soloTestingServer, botTestingServer, twohtsServer } = require("./config-local.json");


const commands = [
    // new SlashCommandBuilder().setName("tarot").setDescription("Draws a Major Arcanum card for the special theme!"),
    // new SlashCommandBuilder().setName("ping").setDescription("Replies with pong!"),
    new SlashCommandBuilder().setName("react").setDescription("Reacts with emoji! (hopefully)"),
    // new SlashCommandBuilder().setName("time").setDescription("Provides time-related and compo information utility"),
    new SlashCommandBuilder().setName("gendom3").setDescription("Provide a modifier and receive a random genre with a random modifier!")
        .addStringOption(option =>
            option.setName("modifier")
                .setDescription("Your chosen modifier/adjective (e.g. \"dank\")")
                .setRequired(true)),
    new SlashCommandBuilder().setName("admin").setDescription("Admin commands for the bot and its minigames.")
        .addStringOption(option =>
            option.setName("application")
                .setDescription("Which application do you want to control? (e.g. \"gendom3\")")
                .setRequired(true).addChoices({ name: "gendom3", value: "gendom3" }))
        .addStringOption(option =>
            option.setName("command")
                .setDescription("Which command do you want to execute? (e.g. \"start\")")
                .setRequired(true).addChoices({ name: "start", value: "start" }, { name: "reset", value: "reset" })),
]
    .map(command => command.toJSON());

const moduleFiles = fs.readdirSync("./app/modules/").filter(file => file.endsWith(".js"));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of moduleFiles)
{
    const command = require(`./app/modules/${file}`);
    if (!command || !command.data) continue;
    console.log(command);
    commands.push(command.data.toJSON());
}

class slash_command_target_server
{
    constructor(serverId)
    {
        this.request = new REST({ version: "10" }).setToken(process.env.LOCAL_TOKEN);
        this.serverId = serverId;
    }
}

const rest_requests = [];

rest_requests.push(new slash_command_target_server(botTestingServer));
rest_requests.push(new slash_command_target_server(soloTestingServer));
rest_requests.push(new slash_command_target_server(twohtsServer));

for (const rest of rest_requests)
{
    (async () =>
    {
        try
        {
            await rest.request.put(
                // applicationGuildCommands updates commands immediately, but only works for known guildIds (servers)
                Routes.applicationGuildCommands(clientId, rest.serverId),
                { body: commands },
            );

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