/* eslint-disable no-unused-vars */
const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder().setName("ping").setDescription("This is a ping command"),

    async execute(interaction, user)
    {
        await interaction.reply("pong!");
        // message.channel.send("pong!");
    },

    execute2(message, args)
    {
        message.channel.send("pong2!" + args[0]);
    },
};

/* Some test code snippets

 if(message.member.roles.cache.has('')) // discord role id; taggable, type /@<role>
 if(message.member.roles.cache.some(r => r.name === "Mod"))

 let role = message.guild.roles.cache.find(r => r.name === "Mod");
 message.member.roles.add(role).catch(console.error);

*/