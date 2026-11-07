// Bot invitation link: https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=268553280&scope=bot%20applications.commands
// Testing bot invite : https://discord.com/api/oauth2/authorize?client_id=888106813789200405&permissions=268553280&scope=bot%20applications.commands
// permissions=268553280 is the minimum the bot needs: View Channels, Send Messages, Embed Links, Attach Files,
// Add Reactions, Read Message History, Manage Roles (for /reactionrole; the bot's role must sit above the roles it hands out).

// ==========================================
// 1. GLOBAL ERROR HANDLING
// ==========================================
// A stray error (e.g. one failed command) must not take the whole bot down: log it and keep running.
// Only a burst of errors in a short time suggests the bot is stuck in a broken state, so only then
// exit and let the host restart it (turn on automatic restarts after a crash in the host's panel).
const ERROR_BURST_LIMIT = 10;
const ERROR_BURST_WINDOW_MS = 60 * 1000;
let recentErrorTimes = [];

// Every start opens a new Discord gateway session and Discord limits how many a bot may open per day. So a
// fatal exit waits first: a host that restarts the bot at once can then not loop through hundreds of sessions.
const RESTART_DELAY_MS = 15 * 1000;
// Closing the Discord connection should take a moment; never hang on it when asked to stop
const SHUTDOWN_TIMEOUT_MS = 5 * 1000;
let exitScheduled = false;
let shuttingDown = false;

// Closes the Discord connection and exits
async function shutdown(exitCode)
{
    if (shuttingDown) return;
    shuttingDown = true;

    const forceExit = setTimeout(() => process.exit(exitCode), SHUTDOWN_TIMEOUT_MS);
    try
    {
        await client.destroy();
    }
    catch (error)
    {
        console.error("[WARN] Error while closing the Discord connection:", error);
    }
    clearTimeout(forceExit);
    process.exit(exitCode);
}

// The bot stays up and keeps answering during the delay
function exitAfterDelay(reason)
{
    if (exitScheduled) return;
    exitScheduled = true;
    console.error(`[FATAL] ${reason} Exiting in ${RESTART_DELAY_MS / 1000}s so the host can restart the bot.`);
    setTimeout(() => shutdown(1), RESTART_DELAY_MS);
}

function noteUnexpectedError(kind, error)
{
    console.error(`[ERROR] ${kind}:`, error);

    const now = Date.now();
    recentErrorTimes = recentErrorTimes.filter(t => now - t < ERROR_BURST_WINDOW_MS);
    recentErrorTimes.push(now);

    if (recentErrorTimes.length >= ERROR_BURST_LIMIT)
    {
        exitAfterDelay(`${ERROR_BURST_LIMIT} unexpected errors within ${ERROR_BURST_WINDOW_MS / 1000}s.`);
    }
}

process.on("unhandledRejection", (reason) => noteUnexpectedError("Unhandled rejection", reason));
process.on("uncaughtException", (error) => noteUnexpectedError("Uncaught exception", error));

const path = require("path");
const fs = require("fs");

// Native v14 Import structure
const { Client, GatewayIntentBits, ActivityType, Events, DiscordjsErrorCodes, MessageFlags } = require("discord.js");
const { isTrackReporter } = require("./system/auth");
const { scheduleComment, logStartup } = require("./ai");
const { syncAllOnStartup } = require("./system/command-registry");
const { rememberDeployedCommit } = require("./modules/version");
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        // Critical for message text reading in v14
        GatewayIntentBits.MessageContent,
    ],
});

require("dotenv").config();

// ==========================================
// 2. TOKEN & INITIALIZATION CONFIG
// ==========================================
const local_testing = process.env.TESTING;
let temp_token;
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

try
{
    if (fs.existsSync(commandsPath))
    {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

        for (const file of commandFiles)
        {
            const filePath = path.join(commandsPath, file);

            // Load each module on its own, so one broken module (e.g. a native dependency
            // failing to load) only disables itself instead of every module after it.
            try
            {
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
            catch (moduleError)
            {
                console.error(`[ERROR] Failed to load command module ${file}, skipping it:`, moduleError);
            }
        }
    }
    else
    {
        console.log(`[WARNING] Modules directory not found at ${commandsPath}`);
    }
}
catch (error)
{
    console.error("[CRITICAL] Failed to load command modules:", error);
}

// Fixed: Swapped once("ready") to once(Events.ClientReady) to eliminate the deprecation warning
client.once(Events.ClientReady, () =>
{
    try
    {
        if (client.user)
        {
            client.user.setActivity("/time", { type: ActivityType.Watching });
        }
        console.log("[INFO] Bot is ready! Hello :)");
        logStartup();
        rememberDeployedCommit();
        console.log(`[INFO] Installed in ${client.guilds.cache.size} server(s): ${client.guilds.cache.map(g => `${g.name} (${g.id})`).join(", ") || "none"}`);
        // Make every server's slash commands match what should exist (game commands only exist while a round runs)
        syncAllOnStartup(client).catch(err => console.error("Slash command sync failed:", err));
    }
    catch (err)
    {
        console.error("Error inside ready event listener:", err);
    }
});

// ==========================================
// 4. SAFE INTERACTION HANDLER
// ==========================================
client.on(Events.InteractionCreate, async interaction =>
{
    // Button clicks go to the module whose name prefixes the button's customId (e.g. "reactionrole:REAPER")
    if (interaction.isButton())
    {
        try
        {
            const owner = interaction.customId.split(":")[0];
            const command = interaction.client.commands.get(owner);
            if (command && typeof command.handleButton === "function")
            {
                await command.handleButton(interaction);
            }
        }
        catch (error)
        {
            console.error(`Error handling button ${interaction.customId}:`, error);
            interaction.reply({ content: "Something went wrong with that button.", flags: MessageFlags.Ephemeral }).catch(() => null);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    try
    {
        const user = interaction.user;
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command)
        {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        await command.execute(interaction, user, client.commands);
    }
    catch (error)
    {
        console.error(`Error executing command ${interaction.commandName}:`, error);

        const replyPayload = { content: "There was an error while executing this command!", flags: MessageFlags.Ephemeral };
        try
        {
            if (interaction.replied || interaction.deferred)
            {
                await interaction.followUp(replyPayload);
            }
            else
            {
                await interaction.reply(replyPayload);
            }
        }
        catch (msgError)
        {
            console.error("Failed to send error reply back to Discord channel:", msgError);
        }
    }
});

// ==========================================
// 5. SAFE MESSAGE CONTENT PARSER
// ==========================================
client.on(Events.MessageCreate, function(message)
{
    try
    {
        if (!message || !message.author || message.author.bot) return;

        if (!isTrackReporter(message.author)) return;

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
                try
                {
                    message.channel.send(`Hi **${authorName}**, please kindly respect the 3 minutes 30 seconds guideline. As it is customary, ${secsExceeded} seconds were deducted from your remaining lifetime.`)
                        .catch(err => console.error("Error sending guideline warning message:", err));
                }
                catch (timeoutErr)
                {
                    console.error("Error within message submission timeout scope:", timeoutErr);
                }
            }, 1000);
        }

        console.log(`Now Playing: **${trackName}** by **${authorName}**!`);

        scheduleComment(message, trackName, authorName, trackDurationInSecs);
    }
    catch (err)
    {
        console.error("Error parsing messageCreate event safely:", err);
    }
});

// ==========================================
// 6. DISCORD NETWORK CONNECTION LISTENERS
// ==========================================
client.on(Events.Error, (error) =>
{
    console.error("Discord client encountered a network connectivity error:", error);
});

// discord.js reconnects on its own after a dropped connection; these logs just make that visible.
client.on(Events.ShardDisconnect, (event, shardId) => console.warn(`[WARN] Shard ${shardId} disconnected (code ${event.code}), discord.js will reconnect.`));
client.on(Events.ShardReconnecting, (shardId) => console.log(`[INFO] Shard ${shardId} reconnecting...`));
client.on(Events.ShardResume, (shardId) => console.log(`[INFO] Shard ${shardId} resumed.`));
client.on(Events.ShardError, (error, shardId) => console.error(`[WARN] Shard ${shardId} error:`, error));

// The session can no longer be recovered by discord.js, so a fresh start is the only way back.
client.on(Events.Invalidated, () => exitAfterDelay("Discord session was invalidated."));

// A stop or restart from the host's panel (SIGTERM) or Ctrl+C (SIGINT): leave cleanly. A second signal exits at once.
for (const signal of ["SIGTERM", "SIGINT"])
{
    process.on(signal, () =>
    {
        if (shuttingDown) process.exit(1);
        console.log(`[INFO] ${signal} received, shutting down.`);
        shutdown(0);
    });
}

// ==========================================
// 7. LOGIN
// ==========================================
const LOGIN_RETRY_MS = 30 * 1000;
// Retrying cannot fix these: they need a config change, so fail loudly instead of looping forever.
const UNRECOVERABLE_LOGIN_ERRORS = [DiscordjsErrorCodes.TokenInvalid, DiscordjsErrorCodes.TokenMissing, DiscordjsErrorCodes.DisallowedIntents];

async function connect()
{
    for (;;)
    {
        try
        {
            await client.login(token);
            return;
        }
        catch (err)
        {
            if (UNRECOVERABLE_LOGIN_ERRORS.includes(err.code))
            {
                console.error("Discord login failed:", err);
                exitAfterDelay("Discord login cannot succeed with the current configuration (check the token and the enabled intents).");
                return;
            }

            // e.g. a temporary network or Discord outage at startup: keep trying instead of staying offline
            console.error(`Discord login failed, retrying in ${LOGIN_RETRY_MS / 1000}s:`, err);
            await new Promise(resolve => setTimeout(resolve, LOGIN_RETRY_MS));
        }
    }
}

connect();
