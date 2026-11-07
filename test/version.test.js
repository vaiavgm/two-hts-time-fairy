const test = require("node:test");
const assert = require("node:assert");
const version = require("../app/modules/version");

// Makes global fetch answer with the given body (or fail with the given status) and records the calls
function stubGitHub(status, body)
{
    const calls = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (url, options) =>
    {
        calls.push({ url, options });
        return { ok: status < 400, status, json: async () => body };
    };
    return { calls, restore: () => { globalThis.fetch = original; } };
}

// An interaction that records the replies it gets
function fakeInteraction(username)
{
    const log = { replies: [], deferred: 0, edits: [] };
    return {
        log,
        user: { username, id: "1" },
        reply: async payload => log.replies.push(payload),
        deferReply: async payload => { log.deferred++; log.deferOptions = payload; },
        editReply: async content => log.edits.push(content),
    };
}

const HEAD_BODY = { sha: "9fde312603c1f0e1d2b3a4c5d6e7f8091a2b3c4d", commit: { committer: { date: "2026-11-07T15:29:32Z" } } };

test("formatVersion shows the full commit ID and a Discord timestamp of the commit date", () =>
{
    const text = version.formatVersion({ sha: HEAD_BODY.sha, date: new Date("2026-11-07T15:29:32Z") }, "main");
    assert.ok(text.includes(`\`${HEAD_BODY.sha}\``));
    assert.ok(text.includes(`<t:${Math.floor(Date.UTC(2026, 10, 7, 15, 29, 32) / 1000)}:F>`));
});

test("fetchHeadCommit asks GitHub for the head of the branch and reads its SHA and committer date", async () =>
{
    const stub = stubGitHub(200, HEAD_BODY);
    try
    {
        const head = await version.fetchHeadCommit("owner/repo", "main");
        assert.strictEqual(stub.calls[0].url, "https://api.github.com/repos/owner/repo/commits/main");
        assert.strictEqual(head.sha, HEAD_BODY.sha);
        assert.strictEqual(head.date.toISOString(), "2026-11-07T15:29:32.000Z");
    }
    finally
    {
        stub.restore();
    }
});

test("/version replies ephemerally with the commit read at startup", async () =>
{
    const stub = stubGitHub(200, HEAD_BODY);
    try
    {
        await version.rememberDeployedCommit();
    }
    finally
    {
        stub.restore();
    }
    const interaction = fakeInteraction("vaia");
    await version.execute(interaction);
    assert.strictEqual(interaction.log.deferred, 1);
    assert.ok(interaction.log.deferOptions.flags, "deferred reply must be ephemeral");
    assert.ok(interaction.log.edits[0].includes(HEAD_BODY.sha));
});

test("/version keeps the startup commit after main moves on, without asking GitHub again", async () =>
{
    const stub = stubGitHub(200, HEAD_BODY);
    try
    {
        await version.rememberDeployedCommit();
    }
    finally
    {
        stub.restore();
    }
    const newer = stubGitHub(200, { ...HEAD_BODY, sha: "ffffffffffffffffffffffffffffffffffffffff" });
    const interaction = fakeInteraction("vaia");
    try
    {
        await version.execute(interaction);
        assert.strictEqual(newer.calls.length, 0);
        assert.ok(interaction.log.edits[0].includes(HEAD_BODY.sha));
        assert.ok(!interaction.log.edits[0].includes("ffffffff"));
    }
    finally
    {
        newer.restore();
    }
});

test("/version says so when GitHub did not answer at startup", async () =>
{
    delete require.cache[require.resolve("../app/modules/version")];
    const fresh = require("../app/modules/version");
    const stub = stubGitHub(503, {});
    try
    {
        await fresh.rememberDeployedCommit();
    }
    finally
    {
        stub.restore();
    }
    const interaction = fakeInteraction("vaia");
    await fresh.execute(interaction);
    assert.ok(interaction.log.edits[0].includes("Restart the bot"));
});

test("/version is refused for non-admins and never asks GitHub", async () =>
{
    const stub = stubGitHub(200, HEAD_BODY);
    const interaction = fakeInteraction("someone");
    try
    {
        await version.execute(interaction);
        assert.strictEqual(stub.calls.length, 0);
        assert.strictEqual(interaction.log.replies.length, 1);
        assert.strictEqual(interaction.log.replies[0].content, "Admin rights required.");
        assert.ok(interaction.log.replies[0].flags, "refusal must be ephemeral");
    }
    finally
    {
        stub.restore();
    }
});
