// Lists the servers a bot is currently installed in (read-only, changes nothing).
//   node list-guilds.js prod     the real TimeFairy
//   node list-guilds.js test     the FakeFairy
// Servers from the matching config file are marked, so you can see where the bot is missing.

require("dotenv").config();

const { REST, Routes } = require("discord.js");

const target = process.argv[2];
let token, configFile;

if (target === "test")
{
    token = process.env.FAKE_TOKEN;
    configFile = "./config-local.json";
}
else if (target === "prod")
{
    token = process.env.DISCORD_TOKEN;
    configFile = "./config.json";
}
else
{
    console.error("Usage: node list-guilds.js <prod|test>");
    process.exit(1);
}

if (!token)
{
    console.error(`No token found for "${target}" in .env (${target === "test" ? "FAKE_TOKEN" : "DISCORD_TOKEN"}).`);
    process.exit(1);
}

const { clientId, servers } = require(configFile);
const configured = new Map();
for (const server of servers)
{
    for (const [name, id] of Object.entries(server)) configured.set(id, name);
}

(async () =>
{
    const rest = new REST({ version: "10" }).setToken(token);
    const guilds = [];

    // the API returns at most 200 per page
    let after;
    for (;;)
    {
        const page = await rest.get(Routes.userGuilds(), { query: new URLSearchParams({ limit: "200", ...(after && { after }) }) });
        guilds.push(...page);
        if (page.length < 200) break;
        after = page[page.length - 1].id;
    }

    console.log(`Application ${clientId} (${target}) is installed in ${guilds.length} server(s):`);
    for (const g of guilds)
    {
        const note = configured.has(g.id) ? `in ${configFile} as "${configured.get(g.id)}"` : `NOT in ${configFile}`;
        console.log(`  ${g.name} (${g.id}) - ${note}`);
    }

    const installedIds = new Set(guilds.map(g => g.id));
    for (const [id, name] of configured)
    {
        if (!installedIds.has(id)) console.log(`  MISSING: ${name} (${id}) is in ${configFile} but the bot is not installed there`);
    }
})().catch(error =>
{
    console.error(error);
    process.exit(1);
});
