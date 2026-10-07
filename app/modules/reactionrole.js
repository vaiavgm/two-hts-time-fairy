const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

// Roles that members can toggle with the buttons. "role" is the role name on the server,
// "emoji" is the (optional) name of a custom emoji on the server.
const ROLES = [
    { label: "REAPER", role: "REAPER", emoji: "reaper" },
    { label: "Reason", role: "Reason", emoji: "reason" },
];

const MODERATOR_ROLE = "@moderator";
const CUSTOM_ID_PREFIX = "reactionrole:";

function isModerator(member)
{
    return member && member.roles.cache.some(r => r.name === MODERATOR_ROLE);
}

module.exports = {
    data: new SlashCommandBuilder().setName("reactionrole").setDescription("Posts a message where members can pick their roles"),

    async execute(interaction)
    {
        if (!isModerator(interaction.member))
        {
            await interaction.reply({ content: "Moderator rights required.", flags: MessageFlags.Ephemeral });
            return;
        }

        const roleEmbed = new EmbedBuilder()
            .setColor("#ffffff")
            .setTitle("Click to choose a role")
            .setDescription("Choosing a role will make you taggable, e.g. @REAPER, to get help for your DAW! Click again to remove it.");

        const row = new ActionRowBuilder();
        for (const entry of ROLES)
        {
            const button = new ButtonBuilder()
                .setCustomId(CUSTOM_ID_PREFIX + entry.role)
                .setLabel(entry.label)
                .setStyle(ButtonStyle.Secondary);

            const emoji = entry.emoji && interaction.guild.emojis.cache.find(e => e.name === entry.emoji);
            if (emoji) button.setEmoji(emoji.id);

            row.addComponents(button);
        }

        // The buttons are identified by their customId, so they keep working after the bot restarts.
        await interaction.reply({ embeds: [roleEmbed], components: [row] });
    },

    // Called by bot.js for button clicks whose customId starts with "reactionrole:"
    async handleButton(interaction)
    {
        const roleName = interaction.customId.slice(CUSTOM_ID_PREFIX.length);
        const entry = ROLES.find(r => r.role === roleName);
        const role = entry && interaction.guild.roles.cache.find(r => r.name === entry.role);

        if (!role)
        {
            await interaction.reply({ content: `The role **${roleName}** does not exist on this server.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const member = interaction.member;
        if (member.roles.cache.has(role.id))
        {
            await member.roles.remove(role);
            await interaction.reply({ content: `Removed the **${role.name}** role.`, flags: MessageFlags.Ephemeral });
        }
        else
        {
            await member.roles.add(role);
            await interaction.reply({ content: `You now have the **${role.name}** role.`, flags: MessageFlags.Ephemeral });
        }
    },
};
