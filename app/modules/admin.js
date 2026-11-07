const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../system/auth");
const { GAME_APPS, GAME_ACTIONS, isGameApp, mayControlGames, runGameAction } = require("../system/game-admin");
const slash_functions = require("../system/slash-commands");

// One /admin command: pick an app, then an action from the list for that app, then only the options that action reads.
// Games (GAME_APPS) get host actions; the other modules can have their slash command switched on or off per server.

const SLASH_MODULES = ["time", "tarot", "dice", "randomgif", "reactionrole"];

const SLASH_ACTIONS = [
    { name: "activate", description: "Add this module's slash command to this server", required: ["confirm"] },
    { name: "deactivate", description: "Remove this module's slash command from this server", required: ["confirm"] },
];

const APPS = [
    ...GAME_APPS.map(name => ({ name, label: `${name} (game host controls)`, actions: GAME_ACTIONS })),
    ...SLASH_MODULES.map(name => ({ name, label: `${name} (slash command on/off)`, actions: SLASH_ACTIONS })),
];

const OPTION_NAMES = ["minutes", "sources", "user", "confirm"];

const MAX_CHOICES = 25;
const MAX_CHOICE_LENGTH = 100;

const data = new SlashCommandBuilder().setName("admin").setDescription("Admin commands for the bot and its minigames.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(o => o.setName("app").setDescription("What to control").setRequired(true)
        .addChoices(...APPS.map(app => ({ name: app.label, value: app.name }))))
    .addStringOption(o => o.setName("action").setDescription("What to do (the list shows the actions of the chosen app)")
        .setRequired(true).setAutocomplete(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("start: time limit in minutes (1-60). Empty: no limit")
        .setMinValue(1).setMaxValue(60))
    .addBooleanOption(o => o.setName("sources").setDescription("list: also name the players whose words make up each theme"))
    .addUserOption(o => o.setName("user").setDescription("kick: the player to remove"))
    .addBooleanOption(o => o.setName("confirm").setDescription("activate / deactivate: set to True to confirm"));

// The app with this name, or undefined.
// name: value of the app option
function findApp(name)
{
    return APPS.find(app => app.name === name);
}

// Autocomplete choices for the action option: the chosen app's actions (all actions before an app is chosen), filtered by the typed text.
// appName: value of the app option, or null
// typed: what the user typed into the action option so far
function suggestActions(appName, typed = "")
{
    const app = findApp(appName);
    const actions = app ? app.actions : [...GAME_ACTIONS, ...SLASH_ACTIONS];
    const needle = typed.trim().toLowerCase();
    return actions
        .filter(action => !needle || action.name.includes(needle) || action.description.toLowerCase().includes(needle))
        .slice(0, MAX_CHOICES)
        .map(action => ({ name: `${action.name}: ${action.description}`.slice(0, MAX_CHOICE_LENGTH), value: action.name }));
}

// Which options an action is missing and which given options it does not read.
// action: entry of GAME_ACTIONS or SLASH_ACTIONS
// options: the interaction's options
function checkOptions(action, options)
{
    const required = action.required || [];
    const used = [...(action.options || []), ...required];
    const given = name => options.get(name) !== null && options.get(name) !== undefined;
    return {
        missing: required.filter(name => name === "confirm" ? options.getBoolean("confirm") !== true : !given(name)),
        ignored: OPTION_NAMES.filter(name => given(name) && !used.includes(name)),
    };
}

// Reply text for missing options.
// actionName: the action that needs them
// missing: names of the missing options
function missingText(actionName, missing)
{
    return missing.map(name => name === "confirm"
        ? `\`${actionName}\` needs \`confirm:True\`.`
        : `\`${actionName}\` needs the \`${name}\` option.`).join("\n");
}

module.exports = {
    data,
    suggestActions,
    checkOptions,

    async autocomplete(interaction)
    {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== "action")
        {
            await interaction.respond([]);
            return;
        }
        await interaction.respond(suggestActions(interaction.options.getString("app"), focused.value));
    },

    async execute(interaction, user, commands)
    {
        const ephemeral = content => interaction.reply({ content, flags: MessageFlags.Ephemeral });
        const appName = interaction.options.getString("app");
        const actionName = interaction.options.getString("action");
        const app = findApp(appName);
        if (!app)
        {
            await ephemeral(`Unknown app **${appName}**.`);
            return;
        }

        // Game actions are open to moderators too; managing slash commands is for bot admins only
        const allowed = isGameApp(app.name) ? mayControlGames(user, interaction.member) : isAdmin(user);
        if (!allowed)
        {
            console.log(`[ADMIN] Denied ${user.username} (ID ${user.id})`);
            await ephemeral("Admin rights required.");
            return;
        }

        const action = app.actions.find(a => a.name === actionName);
        if (!action)
        {
            await ephemeral(`**${app.name}** has no action \`${actionName}\`. Choose one of: ${app.actions.map(a => `\`${a.name}\``).join(", ")}.`);
            return;
        }

        const { missing, ignored } = checkOptions(action, interaction.options);
        if (missing.length)
        {
            await ephemeral(missingText(action.name, missing));
            return;
        }

        console.log(`[ADMIN] ${user.username} (ID ${user.id}) executing [${app.name} ${action.name}]`);

        // Some actions (e.g. handing out gendom3 themes) take longer than the 3 seconds Discord allows for a first reply
        await interaction.deferReply();

        let result;
        if (isGameApp(app.name))
        {
            result = await runGameAction(interaction, commands, app.name, action.name);
        }
        else if (action.name === "activate")
        {
            result = await slash_functions.addCommandsToGuild(interaction, app.name);
        }
        else
        {
            result = await slash_functions.removeCommandsFromGuild(interaction, app.name);
        }

        const [reply, ...followUps] = [].concat(result);
        await interaction.editReply(reply);
        for (const followUp of followUps)
        {
            await interaction.followUp(followUp);
        }
        if (ignored.length)
        {
            await interaction.followUp({ content: `Ignored for \`${action.name}\`: ${ignored.map(n => `\`${n}\``).join(", ")}.`, flags: MessageFlags.Ephemeral });
        }
    },
};
