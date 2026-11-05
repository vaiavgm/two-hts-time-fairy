// Host controls for Gendom 3 (see gendom3.js for the game). Discord hides this command from everyone
// except server Administrators; a server admin can add more roles (e.g. @moderator) under
// Server Settings > Integrations > this bot. The code check below also admits bot admins and @moderator.

const {
    SlashCommandBuilder,
    InteractionContextType,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");
const { canControlGames } = require("../system/auth");
const gendom3 = require("./gendom3");

const ACTIONS = {
    start: ["start", "Open a Gendom 3 round in this channel"],
    distribute: ["distribute", "Hand out the themes to everybody who joined"],
    list: ["list", "Post everybody's theme publicly"],
    close: ["close", "End the round in this channel and free its memory"],
};

const data = new SlashCommandBuilder().setName("gendom3-admin").setDescription("Host controls for Gendom 3")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild);
for (const [name, description] of Object.values(ACTIONS))
{
    data.addSubcommand(sub => sub.setName(name).setDescription(description));
}

module.exports = {
    data,

    async execute(interaction, user)
    {
        if (!canControlGames(user, interaction.member))
        {
            console.log(`[GENDOM3] Denied ${user.username} (ID ${user.id})`);
            await interaction.reply({ content: "Moderator rights required.", flags: MessageFlags.Ephemeral });
            return;
        }

        const action = interaction.options.getSubcommand();
        console.log(`[GENDOM3] ${user.username} (ID ${user.id}) executing [${action}] in channel ${interaction.channelId}`);

        // Distributing sends many follow-ups and can take longer than the 3 seconds Discord allows for a first reply
        await interaction.deferReply();

        // An action returns one message or an array of them (the first is the reply, the others follow-ups)
        const [reply, ...followUps] = [].concat(await gendom3[action](interaction));
        await interaction.editReply(reply);
        for (const followUp of followUps)
        {
            await interaction.followUp(followUp);
        }
    },
};
