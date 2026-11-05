const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");
const fs = require("fs");
const os = require("os");
const path = require("path");

// The registry keeps its opt-outs in DATA_DIR; use a throwaway folder
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fairy-test-"));
process.env.DATA_DIR = dataDir;
const optOutFile = path.join(dataDir, "command-opt-outs.json");

// randomgif needs the native canvas library, which may be missing where the tests run: stub it so that
// every module loads. The test for a broken module below uses a separate registry instance.
const originalLoad = Module._load;
const stubbedLoad = function(request, ...rest)
{
    return request === "canvas" || request === "gif-encoder-2" ? {} : originalLoad.call(this, request, ...rest);
};
Module._load = stubbedLoad;

// Loads a new registry instance, like a bot restart (module state starts empty, the opt-out file stays)
function restartedRegistry()
{
    for (const key of Object.keys(require.cache))
    {
        if (key.includes("two-hts-time-fairy") && !key.includes("node_modules")) delete require.cache[key];
    }
    return require("../app/system/command-registry");
}
const registry = require("../app/system/command-registry");
const gendom3 = require("../app/modules/gendom3");

// A stand-in for a Discord server that records what its command list was last set to
function fakeGuild(id, registeredNames)
{
    const guild = {
        id,
        name: "guild " + id,
        current: registeredNames.slice(),
        setCalls: 0,
        commands: {
            fetch: async () => new Map(guild.current.map(name => [name, { name, equals: () => false }])),
            set: async data =>
            {
                guild.setCalls++;
                guild.current = data.map(d => d.name);
            },
        },
    };
    return guild;
}

// A server whose registered commands are exactly the current definitions of these modules (as Discord returns them)
function upToDateGuild(id, moduleNames, changeDescriptionOf)
{
    const guild = fakeGuild(id, []);
    const commands = moduleNames.map(name =>
    {
        const definition = require("../app/modules/" + name).data.toJSON();
        const stored = changeDescriptionOf === name ? { ...definition, description: "old description" } : definition;
        return { name: definition.name, equals: candidate => JSON.stringify(candidate) === JSON.stringify(stored) };
    });
    guild.current = commands.map(c => c.name);
    guild.commands.fetch = async () => new Map(commands.map(c => [c.name, c]));
    return guild;
}

function sorted(list)
{
    return list.slice().sort();
}

test("startup sync keeps permanent commands, drops game commands and unknown leftovers", async () =>
{
    const guild = fakeGuild("g1", ["admin", "time", "roll", "gendom3", "chatgpt"]);
    await registry.syncOnStartup(guild);
    assert.deepStrictEqual(sorted(guild.current), ["admin", "roll", "time"]);
});

test("startup sync always keeps /admin, even if it was missing", async () =>
{
    const guild = fakeGuild("g2", ["time"]);
    await registry.syncOnStartup(guild);
    assert.deepStrictEqual(sorted(guild.current), ["admin", "time"]);
});

test("startup sync leaves servers without any of the bot's commands alone", async () =>
{
    const guild = fakeGuild("g3", []);
    await registry.syncOnStartup(guild);
    assert.strictEqual(guild.setCalls, 0);
});

test("startup sync does not call Discord when the server already matches", async () =>
{
    const guild = upToDateGuild("g12", ["admin", "time"]);
    await registry.syncOnStartup(guild);
    assert.strictEqual(guild.setCalls, 0);
});

test("startup sync updates a command whose definition changed", async () =>
{
    const guild = upToDateGuild("g13", ["admin", "time"], "time");
    await registry.syncOnStartup(guild);
    assert.strictEqual(guild.setCalls, 1);
});

test("permanent commands can be added and removed", async () =>
{
    const guild = fakeGuild("g4", ["admin"]);
    await registry.setPermanent(guild, "tarot", true);
    assert.deepStrictEqual(sorted(guild.current), ["admin", "tarot"]);
    await registry.setPermanent(guild, "tarot", false);
    assert.deepStrictEqual(guild.current, ["admin"]);
});

test("a game command exists only while a round runs, per server", async () =>
{
    const guild = fakeGuild("g5", ["admin", "time"]);
    await registry.syncOnStartup(guild);
    const interaction = channelId => ({ channelId, guildId: guild.id, guild });

    await gendom3.start(interaction("c1"));
    assert.deepStrictEqual(sorted(guild.current), ["admin", "gendom3", "time"]);

    await gendom3.start(interaction("c2"));
    await gendom3.close(interaction("c1"));
    assert.ok(guild.current.includes("gendom3"), "still needed by the round in channel c2");

    await gendom3.close(interaction("c2"));
    assert.deepStrictEqual(sorted(guild.current), ["admin", "time"]);
});

test("a failing Discord call is reported, not thrown", async () =>
{
    const guild = fakeGuild("g6", ["admin"]);
    guild.commands.set = async () =>
    {
        throw new Error("Discord says no");
    };
    const originalError = console.error;
    console.error = () => null;
    try
    {
        const message = await gendom3.start({ channelId: "c9", guildId: guild.id, guild });
        assert.match(message, /could not be added/);
    }
    finally
    {
        console.error = originalError;
    }
});

test("startup sync adds default commands that a bot update introduced", async () =>
{
    const guild = fakeGuild("g8", ["admin", "roll"]);
    await registry.syncOnStartup(guild);
    assert.deepStrictEqual(sorted(guild.current), ["admin", "roll", "time"]);
});

test("a default command an admin switched off stays off, also after a restart", async () =>
{
    const guild = fakeGuild("g9", ["admin", "time", "roll"]);
    await registry.syncOnStartup(guild);
    await registry.setPermanent(guild, "time", false);
    assert.deepStrictEqual(sorted(guild.current), ["admin", "roll"]);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(optOutFile, "utf8")).g9, ["time"]);

    const afterRestart = restartedRegistry();
    await afterRestart.syncOnStartup(guild);
    assert.deepStrictEqual(sorted(guild.current), ["admin", "roll"], "time must not come back");

    await afterRestart.setPermanent(guild, "time", true);
    assert.deepStrictEqual(sorted(guild.current), ["admin", "roll", "time"]);
    assert.strictEqual(JSON.parse(fs.readFileSync(optOutFile, "utf8")).g9, undefined);
});

test("switching off a non-default command does not need the opt-out file", async () =>
{
    fs.rmSync(optOutFile, { force: true });
    const guild = fakeGuild("g10", ["admin", "time", "roll"]);
    await registry.syncOnStartup(guild);
    await registry.setPermanent(guild, "dice", false);
    assert.deepStrictEqual(sorted(guild.current), ["admin", "time"]);
    assert.strictEqual(fs.existsSync(optOutFile), false);
});

test("an unreadable opt-out file means starting without opt-outs", async () =>
{
    fs.writeFileSync(optOutFile, "{ this is not json");
    const originalError = console.error;
    console.error = () => null;
    try
    {
        const afterRestart = restartedRegistry();
        const guild = fakeGuild("g11", ["admin", "roll"]);
        await afterRestart.syncOnStartup(guild);
        assert.deepStrictEqual(sorted(guild.current), ["admin", "roll", "time"]);
    }
    finally
    {
        console.error = originalError;
    }
});

test("startup sync leaves a server alone when unknown commands might belong to a module that failed to load", async () =>
{
    // load a fresh registry whose modules cannot load because canvas throws
    Module._load = function(request, ...rest)
    {
        if (request === "canvas") throw new Error("native canvas missing");
        return originalLoad.call(this, request, ...rest);
    };
    for (const key of Object.keys(require.cache))
    {
        if (key.includes("two-hts-time-fairy") && !key.includes("node_modules")) delete require.cache[key];
    }
    const freshRegistry = require("../app/system/command-registry");

    const guild = fakeGuild("g7", ["admin", "randomgif", "time"]);
    const originalError = console.error;
    console.error = () => null;
    try
    {
        await freshRegistry.syncOnStartup(guild);
    }
    finally
    {
        console.error = originalError;
        Module._load = stubbedLoad;
    }
    assert.strictEqual(guild.setCalls, 0);
    assert.deepStrictEqual(sorted(guild.current), ["admin", "randomgif", "time"]);
});

test("/reactionrole is never added on its own, only by an explicit /admin slash activate", async () =>
{
    const reactionrole = require("../app/modules/reactionrole");
    assert.strictEqual(reactionrole.defaultEnabled, false);

    const guild = fakeGuild("g20", ["admin", "time"]);
    await registry.syncOnStartup(guild);
    await registry.syncOnStartup(guild);
    assert.ok(!guild.current.includes("reactionrole"), "not added by the startup sync");

    await registry.setPermanent(guild, "reactionrole", true);
    assert.ok(guild.current.includes("reactionrole"), "added by the admin");

    await registry.setPermanent(guild, "reactionrole", false);
    assert.ok(!guild.current.includes("reactionrole"), "removed again by the admin");
});
