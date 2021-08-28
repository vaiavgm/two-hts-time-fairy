// Bot invitation link: https://discord.com/api/oauth2/authorize?client_id=881164920673165333&permissions=8&scope=bot%20applications.commands

// eslint-disable-next-line prefer-const
const local_testing = process.env.TESTING;

require('dotenv').config();

// Require the necessary discord.js classes
const { Client, Intents } = require('discord.js');
// const { token } = require('../config.json');

let temp_token = '';

if (local_testing !== undefined) {
	temp_token = process.env.LOCAL_TOKEN;
	console.log('activating local testing mode');
}
else {
	temp_token = process.env.DISCORD_TOKEN;
	console.log('activating online mode');
}

const { token } = temp_token;

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

client.once('ready', () => {
	console.log('Ready!');
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
