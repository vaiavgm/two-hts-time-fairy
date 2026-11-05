const { MessageFlags, SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../system/auth");
const slash_functions = require("../system/slash-commands");

module.exports = {

    data: new SlashCommandBuilder().setName("admin").setDescription("Bot owner commands: enable or disable slash commands per server.")
        .addStringOption(option =>
            option.setName("application")
                .setDescription("Which module do you want to (de)activate? (e.g. \"gendom3\")")
                .setRequired(true).addChoices(
                    { name: "gendom3", value: "gendom3" },
                    { name: "game-admin", value: "game-admin" },
                    { name: "time", value: "time" },
                    { name: "tarot", value: "tarot" },
                    { name: "dice", value: "dice" },
                    { name: "randomgif", value: "randomgif" },
                    { name: "reactionrole", value: "reactionrole" }))
        .addStringOption(option =>
            option.setName("command")
                .setDescription("What do you want to do?")
                .setRequired(true).addChoices({ name: "Activate Slash Command", value: "activate" }, { name: "Deactivate Slash Command", value: "deactivate" }))
        .addStringOption(option =>
            option.setName("confirm")
                .setDescription("This is only needed for critical commands. Type \"confirm\", if you are sure to execute the function.")
                .setRequired(false)),

    async execute(interaction, user)
    {
        let result = "Admin rights required.";
        if (!isAdmin(user))
        {
            console.log(`[ADMIN] Denied ${user.username} (ID ${user.id})`);
            await interaction.reply({ content: result, flags: MessageFlags.Ephemeral });
            return;
        }

        const app = interaction.options.getString("application");
        const cmd = interaction.options.getString("command");
        // critical commands need a manual input of "confirm"
        const confirm = interaction.options.getString("confirm") == "confirm";

        console.log(`[ADMIN] ${user.username} (ID ${user.id}) executing command [${cmd}] on app [${app}]`);

        result = "Enabling/Disabling Slash Commands require the 'confirm' option as parameter.";

        switch (cmd)
        {
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

        await interaction.reply({ content: result });
    },
};
