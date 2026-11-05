// Decides which slash commands each server has, and makes Discord match (declarative: describe what should
// exist, then replace the server's command list in one call with guild.commands.set).
//
// - Permanent modules (e.g. time, tarot): chosen with /admin slash activate|deactivate.
// - Game modules (see GAME_APPS in game-admin.js): only while a round runs; the game calls setTemporary.
// - "admin" is always registered, otherwise the bot owner could lock themselves out.
//
// The permanent choices are kept in memory and seeded from what Discord has registered at startup (so a restart
// keeps them). To persist them elsewhere (e.g. a database), replace the `permanent` Map accesses below.

const fs = require("fs");
const path = require("path");
const { GAME_APPS } = require("./game-admin");

const MODULES_DIR = path.join(__dirname, "..", "modules");
const ALWAYS_ON = ["admin"];

// guildId -> Set of module names
const permanent = new Map();
const temporary = new Map();
// guildId -> promise of the latest sync, so syncs of one server never overlap
const queues = new Map();

const brokenModules = new Set();

// The command definition of a module, or null if the module cannot be loaded (e.g. a native dependency is
// missing). Like the loader in bot.js, one broken module must not stop the others.
function moduleData(moduleName)
{
    try
    {
        return require(path.join(MODULES_DIR, moduleName)).data || null;
    }
    catch (error)
    {
        if (!brokenModules.has(moduleName))
        {
            brokenModules.add(moduleName);
            console.error(`[WARNING] Module ${moduleName} cannot be loaded, its slash command is skipped:`, error.message);
        }
        return null;
    }
}

function moduleNames()
{
    return fs.readdirSync(MODULES_DIR).filter(f => f.endsWith(".js")).map(f => f.slice(0, -3));
}

// Slash command name -> module name (they differ, e.g. /roll comes from dice)
function moduleForCommandName(commandName)
{
    return moduleNames().find(name =>
    {
        const data = moduleData(name);
        return data && data.name === commandName;
    });
}

function setOf(map, guildId)
{
    if (!map.has(guildId)) map.set(guildId, new Set());
    return map.get(guildId);
}

function desiredModules(guildId)
{
    return new Set([...ALWAYS_ON, ...setOf(permanent, guildId), ...setOf(temporary, guildId)]);
}

async function applyToDiscord(guild)
{
    const data = [...desiredModules(guild.id)].map(moduleData).filter(Boolean).map(d => d.toJSON());
    await guild.commands.set(data);
}

function sync(guild)
{
    const previous = queues.get(guild.id) || Promise.resolve();
    const next = previous.catch(() => null).then(() => applyToDiscord(guild));
    queues.set(guild.id, next);
    return next;
}

async function setPermanent(guild, moduleName, enabled)
{
    const set = setOf(permanent, guild.id);
    if (enabled) set.add(moduleName);
    else set.delete(moduleName);
    await sync(guild);
}

async function setTemporary(guild, moduleName, enabled)
{
    const set = setOf(temporary, guild.id);
    if (enabled) set.add(moduleName);
    else set.delete(moduleName);
    await sync(guild);
}

// At startup: take over what a server has registered, keep the permanent modules, and drop everything else
// (game commands have no round after a restart, unknown commands are leftovers).
async function syncOnStartup(guild)
{
    const registered = await guild.commands.fetch();
    // A server with none of this bot's commands is not managed here; do not suddenly add some
    if (registered.size < 1) return;

    const set = setOf(permanent, guild.id);
    let unknown = 0;
    for (const command of registered.values())
    {
        const name = moduleForCommandName(command.name);
        if (!name) unknown++;
        else if (!ALWAYS_ON.includes(name) && !GAME_APPS.includes(name)) set.add(name);
    }

    // An unrecognised command may belong to a module that failed to load; removing it would silently turn it
    // off for good, so leave this server untouched until every module loads again
    if (unknown > 0 && brokenModules.size > 0)
    {
        console.error(`[WARNING] Not syncing slash commands of guild ${guild.name}: ${unknown} command(s) are unknown and ${[...brokenModules].join(", ")} failed to load.`);
        return;
    }
    await sync(guild);
}

async function syncAllOnStartup(client)
{
    for (const guild of client.guilds.cache.values())
    {
        try
        {
            await syncOnStartup(guild);
        }
        catch (error)
        {
            console.error(`Could not sync slash commands of guild ${guild.name} (${guild.id}):`, error);
        }
    }
}

module.exports = { ALWAYS_ON, moduleNames, setPermanent, setTemporary, syncOnStartup, syncAllOnStartup };
