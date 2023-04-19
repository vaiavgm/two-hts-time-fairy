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

function handle2HTSTime()
{
    // get the current date and time in the specified timezone
    const localDate = new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" });
    const _2htsCompoId = getCompoId();
    const compoStart = new Date(new Date(localDate).getFullYear(), new Date(localDate).getMonth(), new Date(localDate).getDate(), 21, 0, 0);
    const compoEnd = new Date(new Date(localDate).getFullYear(), new Date(localDate).getMonth(), new Date(localDate).getDate(), 23, 15, 0);
    const compoMidnight = new Date(new Date(localDate).getFullYear(), new Date(localDate).getMonth(), new Date(localDate).getDate() + 1, 0, 0, 0);

    let message;

    if (new Date(localDate).getDay() === 0 && new Date(localDate) >= compoStart && new Date(localDate) < compoMidnight)
    {
        const secondsUntilCompoEnd = Math.floor((compoEnd - new Date(localDate)) / 1000);
        message = `**2HTS${_2htsCompoId}** in progress. Ends in ${secToStr(secondsUntilCompoEnd)}.\n\n${handleLinks()}`;
    } else
    {
        const daysUntilNext2HTS = (7 - new Date(localDate).getDay() + 7) % 7;
        const secondsUntil2HTS = (daysUntilNext2HTS * 24 * 60 * 60) + ((21 * 60 * 60) - (new Date(localDate).getHours() * 60 * 60) - (new Date(localDate).getMinutes() * 60) - new Date(localDate).getSeconds());
        message = `Time until **2HTS${_2htsCompoId + 1}**: ${secToStr(secondsUntil2HTS)}\n\n${handleLinks()}`;
    }

    return message;
}

const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder().setName("time").setDescription("Shows the time until the next compo"),

    async execute(interaction)
    {
        await interaction.reply(handle2HTSTime());
    },
};
