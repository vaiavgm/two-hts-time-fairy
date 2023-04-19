let participants = [];

let game_has_started = false;
let genre_buffer = [];
let modifier_buffer = [];

class Participant
{
    constructor(user)
    {
        this.user = user;
        this.modifier = "";
        this.generatedTheme = "";
    }
}

function get_genre_list()
{
    const themes = "House, Techno, Country, Rock, Hardcore, Metal, Hip Hop, IDM, Chiptune, Dubstep, Drum and Bass, Ambient, Jazz, Funk, Trap, Electro, Blues, Classical, Opera, Reggae, Trance, Industrial, Indie, Latin, Dub, New Jack Swing, Ska, Folk, Minimalism, Breakcore";
    return themes.split(", ");
}

function get_random_theme_for_participant(participant)
{
    if (participant.generatedTheme !== undefined && participant.generatedTheme !== "")
    {
        return "Your theme is: ``" + participant.generatedTheme + "``";
    }

    if (genre_buffer.length < 1)
    {
        genre_buffer = get_genre_list();
    }

    const random_genre_id = Math.floor(Math.random() * genre_buffer.length);

    let random_modifier;
    let random_modifier_id;
    let max_iterations = 10;


    while (max_iterations > 0 && (random_modifier == undefined || random_modifier == participant.modifier))
    {
        max_iterations--;
        if (modifier_buffer.length < 1)
        {
            for (const p of participants)
            {
                modifier_buffer.push(p.modifier);
            }
        }
        random_modifier_id = Math.floor(Math.random() * modifier_buffer.length);
        random_modifier = modifier_buffer[random_modifier_id];
    }


    const theme_result = random_modifier + " " + genre_buffer[random_genre_id];
    modifier_buffer.splice(random_modifier_id, 1);
    genre_buffer.splice(random_genre_id, 1);

    console.log(modifier_buffer);
    console.log(genre_buffer);

    participant.generatedTheme = theme_result;
    return "Your theme is: ``" + theme_result + "``";
}

function provideModifier(modifier, user)
{
    let participant = undefined;

    for (const p of participants)
    {
        if (p.user == user)
        {
            participant = p;
        }
    }

    if (participant == undefined)
    {
        participant = new Participant(user);
        participants.push(participant);
    }

    participant.modifier = modifier;

    if (!game_has_started)
    {
        return "Your chosen modifier is \"" + modifier + "\"";
    }

    console.log(participant);

    return get_random_theme_for_participant(participant);
}

const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder().setName("gendom3").setDescription("Provide a modifier and receive a random genre with a random modifier!")
        .addStringOption(option =>
            option.setName("modifier")
                .setDescription("Your chosen modifier/adjective (e.g. \"dank\")")
                .setRequired(true)),


    async execute(interaction, user)
    {
        participants.push(new Participant(user));

        const modifier = interaction.options.getString("modifier");
        const result = provideModifier(modifier, user);
        user.send(result).catch(console.error);
        await interaction.reply("\u{1F3B2}");
    },

    async start()
    {
        return this.provideThemes();
    },

    async reset()
    {
        participants = [];
        game_has_started = false;
        genre_buffer = [];
        modifier_buffer = [];

        return "Gendom 3 has been reset.";
    },

    async provideThemes()
    {
        game_has_started = true;
        for (const p of participants)
        {
            p.user.send(get_random_theme_for_participant(p));
        }
        return "Themes distributed to " + participants.length + " participants!";
    },
};

