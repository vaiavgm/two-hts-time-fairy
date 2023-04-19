function isAdmin(user)
{
    const userId = user.username + "#" + user.discriminator;
    const admins = ["Vaia#6573", "antik#0959"];

    return admins.includes(userId);
}

const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {

    data: new SlashCommandBuilder().setName("admin").setDescription("Admin commands for the bot and its minigames.")
        .addStringOption(option =>
            option.setName("application")
                .setDescription("Which application do you want to control? (e.g. \"gendom3\")")
                .setRequired(true).addChoices({ name: "gendom3", value: "gendom3" }))
        .addStringOption(option =>
            option.setName("command")
                .setDescription("Which command do you want to execute? (e.g. \"start\")")
                .setRequired(true).addChoices({ name: "start", value: "start" }, { name: "reset", value: "reset" })),


    async execute(interaction, user, commands)
    {
        let result = "Admin rights required.";
        if (!isAdmin(user)) interaction.reply({ content: result, ephemeral: false });

        const app = interaction.options.getString("application");
        const cmd = interaction.options.getString("command");

        console.log(`[ADMIN] Executing command [${cmd}] on app [${app}]`);

        result = "Unknown app or command.";

        switch (cmd)
        {
        case "reset":
            result = await commands.get(app).reset();
            break;
        case "start":
            result = await commands.get(app).start();
            break;
        }

        await interaction.reply({ content: result, ephemeral: false });
    },
};