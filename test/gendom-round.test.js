const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "fairy-gendom-round-"));
const gendom4 = require("../app/modules/gendom4");
const gendom3 = require("../app/modules/gendom3");
const { settings } = require("../app/system/gendom");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fakeGuild(id)
{
    return { id, name: "guild " + id, commands: { fetch: async () => new Map(), set: async () => null } };
}

// A channel that records the messages the bot posts and edits
function fakeChannel()
{
    const channel = {
        sent: [],
        send: async payload =>
        {
            const message = {
                content: payload.content,
                edits: [],
                edit: async edit =>
                {
                    message.content = edit.content;
                    message.edits.push(edit.content);
                },
            };
            channel.sent.push(message);
            return message;
        },
    };
    return channel;
}

function hostInteraction(guild, channel, minutes = null)
{
    return {
        channelId: "c1",
        guildId: guild.id,
        guild,
        channel,
        options: { getBoolean: () => null, getInteger: () => minutes },
    };
}

function joinInteraction(guild, userId, name, words, options = {})
{
    const slots = words.length === 1 ? { word: words[0] } : { "who": words[0], "does-what": words[1], "where": words[2], "when": words[3] };
    const interaction = {
        channelId: "c1",
        guildId: guild.id,
        guild,
        user: { id: userId, username: name.toLowerCase(), globalName: null },
        member: { displayName: name },
        options: { getString: option => slots[option], getSubcommand: () => "join" },
        replies: [],
        followUps: [],
        reply: async payload => interaction.replies.push(payload),
        followUp: options.followUp || (async payload => interaction.followUps.push(payload)),
    };
    return interaction;
}

function withSettings(overrides, body)
{
    return async () =>
    {
        const saved = { ...settings };
        Object.assign(settings, overrides);
        try
        {
            await body();
        }
        finally
        {
            Object.assign(settings, saved);
        }
    };
}

test("distribute sends the private themes in small batches, one batch after the other",
    withSettings({ batchSize: 3, batchDelayMs: 30, dashboardDelayMs: 5 }, async () =>
    {
        const guild = fakeGuild("g1");
        await gendom3.start(hostInteraction(guild, fakeChannel()));

        let active = 0;
        let maxActive = 0;
        const sentAt = [];
        const joins = [];
        for (let i = 0; i < 7; i++)
        {
            joins.push(joinInteraction(guild, String(i), "P" + i, ["word" + i],
                {
                    followUp: async payload =>
                    {
                        if (!payload.flags) return;
                        active++;
                        maxActive = Math.max(maxActive, active);
                        sentAt.push(Date.now());
                        await sleep(5);
                        active--;
                    },
                }));
            await gendom3.execute(joins[i]);
        }

        const started = Date.now();
        const result = await gendom3.distribute(hostInteraction(guild, null));
        assert.match(result[0], /7 sent privately/);
        assert.ok(maxActive <= 3, `at most 3 at once, saw ${maxActive}`);
        assert.strictEqual(sentAt.length, 7);
        assert.ok(Date.now() - started >= 60, "two pauses between three batches");
        await gendom3.close(hostInteraction(guild, null));
    }));

test("a private reply that fails still gets the player mentioned", withSettings({ batchSize: 2, batchDelayMs: 1 }, async () =>
{
    const guild = fakeGuild("g2");
    await gendom3.start(hostInteraction(guild, fakeChannel()));
    await gendom3.execute(joinInteraction(guild, "1", "Anna", ["dank"]));
    await gendom3.execute(joinInteraction(guild, "2", "Ben", ["wet"], { followUp: async payload => { if (payload.flags) throw new Error("expired"); } }));
    await gendom3.execute(joinInteraction(guild, "3", "Cleo", ["old"]));

    const result = await gendom3.distribute(hostInteraction(guild, null));
    assert.match(result[0], /2 sent privately, 1 mentioned below/);
    assert.match(result[1].content, /<@2>/);
    await gendom3.close(hostInteraction(guild, null));
}));

test("start with minutes: reminder one minute before the end, countdown line until the time is up",
    withSettings({ minuteMs: 100, dashboardDelayMs: 5 }, async () =>
    {
        const guild = fakeGuild("g3");
        const channel = fakeChannel();
        const intro = await gendom3.start(hostInteraction(guild, channel, 3));
        assert.match(intro, /3 minutes/);
        assert.doesNotMatch(intro, /kept between/);

        await sleep(190);
        assert.strictEqual(channel.sent.length, 1, "only the status message so far");
        await sleep(50);
        assert.match(channel.sent[1].content, /One minute left to join Gendom 3/);
        assert.match(channel.sent[0].content, /1 minute left to join/);
        await sleep(100);
        assert.strictEqual(channel.sent.length, 2, "no message when the time is up");
        assert.doesNotMatch(channel.sent[0].content, /left to join/);
        assert.match(channel.sent[0].content, /\(open\)/);
        await gendom3.close(hostInteraction(guild, null));
    }));

test("minutes are clamped to 1-60, and a one minute round has no reminder",
    withSettings({ minuteMs: 40, dashboardDelayMs: 5 }, async () =>
    {
        const guild = fakeGuild("g4");
        const channel = fakeChannel();
        const intro = await gendom3.start(hostInteraction(guild, channel, 1));
        assert.match(intro, /1 minute\*\*/);
        await sleep(40 + 30);
        assert.strictEqual(channel.sent.length, 1, "no reminder and no time-up message");
        await gendom3.close(hostInteraction(guild, null));

        const big = await gendom3.start(hostInteraction(guild, fakeChannel(), 500));
        assert.match(big, /60 minutes/);
        assert.match(big, /kept between 1 and 60/);
        await gendom3.close(hostInteraction(guild, null));

        const small = await gendom3.start(hostInteraction(guild, fakeChannel(), 0));
        assert.match(small, /1 minute\*\*/);
        assert.match(small, /kept between/);
        await gendom3.close(hostInteraction(guild, null));
    }));

test("without minutes there is no timer and no time line", withSettings({ minuteMs: 10, dashboardDelayMs: 5 }, async () =>
{
    const guild = fakeGuild("g5");
    const channel = fakeChannel();
    const intro = await gendom3.start(hostInteraction(guild, channel));
    assert.doesNotMatch(intro, /minute/);
    assert.doesNotMatch(channel.sent[0].content, /left to join/);
    await sleep(60);
    assert.strictEqual(channel.sent.length, 1);
    await gendom3.close(hostInteraction(guild, null));
}));

test("distribute and close stop the timer", withSettings({ minuteMs: 40, dashboardDelayMs: 5, batchDelayMs: 1 }, async () =>
{
    const guild = fakeGuild("g6");
    const channel = fakeChannel();
    await gendom4.start(hostInteraction(guild, channel, 3));
    await gendom4.execute(joinInteraction(guild, "1", "Anna", ["a", "b", "c", "d"]));
    await gendom4.execute(joinInteraction(guild, "2", "Ben", ["e", "f", "g", "h"]));
    await gendom4.distribute(hostInteraction(guild, null));
    await sleep(40 * 3 + 40);
    assert.strictEqual(channel.sent.length, 1, "no reminder after the themes are out");
    await gendom4.close(hostInteraction(guild, null));
}));

test("the status message follows the round: joins, theme handout, close", withSettings({ dashboardDelayMs: 5, batchDelayMs: 1 }, async () =>
{
    const guild = fakeGuild("g7");
    const channel = fakeChannel();
    await gendom4.start(hostInteraction(guild, channel));
    const status = channel.sent[0];
    assert.match(status.content, /Gendom 4\*\* \(open\): 0 players joined/);

    await gendom4.execute(joinInteraction(guild, "1", "Vaia", ["a", "b", "c", "d"]));
    await gendom4.execute(joinInteraction(guild, "2", "lelly_*", ["e", "f", "g", "h"]));
    await gendom4.execute(joinInteraction(guild, "3", "loo", ["i", "j", "k", "l"]));
    await sleep(30);
    assert.strictEqual(status.edits.length, 1, "three joins in a row are merged into one edit");
    assert.match(status.content, /3 players joined/);
    assert.ok(status.content.endsWith("1) Vaia - joined\n2) lelly\\_\\* - joined\n3) loo - joined"), status.content);

    // Changing an entry keeps the order and the count
    await gendom4.execute(joinInteraction(guild, "1", "Vaia", ["x", "y", "z", "w"]));
    await sleep(30);
    assert.match(status.content, /3 players joined/);

    await gendom4.distribute(hostInteraction(guild, null));
    await sleep(30);
    assert.match(status.content, /\(themes handed out\)/);
    assert.match(status.content, /Latecomers may still use `\/gendom4 join`/);
    assert.match(status.content, /1\) Vaia - theme ready/);

    await gendom4.execute(joinInteraction(guild, "4", "xyz", ["m", "n", "o", "p"]));
    await sleep(30);
    assert.match(status.content, /4 players joined/);
    assert.match(status.content, /4\) xyz - theme ready/);

    await gendom4.close(hostInteraction(guild, null));
    assert.match(status.content, /\(closed\): 4 players joined/);
    assert.doesNotMatch(status.content, /Latecomers/);
}));

test("the countdown shows whole minutes, floored, and is refreshed every minute",
    withSettings({ minuteMs: 100, dashboardDelayMs: 5 }, async () =>
    {
        const guild = fakeGuild("g10");
        const channel = fakeChannel();
        await gendom3.start(hostInteraction(guild, channel, 3));
        const status = channel.sent[0];
        assert.match(status.content, /3 minutes left to join/);

        await sleep(140);
        assert.match(status.content, /2 minutes left to join/, "refreshed by the minute tick, with nobody joining");
        await sleep(100);
        assert.match(status.content, /1 minute left to join/);

        await sleep(20);
        await gendom3.execute(joinInteraction(guild, "1", "Anna", ["dank"]));
        await sleep(20);
        assert.match(status.content, /0 minutes left to join/, "less than a minute left is 0 whole minutes");
        assert.match(status.content, /1\) Anna - joined/);

        await sleep(80);
        assert.doesNotMatch(status.content, /left to join/);
        await gendom3.close(hostInteraction(guild, null));
    }));

test("a long player list is cut off below Discord's message limit", withSettings({ dashboardDelayMs: 5 }, async () =>
{
    const guild = fakeGuild("g8");
    const channel = fakeChannel();
    await gendom3.start(hostInteraction(guild, channel));
    for (let i = 0; i < 120; i++)
    {
        await gendom3.execute(joinInteraction(guild, String(i), "Player number " + i + " with a long name", ["w" + i]));
    }
    await sleep(30);
    const status = channel.sent[0].content;
    assert.ok(status.length < 2000, `length ${status.length}`);
    assert.match(status, /120 players joined/);
    assert.match(status, /\.\.\. and \d+ more$/);
    await gendom3.close(hostInteraction(guild, null));
}));

test("the round works when the bot cannot post in the channel", async () =>
{
    const guild = fakeGuild("g9");
    const channel = { send: async () => { throw new Error("Missing Permissions"); } };
    const original = console.error;
    console.error = () => null;
    try
    {
        const intro = await gendom3.start(hostInteraction(guild, channel, 5));
        assert.match(intro, /5 minutes/);
        await gendom3.execute(joinInteraction(guild, "1", "Anna", ["dank"]));
        const closed = await gendom3.close(hostInteraction(guild, null));
        assert.match(closed, /closed/);
    }
    finally
    {
        console.error = original;
    }
});
