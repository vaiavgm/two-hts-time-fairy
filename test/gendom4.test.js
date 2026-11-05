const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "fairy-gendom4-"));
const gendom4 = require("../app/modules/gendom4");

const PHRASES = [
    ["the dog", "drinks water", "in the kitchen", "at midnight"],
    ["the telephone", "requires power", "on the moon", "during the lunch break"],
    ["the man", "eats pizza", "under the bed", "on a Sunday"],
    ["my grandma", "hides a sock", "in the bathtub", "after school"],
    ["a confused pirate", "sings opera", "at the train station", "every morning"],
];

function fakeGuild(id)
{
    return { id, name: "guild " + id, commands: { fetch: async () => new Map(), set: async () => null } };
}

// A /gendom4 join (or theme) interaction that records what the bot answers
function playerInteraction(guild, channelId, userId, name, words, subcommand = "join")
{
    const values = { "who": words[0], "does-what": words[1], "where": words[2], "when": words[3] };
    const interaction = {
        channelId,
        guildId: guild.id,
        guild,
        user: { id: userId, username: name.toLowerCase(), globalName: null },
        member: { displayName: name },
        options: { getString: option => values[option], getSubcommand: () => subcommand },
        replies: [],
        followUps: [],
        reply: async payload => interaction.replies.push(payload),
        followUp: async payload => interaction.followUps.push(payload),
    };
    return interaction;
}

function hostInteraction(guild, channelId, sources = false)
{
    return { channelId, guildId: guild.id, guild, options: { getBoolean: name => (name === "sources" ? sources : null) } };
}

test("buildSentence joins the parts into one sentence", () =>
{
    assert.strictEqual(gendom4.buildSentence(["the dog", "eats pizza", "in the kitchen", "at midnight"]),
        "The dog eats pizza in the kitchen at midnight.");
    assert.strictEqual(gendom4.buildSentence(["the dog.", "eats pizza!", "in the kitchen,", "at midnight!"]),
        "The dog eats pizza in the kitchen at midnight!");
});

test("the join command offers an example for every part", () =>
{
    const join = gendom4.data.toJSON().options.find(o => o.name === "join");
    assert.deepStrictEqual(join.options.map(o => o.name), ["who", "does-what", "where", "when"]);
    for (const option of join.options)
    {
        assert.match(option.description, /e\.g\./);
        assert.ok(option.required);
    }
});

test("start explains the game", async () =>
{
    const guild = fakeGuild("g1");
    const intro = await gendom4.start(hostInteraction(guild, "c1"));
    assert.match(intro, /who/);
    assert.match(intro, /does what/);
    assert.match(intro, /eats pizza/);
    await gendom4.close(hostInteraction(guild, "c1"));
});

test("an entry with a blank part is rejected with a reason", async () =>
{
    const guild = fakeGuild("g2");
    await gendom4.start(hostInteraction(guild, "c1"));

    const blank = playerInteraction(guild, "c1", "1", "Anna", ["the dog", "   ", "in the kitchen", "..."]);
    await gendom4.execute(blank);
    const reply = blank.replies[0];
    assert.ok(reply.flags, "ephemeral");
    assert.match(reply.content, /the dog \[blank\] in the kitchen \[blank\]/);
    assert.match(reply.content, /\*\*does what\*\*/);
    assert.match(reply.content, /\*\*when\*\*/);
    assert.match(reply.content, /eats pizza/);
    assert.strictEqual(blank.followUps.length, 0, "no join announcement");

    const distributed = await gendom4.distribute(hostInteraction(guild, "c1"));
    assert.match(distributed, /At least 2 players/);
    await gendom4.close(hostInteraction(guild, "c1"));
});

test("a full round: themes from other players, list with sources, latecomers", async () =>
{
    const guild = fakeGuild("g3");
    await gendom4.start(hostInteraction(guild, "c1"));

    const names = ["Anna", "Ben", "Cleo", "Dan", "Eve"];
    const joins = PHRASES.map((words, i) => playerInteraction(guild, "c1", String(i), names[i], words));
    for (const join of joins) await gendom4.execute(join);

    const result = await gendom4.distribute(hostInteraction(guild, "c1"));
    assert.match(result[0], /5 sent privately/);

    const themes = joins.map(join => join.followUps.find(p => p.flags).content);
    themes.forEach((theme, i) =>
    {
        // None of the player's own parts, and four parts from four different players
        const text = theme.toLowerCase();
        for (const part of PHRASES[i]) assert.ok(!text.includes(part.toLowerCase()), `${theme} contains own "${part}"`);
        const givers = new Set();
        PHRASES.forEach((words, j) => words.forEach(part =>
        {
            if (text.includes(part.toLowerCase())) givers.add(j);
        }));
        assert.strictEqual(givers.size, 4, theme);
    });

    const plain = await gendom4.list(hostInteraction(guild, "c1"));
    assert.ok(!plain[0].content.includes("("));
    const withSources = await gendom4.list(hostInteraction(guild, "c1", true));
    const lines = withSources[0].content.split("\n");
    assert.strictEqual(lines.length, 5);
    for (const line of lines) assert.match(line, /^<@\d>: `.+\.` \(\w+, \w+, \w+, \w+\)$/);

    const late = playerInteraction(guild, "c1", "9", "Zed", ["the cat", "naps", "on the roof", "at dawn"]);
    await gendom4.execute(late);
    assert.match(late.replies[0].content, /^Your theme is: `/);
    assert.ok(!late.replies[0].content.includes("the cat"));

    const closed = await gendom4.close(hostInteraction(guild, "c1"));
    assert.match(closed, /6 players/);
});
