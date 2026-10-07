// Bot invitation link: https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=8&scope=bot%20applications.commands
// Testing bot invite : https://discord.com/api/oauth2/authorize?client_id=888106813789200405&permissions=8&scope=bot%20applications.commands

// ==========================================
// 1. GLOBAL ANTI-CRASH SHIELD
// ==========================================
// Log, then exit non-zero so the host (Procfile worker) restarts the bot in a clean state
// instead of leaving it running half-broken.
process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    process.exit(1);
});

const path = require("path");
const fs = require("fs");

// Native v14 Import structure
const { Client, GatewayIntentBits, ActivityType, Events } = require("discord.js");
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent // Critical for message text reading in v14
    ] 
});

require("dotenv").config();

// ==========================================
// 2. TOKEN & INITIALIZATION CONFIG
// ==========================================
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

// ==========================================
// 3. COMMAND LOADER ROUTINE
// ==========================================
client.commands = new Map();
const commandsPath = path.join(__dirname, "modules");

try {
    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

        for (const file of commandFiles)
        {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);

            if ("data" in command && "execute" in command)
            {
                client.commands.set(command.data.name, command);
            }
            else
            {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    } else {
        console.log(`[WARNING] Modules directory not found at ${commandsPath}`);
    }
} catch (error) {
    console.error("[CRITICAL] Failed to load command modules:", error);
}

// Fixed: Swapped once("ready") to once(Events.ClientReady) to eliminate the deprecation warning
client.once(Events.ClientReady, () =>
{
    try {
        if (client.user) {
            client.user.setActivity("/time", { type: ActivityType.Watching }); 
        }
        console.log("[INFO] Bot is ready! Hello :)");
    } catch (err) {
        console.error("Error inside ready event listener:", err);
    }
});

// ==========================================
// 4. SAFE INTERACTION HANDLER
// ==========================================
client.on(Events.InteractionCreate, async interaction =>
{
    if (!interaction.isChatInputCommand()) return;

    try {
        const user = interaction.user; 
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command)
        {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        await command.execute(interaction, user, client.commands);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        
        const replyPayload = { content: 'There was an error while executing this command!', ephemeral: true };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyPayload);
            } else {
                await interaction.reply(replyPayload);
            }
        } catch (msgError) {
            console.error("Failed to send error reply back to Discord channel:", msgError);
        }
    }
});

// ==========================================
// 5. SAFE MESSAGE CONTENT PARSER
// ==========================================
client.on(Events.MessageCreate, function(message)
{
    try {
        if (!message || !message.author || message.author.bot) return;

        const userId = message.author.username;
        const api_callers = ["vaia", "antik0959", "urinalpooper"];

        if (!api_callers.includes(userId)) return;

        let parsedMessage = message.content;
        if (!parsedMessage) return;
        
        parsedMessage = parsedMessage.replace(/\*/g, "");

        if (!parsedMessage.toLowerCase().startsWith("now playing: ")) return;
        if (!parsedMessage.includes("[") || !parsedMessage.includes("]")) return;

        parsedMessage = parsedMessage.replace(/Now Playing: /gi, "");

        const splitOpen = parsedMessage.split("[");
        if (splitOpen.length < 2) return;
        
        const splitClose = splitOpen[1].split("]");
        const trackDurationString = splitClose[0];
        
        if (!trackDurationString.includes(":")) return;
        
        const trackMins = parseInt(trackDurationString.split(":")[0]);
        const trackSecs = parseInt(trackDurationString.split(":")[1]);
        const trackDurationInSecs = trackMins * 60 + trackSecs;

        if (isNaN(trackMins) || isNaN(trackSecs) || isNaN(trackDurationInSecs) || trackDurationInSecs <= 0) return;

        const trackAndAuthor = splitOpen[0].split(/ by /g);
        if (trackAndAuthor.length < 2) return;
        
        const authorName = trackAndAuthor.pop().trim();
        const trackName = trackAndAuthor.join(" by ").trim();

        if (authorName.length === 0 || trackName.length === 0) return;

        const trackDurationSecsLimit = 210;
        if (trackDurationInSecs > trackDurationSecsLimit)
        {
            const secsExceeded = trackDurationInSecs - trackDurationSecsLimit;

            setTimeout(() =>
            {
                try {
                    message.channel.send(`Hi **${authorName}**, please kindly respect the 3 minutes 30 seconds guideline. As it is customary, ${secsExceeded} seconds were deducted from your remaining lifetime.`)
                        .catch(err => console.error("Error sending guideline warning message:", err));
                } catch (timeoutErr) {
                    console.error("Error within message submission timeout scope:", timeoutErr);
                }
            }, 1000);
        }

        console.log(`Now Playing: **${trackName}** by **${authorName}**!`);
    } catch (err) {
        console.error("Error parsing messageCreate event safely:", err);
    }
});

// ==========================================
// 6. DISCORD NETWORK CONNECTION LISTENERS
// ==========================================
client.on("error", (error) => {
    console.error("Discord client encountered a network connectivity error:", error);
});

client.login(token).catch(err => {
    console.error("Critical error during initial Discord login attempt:", err);
});
