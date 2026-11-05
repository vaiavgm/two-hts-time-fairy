const { MessageFlags, SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../system/auth");
const { GAME_ACTIONS, isGameAction, mayControlGames, runGameAction } = require("../system/game-admin");
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
                .setRequired(true).addChoices(
                    ...GAME_ACTIONS.map(action => ({ name: action, value: action })),
                    { name: "Activate Slash Command", value: "activate" },
                    { name: "Deactivate Slash Command", value: "deactivate" }))
        .addStringOption(option =>
            option.setName("confirm")
                .setDescription("This is only needed for critical commands. Type \"confirm\", if you are sure to execute the function.")
                .setRequired(false)),

    async execute(interaction, user, commands)
    {
        const app = interaction.options.getString("application");
        const cmd = interaction.options.getString("command");

        // Game actions (start, distribute, ...) are open to moderators too; managing slash commands is for bot admins only
        const allowed = isGameAction(cmd) ? mayControlGames(user, interaction.member) : isAdmin(user);
        if (!allowed)
        {
            console.log(`[ADMIN] Denied ${user.username} (ID ${user.id})`);
            await interaction.reply({ content: "Admin rights required.", flags: MessageFlags.Ephemeral });
            return;
        }

        // critical commands need a manual input of "confirm"
        const confirm = interaction.options.getString("confirm") == "confirm";

        console.log(`[ADMIN] ${user.username} (ID ${user.id}) executing command [${cmd}] on app [${app}]`);

        // Some actions (e.g. handing out gendom3 themes) take longer than the 3 seconds Discord allows for a first reply
        await interaction.deferReply();

        let result = "Enabling/Disabling Slash Commands require the 'confirm' option as parameter.";

        if (isGameAction(cmd))
        {
            result = await runGameAction(interaction, commands, app, cmd);
        }
        else if (cmd === "activate" && confirm)
        {
            result = await slash_functions.addCommandsToGuild(interaction, app);
        }
        else if (cmd === "deactivate" && confirm)
        {
            result = await slash_functions.removeCommandsFromGuild(interaction, app);
        }

        const [reply, ...followUps] = [].concat(result);
        await interaction.editReply(reply);
        for (const followUp of followUps)
        {
            await interaction.followUp(followUp);
        }
    },
};
