const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");
const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../system/auth");

// The host clones the repo and pulls on every start, so the checked-out commit in the local .git is the one the bot runs.
const REPO_DIR = path.join(__dirname, "..", "..");
const TIMEOUT_MS = 5000;
const run = promisify(execFile);

// The commit read once at startup: a later pull without a restart does not change the code that runs.
let deployed = null;

const data = new SlashCommandBuilder().setName("version").setDescription("Show the commit the bot runs (admins only)")
    .setContexts(InteractionContextType.Guild);

// Checked-out commit of a local repo as { sha, branch, date }. Throws if git is missing or the folder is no repo.
// repoDir: folder that contains the .git folder
async function readLocalCommit(repoDir = REPO_DIR)
{
    const options = { cwd: repoDir, timeout: TIMEOUT_MS };
    const { stdout: log } = await run("git", ["log", "-1", "--format=%h%n%cI"], options);
    const { stdout: ref } = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"], options);
    const [sha, date] = log.trim().split("\n");
    return { sha, branch: ref.trim(), date: new Date(date) };
}

// Reads the checked-out commit once and keeps it; called at startup, failures are logged and retried on the next start.
// repoDir: folder that contains the .git folder
async function rememberDeployedCommit(repoDir = REPO_DIR)
{
    try
    {
        deployed = await readLocalCommit(repoDir);
    }
    catch (error)
    {
        console.error("[VERSION] Could not read the local git commit at startup:", error.message);
    }
}

// The reply text for a commit, with the date as a Discord timestamp (shown in each reader's own time zone).
// head: { sha, branch, date } as returned by readLocalCommit
function formatVersion(head)
{
    const unix = Math.floor(head.date.getTime() / 1000);
    return `Running commit \`${head.sha}\` on \`${head.branch}\`\nCommitted <t:${unix}:F>`;
}

module.exports = {
    data,
    formatVersion,
    readLocalCommit,
    rememberDeployedCommit,

    async execute(interaction)
    {
        const user = interaction.user;
        if (!isAdmin(user))
        {
            console.log(`[VERSION] Denied ${user.username} (ID ${user.id})`);
            await interaction.reply({ content: "Admin rights required.", flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!deployed)
        {
            await interaction.editReply("The commit could not be read when the bot started (no .git folder or no git). Restart the bot to read it again.");
            return;
        }
        await interaction.editReply(formatVersion(deployed));
    },
};
