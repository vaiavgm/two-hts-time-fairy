const partylink = "<http://chorus.thasauce.net:8000/compo.m3u>";
// Same numbering as getCompoId(), for an arbitrary instant (ms since epoch)
function getCompoIdAt(ms)
{
    // 2HTS250 was on that day
    const date2HTS250 = new Date("2019-01-13").getTime();
    const weeks = Math.floor((ms - date2HTS250) / (1000 * 60 * 60 * 24 * 7));
    return 250 + weeks;
}

function getCompoId()
{
    return getCompoIdAt(Date.now());
}

function handleLinks()
{
    const compo_id = getCompoId();
    return `Link to Chorus: ${partylink}
Here is the latest compo upload page: <http://compo.thasauce.net/rounds/view/2HTS${compo_id}>`;
}


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

function handle2HTSTime()
{
    const embed = new Discord.EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("2HTS Compo Info");

    const now = Date.now();
    const vienna = viennaParts(now);
    const _2htsCompoId = getCompoId();

    // Sunday of the current/next compo, in Vienna time (today, if today is Sunday)
    const daysUntilSunday = (7 - vienna.weekday) % 7;
    const compoStart = viennaWallToInstant(vienna.year, vienna.month, vienna.day + daysUntilSunday, 21, 0, 0);
    const compoEnd = viennaWallToInstant(vienna.year, vienna.month, vienna.day + daysUntilSunday, 23, 16, 0);
    const compoMidnight = viennaWallToInstant(vienna.year, vienna.month, vienna.day + daysUntilSunday + 1, 0, 0, 0);

    if (now >= compoStart && now < compoEnd)
    {
        // 2HTS in progress
        const secondsUntilCompoEnd = Math.floor((compoEnd - now) / 1000);
        embed.setDescription(`**2HTS${_2htsCompoId}** in progress. Time left to compose: ${secToStr(secondsUntilCompoEnd)}

${handleLinks()}`);
    }
    else if (now >= compoEnd && now < compoMidnight)
    {
        // 2HTS party started
        embed.setDescription(`**2HTS${_2htsCompoId}** in progress. Tune in to our listening party, and we hope to see you again next sunday!

${handleLinks()}`);
    }
    else
    {
        // Time until next 2HTS start
        const secondsUntil2HTS = Math.floor((compoStart - now) / 1000);
        // The label names the compo being counted down to; the links below keep pointing at the compo just held.
        const upcomingCompoId = getCompoIdAt(compoStart);
        embed.setDescription(`Time until **2HTS${upcomingCompoId}**: ${secToStr(secondsUntil2HTS)}

${handleLinks()}`);
    }

    return embed;
}

const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder().setName("time").setDescription("Shows the time until the next compo"),

    async execute(interaction)
    {
        const embed = handle2HTSTime();
        await interaction.reply({ embeds: [embed] });
    },
};
