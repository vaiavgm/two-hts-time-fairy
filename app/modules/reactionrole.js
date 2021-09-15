/* eslint-disable no-unused-vars */
module.exports = {
  name: "reactionrole",
  description: "reactions for users",
  async execute(message, args, Discord, client) {
    if (!message.member.roles.cache.some(r => r.name === "@moderator")) return;

    // channelid
    const channel = message.channel;
    const reaperRole = message.guild.roles.cache.find(role => role.name === "REAPER");
    const reasonRole = message.guild.roles.cache.find(role => role.name === "Reason");

    const reaperEmote = client.emojis.cache.find(emoji => emoji.name === "reaper").id;
    const reasonEmote = client.emojis.cache.find(emoji => emoji.name === "reason").id;

    const roleEmbed = new Discord.MessageEmbed()
      .setColor("#ffffff")
      .setTitle("React to choose a role")
      .setDescription("Choosing a role will make you taggable, e.g. @REAPER, to get help for your DAW!");

    const messageEmbed = await message.channel.send({ embeds: [roleEmbed] });
    messageEmbed.react(reaperEmote);
    messageEmbed.react(reasonEmote);


    client.on("messageReactionAdd", async (reaction, user) => {
      if (reaction.message.partial) await reaction.message.fetch();
      if (reaction.partial) await reaction.fetch();
      if (user.bot) return;
      if (!reaction.message.guild) return;

      if (reaction.message.channel.id == channel) {
        if (reaction.emoji.id === reaperEmote) {
          await reaction.message.guild.members.cache.get(user.id).roles.add(reaperRole);
        }
        else if (reaction.emoji.id === reasonEmote) {
          await reaction.message.guild.members.cache.get(user.id).roles.add(reasonRole);
        }
      }
      else {
        return;
      }
    });

    client.on("messageReactionRemove", async (reaction, user) => {
      if (reaction.message.partial) await reaction.message.fetch();
      if (reaction.partial) await reaction.fetch();
      if (user.bot) return;
      if (!reaction.message.guild) return;

      if (reaction.message.channel.id == channel) {
        if (reaction.emoji.id === reaperEmote) {
          await reaction.message.guild.members.cache.get(user.id).roles.remove(reaperRole);
        }
        else if (reaction.emoji.id === reasonEmote) {
          await reaction.message.guild.members.cache.get(user.id).roles.remove(reasonRole);
        }
      }
      else {
        return;
      }
    });
  },
};

// use reaction.emoji.name for default discord emoji
