// Channels registered with /admin app:nowplaying to get "Now Playing" handling: Chorus entries, the 3:30 length warning and AI comments.
// Nothing is posted in any other channel. The list is kept in DATA_DIR so it survives restarts.

const fs = require("node:fs");
const path = require("node:path");

const FILE_NAME = "now-playing-channels.json";

// Registered channels stored in a JSON file of { channelId: guildId }; loaded on first use, saved after each change.
class ChannelStore
{
    // filePath: the JSON file; its folder is created when needed
    constructor(filePath)
    {
        this.filePath = filePath;
        this.channels = null;
        this.writeQueue = Promise.resolve();
    }

    load()
    {
        if (this.channels) return this.channels;
        this.channels = new Map();
        try
        {
            const stored = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
            for (const [channelId, guildId] of Object.entries(stored))
            {
                if (typeof guildId === "string") this.channels.set(channelId, guildId);
            }
        }
        catch (error)
        {
            if (error.code !== "ENOENT") console.error(`[WARNING] Could not read ${this.filePath}, starting without registered channels:`, error.message);
        }
        return this.channels;
    }

    // Writes to a temporary file first and renames it, so a crash cannot leave a half-written file.
    save()
    {
        const content = JSON.stringify(Object.fromEntries(this.load()), null, 2);
        this.writeQueue = this.writeQueue.catch(() => null).then(async () =>
        {
            await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
            await fs.promises.writeFile(this.filePath + ".tmp", content);
            await fs.promises.rename(this.filePath + ".tmp", this.filePath);
        });
        return this.writeQueue;
    }

    // True if the channel is registered.
    // channelId: the channel to check
    has(channelId)
    {
        return this.load().has(channelId);
    }

    // Registers a channel and saves; returns false if it already was registered.
    // channelId: the channel to register
    // guildId: its server
    async add(channelId, guildId)
    {
        if (this.has(channelId)) return false;
        this.load().set(channelId, guildId);
        await this.save();
        return true;
    }

    // Unregisters a channel and saves; returns false if it was not registered.
    // channelId: the channel to unregister
    async remove(channelId)
    {
        if (!this.load().delete(channelId)) return false;
        await this.save();
        return true;
    }

    // Registered channel IDs, all or of one server.
    // guildId: only channels of this server; omit for all
    list(guildId)
    {
        return [...this.load()].filter(([, g]) => !guildId || g === guildId).map(([channelId]) => channelId);
    }
}

const defaultStore = new ChannelStore(path.join(process.env.DATA_DIR || path.join(__dirname, "..", "..", "data"), FILE_NAME));

module.exports = { ChannelStore, defaultStore };
