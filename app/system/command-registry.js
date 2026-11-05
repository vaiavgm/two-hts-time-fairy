// Decides which slash commands each server has, and makes Discord match (declarative: describe what should
// exist, then replace the server's command list in one call with guild.commands.set).
//
// - "admin" is always registered, otherwise the bot owner could lock themselves out.
// - Default modules (export `defaultEnabled: true`, e.g. time) are added at startup, unless an admin switched
//   them off on that server with /admin slash deactivate. Those opt-outs are kept in a small JSON file.
// - Other permanent modules are chosen with /admin slash activate|deactivate. Discord remembers them, they are
//   re-read from it at startup.
// - Game modules (see GAME_APPS in game-admin.js) have their command only while a round runs: the game calls
//   setTemporary.
// Changed definitions of existing commands (descriptions, options) are pushed at every startup as well.

const fs = require("fs");
const path = require("path");
const { GAME_APPS } = require("./game-admin");

const MODULES_DIR = path.join(__dirname, "..", "modules");
const ALWAYS_ON = ["admin"];
const OPT_OUT_FILE = "command-opt-outs.json";

// guildId -> Set of module names
const permanent = new Map();
const temporary = new Map();
// guildId -> Set of default modules an admin switched off (persisted in OPT_OUT_FILE)
const optOuts = new Map();
let optOutsLoaded = false;
let writeQueue = Promise.resolve();
// guildId -> promise of the latest sync, so syncs of one server never overlap
const queues = new Map();
const brokenModules = new Set();

// ------------------------------------------------------------------
// Modules
// ------------------------------------------------------------------

// A loaded module, or null if it cannot be loaded (e.g. a native dependency is missing). Like the loader in
// bot.js, one broken module must not stop the others.
function loadModule(moduleName)
{
    try
    {
        return require(path.join(MODULES_DIR, moduleName));
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

function moduleData(moduleName)
{
    const loaded = loadModule(moduleName);
    return loaded && loaded.data ? loaded.data : null;
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

function defaultModules()
{
    return moduleNames().filter(name =>
    {
        const loaded = loadModule(name);
        return loaded && loaded.defaultEnabled === true && !ALWAYS_ON.includes(name) && !GAME_APPS.includes(name);
    });
}

// ------------------------------------------------------------------
// Opt-outs file
// ------------------------------------------------------------------

function optOutPath()
{
    return path.join(process.env.DATA_DIR || path.join(__dirname, "..", "..", "data"), OPT_OUT_FILE);
}

function loadOptOuts()
{
    if (optOutsLoaded) return;
    optOutsLoaded = true;

    try
    {
        const stored = JSON.parse(fs.readFileSync(optOutPath(), "utf8"));
        for (const [guildId, modules] of Object.entries(stored))
        {
            if (Array.isArray(modules)) optOuts.set(guildId, new Set(modules.filter(m => typeof m === "string")));
        }
    }
    catch (error)
    {
        // No file yet is normal; anything else (unreadable, corrupt) just means starting without opt-outs
        if (error.code !== "ENOENT") console.error(`[WARNING] Could not read ${optOutPath()}, starting without opt-outs:`, error.message);
    }
}

// Writes to a temporary file first and renames it, so a crash cannot leave a half-written file
function saveOptOuts()
{
    const target = optOutPath();
    const content = JSON.stringify(Object.fromEntries([...optOuts].filter(([, set]) => set.size > 0).map(([id, set]) => [id, [...set]])), null, 2);

    writeQueue = writeQueue.catch(() => null).then(async () =>
    {
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(target + ".tmp", content);
        await fs.promises.rename(target + ".tmp", target);
    });
    return writeQueue;
}

async function persistOptOuts()
{
    try
    {
        await saveOptOuts();
    }
    catch (error)
    {
        console.error(`[WARNING] Could not save ${optOutPath()}; the opt-out is lost when the bot restarts:`, error);
    }
}

// ------------------------------------------------------------------
// Syncing
// ------------------------------------------------------------------

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
    loadOptOuts();
    const set = setOf(permanent, guild.id);
    if (enabled) set.add(moduleName);
    else set.delete(moduleName);

    // Only default modules need an opt-out: they would otherwise come back at the next startup
    if (defaultModules().includes(moduleName))
    {
        const out = setOf(optOuts, guild.id);
        if (enabled) out.delete(moduleName);
        else out.add(moduleName);
        await persistOptOuts();
    }
    await sync(guild);
}

async function setTemporary(guild, moduleName, enabled)
{
    const set = setOf(temporary, guild.id);
    if (enabled) set.add(moduleName);
    else set.delete(moduleName);
    await sync(guild);
}

// At startup: take over what a server has registered, add the default modules that are missing, and drop
// everything else (game commands have no round after a restart, unknown commands are leftovers).
async function syncOnStartup(guild)
{
    loadOptOuts();
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

    // New commands from a bot update: default modules the server lacks and no admin switched off
    const switchedOff = setOf(optOuts, guild.id);
    for (const name of defaultModules())
    {
        if (!switchedOff.has(name)) set.add(name);
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
