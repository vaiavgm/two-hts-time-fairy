const test = require("node:test");
const assert = require("node:assert");
const np = require("../app/system/now-playing");

// A Chorus post as in the 2HTS657 party: text line plus embed
function chorusPost(content = "Now Playing: Eye to Eye by Vaiaphraim [3:02]")
{
    return {
        author: { id: "chorus" },
        channelId: "source",
        content,
        embeds: [{
            title: "Eye to Eye",
            description: "2HTS657 listening party, entry 2 of 7.\n[Tune in to the stream here!](http://chorus.thasauce.net:8000/compo)",
            fields: [{ name: "Artist", value: "Vaiaphraim" }, { name: "Length", value: "3:02" }],
        }],
    };
}

test("parseNowPlaying reads track, author and length, keeping \" by \" inside the title", () =>
{
    assert.deepStrictEqual(np.parseNowPlaying("**Now Playing:** Stand by Me by Ben [1:05]"), { track: "Stand by Me", author: "Ben", durationSecs: 65 });
    assert.strictEqual(np.parseNowPlaying("Now Playing: no length by Ben"), null);
    assert.strictEqual(np.parseNowPlaying("Now Playing: no author [1:05]"), null);
    assert.strictEqual(np.parseNowPlaying("Starting stream... http://x"), null);
});

test("parseChorusEntry adds round and entry number from the embed", () =>
{
    assert.deepStrictEqual(np.parseChorusEntry(chorusPost()),
        { track: "Eye to Eye", author: "Vaiaphraim", durationSecs: 182, round: "2HTS657", entry: 2, total: 7 });
});

test("parseChorusEntry falls back to the embed when the text line is missing", () =>
{
    const entry = np.parseChorusEntry(chorusPost(""));
    assert.strictEqual(entry.track, "Eye to Eye");
    assert.strictEqual(entry.durationSecs, 182);
});

test("parseChorusEntry ignores Chorus's other posts", () =>
{
    assert.strictEqual(np.parseChorusEntry({ content: "Downloading 2HTS657 songs... done!", embeds: [] }), null);
});

test("formatRelay keeps the Now Playing line and adds the entry below it", () =>
{
    const text = np.formatRelay(np.parseChorusEntry(chorusPost()));
    assert.strictEqual(text, "Now Playing: **Eye to Eye** by **Vaiaphraim** [3:02]\n-# 2HTS657, entry 2 of 7");
    assert.deepStrictEqual(np.parseNowPlaying(text), { track: "Eye to Eye", author: "Vaiaphraim", durationSecs: 182 });
});

test("formatRelay escapes markdown in names", () =>
{
    assert.ok(np.formatRelay({ track: "a_b_", author: "*x*", durationSecs: 61 }).includes("a\\_b\\_"));
});

test("the relay is on only with both IDs and only reacts to Chorus in the watched channel", () =>
{
    assert.strictEqual(np.relaySettings({ CHORUS_BOT_ID: "chorus" }), null);
    const relay = np.relaySettings({ CHORUS_BOT_ID: "chorus", CHORUS_CHANNEL_ID: "source" });
    assert.ok(np.isChorusPost(chorusPost(), relay));
    assert.ok(!np.isChorusPost({ ...chorusPost(), channelId: "elsewhere" }, relay));
    assert.ok(!np.isChorusPost({ ...chorusPost(), author: { id: "someone" } }, relay));
    assert.ok(!np.isChorusPost(chorusPost(), null));
});

test("a track announced twice in a channel within its length is a repeat, later or elsewhere it is not", () =>
{
    const recent = new np.RecentTracks();
    const track = { track: "Eye to Eye", author: "Vaiaphraim", durationSecs: 182 };
    assert.strictEqual(recent.isRepeat("c1", track, 0), false);
    assert.strictEqual(recent.isRepeat("c1", { ...track, track: "eye to eye" }, 60 * 1000), true);
    assert.strictEqual(recent.isRepeat("c2", track, 60 * 1000), false);
    assert.strictEqual(recent.isRepeat("c1", track, 183 * 1000), false);
});
