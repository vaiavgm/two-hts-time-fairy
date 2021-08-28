// to update slash commands, execute
// node deploy-commands.js

require('dotenv').config();

const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// eslint-disable-next-line no-unused-vars
const { clientId, soloTestingServer, botTestingServer } = require('./config-local.json');


const commands = [
	new SlashCommandBuilder().setName('nothing').setDescription('Does nothing!'),
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(process.env.LOCAL_TOKEN);

(async () => {
	try {
		/* await rest.put(
			// applicationCommands updates commands on all servers, but will take up to one hour
		    Routes.applicationCommands(clientId),
			{ body: commands },
		);*/

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
