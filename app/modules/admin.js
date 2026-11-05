const { MessageFlags, SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../system/auth");
const { GAME_APPS, GAME_ACTIONS, isGameApp, mayControlGames, runGameAction } = require("../system/game-admin");
const slash_functions = require("../system/slash-commands");

// Modules whose slash command can be enabled or disabled per server. Games (GAME_APPS) are left out:
// their command exists automatically while a round runs.
const SLASH_MODULES = ["time", "tarot", "dice", "randomgif", "reactionrole"];

function addSlashSubcommand(group, name, description)
{
    return group.addSubcommand(sub => sub.setName(name).setDescription(description)
        .addStringOption(option => option.setName("module")
            .setDescription("Which module's slash command?")
            .setRequired(true)
            .addChoices(...SLASH_MODULES.map(module => ({ name: module, value: module }))))
        .addBooleanOption(option => option.setName("confirm")
            .setDescription("Set to True to confirm")
            .setRequired(true)));
}

const data = new SlashCommandBuilder().setName("admin").setDescription("Admin commands for the bot and its minigames.");

// /admin <game> start | distribute | list | close
for (const app of GAME_APPS)
{
    data.addSubcommandGroup(group =>
    {
        group.setName(app).setDescription(`Host controls for ${app}`);
        for (const action of GAME_ACTIONS)
        {
            group.addSubcommand(sub => sub.setName(action.name).setDescription(action.description));
        }
        return group;
    });
}

// /admin slash activate | deactivate
data.addSubcommandGroup(group =>
{
    group.setName("slash").setDescription("Enable or disable a module's slash command on this server");
    addSlashSubcommand(group, "activate", "Add a module's slash command to this server");
    addSlashSubcommand(group, "deactivate", "Remove a module's slash command from this server");
    return group;
});

module.exports = {
    data,

    async execute(interaction, user, commands)
    {
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();

        // Game actions are open to moderators too; managing slash commands is for bot admins only
        const allowed = isGameApp(group) ? mayControlGames(user, interaction.member) : isAdmin(user);
        if (!allowed)
        {
            console.log(`[ADMIN] Denied ${user.username} (ID ${user.id})`);
            await interaction.reply({ content: "Admin rights required.", flags: MessageFlags.Ephemeral });
            return;
        }

        console.log(`[ADMIN] ${user.username} (ID ${user.id}) executing [${group} ${sub}]`);

        // Some actions (e.g. handing out gendom3 themes) take longer than the 3 seconds Discord allows for a first reply
        await interaction.deferReply();

        let result;
        if (isGameApp(group))
        {
            result = await runGameAction(interaction, commands, group, sub);
        }
        else if (!interaction.options.getBoolean("confirm"))
        {
            result = "Not confirmed: set the confirm option to True.";
        }
        else if (sub === "activate")
        {
            result = await slash_functions.addCommandsToGuild(interaction, interaction.options.getString("module"));
        }
        else
        {
            result = await slash_functions.removeCommandsFromGuild(interaction, interaction.options.getString("module"));
        }

        const [reply, ...followUps] = [].concat(result);
        await interaction.editReply(reply);
        for (const followUp of followUps)
        {
            await interaction.followUp(followUp);
        }
    },
};
