const test = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const version = require("../app/modules/version");

const COMMIT_DATE = "2026-11-07T15:29:32Z";

// A temporary git repo on branch main with one commit at COMMIT_DATE
function makeRepo()
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "version-test-"));
    const env = { ...process.env, GIT_COMMITTER_DATE: COMMIT_DATE, GIT_AUTHOR_DATE: COMMIT_DATE };
    const git = (...args) => execFileSync("git", args, { cwd: dir, env }).toString().trim();
    git("init", "-q", "-b", "main");
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "--allow-empty", "-m", "first");
    return { dir, shortSha: git("rev-parse", "--short", "HEAD"), fullSha: git("rev-parse", "HEAD") };
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

test("readLocalCommit reads the short hash, branch and committer date of the checked-out commit", async () =>
{
    const repo = makeRepo();
    const head = await version.readLocalCommit(repo.dir);
    assert.strictEqual(head.sha, repo.shortSha);
    assert.ok(head.sha.length < repo.fullSha.length);
    assert.strictEqual(head.branch, "main");
    assert.strictEqual(head.date.toISOString(), "2026-11-07T15:29:32.000Z");
});

test("formatVersion shows the short hash, the branch and a Discord timestamp of the commit date", () =>
{
    const text = version.formatVersion({ sha: "9fde312", branch: "main", date: new Date(COMMIT_DATE) });
    assert.ok(text.includes("`9fde312`"));
    assert.ok(text.includes("`main`"));
    assert.ok(text.includes(`<t:${Math.floor(Date.UTC(2026, 10, 7, 15, 29, 32) / 1000)}:F>`));
});

test("/version replies ephemerally with the commit read at startup", async () =>
{
    const repo = makeRepo();
    await version.rememberDeployedCommit(repo.dir);
    const interaction = fakeInteraction("vaia");
    await version.execute(interaction);
    assert.strictEqual(interaction.log.deferred, 1);
    assert.ok(interaction.log.deferOptions.flags, "deferred reply must be ephemeral");
    assert.ok(interaction.log.edits[0].includes(repo.shortSha));
    assert.ok(!interaction.log.edits[0].includes(repo.fullSha));
});

test("/version keeps the startup commit after a later commit, until the next restart", async () =>
{
    const repo = makeRepo();
    await version.rememberDeployedCommit(repo.dir);
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "--allow-empty", "-m", "second"], { cwd: repo.dir });
    const interaction = fakeInteraction("vaia");
    await version.execute(interaction);
    assert.ok(interaction.log.edits[0].includes(repo.shortSha));
});

test("/version says so when the folder had no git repo at startup", async () =>
{
    delete require.cache[require.resolve("../app/modules/version")];
    const fresh = require("../app/modules/version");
    await fresh.rememberDeployedCommit(fs.mkdtempSync(path.join(os.tmpdir(), "version-norepo-")));
    const interaction = fakeInteraction("vaia");
    await fresh.execute(interaction);
    assert.ok(interaction.log.edits[0].includes("Restart the bot"));
});

test("/version is refused for non-admins", async () =>
{
    const interaction = fakeInteraction("someone");
    await version.execute(interaction);
    assert.strictEqual(interaction.log.deferred, 0);
    assert.strictEqual(interaction.log.replies.length, 1);
    assert.strictEqual(interaction.log.replies[0].content, "Admin rights required.");
    assert.ok(interaction.log.replies[0].flags, "refusal must be ephemeral");
});
