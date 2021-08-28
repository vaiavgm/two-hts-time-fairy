// Bot invitation link: https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=2147485760&scope=bot%20applications.commands

require('dotenv').config();
// Require the necessary discord.js classes
const { Client, Intents } = require('discord.js');
// const { token } = require('../config.json');
const { token } = process.env.DISCORD_TOKEN;

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

client.once('ready', () => {
	console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;

	if (commandName === 'react') {
		const message = await interaction.reply('You can react with Unicode emojis!', { fetchReply: true });
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
		await interaction.reply('Nothing...');
	}
});

client.login(token);
