// Bot invitation link: https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=8&scope=bot%20applications.commands
// Testing bot invite : https://discord.com/api/oauth2/authorize?client_id=888106813789200405&permissions=8&scope=bot%20applications.commands

const path = require("path");
const fs = require("fs");

const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [Intents.FLAGS.GUILDS, "GUILD_MESSAGES"] });

require("dotenv").config();


// Determine, which token to use
const local_testing = process.env.TESTING;

let temp_token = "";
const localDate = new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" });

if (local_testing !== undefined)
{
    temp_token = process.env.FAKE_TOKEN;
    console.log(`${localDate} [INFO] Launching fake bot. Remove 'TESTING=yes', to use production build.`);
}
else
{
    temp_token = process.env.DISCORD_TOKEN;
    console.log(`${localDate} [INFO] Launching 2HTS Time Fairy...`);
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
    console.log("[INFO] Bot is ready! Hello :)");
});

// Execute on interaction
client.on("interactionCreate", async interaction =>
{
    if (!interaction.isCommand()) return;

    const user = client.users.cache.get(interaction.member.user.id);

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command)
    {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    await command.execute(interaction, user, client.commands);
});


// -- OpenAI API start (TODO - extract to separate file/module, if possible)
const { OpenAI } = require("openai");
// eslint-disable-next-line no-unused-vars
const openai = new OpenAI({
    api_key: process.env.OPENAI_API_KEY,
});
// -- OpenAI API end
client.on("messageCreate", function(message)
{
    console.log(`message created: ${message.content}`);
    if (message.author.bot) return;

    if (!message.content.toLowerCase().includes("now playing: ")) return;

    const parsedMessage = message.content;
    parsedMessage.replace(/Now Playing: /gi, "");

    (async () =>
    {
        const completion = await openai.completions.create({
            model: "text-davinci-003",
            prompt: `Write something kind and motivational about the music piece named "${parsedMessage}".`,
            max_tokens: 100,
        });
        // message.deferReply();
        // message.deleteReply();
        message.channel.send(completion.choices[0].text);
    })();
});


client.login(token);
