// Shared engine for the Gendom games: players join a round with one word or phrase per slot, the host hands out
// the themes, and everybody receives a theme built from other players' words (see gendom-logic.js).
//
// Players:  /<game> join <slot options>   (join, or change your entry before the themes are handed out)
//           /<game> theme                 (show your theme again, privately)
// Hosts:    /admin <game> start [minutes] | distribute | list [sources] | close   (see game-admin.js)
//
// All replies to players are ephemeral (no DMs). One round per channel and game, kept in memory only:
// a bot restart ends every round.
//
// `start` also posts a status message in the channel that is edited as players join (who joined, how many).
// With the optional `minutes` (clamped to 1-60; unset means no time limit) the status message shows the minutes
// left (refreshed every minute), the channel gets a reminder one minute before the end, and when the time is up
// the themes are handed out without further input from the host (as if the host had run `distribute`).
// `distribute` sends the private themes in small batches with a pause in between, so a big round does not hit
// Discord's rate limits.
//
// A game module calls createGame(config) and exports the result. config:
//   name          command name, e.g. "gendom4"
//   title         shown to players, e.g. "Gendom 4"
//   description   description of the slash command
//   entryNoun     what an entry is called: "word" or "phrase"
//   slots         [{ name, label, description, examples: [...], maxLength }], one option of /<game> join each
//   intro         message posted when a round is opened (the explanation for players)
//   apart         optional, pairs of slot names that should not come from the same player, e.g. [["who", "does-what"]]
//   createState() optional, per round state for buildTheme (e.g. a genre buffer)
//   buildTheme(sources, state)  the theme text from one source ({ userId, word }) per slot

const {
    SlashCommandBuilder,
    InteractionContextType,
    MessageFlags,
    escapeMarkdown,
    inlineCode,
    userMention,
} = require("discord.js");
const { assignInitial, createPool, drawLate } = require("./gendom-logic");
const registry = require("./command-registry");

const DEFAULT_MAX_LENGTH = 40;
const MIN_PLAYERS = 2;
// Interaction tokens stay valid for 15 minutes; leave some slack
const FOLLOW_UP_WINDOW_MS = 14 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 1900;
const MAX_MENTIONS_PER_MESSAGE = 50;
const BLANK = "[blank]";
const MIN_MINUTES = 1;
const MAX_MINUTES = 60;
const MAX_DASHBOARD_LENGTH = 1800;

// Timings, in an object so tests can speed them up:
// batchSize private theme replies are sent at once, with batchDelayMs between two batches;
// status message edits are merged to at most one per dashboardDelayMs
const settings = {
    batchSize: 5,
    batchDelayMs: 1000,
    minuteMs: 60 * 1000,
    dashboardDelayMs: 2000,
};

function ephemeral(content)
{
    return { content, flags: MessageFlags.Ephemeral };
}

function cleanWord(raw)
{
    return String(raw ?? "").replace(/`/g, "'").replace(/\s+/g, " ").trim();
}

// A word needs at least one letter or digit: blanks and things like "..." are rejected
function isValidWord(word)
{
    return /[\p{L}\p{N}]/u.test(word);
}

function themeMessage(text)
{
    return "Your theme is: " + inlineCode(text);
}

function plural(count, noun)
{
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function examplesOf(slot)
{
    return slot.examples.map(inlineCode).join(" or ");
}

// Splits text parts into messages that stay below Discord's length limit
function chunkParts(parts, separator)
{
    const chunks = [];
    let current = "";
    for (const part of parts)
    {
        if (current !== "" && current.length + separator.length + part.length > MAX_MESSAGE_LENGTH)
        {
            chunks.push(current);
            current = "";
        }
        current += (current === "" ? "" : separator) + part;
    }
    if (current !== "") chunks.push(current);
    return chunks;
}

// The name shown in `list sources`, taken when the player joins (no extra API calls later)
function displayName(interaction)
{
    const member = interaction.member;
    return (member && (member.displayName || member.nick)) || interaction.user.globalName || interaction.user.username;
}

function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

// The `minutes` option of `start`, clamped to 1-60; null when it is not set
function requestedMinutes(interaction)
{
    const options = interaction.options;
    const raw = options && typeof options.getInteger === "function" ? options.getInteger("minutes") : null;
    if (raw === null || raw === undefined) return null;
    const minutes = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(raw)));
    return { minutes, clamped: minutes !== raw };
}

async function channelOf(interaction)
{
    if (interaction.channel) return interaction.channel;
    return interaction.client ? interaction.client.channels.fetch(interaction.channelId) : null;
}

function createGame(config)
{
    const { name, title, entryNoun, slots } = config;
    if ((config.apart || []).flat().some(slotName => !slots.some(slot => slot.name === slotName)))
    {
        throw new Error(`${name}: "apart" names a slot that does not exist.`);
    }
    const command = "/" + name;
    const createState = config.createState || (() => ({}));
    const apart = (config.apart || []).map(pair => pair.map(slotName => slots.findIndex(slot => slot.name === slotName)));

    // channelId -> { channelId, guildId, distributed, closed, state, pool, players: Map<userId, Player>,
    //                channel, dashboard, deadline, timeUp, warnTimer, endTimer, tickTimer, dashboardTimer }
    // Player: { userId, name, words, sources, theme, interaction, joinedAt }
    const rounds = new Map();

    function entryText(words)
    {
        return words.join(" ");
    }

    function entriesOf(round)
    {
        return [...round.players.values()].map(p => ({ userId: p.userId, words: p.words }));
    }

    function giveTheme(round, player, sources)
    {
        player.sources = sources;
        player.theme = config.buildTheme(sources, round.state);
    }

    // The reason an entry is rejected, or null if it is fine
    function invalidReason(words)
    {
        const invalid = slots.filter((slot, i) => !isValidWord(words[i]));
        if (invalid.length < 1) return null;

        if (slots.length === 1)
        {
            return `Your ${entryNoun} needs at least one letter or number, e.g. ${examplesOf(slots[0])}.`;
        }
        const preview = words.map(word => (isValidWord(word) ? word : BLANK)).join(" ");
        return `Your ${entryNoun} ${inlineCode(preview)} needs a proper ` +
            invalid.map(slot => `**${slot.label}** (e.g. ${examplesOf(slot)})`).join(" and ") + ".";
    }

    // ------------------------------------------------------------------
    // Status message and timer. Both are best effort: if the bot may not post in the channel, the round still works.
    // ------------------------------------------------------------------

    // `message` is a text (no mentions are parsed) or a complete payload
    async function say(round, message)
    {
        if (!round.channel) return;
        try
        {
            await round.channel.send(typeof message === "string" ? { content: message, allowedMentions: { parse: [] } } : message);
        }
        catch (error)
        {
            console.error(`Could not post a ${title} message:`, error);
        }
    }

    function dashboardText(round)
    {
        const players = [...round.players.values()];
        let status = "open";
        if (round.closed) status = "closed";
        else if (round.distributed) status = "themes handed out";

        const head = [`\u{1F3B2} **${title}** (${status}): ${plural(players.length, "player")} joined`];
        const minutesLeft = minutesLeftOf(round);
        if (minutesLeft !== null) head.push(`\u23F1\uFE0F ${plural(minutesLeft, "minute")} left to join`);
        if (round.distributed && !round.closed) head.push(`Latecomers may still use \`${command} join\`.`);

        const state = round.distributed ? "theme ready" : "joined";
        const lines = [];
        let length = head.join("\n").length;
        for (let i = 0; i < players.length; i++)
        {
            const line = `${i + 1}) ${escapeMarkdown(players[i].name)} - ${state}`;
            if (length + line.length + 1 > MAX_DASHBOARD_LENGTH)
            {
                lines.push(`... and ${players.length - i} more`);
                break;
            }
            lines.push(line);
            length += line.length + 1;
        }
        return head.join("\n") + (lines.length > 0 ? "\n\n" + lines.join("\n") : "");
    }

    async function pushDashboard(round)
    {
        if (!round.dashboard) return;
        try
        {
            await round.dashboard.edit({ content: dashboardText(round), allowedMentions: { parse: [] } });
        }
        catch (error)
        {
            console.error(`Could not update the ${title} status message:`, error);
        }
    }

    // Joins can arrive in bursts and Discord limits message edits, so edits are merged: the one scheduled edit
    // shows whatever the state is by then. `immediate` (used when the round closes) edits right away.
    function refreshDashboard(round, immediate = false)
    {
        if (!round.dashboard) return Promise.resolve();
        if (immediate)
        {
            clearTimeout(round.dashboardTimer);
            round.dashboardTimer = null;
            return pushDashboard(round);
        }
        if (!round.dashboardTimer)
        {
            round.dashboardTimer = setTimeout(() =>
            {
                round.dashboardTimer = null;
                pushDashboard(round);
            }, settings.dashboardDelayMs);
            round.dashboardTimer.unref();
        }
        return Promise.resolve();
    }

    // Whole minutes left, fractions floored; null without a time limit, once the time is up, and when the round is
    // over. Timers fire a little late, so a few seconds are added: right after a minute tick it reads N, not N-1.
    function minutesLeftOf(round)
    {
        if (!round.deadline || round.timeUp || round.closed || round.distributed) return null;
        const left = round.deadline - Date.now();
        if (left <= 0) return null;
        return Math.floor((left + settings.minuteMs / 20) / settings.minuteMs);
    }

    function isOpen(round)
    {
        return rounds.get(round.channelId) === round && !round.distributed;
    }

    function startTimers(round, minutes)
    {
        round.deadline = Date.now() + minutes * settings.minuteMs;

        // A round of one minute or less would be "one minute left" from the start, so it gets no reminder
        if (minutes > MIN_MINUTES)
        {
            round.warnTimer = setTimeout(() =>
            {
                if (!isOpen(round)) return;
                say(round, `\u23F0 One minute left to join ${title}! Hurry up with \`${command} join\` ` +
                    `(${plural(round.players.size, "player")} so far). The themes are handed out when the time is up.`);
            }, (minutes - 1) * settings.minuteMs);
            round.warnTimer.unref();
        }

        // The countdown in the status message is refreshed every minute
        round.tickTimer = setInterval(() => refreshDashboard(round, true), settings.minuteMs);
        round.tickTimer.unref();
        round.endTimer = setTimeout(() => timeUp(round), minutes * settings.minuteMs);
        round.endTimer.unref();
    }

    // The time is up: hand out the themes and post the same summary the host would get from `distribute`
    async function timeUp(round)
    {
        clearInterval(round.tickTimer);
        if (!isOpen(round)) return;
        // Timers may fire a little early, so the clock alone cannot tell that the time is up
        round.timeUp = true;

        if (round.players.size < MIN_PLAYERS)
        {
            await say(round, `\u231B Time is up for ${title}, but at least ${MIN_PLAYERS} players are needed ` +
                `(currently ${round.players.size}). The host can wait for more players and use \`distribute\`, or \`close\` the round.`);
            await refreshDashboard(round, true);
            return;
        }

        try
        {
            for (const payload of await handOut(round))
            {
                await say(round, payload);
            }
        }
        catch (error)
        {
            console.error(`Could not hand out the ${title} themes when the time was up:`, error);
        }
    }

    function stopTimers(round)
    {
        clearTimeout(round.warnTimer);
        clearTimeout(round.endTimer);
        clearInterval(round.tickTimer);
    }

    // ------------------------------------------------------------------
    // Player commands
    // ------------------------------------------------------------------

    async function join(interaction)
    {
        const round = rounds.get(interaction.channelId);
        if (!round)
        {
            await interaction.reply(ephemeral(`No ${title} round is running in this channel. An admin can open one.`));
            return;
        }

        const words = slots.map(slot => cleanWord(interaction.options.getString(slot.name)));
        const reason = invalidReason(words);
        if (reason)
        {
            await interaction.reply(ephemeral(reason));
            return;
        }

        const existing = round.players.get(interaction.user.id);

        if (existing && round.distributed)
        {
            await interaction.reply(ephemeral("The themes are already handed out. " + themeMessage(existing.theme)));
            return;
        }

        if (existing)
        {
            const previous = entryText(existing.words);
            existing.words = words;
            existing.name = displayName(interaction);
            existing.interaction = interaction;
            existing.joinedAt = Date.now();
            refreshDashboard(round);
            await interaction.reply(ephemeral(`Your ${entryNoun} was changed from ${inlineCode(previous)} to ${inlineCode(entryText(words))}.`));
            return;
        }

        const player = {
            userId: interaction.user.id,
            name: displayName(interaction),
            words,
            sources: null,
            theme: null,
            interaction,
            joinedAt: Date.now(),
        };
        let privateReply;

        if (round.distributed)
        {
            // Latecomer: their words go into the pool and they draw from it (see drawLate)
            giveTheme(round, player, drawLate(round.pool, { userId: player.userId, words }, apart));
            player.interaction = null;
            privateReply = themeMessage(player.theme);
        }
        else
        {
            privateReply = `You joined with the ${entryNoun} ${inlineCode(entryText(words))}. Join again to change it. The themes are handed out by an admin.`;
        }

        round.players.set(player.userId, player);
        refreshDashboard(round);
        await interaction.reply(ephemeral(privateReply));

        try
        {
            await interaction.followUp({
                content: `\u{1F3B2} ${userMention(player.userId)} joined ${title} (${plural(round.players.size, "player")})`,
                allowedMentions: { parse: [] },
            });
        }
        catch (error)
        {
            console.error(`Could not announce a ${title} join:`, error);
        }
    }

    async function showTheme(interaction)
    {
        const round = rounds.get(interaction.channelId);
        const player = round && round.players.get(interaction.user.id);

        if (!round)
        {
            await interaction.reply(ephemeral(`No ${title} round is running in this channel.`));
        }
        else if (!player)
        {
            await interaction.reply(ephemeral(`You have not joined this round. Use \`${command} join\`.`));
        }
        else if (!round.distributed)
        {
            await interaction.reply(ephemeral(`The themes are not handed out yet. Your ${entryNoun} is ${inlineCode(entryText(player.words))}.`));
        }
        else
        {
            await interaction.reply(ephemeral(themeMessage(player.theme)));
        }
    }

    // ------------------------------------------------------------------
    // Host actions, called from /admin via game-admin.js. They return a string, a reply payload, or an array of
    // those (the first is the reply, the rest are follow-ups).
    // ------------------------------------------------------------------

    async function start(interaction)
    {
        if (!interaction.guild) return `${title} can only be played in a server.`;

        const existing = rounds.get(interaction.channelId);
        if (existing)
        {
            return `A ${title} round is already running in this channel (${existing.players.size} players).`;
        }

        const limit = requestedMinutes(interaction);
        const round = {
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            distributed: false,
            closed: false,
            state: createState(),
            pool: null,
            players: new Map(),
            channel: null,
            dashboard: null,
            deadline: null,
            timeUp: false,
            warnTimer: null,
            endTimer: null,
            tickTimer: null,
            dashboardTimer: null,
        };
        rounds.set(interaction.channelId, round);

        // The game's command only exists on the server while a round runs
        try
        {
            await registry.setTemporary(interaction.guild, name, true);
        }
        catch (error)
        {
            console.error(`Could not register ${command}:`, error);
            return `The round is open, but the \`${command}\` command could not be added to this server, so nobody can join yet. Try \`close\` and \`start\` again.`;
        }

        if (limit) startTimers(round, limit.minutes);

        try
        {
            round.channel = await channelOf(interaction);
            if (round.channel) round.dashboard = await round.channel.send({ content: dashboardText(round), allowedMentions: { parse: [] } });
        }
        catch (error)
        {
            console.error(`Could not post the ${title} status message:`, error);
        }

        if (!limit) return config.intro;
        return config.intro + `\n\u23F1\uFE0F You have **${plural(limit.minutes, "minute")}** to join` +
            (limit.clamped ? ` (the time limit is kept between ${MIN_MINUTES} and ${MAX_MINUTES} minutes)` : "") +
            ` (until <t:${Math.floor(round.deadline / 1000)}:R>), then the themes are handed out automatically.`;
    }

    async function distribute(interaction)
    {
        const round = rounds.get(interaction.channelId);
        if (!round) return `No ${title} round is running in this channel. Open one with \`start\`.`;
        if (round.distributed) return "The themes of this round are already handed out. Use `list` to post them, or `close` to end the round.";
        if (round.players.size < MIN_PLAYERS) return `At least ${MIN_PLAYERS} players are needed (currently ${round.players.size}).`;

        return handOut(round);
    }

    // Hands out the themes of a round that is open and has enough players, for the host and for the timer.
    // Returns the reply payloads: a summary, then the mentions of the players who could not be told privately.
    async function handOut(round)
    {
        // All state changes happen before the first await, so a join arriving meanwhile counts as a latecomer
        round.distributed = true;
        stopTimers(round);
        refreshDashboard(round);
        const entries = entriesOf(round);
        const assignment = assignInitial(entries, slots.length, apart);
        round.pool = createPool(entries, slots.length);
        for (const player of round.players.values())
        {
            giveTheme(round, player, assignment.get(player.userId));
        }

        const players = [...round.players.values()];
        const pingIds = [];
        let privateCount = 0;

        // Nobody needs the themes instantly: send them in small batches with a pause in between
        const results = [];
        for (let i = 0; i < players.length; i += settings.batchSize)
        {
            if (i > 0) await sleep(settings.batchDelayMs);
            const batch = players.slice(i, i + settings.batchSize);
            results.push(...await Promise.allSettled(batch.map(async player =>
            {
                if (!player.interaction || Date.now() - player.joinedAt > FOLLOW_UP_WINDOW_MS)
                {
                    throw new Error("join interaction expired");
                }
                await player.interaction.followUp(ephemeral(themeMessage(player.theme)));
            })));
        }

        players.forEach((player, index) =>
        {
            player.interaction = null;
            if (results[index].status === "fulfilled") privateCount++;
            else pingIds.push(player.userId);
        });

        const payloads = [`Themes handed out to ${players.length} players: ${privateCount} sent privately` +
            (pingIds.length > 0 ? `, ${pingIds.length} mentioned below.` : ".")];

        for (let i = 0; i < pingIds.length; i += MAX_MENTIONS_PER_MESSAGE)
        {
            const ids = pingIds.slice(i, i + MAX_MENTIONS_PER_MESSAGE);
            payloads.push({
                content: ids.map(userMention).join(" ") + ` your theme is ready, use \`${command} theme\` to see it.`,
                allowedMentions: { users: ids },
            });
        }

        return payloads;
    }

    // With the `sources` option, the players whose words make up each theme are named after it, in slot order
    async function list(interaction)
    {
        const round = rounds.get(interaction.channelId);
        if (!round) return `No ${title} round is running in this channel.`;
        if (!round.distributed) return "The themes are not handed out yet. Use `distribute` first.";

        const withSources = Boolean(interaction.options && interaction.options.getBoolean("sources"));
        const nameOf = userId =>
        {
            const giver = round.players.get(userId);
            return giver ? escapeMarkdown(giver.name) : "?";
        };

        const lines = [...round.players.values()].map(p =>
            `${userMention(p.userId)}: ${inlineCode(p.theme)}` +
            (withSources ? ` (${p.sources.map(source => nameOf(source.userId)).join(", ")})` : ""));
        const chunks = chunkParts(lines, "\n");
        return chunks.map(content => ({ content, allowedMentions: { parse: [] } }));
    }

    async function close(interaction)
    {
        const round = rounds.get(interaction.channelId);
        if (!round) return `No ${title} round is running in this channel.`;

        rounds.delete(interaction.channelId);
        round.closed = true;
        stopTimers(round);
        await refreshDashboard(round, true);
        const closed = `${title} is closed in this channel (${plural(round.players.size, "player")}). New players can no longer join.`;

        // Rounds are per channel but the command is per server: remove it once the last round of the server is over
        const stillRunning = [...rounds.values()].some(r => r.guildId === round.guildId);
        if (stillRunning || !interaction.guild) return closed;

        try
        {
            await registry.setTemporary(interaction.guild, name, false);
        }
        catch (error)
        {
            console.error(`Could not remove ${command}:`, error);
            return closed + ` The \`${command}\` command could not be removed from the server; it is cleaned up when the bot restarts.`;
        }
        return closed;
    }

    const data = new SlashCommandBuilder().setName(name).setDescription(config.description)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub =>
        {
            sub.setName("join").setDescription(config.joinDescription);
            for (const slot of slots)
            {
                sub.addStringOption(option => option.setName(slot.name)
                    .setDescription(slot.description)
                    .setMinLength(1)
                    .setMaxLength(slot.maxLength || DEFAULT_MAX_LENGTH)
                    .setRequired(true));
            }
            return sub;
        })
        .addSubcommand(sub => sub.setName("theme")
            .setDescription("Show your theme again (only you can see it)"));

    return {
        data,

        async execute(interaction)
        {
            switch (interaction.options.getSubcommand())
            {
                case "join":
                    await join(interaction);
                    break;
                case "theme":
                    await showTheme(interaction);
                    break;
            }
        },

        start,
        distribute,
        list,
        close,
    };
}

module.exports = { createGame, cleanWord, isValidWord, settings };
