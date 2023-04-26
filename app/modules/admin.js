function isAdmin(user)
{
    const userId = user.username + "#" + user.discriminator;
    const admins = ["Vaia#6573", "antik#0959"];

    return admins.includes(userId);
}


const slash_functions = require("../system/slash-commands");

const { SlashCommandBuilder } = require("@discordjs/builders");
module.exports = {

    data: new SlashCommandBuilder().setName("admin").setDescription("Admin commands for the bot and its minigames.")
        .addStringOption(option =>
            option.setName("application")
                .setDescription("Which application do you want to control? (e.g. \"gendom3\")")
                .setRequired(true).addChoices(
                    { name: "gendom3", value: "gendom3" },
                    { name: "time", value: "time" },
                    { name: "tarot", value: "tarot" },
                    { name: "dice", value: "dice" },
                    { name: "randomgif", value: "randomgif" }))
        .addStringOption(option =>
            option.setName("command")
                .setDescription("Which command do you want to execute? (e.g. \"start\")")
                .setRequired(true).addChoices({ name: "start", value: "start" }, { name: "reset", value: "reset" }, { name: "Activate Slash Command", value: "activate" }, { name: "Deactivate Slash Command", value: "deactivate" }))
        .addStringOption(option =>
            option.setName("confirm")
                .setDescription("This is only needed for critical commands. Type \"confirm\", if you are sure to execute the function.")
                .setRequired(false)),

    async execute(interaction, user, commands)
    {
        let result = "Admin rights required.";
        if (!isAdmin(user))
        {
            await interaction.reply({ content: result, ephemeral: false });
            return;
        }

        const app = interaction.options.getString("application");
        const cmd = interaction.options.getString("command");
        // critical commands need a manual input of "confirm"
        const confirm = interaction.options.getString("confirm") == "confirm";

        console.log(`[ADMIN] Executing command [${cmd}] on app [${app}]`);

        result = "Unknown app or command. Enabling/Disabling Slash Commands require the 'confirm' option as parameter.";

        switch (cmd)
        {
        case "reset":
            result = await commands.get(app).reset();
            break;
        case "start":
            result = await commands.get(app).start();
            break;
        case "activate":
            // break, if "confirm" has not been written
            if (!confirm) break;
            result = await slash_functions.addCommandsToGuild(interaction, app);
            break;
        case "deactivate":
            // break, if "confirm" has not been written
            if (!confirm) break;
            result = await slash_functions.removeCommandsFromGuild(interaction, app);
            break;
        }

        await interaction.reply({ content: result, ephemeral: false });
    },
};