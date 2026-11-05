// Gendom 3: players each submit a word (modifier); the words are pooled and everybody receives a random
// genre combined with somebody else's word, e.g. "dank Techno".
//
// Players:  /gendom3 join word:<word>   (join, or change your word before the themes are handed out)
//           /gendom3 theme              (show your theme again, privately)
// Hosts:    /admin gendom3 start | distribute | list | close   (see system/game-admin.js)
//
// All replies to players are ephemeral (no DMs). One round per channel, kept in memory only:
// a bot restart ends every round.

const {
    SlashCommandBuilder,
    InteractionContextType,
    MessageFlags,
    inlineCode,
    userMention,
} = require("discord.js");
const { nextGenre, assignInitial, assignLate } = require("../system/gendom-logic");

const MAX_WORD_LENGTH = 40;
const MIN_PLAYERS = 2;
// Interaction tokens stay valid for 15 minutes; leave some slack
const FOLLOW_UP_WINDOW_MS = 14 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 1900;
const MAX_MENTIONS_PER_MESSAGE = 50;

// channelId -> { distributed, genreBuffer, players: Map<userId, Player> }
// Player: { userId, word, theme, interaction, joinedAt }
const rounds = new Map();

function ephemeral(content)
{
    return { content, flags: MessageFlags.Ephemeral };
}

function cleanWord(raw)
{
    return raw.replace(/`/g, "'").replace(/\s+/g, " ").trim();
}

function themeMessage(text)
{
    return "Your theme is: " + inlineCode(text);
}

function entriesOf(round)
{
    return [...round.players.values()].map(p => ({ userId: p.userId, word: p.word }));
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

function plural(count, noun)
{
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function giveTheme(round, player, source)
{
    player.theme = source.word + " " + nextGenre(round.genreBuffer);
}

// ------------------------------------------------------------------
// Player commands
// ------------------------------------------------------------------

async function join(interaction)
{
    const round = rounds.get(interaction.channelId);
    if (!round)
    {
        await interaction.reply(ephemeral("No Gendom 3 round is running in this channel. An admin can open one."));
        return;
    }

    const word = cleanWord(interaction.options.getString("word"));
    if (word === "")
    {
        await interaction.reply(ephemeral("Please provide a word."));
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
        const previous = existing.word;
        existing.word = word;
        existing.interaction = interaction;
        existing.joinedAt = Date.now();
        await interaction.reply(ephemeral(`Your word was changed from ${inlineCode(previous)} to ${inlineCode(word)}.`));
        return;
    }

    const player = { userId: interaction.user.id, word, theme: null, interaction, joinedAt: Date.now() };
    let privateReply;

    if (round.distributed)
    {
        // Latecomer: not part of the original shuffle, so a word that was already handed out may be repeated.
        // The pool is read before the player is added, so they can never draw their own word.
        const source = assignLate(player, entriesOf(round));
        giveTheme(round, player, source);
        player.interaction = null;
        privateReply = themeMessage(player.theme);
    }
    else
    {
        privateReply = `You joined with the word ${inlineCode(word)}. Join again with another word to change it. The themes are handed out by an admin.`;
    }

    round.players.set(player.userId, player);
    await interaction.reply(ephemeral(privateReply));

    try
    {
        await interaction.followUp({
            content: `\u{1F3B2} ${userMention(player.userId)} joined Gendom 3 (${plural(round.players.size, "player")})`,
            allowedMentions: { parse: [] },
        });
    }
    catch (error)
    {
        console.error("Could not announce a Gendom 3 join:", error);
    }
}

async function showTheme(interaction)
{
    const round = rounds.get(interaction.channelId);
    const player = round && round.players.get(interaction.user.id);

    if (!round)
    {
        await interaction.reply(ephemeral("No Gendom 3 round is running in this channel."));
    }
    else if (!player)
    {
        await interaction.reply(ephemeral("You have not joined this round. Use `/gendom3 join` with a word."));
    }
    else if (!round.distributed)
    {
        await interaction.reply(ephemeral(`The themes are not handed out yet. Your word is ${inlineCode(player.word)}.`));
    }
    else
    {
        await interaction.reply(ephemeral(themeMessage(player.theme)));
    }
}

// ------------------------------------------------------------------
// Host actions, called from /admin via system/game-admin.js. They return a string, a reply payload, or an array of those
// (the first is the reply, the rest are follow-ups).
// ------------------------------------------------------------------

async function start(interaction)
{
    const existing = rounds.get(interaction.channelId);
    if (existing)
    {
        return `A Gendom 3 round is already running in this channel (${existing.players.size} players).`;
    }

    rounds.set(interaction.channelId, { distributed: false, genreBuffer: [], players: new Map() });
    return "\u{1F3B2} **Gendom 3** is open in this channel! Join with `/gendom3 join` and a word, e.g. \"dank\". The word stays secret.";
}

async function distribute(interaction)
{
    const round = rounds.get(interaction.channelId);
    if (!round) return "No Gendom 3 round is running in this channel. Open one with `start`.";
    if (round.distributed) return "The themes of this round are already handed out. Use `list` to post them, or `close` to end the round.";
    if (round.players.size < MIN_PLAYERS) return `At least ${MIN_PLAYERS} players are needed (currently ${round.players.size}).`;

    // All state changes happen before the first await, so a /gendom3 join arriving meanwhile counts as a latecomer
    round.distributed = true;
    const assignment = assignInitial(entriesOf(round));
    for (const player of round.players.values())
    {
        giveTheme(round, player, assignment.get(player.userId));
    }

    const players = [...round.players.values()];
    const now = Date.now();
    const pingIds = [];
    let privateCount = 0;

    const results = await Promise.allSettled(players.map(async player =>
    {
        if (!player.interaction || now - player.joinedAt > FOLLOW_UP_WINDOW_MS)
        {
            throw new Error("join interaction expired");
        }
        await player.interaction.followUp(ephemeral(themeMessage(player.theme)));
    }));

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
            content: ids.map(userMention).join(" ") + " your theme is ready, use `/gendom3 theme` to see it.",
            allowedMentions: { users: ids },
        });
    }

    return payloads;
}

async function list(interaction)
{
    const round = rounds.get(interaction.channelId);
    if (!round) return "No Gendom 3 round is running in this channel.";
    if (!round.distributed) return "The themes are not handed out yet. Use `distribute` first.";

    const lines = [...round.players.values()].map(p => `${userMention(p.userId)}: ${inlineCode(p.theme)}`);
    const chunks = chunkParts(lines, "\n");
    return chunks.map(content => ({ content, allowedMentions: { parse: [] } }));
}

async function close(interaction)
{
    const round = rounds.get(interaction.channelId);
    if (!round) return "No Gendom 3 round is running in this channel.";

    rounds.delete(interaction.channelId);
    return `Gendom 3 is closed in this channel (${round.players.size} players). New players can no longer join.`;
}

module.exports = {
    data: new SlashCommandBuilder().setName("gendom3").setDescription("Play Gendom 3: send a word, get a random genre with somebody else's word!")
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub => sub.setName("join")
            .setDescription("Join the round with your word, or change your word before the themes are handed out")
            .addStringOption(option => option.setName("word")
                .setDescription("Your modifier/adjective (e.g. \"dank\")")
                .setMinLength(1)
                .setMaxLength(MAX_WORD_LENGTH)
                .setRequired(true)))
        .addSubcommand(sub => sub.setName("theme")
            .setDescription("Show your theme again (only you can see it)")),

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
