const { SlashCommandBuilder } = require("@discordjs/builders");

// \u{1F604} = ??

module.exports = {
    data: new SlashCommandBuilder().setName("react").setDescription("Reacts with an emoji"),

    async execute(interaction)
    {
        const emoji = "\u{1F604}";

        await interaction.reply("I can react with Unicode emojis! " + emoji);
        const message = await interaction.fetchReply();
        await message.react(emoji);
    },
};

