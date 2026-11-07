// Reads "Now Playing: Track by Author [m:ss]" posts, typed by people or posted by the Chorus bot, and builds the relay line for 2HTS.
// Chorus posts in another server; when the relay is configured, the bot copies each of its entries into a 2HTS channel.

const { escapeMarkdown } = require("discord.js");

const PREFIX = /^now playing:\s*/i;

// Track, author and length from a "Now Playing: Track by Author [m:ss]" line, or null if the text is no such line.
// text: message content; markdown asterisks are ignored
function parseNowPlaying(text)
{
    if (!text) return null;
    const line = text.replace(/\*/g, "").split(/\r?\n/)[0].trim();
    if (!PREFIX.test(line)) return null;

    const match = line.replace(PREFIX, "").match(/^(.*)\[(\d+):(\d{1,2})\]\s*$/);
    if (!match) return null;
    const durationSecs = parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
    if (!(durationSecs > 0)) return null;

    const parts = match[1].split(/ by /g);
    if (parts.length < 2) return null;
    const author = parts.pop().trim();
    const track = parts.join(" by ").trim();
    if (!author || !track) return null;
    return { track, author, durationSecs };
}

// Seconds from "m:ss", or NaN.
// text: a length like "3:02"
function parseLength(text)
{
    const match = String(text || "").trim().match(/^(\d+):(\d{1,2})$/);
    return match ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : NaN;
}

// A Chorus entry as { track, author, durationSecs, round, entry, total }, read from the text line or else from its embed; null for other posts.
// message: a Discord message (content and embeds are read)
function parseChorusEntry(message)
{
    const embed = (message.embeds || [])[0];
    const description = (embed && embed.description) || "";
    const details = description.match(/(\S+) listening party, entry (\d+) of (\d+)/i);
    const extra = details ? { round: details[1], entry: parseInt(details[2], 10), total: parseInt(details[3], 10) } : {};

    const fromText = parseNowPlaying(message.content);
    if (fromText) return { ...fromText, ...extra };
    if (!embed || !embed.title) return null;

    const field = name => ((embed.fields || []).find(f => f.name.toLowerCase() === name) || {}).value;
    const author = (field("artist") || "").trim();
    const durationSecs = parseLength(field("length"));
    if (!author || !(durationSecs > 0)) return null;
    return { track: embed.title.trim(), author, durationSecs, ...extra };
}

// The line posted on 2HTS for a Chorus entry; it keeps the "Now Playing" format people know.
// entry: as returned by parseChorusEntry
function formatRelay(entry)
{
    const length = `${Math.floor(entry.durationSecs / 60)}:${String(entry.durationSecs % 60).padStart(2, "0")}`;
    const line = `Now Playing: **${escapeMarkdown(entry.track)}** by **${escapeMarkdown(entry.author)}** [${length}]`;
    if (!entry.entry) return line;
    const details = [entry.round && escapeMarkdown(entry.round), `entry ${entry.entry} of ${entry.total}`].filter(Boolean).join(", ");
    return `${line}\n-# ${details}`;
}

// Relay settings from the environment, or null when the relay is not fully configured.
// env: environment variables, CHORUS_BOT_ID, CHORUS_CHANNEL_ID and CHORUS_RELAY_CHANNEL_ID
function relaySettings(env = process.env)
{
    const botId = (env.CHORUS_BOT_ID || "").trim();
    const sourceChannelId = (env.CHORUS_CHANNEL_ID || "").trim();
    const targetChannelId = (env.CHORUS_RELAY_CHANNEL_ID || "").trim();
    return botId && sourceChannelId && targetChannelId ? { botId, sourceChannelId, targetChannelId } : null;
}

// True if the message is a Chorus post in the watched channel.
// message: any received message
// relay: as returned by relaySettings, or null
function isChorusPost(message, relay)
{
    return Boolean(relay) && message.author && message.author.id === relay.botId && message.channelId === relay.sourceChannelId;
}

// Remembers announced tracks per channel, so a track copied by hand after the relay (or the other way round) is handled once.
class RecentTracks
{
    constructor()
    {
        this.seen = new Map();
    }

    // Records the track and returns true if it was already announced in this channel within its length.
    // channelId: channel the track is announced in
    // track: as returned by parseNowPlaying
    // now: current time in ms
    isRepeat(channelId, track, now = Date.now())
    {
        const key = `${channelId}|${track.track.toLowerCase()}|${track.author.toLowerCase()}`;
        const until = this.seen.get(key);
        for (const [k, end] of this.seen)
        {
            if (end <= now) this.seen.delete(k);
        }
        if (until && until > now) return true;
        this.seen.set(key, now + track.durationSecs * 1000);
        return false;
    }
}

module.exports = { parseNowPlaying, parseChorusEntry, formatRelay, relaySettings, isChorusPost, RecentTracks };
