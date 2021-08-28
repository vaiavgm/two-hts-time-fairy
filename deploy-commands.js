require('dotenv').config();

const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
// eslint-disable-next-line no-unused-vars
const { clientId, soloTestingServer, botTestingServer } = require('./config.json');

const commands = [
	new SlashCommandBuilder().setName('react').setDescription('Reacts with emoji! (hopefully)'),
	new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!'),
	new SlashCommandBuilder().setName('server').setDescription('Replies with server info!'),
	new SlashCommandBuilder().setName('user').setDescription('Replies with user info!'),
	new SlashCommandBuilder().setName('nothing').setDescription('Does nothing!'),
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
	try {
		/* await rest.put(
			// applicationCommands updates commands on all servers, but will take up to one hour
		    Routes.applicationCommands(clientId),
			{ body: commands },
		);*/

		await rest.put(
			// applicationGuildCommands updates commands immediately, but only works for known guildIds (servers)
			Routes.applicationGuildCommands(clientId, soloTestingServer),
			{ body: commands },
		);

		await rest.put(
			// applicationGuildCommands updates commands immediately, but only works for known guildIds (servers)
			Routes.applicationGuildCommands(clientId, botTestingServer),
			{ body: commands },
		);

		console.log('Successfully registered application commands.');
	}
	catch (error) {
		console.error(error);
	}
})();
