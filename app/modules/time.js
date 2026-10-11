const partylink = "<http://chorus.thasauce.net:8000/compo.m3u>";

function compoUrl(compoId)
{
    return `<http://compo.thasauce.net/rounds/view/2HTS${compoId}>`;
}

// Compo ID for an arbitrary instant (ms since epoch). The ID counts weeks in Vienna's calendar,
// so it moves on at Sunday 00:00 Vienna time.
function getCompoIdAt(ms)
{
    // 2HTS250 was on that day
    const date2HTS250 = Date.UTC(2019, 0, 13);
    const v = viennaParts(ms);
    const viennaDate = Date.UTC(v.year, v.month - 1, v.day);
    const weeks = Math.floor((viennaDate - date2HTS250) / (1000 * 60 * 60 * 24 * 7));
    return 250 + weeks;
}

// Exact static breakdown, as of the moment it is computed. Currently not shown (the live Discord
// timestamps are used instead), but kept in case the static countdowns are brought back.
// eslint-disable-next-line no-unused-vars
function secToStr(seconds)
{
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor(seconds / 60) % 60;
    const remainingSeconds = seconds % 60;

    let result_string = "";
    // only display days, if there's at least one day
    if (days > 0)
    {
        result_string += `${days}d `;
    }
    result_string += `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m ${remainingSeconds.toString().padStart(2, "0")}s`;
    return `\`${result_string}\``;
}

// Discord renders these in each viewer's own timezone: F = full date and time, t = short time,
// R = live relative countdown ("in 3 days"). R is used for the upcoming compo and the submission deadline.
function discordTime(ms, style)
{
    return `<t:${Math.floor(ms / 1000)}:${style}>`;
}


const Discord = require("discord.js");

const COMPO_TZ = "Europe/Vienna";
const viennaFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: COMPO_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Vienna wall-clock fields for a given instant (ms since epoch)
function viennaParts(ms)
{
    const p = {};
    for (const { type, value } of viennaFormat.formatToParts(ms))
    {
        p[type] = value;
    }
    return {
        year: +p.year,
        month: +p.month,
        day: +p.day,
        hour: +p.hour,
        minute: +p.minute,
        second: +p.second,
        weekday: WEEKDAYS.indexOf(p.weekday),
    };
}

// Vienna's offset from UTC (ms) at a given instant, DST included
function viennaOffsetMs(ms)
{
    const v = viennaParts(ms);
    return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - Math.floor(ms / 1000) * 1000;
}

// The real instant (ms) at which Vienna's wall clock reads the given time.
// Day overflow is fine (e.g. day 32 rolls into next month).
function viennaWallToInstant(year, month, day, hour, minute, second)
{
    const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    // The offset must be taken at the target instant, not now, so DST changes in between are respected.
    // Two passes settle the guess when the target lies on the other side of a DST change.
    let instant = asUtc - viennaOffsetMs(asUtc);
    instant = asUtc - viennaOffsetMs(instant);
    return instant;
}

const COMPO_START = { hour: 21, minute: 0 };
const COMPO_END = { hour: 23, minute: 16 };

function handle2HTSTime(now = Date.now())
{
    const embed = new Discord.EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("2HTS Compo Info");

    const vienna = viennaParts(now);

    // Sunday of the current/next compo, in Vienna time (today, if today is Sunday)
    const sunday = vienna.day + (7 - vienna.weekday) % 7;
    const compoStart = viennaWallToInstant(vienna.year, vienna.month, sunday, COMPO_START.hour, COMPO_START.minute, 0);
    const compoEnd = viennaWallToInstant(vienna.year, vienna.month, sunday, COMPO_END.hour, COMPO_END.minute, 0);
    // the party may run until midnight; after that, the compo counts as "previous"
    const compoMidnight = viennaWallToInstant(vienna.year, vienna.month, sunday + 1, 0, 0, 0);
    const compoId = getCompoIdAt(compoStart);

    // Every message has the same shape: a timer/status line, the one compo link, a blank line, the stream link.
    // The compo page may not exist yet for an upcoming compo, but it is always linked. There is no "previous" compo.
    let statusLine, compoLine;

    if (now >= compoStart && now < compoEnd)
    {
        // compo running
        statusLine = `Submissions close at ${discordTime(compoEnd, "t")} (${discordTime(compoEnd, "R")})`;
        // static countdown, kept in case it is brought back:
        // statusLine += `\nTime left to compose: ${secToStr(Math.floor((compoEnd - now) / 1000))}`;
        compoLine = `**2HTS${compoId}** in progress: ${compoUrl(compoId)}`;
    }
    else if (now >= compoEnd && now < compoMidnight)
    {
        // listening party, until midnight
        statusLine = "Tune in to our listening party, and we hope to see you again next Sunday!";
        compoLine = `**2HTS${compoId}** in progress: ${compoUrl(compoId)}`;
    }
    else
    {
        // upcoming compo
        statusLine = `Starts ${discordTime(compoStart, "F")} (${discordTime(compoStart, "R")})`;
        // static countdown, kept in case it is brought back:
        // statusLine += `\nCountdown: ${secToStr(Math.floor((compoStart - now) / 1000))}`;
        compoLine = `**2HTS${compoId}** upload page: ${compoUrl(compoId)}`;
    }

    embed.setDescription(`${statusLine}\n${compoLine}\n\nLink to Chorus: ${partylink}`);
    return embed;
}

const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder().setName("time").setDescription("Shows the time until the next compo"),

    async execute(interaction)
    {
        const embed = handle2HTSTime();
        await interaction.reply({ embeds: [embed] });
    },

    // exported for testing
    buildEmbed: handle2HTSTime,
};
