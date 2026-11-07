const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../system/auth");

// The bot's server has no .git folder, so the head commit is asked from GitHub.
const REPO = "vaiavgm/two-hts-time-fairy";
const BRANCH = "main";
const TIMEOUT_MS = 5000;

// The head commit read once at startup: the commit the bot runs, unlike a live read which can be newer after a push.
let deployed = null;

const data = new SlashCommandBuilder().setName("version").setDescription("Show the latest commit of the bot (admins only)")
    .setContexts(InteractionContextType.Guild);

// Head commit of a branch on GitHub as { sha, date }. Throws if GitHub does not answer in time.
// repo: "owner/name" on GitHub
// branch: branch whose head is asked
async function fetchHeadCommit(repo = REPO, branch = BRANCH)
{
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "two-hts-time-fairy" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const json = await res.json();
    return { sha: json.sha, date: new Date(json.commit.committer.date) };
}

// Reads the head commit once and keeps it; called at startup, failures are logged and retried on the next start.
async function rememberDeployedCommit()
{
    try
    {
        deployed = await fetchHeadCommit();
    }
    catch (error)
    {
        console.error("[VERSION] Could not read the head commit at startup:", error.message);
    }
}

// The reply text for a head commit, with the date as a Discord timestamp (shown in each reader's own time zone).
// head: { sha, date } as returned by fetchHeadCommit
// branch: branch name shown in the reply
function formatVersion(head, branch = BRANCH)
{
    const unix = Math.floor(head.date.getTime() / 1000);
    return `Latest commit on \`${branch}\`: \`${head.sha}\`\nCommitted <t:${unix}:F>`;
}

module.exports = {
    data,
    fetchHeadCommit,
    formatVersion,
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
            await interaction.editReply("The commit was not read when the bot started (GitHub did not answer). Restart the bot to read it.");
            return;
        }
        await interaction.editReply(formatVersion(deployed));
    },
};
