const { MessageFlags, SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../system/auth");
const slash_functions = require("../system/slash-commands");

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
                    { name: "randomgif", value: "randomgif" },
                    { name: "reactionrole", value: "reactionrole" }))
        .addStringOption(option =>
            option.setName("command")
                .setDescription("Which command do you want to execute? (e.g. \"start\")")
                .setRequired(true).addChoices({ name: "start", value: "start" }, { name: "distribute", value: "distribute" }, { name: "list", value: "list" }, { name: "close", value: "close" }, { name: "Activate Slash Command", value: "activate" }, { name: "Deactivate Slash Command", value: "deactivate" }))
        .addStringOption(option =>
            option.setName("confirm")
                .setDescription("This is only needed for critical commands. Type \"confirm\", if you are sure to execute the function.")
                .setRequired(false)),

    async execute(interaction, user, commands)
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

        // Some actions (e.g. handing out gendom3 themes) take longer than the 3 seconds Discord allows for a first reply
        await interaction.deferReply();

        result = "Unknown app or command. Enabling/Disabling Slash Commands require the 'confirm' option as parameter.";

        switch (cmd)
        {
            case "start":
            case "distribute":
            case "list":
            case "close":
            {
                const target = commands.get(app);
                if (!target || typeof target[cmd] !== "function")
                {
                    result = `The app **${app}** does not support the "${cmd}" command.`;
                    break;
                }
                // An action may return one reply or an array (first one is the reply, the others follow-ups)
                result = await target[cmd](interaction);
                break;
            }
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

        const [reply, ...followUps] = [].concat(result);
        await interaction.editReply(reply);
        for (const followUp of followUps)
        {
            await interaction.followUp(followUp);
        }
    },
};