/* eslint-disable no-unused-vars */
const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder().setName("roll").setDescription("Roll some virtual dice!")
        .addStringOption(option =>
            option.setName("dicetype")
                .setDescription("e.g. '2d12' for 2 12-sided dice.")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("advantage")
                .setDescription("only the highest/lowest roll counts").setRequired(false)
                .addChoices({ name: "advantage", value: "advantage" }, { name: "disadvantage", value: "disadvantage" })),

    async execute(interaction, user)
    {

        const dicetype = interaction.options.getString("dicetype");
        const advantage = interaction.options.getString("advantage");

        const embed = rollDice(dicetype, advantage);
        await interaction.reply({ embeds: [embed] });
    },

};

const Discord = require("discord.js");

function rollDice(diceNotation, advantage = null)
{
    const error_embed = new Discord.MessageEmbed()
        .setColor("#ff0000")
        .setTitle("Invalid dice notation.");

    // Parse the notation string into the number of dice and the number of sides per die
    let [numDice, numSides] = diceNotation.split("d");

    // Check if the inputs are valid
    if (isNaN(numSides))
    {
        numSides = 20;
    }
    if (isNaN(numDice))
    {
        numDice = 1;
    }

    // Ensure the number of dice and sides per die are within reasonable bounds
    numDice = Math.max(Math.min(numDice, 100), 1);
    numSides = Math.max(Math.min(numSides, 100), 2);

    // Roll the dice and store the individual rolls
    const rolls = [];
    let total = 0;
    for (let i = 0; i < numDice; i++)
    {
        const roll = Math.floor(Math.random() * numSides) + 1;
        rolls.push(roll);
    }

    if (advantage === "advantage")
    {
        const highestRoll = Math.max(...rolls);
        total = highestRoll;
    }
    else if (advantage === "disadvantage")
    {
        const lowestRoll = Math.min(...rolls);
        total = lowestRoll;
    }
    else
    {
        total = rolls.reduce((acc, val) => acc + val, 0);
    }

    // Construct the output embed
    const embed = new Discord.MessageEmbed()
        .setColor("#00ff00")
        .setTitle(`Rolled ${numDice}d${numSides} ${advantage ? "(" + advantage + ")" : ""}`)
        .setDescription(rolls.join(", ") + "\n**Result: " + total + "**");

    return embed;
}
