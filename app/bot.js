// Bot invitation link: https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=8&scope=bot%20applications.commands
// Testing bot invite : https://discord.com/api/oauth2/authorize?client_id=888106813789200405&permissions=8&scope=bot%20applications.commands

const path = require("path");
const fs = require("fs");

const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

require("dotenv").config();

// Determine, which token to use
const local_testing = process.env.TESTING;

let temp_token = "";

if (local_testing !== undefined)
{
    temp_token = process.env.LOCAL_TOKEN;
    console.log("[INFO] Activating fake bot.");
}
else
{
    temp_token = process.env.DISCORD_TOKEN;
    console.log("[INFO] Activating time fairy. Set 'TESTING=yes' to switch to local testing.");
}

const token = temp_token;

// Activate slash commands
client.commands = new Map();
const commandsPath = path.join(__dirname, "modules");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles)
{
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Set a new item in the Collection with the key as the command name
    // and the value as the exported module
    if ("data" in command && "execute" in command)
    {
        client.commands.set(command.data.name, command);
    }
    else
    {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Execute once after startup
client.once("ready", () =>
{
    client.user.setActivity("/time", { type: "WATCHING" });
    console.log("[INFO] Bot is ready!");
});

// Execute on interaction
client.on("interactionCreate", async interaction =>
{
    if (!interaction.isCommand()) return;

    const user = client.users.cache.get(interaction.member.user.id);

    // const { commandName } = interaction;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command)
    {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    await command.execute(interaction, user, client.commands);
});

client.login(token);
