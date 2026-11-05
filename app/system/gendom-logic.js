// Pure game logic for /gendom3 (no Discord code, so it can be unit tested).
// An "entry" is { userId, word }.

const GENRES = [
    "House", "Techno", "Country", "Rock", "Hardcore", "Metal", "Hip Hop", "IDM", "Chiptune", "Dubstep",
    "Drum and Bass", "Ambient", "Jazz", "Funk", "Trap", "Electro", "Blues", "Classical", "Opera", "Reggae",
    "Trance", "Industrial", "Indie", "Latin", "Dub", "New Jack Swing", "Ska", "Folk", "Minimalism", "Breakcore",
];

const SHUFFLE_ATTEMPTS = 200;

function normalize(word)
{
    return String(word).trim().toLowerCase();
}

function pickRandom(list)
{
    return list[Math.floor(Math.random() * list.length)];
}

// Fisher-Yates, returns a new array
function shuffled(list)
{
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// Draws genres without repeats until the buffer is empty, then refills it.
function nextGenre(buffer)
{
    if (buffer.length < 1)
    {
        buffer.push(...GENRES);
    }
    return buffer.splice(Math.floor(Math.random() * buffer.length), 1)[0];
}

// Hands every entry's word to exactly one other player by arranging the players in a random
// single cycle (everyone gets the word of the next player), so nobody gets their own word.
// Several cycles are tried, keeping the one where the fewest players get a word with the same text as
// their own (e.g. both typed "dank"). Returns Map<userId, sourceEntry>.
function assignInitial(entries)
{
    if (entries.length < 2)
    {
        throw new Error("At least 2 entries are needed to assign words.");
    }

    let best = null;
    let bestClashes = Infinity;

    for (let attempt = 0; attempt < SHUFFLE_ATTEMPTS && bestClashes > 0; attempt++)
    {
        const order = shuffled(entries);
        const assignment = new Map();
        let clashes = 0;

        for (let i = 0; i < order.length; i++)
        {
            const receiver = order[i];
            const source = order[(i + 1) % order.length];
            assignment.set(receiver.userId, source);
            if (normalize(source.word) === normalize(receiver.word)) clashes++;
        }

        if (clashes < bestClashes)
        {
            best = assignment;
            bestClashes = clashes;
        }
    }

    return best;
}

// Picks a word for someone who joined after the initial assignment. Never returns their own entry;
// prefers a word with different text, and only repeats the same text if there is nothing else.
// Returns null if the pool holds nothing but the player's own entry.
function assignLate(entry, pool)
{
    const others = pool.filter(e => e.userId !== entry.userId);
    if (others.length < 1) return null;

    const different = others.filter(e => normalize(e.word) !== normalize(entry.word));
    return pickRandom(different.length > 0 ? different : others);
}

module.exports = { GENRES, normalize, nextGenre, assignInitial, assignLate };
