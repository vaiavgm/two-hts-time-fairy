const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ChannelStore } = require("../app/system/track-channels");
const admin = require("../app/modules/admin");

// A store in a fresh temporary folder
function tempStore()
{
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "track-channels-")), "data", "channels.json");
    return { file, store: new ChannelStore(file) };
}

test("registered channels are saved and read back after a restart", async () =>
{
    const { file, store } = tempStore();
    assert.strictEqual(await store.add("c1", "g1"), true);
    assert.strictEqual(await store.add("c1", "g1"), false);
    await store.add("c2", "g2");
    const reloaded = new ChannelStore(file);
    assert.ok(reloaded.has("c1"));
    assert.deepStrictEqual(reloaded.list("g2"), ["c2"]);
    assert.deepStrictEqual(reloaded.list().sort(), ["c1", "c2"]);
});

test("an unregistered channel is gone, also after a restart", async () =>
{
    const { file, store } = tempStore();
    await store.add("c1", "g1");
    assert.strictEqual(await store.remove("c1"), true);
    assert.strictEqual(await store.remove("c1"), false);
    assert.ok(!new ChannelStore(file).has("c1"));
});

test("no file means no registered channels", () =>
{
    assert.deepStrictEqual(tempStore().store.list(), []);
});

test("/admin nowplaying registers, lists and unregisters the current channel", async () =>
{
    const { store } = tempStore();
    const interaction = { channelId: "c1", guildId: "g1" };
    assert.ok((await admin.runNowPlayingAction(interaction, "register", store)).includes("now gets"));
    assert.ok((await admin.runNowPlayingAction(interaction, "register", store)).includes("already"));
    assert.ok((await admin.runNowPlayingAction(interaction, "channels", store)).includes("<#c1>"));
    assert.ok((await admin.runNowPlayingAction({ channelId: "c9", guildId: "g2" }, "channels", store)).includes("No Now Playing channel"));
    assert.ok((await admin.runNowPlayingAction(interaction, "unregister", store)).includes("no longer"));
    assert.ok(!store.has("c1"));
});
