/* eslint-disable no-unused-vars */
module.exports = {
  name: "ping",
  description: "this is a ping command",
  execute(message, args) {
    message.channel.send("pong!");
  },
  execute2(message, args) {

    message.channel.send("pong2!" + args[0]);
  },
};

/* Some test code snippets

 if(message.member.roles.cache.has('')) // discord role id; taggable, type /@<role>
 if(message.member.roles.cache.some(r => r.name === "Mod"))

 let role = message.guild.roles.cache.find(r => r.name === "Mod");
 message.member.roles.add(role).catch(console.error);

*/