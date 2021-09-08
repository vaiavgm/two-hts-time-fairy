// Bot invitation link: https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=8&scope=bot%20applications.commands

require('dotenv').config();

// eslint-disable-next-line prefer-const
const local_testing = process.env.TESTING;

// eslint-disable-next-line no-unused-vars
// const { colorPredicate } = require('@discordjs/builders/dist/messages/embed/Assertions');

// Require the necessary discord.js classes
const Discord = require('discord.js');
// eslint-disable-next-line no-unused-vars
const { Client, Intents, ClientUser } = Discord;

let temp_token = '';

if (local_testing !== undefined) {
  temp_token = process.env.LOCAL_TOKEN;
  console.log('activating local testing mode');
}
else {
  temp_token = process.env.DISCORD_TOKEN;
  console.log('activating online mode');
}

const token = temp_token;

// Create a new client instance
const client = new Discord.Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
    Intents.FLAGS.DIRECT_MESSAGES],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
},
);

// Filesystem
const fs = require('fs');

client.commands = new Discord.Collection();
const modules = fs.readdirSync('./app/modules').filter(file => file.endsWith('.js'));
for (const file of modules) {
  const command = require(`./modules/${file}`);
  client.commands.set(command.name, command);
}


client.once('ready', () => {
  console.log('Ready!');
});

const prefix = '!';

client.on('messageCreate', msg => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.split(' ');
  const command = args.shift().toLowerCase();


  if (command === '!ping') {
    client.commands.get('ping').execute(msg, args);
  }
  else if (command === '!ping2') {
    client.commands.get('ping').execute2(msg, args);
  }

  if (command === '!reactionrole') {
    client.commands.get('reactionrole').execute(msg, args, Discord, client);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'react') {
    interaction.reply('You can react with Unicode emojis 😄!');
    const message = await interaction.fetchReply();
    message.react('😄');
  }
  else if (commandName === 'ping') {
    await interaction.reply('Pong!', { fetchReply: true });
  }
  else if (commandName === 'server') {
    await interaction.reply('Server info.');
  }
  else if (commandName === 'user') {
    await interaction.reply('User info.');
  }
  else if (commandName === 'nothing') {
    await interaction.reply('...');
  }
});

client.login(token);
