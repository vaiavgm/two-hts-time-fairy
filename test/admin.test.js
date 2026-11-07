const test = require("node:test");
const assert = require("node:assert");
const admin = require("../app/modules/admin");
const slash_functions = require("../app/system/slash-commands");

// Options as Discord passes them: only the given ones are set
function fakeOptions(values, focused = null)
{
    const get = name => name in values ? { name, value: values[name] } : null;
    return {
        get,
        getString: name => values[name] ?? null,
        getBoolean: name => values[name] ?? null,
        getInteger: name => values[name] ?? null,
        getUser: name => values[name] ?? null,
        getFocused: () => focused,
    };
}

// An admin interaction that records its replies
function fakeInteraction(values, { username = "vaia", member = null, focused = null } = {})
{
    const log = { replies: [], deferred: 0, edits: [], followUps: [], responded: null };
    return {
        log,
        user: { username, id: "1" },
        member,
        guild: { name: "Test" },
        channelId: "c1",
        options: fakeOptions(values, focused),
        reply: async payload => log.replies.push(payload),
        deferReply: async () => { log.deferred++; },
        editReply: async content => log.edits.push(content),
        followUp: async payload => log.followUps.push(payload),
        respond: async choices => { log.responded = choices; },
    };
}

// Fake game module that records which host action ran
function fakeGames()
{
    const calls = [];
    const game = {};
    for (const action of ["start", "distribute", "list", "kick", "close"])
    {
        game[action] = async () =>
        {
            calls.push(action);
            return `${action} done`;
        };
    }
    return { calls, commands: new Map([["gendom3", game], ["gendom4", game]]) };
}

test("/admin is one command with app and action instead of a subcommand per action", () =>
{
    const json = admin.data.toJSON();
    const names = json.options.map(o => o.name);
    assert.deepStrictEqual(names, ["app", "action", "minutes", "sources", "user", "confirm"]);
    assert.ok(json.options.every(o => o.type !== 1 && o.type !== 2), "no subcommands or groups");
    assert.strictEqual(json.options[1].autocomplete, true);
    assert.deepStrictEqual(json.options[0].choices.map(c => c.value), ["gendom3", "gendom4", "nowplaying", "time", "tarot", "dice", "randomgif", "reactionrole"]);
});

test("action suggestions follow the chosen app and the typed text", () =>
{
    assert.deepStrictEqual(admin.suggestActions("gendom3").map(c => c.value), ["start", "distribute", "list", "kick", "close"]);
    assert.deepStrictEqual(admin.suggestActions("tarot").map(c => c.value), ["activate", "deactivate"]);
    assert.deepStrictEqual(admin.suggestActions("gendom4", "ki").map(c => c.value), ["kick"]);
    assert.strictEqual(admin.suggestActions(null).length, 10);
    assert.ok(admin.suggestActions("gendom3").every(c => c.name.length <= 100));
});

test("autocomplete answers the action option with the app's actions", async () =>
{
    const interaction = fakeInteraction({ app: "dice" }, { focused: { name: "action", value: "" } });
    await admin.autocomplete(interaction);
    assert.deepStrictEqual(interaction.log.responded.map(c => c.value), ["activate", "deactivate"]);
});

test("a game action runs with its options and reports options it does not read", async () =>
{
    const games = fakeGames();
    const interaction = fakeInteraction({ app: "gendom3", action: "start", minutes: 5, sources: true });
    await admin.execute(interaction, interaction.user, games.commands);
    assert.deepStrictEqual(games.calls, ["start"]);
    assert.deepStrictEqual(interaction.log.edits, ["start done"]);
    assert.ok(interaction.log.followUps[0].content.includes("`sources`"));
    assert.ok(!interaction.log.followUps[0].content.includes("`minutes`"));
});

test("an action that does not belong to the app is refused with the app's actions", async () =>
{
    const games = fakeGames();
    const interaction = fakeInteraction({ app: "tarot", action: "start" });
    await admin.execute(interaction, interaction.user, games.commands);
    assert.strictEqual(games.calls.length, 0);
    assert.strictEqual(interaction.log.deferred, 0);
    assert.ok(interaction.log.replies[0].content.includes("`activate`"));
    assert.ok(interaction.log.replies[0].flags);
});

test("kick without a user and deactivate without confirm:True are refused", async () =>
{
    const games = fakeGames();
    const kick = fakeInteraction({ app: "gendom3", action: "kick" });
    await admin.execute(kick, kick.user, games.commands);
    assert.ok(kick.log.replies[0].content.includes("`user`"));

    const deactivate = fakeInteraction({ app: "tarot", action: "deactivate", confirm: false });
    await admin.execute(deactivate, deactivate.user, games.commands);
    assert.ok(deactivate.log.replies[0].content.includes("confirm:True"));
    assert.strictEqual(games.calls.length, 0);
});

test("activate and deactivate switch the chosen module's slash command", async () =>
{
    const original = { add: slash_functions.addCommandsToGuild, remove: slash_functions.removeCommandsFromGuild };
    const calls = [];
    const record = (kind, result) => async (_, module) =>
    {
        calls.push([kind, module]);
        return result;
    };
    slash_functions.addCommandsToGuild = record("add", "added");
    slash_functions.removeCommandsFromGuild = record("remove", "removed");
    try
    {
        const on = fakeInteraction({ app: "tarot", action: "activate", confirm: true });
        await admin.execute(on, on.user, new Map());
        const off = fakeInteraction({ app: "dice", action: "deactivate", confirm: true });
        await admin.execute(off, off.user, new Map());
        assert.deepStrictEqual(calls, [["add", "tarot"], ["remove", "dice"]]);
        assert.deepStrictEqual([on.log.edits[0], off.log.edits[0]], ["added", "removed"]);
    }
    finally
    {
        slash_functions.addCommandsToGuild = original.add;
        slash_functions.removeCommandsFromGuild = original.remove;
    }
});

test("moderators may run game actions but not switch slash commands", async () =>
{
    const games = fakeGames();
    const moderator = { roles: { cache: [{ name: "@moderator" }] }, permissions: { has: () => false } };
    const game = fakeInteraction({ app: "gendom4", action: "close" }, { username: "mod", member: moderator });
    await admin.execute(game, game.user, games.commands);
    assert.deepStrictEqual(games.calls, ["close"]);

    const slash = fakeInteraction({ app: "time", action: "deactivate", confirm: true }, { username: "mod", member: moderator });
    await admin.execute(slash, slash.user, games.commands);
    assert.strictEqual(slash.log.replies[0].content, "Admin rights required.");
});
