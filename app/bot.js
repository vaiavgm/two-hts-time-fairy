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


/* at some point i want to figure out the way it reacts to numbers so that anying greater than [3:00]
in the time gets it to say something about it being too long */

// -- OpenAI API start (TODO - extract to separate file/module, if possible)
const { OpenAI } = require("openai");
const { randomInt } = require("crypto");
// eslint-disable-next-line no-unused-vars
const openai = new OpenAI({
    api_key: process.env.OPENAI_API_KEY,
});
// -- OpenAI API end


client.on("messageCreate", function(message)
{
    if (message.author.bot) return;

    if (!message.content.toLowerCase().includes("now playing: ")) return;
    if (!message.content.includes("[")) return;
    if (!message.content.includes("]")) return;

    let parsedMessage = message.content;
    parsedMessage = parsedMessage.replace(/Now Playing: /gi, "");
    parsedMessage = parsedMessage.replace(/\*/g, "");

    const trackDuration = parsedMessage.split("[")[1].split("]")[0];
    const trackMins = parseInt(trackDuration.split(":")[0]);
    const trackSecs = parseInt(trackDuration.split(":")[1]);

    const trackDurationInSecs = trackMins * 60 + trackSecs;

    const trackAndAuthor = parsedMessage.split("[")[0].split(/ by /g);
    const authorName = trackAndAuthor.pop().trim();
    const trackName = trackAndAuthor.join(" by ").trim();

    const complimentPrompts = [
        `Write a kind and motivational sentence about the music piece named "${trackName}" by ${authorName}. Use 30 tokens.`,
        `Tell ${authorName} that you are enjoying their song so far in a single sentence! Use 30 tokens.`,
        `Compliment ${authorName} on the arrangement of their song "${trackName}" in a single sentence. Use 30 tokens.`,
        `Thank ${authorName} for their music submission and express nice thoughts about it in a single sentence. Use 30 tokens.`,
        `Express surprise over how a musical section of the song "${trackName}" developed in a single sentence. Use 30 tokens.`,
    ];

    // time exceeded
    const trackDurationSecsLimit = 180;
    if (trackDurationInSecs > trackDurationSecsLimit)
    {
        const secsExceeded = trackDurationInSecs - trackDurationSecsLimit;

        setTimeout(() =>
        {
            message.channel.send(`Hi **${authorName}**, please kindly respect the 3 minutes guideline. As it is customary, ${secsExceeded} seconds were deducted from your remaining lifetime.`);
        }, 1000);
    }

    message.channel.send(`Now Playing: **${trackName}** by **${authorName}**!`);

    const minComplimentTimeMillis = parseInt(trackDurationInSecs * 0.4 * 1000);
    const maxComplimentTimeMillis = parseInt(trackDurationInSecs * 0.85 * 1000);
    const complimentTimeMillis = randomInt(minComplimentTimeMillis, maxComplimentTimeMillis);
    // console.log(`min: ${minComplimentTimeMillis / 1000}s | max: ${maxComplimentTimeMillis / 1000}s | rand: ${complimentTimeMillis / 1000}s`);
    setTimeout(() =>
    {
        (async () =>
        {
            const completion = await openai.completions.create({
                model: "text-davinci-003",
                prompt: complimentPrompts[randomInt(complimentPrompts.length)],
                max_tokens: 40,
            });
            // message.deferReply();
            // message.deleteReply();
            message.channel.send(completion.choices[0].text);
        })();
    }, complimentTimeMillis);

});

client.login(token);
