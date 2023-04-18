// Bot invitation link: https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=8&scope=bot%20applications.commands
// Testing bot invite : https://discord.com/api/oauth2/authorize?client_id=888106813789200405&permissions=8&scope=bot%20applications.commands

const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

require("dotenv").config();

const local_testing = process.env.TESTING;

let temp_token = "";

if (local_testing !== undefined)
{
    temp_token = process.env.LOCAL_TOKEN;
    console.log("activating local testing mode");
}
else
{
    temp_token = process.env.DISCORD_TOKEN;
    console.log("activating online mode");
}

const token = temp_token;

// Filesystem
const fs = require("fs");

client.commands = new Map();
const modules = fs.readdirSync("./app/modules").filter(file => file.endsWith(".js"));
for (const file of modules)
{
    const command = require(`./modules/${file}`);
    client.commands.set(command.name, command);
}

client.once("ready", () =>
{
    console.log("Ready!");
});

client.on("interactionCreate", async interaction =>
{
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    const user = client.users.cache.get(interaction.member.user.id);
    const userId = user.username + "#" + user.discriminator;
    const admins = ["Vaia#6573", "antik#0959"];

    let isAdmin = false;
    if (admins.includes(userId))
    {
        isAdmin = true;
    }

    let result, message, modifier;

    switch (commandName)
    {
    case "time":
        result = await client.commands.get("time").time();
        await interaction.reply(result);
        break;
    case "react":
        interaction.reply("You can react with Unicode emojis 😄!");
        message = await interaction.fetchReply();
        message.react("😄");
        break;
    case "ping":
        await interaction.reply("Pong!", { fetchReply: true });
        break;
    case "tarot":
        result = await client.commands.get("tarot").tarot(user);
        user.send(result).catch(console.error);
        await interaction.reply({ content: "🎴" });
        break;
    case "tarotmore":
        result = await client.commands.get("tarot").tarotmore(user);
        await interaction.reply({ content: result, ephemeral: true });
        break;
    case "gendom3":
        modifier = interaction.options.getString("modifier");
        result = await client.commands.get("gendom3").provideModifier(modifier, user);
        user.send(result).catch(console.error);
        await interaction.reply("🎲");
        break;
    case "admin":
        if (isAdmin)
        {
            const app = interaction.options.getString("application");
            const cmd = interaction.options.getString("command");

            result = "Unknown app or command.";

            switch (cmd)
            {
            case "reset":
                result = await client.commands.get(app).reset();
                break;
            case "start":
                result = await client.commands.get(app).start();
                break;
            }

            await interaction.reply({ content: result, ephemeral: false });
        }
        break;
    default:
    }
});

client.login(token);

