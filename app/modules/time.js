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

function handle2HTSTime()
{
    // create a new Discord embed
    const embed = new Discord.MessageEmbed()
        .setColor("#0099ff")
        .setTitle("2HTS Compo Info");

    // get the current date and time in the specified timezone
    const localDateStr = new Date();
    const localDate = new Date(localDateStr);


    // localDate = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate() + 3, 23, 17, 0);
    const _2htsCompoId = getCompoId();
    const compoStart = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 20, 0, 0);
    compoStart.setHours(20);
    const compoEnd = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 22, 16, 0);
    compoEnd.setHours(22);
    const compoMidnight = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate() + 1, 0, 0, 0);
    compoMidnight.setHours(0);

    if (localDate.getDay() === 0 && localDate >= compoStart && localDate < compoEnd)
    {
        // 2HTS in progress
        const secondsUntilCompoEnd = Math.floor((compoEnd - localDate) / 1000);
        embed.setDescription(`**2HTS${_2htsCompoId}** in progress. Time left to compose: ${secToStr(secondsUntilCompoEnd)}\n\n${handleLinks()}`);
    }
    else if (localDate.getDay() === 0 && localDate >= compoStart && localDate < compoMidnight)
    {
        // 2HTS party started
        embed.setDescription(`**2HTS${_2htsCompoId}** in progress. Tune in to our listening party, and we hope to see you again next sunday!\n\n${handleLinks()}`);
    }
    else
    {
        // Time until next 2HTS start
        const daysUntilNext2HTS = (7 - localDate.getDay() + 7) % 7;

        const localTZOffset = localDate.getTimezoneOffset();
        const futureTZOffset = compoStart.getTimezoneOffset();

        const TZDeltaMinutes = localTZOffset - futureTZOffset;

        const secondsUntil2HTS =
            // convert days into seconds
            (daysUntilNext2HTS * 24 * 60 * 60) +
            // convert hours until 20:00 GMT into seconds
            ((new Date(compoStart).getUTCHours() * 60 * 60) - (localDate.getUTCHours() * 60 * 60)
            // convert minutes to seconds, and apply seconds difference
            - ((localDate.getMinutes()) * 60) - localDate.getSeconds())
            // convert DST stuff to seconds and subtract them
            - (TZDeltaMinutes * 60);
        embed.setDescription(`Time until **2HTS${_2htsCompoId}**: ${secToStr(secondsUntil2HTS)}\n\n${handleLinks()}`);
        // embed.setDescription(`Time until **2HTS${_2htsCompoId + 1}**: ${secToStr(secondsUntil2HTS)}\n\n${handleLinks()}\nCurrentUTCHour: ${localDate.getUTCHours()} | CompoUTCHour: ${compoStart.getUTCHours()}`);
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
