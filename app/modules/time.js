const partylink = "<http://chorus.thasauce.net:8000/compo.m3u>";
function getCompoId()
{
    // 2HTS250 was on that day
    const date2HTS250 = new Date("2019-01-13");
    const today = new Date();

    // Calculate the number of days between startDate and today
    const daysSince2HTS250 = Math.floor((today - date2HTS250) / (1000 * 60 * 60 * 24));

    // Calculate the number of weeks between startDate and today
    const weeksSince2HTS250 = Math.floor(daysSince2HTS250 / 7);

    // Add 250 and the number of weeks to get the current compo ID
    const currentCompoId = 250 + weeksSince2HTS250;

    return currentCompoId;
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


// function isoToObj(s)
// {
//     const b = s.split(/[-TZ:]/i);
//
//     return new Date(Date.UTC(b[0], --b[1], b[2], b[3], b[4], b[5]));
//
// }
// function timeToGo(s)
// {
//
//     // Utility to add leading zero
//     function z(n)
//     {
//         return (n < 10 ? "0" : "") + n;
//     }
//
//     // Convert string to date object
//     const d = isoToObj(s);
//     let diff = d - new Date();
//
//     // Allow for previous times
//     const sign = diff < 0 ? "-" : "";
//     diff = Math.abs(diff);
//
//     // Get time components
//     const hours = diff / 3.6e6 | 0;
//     const mins = diff % 3.6e6 / 6e4 | 0;
//     const secs = Math.round(diff % 6e4 / 1e3);
//
//     // Return formatted string
//     return sign + z(hours) + ":" + z(mins) + ":" + z(secs);
// }

function handle2HTSTime()
{
    // create a new Discord embed
    const embed = new Discord.MessageEmbed()
        .setColor("#0099ff")
        .setTitle("2HTS Compo Info");

    // get the current date and time in the specified timezone
    const localDate = new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" });

    // localDate = new Date(new Date(localDate).getFullYear(), new Date(localDate).getMonth(), new Date(localDate).getDate() + 3, 23, 17, 0);
    const _2htsCompoId = getCompoId();
    const compoStart = new Date(new Date(localDate).getFullYear(), new Date(localDate).getMonth(), new Date(localDate).getDate(), 21, 0, 0);
    const compoEnd = new Date(new Date(localDate).getFullYear(), new Date(localDate).getMonth(), new Date(localDate).getDate(), 23, 16, 0);
    const compoMidnight = new Date(new Date(localDate).getFullYear(), new Date(localDate).getMonth(), new Date(localDate).getDate() + 1, 0, 0, 0);

    if (new Date(localDate).getDay() === 0 && new Date(localDate) >= compoStart && new Date(localDate) < compoEnd)
    {
        // 2HTS in progress
        const secondsUntilCompoEnd = Math.floor((compoEnd - new Date(localDate)) / 1000);
        embed.setDescription(`**2HTS${_2htsCompoId}** in progress. Time left to compose: ${secToStr(secondsUntilCompoEnd)}\n\n${handleLinks()}`);
    }
    else if (new Date(localDate).getDay() === 0 && new Date(localDate) >= compoStart && new Date(localDate) < compoMidnight)
    {
        // 2HTS party started
        embed.setDescription(`**2HTS${_2htsCompoId}** in progress. Tune in to our listening party, and we hope to see you again next sunday!\n\n${handleLinks()}`);
    }
    else
    {
        // Time until next 2HTS start
        const daysUntilNext2HTS = (7 - new Date(localDate).getDay() + 7) % 7;
        const localTZOffset = new Date(localDate).getTimezoneOffset();

        let futureDate = new Date(localDate);
        futureDate = futureDate.setDate(futureDate.getDate() + daysUntilNext2HTS);
        const futureTZOffset = new Date(futureDate).getTimezoneOffset();

        const TZDeltaMinutes = localTZOffset - futureTZOffset;


        const secondsUntil2HTS =
            // convert days into seconds
            (daysUntilNext2HTS * 24 * 60 * 60) +
            // convert hours until 21:00 into seconds
            ((21 * 60 * 60) - (new Date(localDate).getHours() * 60 * 60)
            // convert minutes to seconds, and apply seconds difference
            - ((new Date(localDate).getMinutes()) * 60) - new Date(localDate).getSeconds())
            // convert DST stuff to seconds and subtract them
            - (TZDeltaMinutes * 60);
        embed.setDescription(`Time until **2HTS${_2htsCompoId + 1}**: ${secToStr(secondsUntil2HTS)}\n\n${handleLinks()}`);
    }

    // return the Discord embed
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
