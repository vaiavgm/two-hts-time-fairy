// Pure game logic for the Gendom games (no Discord code, so it can be unit tested).
// An "entry" is { userId, words: [...] } with one word or phrase per slot (Gendom 3 has 1 slot, Gendom 4 has 4).
// A "source" is { userId, word }: one word of somebody's entry, as handed to a receiver.

const GENRES = [
    "House", "Techno", "Country", "Rock", "Hardcore", "Metal", "Hip Hop", "IDM", "Chiptune", "Dubstep",
    "Drum and Bass", "Ambient", "Jazz", "Funk", "Trap", "Electro", "Blues", "Classical", "Opera", "Reggae",
    "Trance", "Industrial", "Indie", "Latin", "Dub", "New Jack Swing", "Ska", "Folk", "Minimalism", "Breakcore",
];

const SHUFFLE_ATTEMPTS = 200;
const DRAW_ATTEMPTS = 50;

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

// One offset per slot, all between 1 and n-1 (so never 0: nobody gets their own word). They are all different
// while there are enough players; with fewer players than slots + 1 they repeat (the modulo wraps around).
function randomOffsets(playerCount, slotCount)
{
    const available = Array.from({ length: playerCount - 1 }, (_, i) => i + 1);
    const offsets = [];
    while (offsets.length < slotCount)
    {
        offsets.push(...shuffled(available));
    }
    return shuffled(offsets.slice(0, slotCount));
}

// Rotating shuffle: the players are put in a random order, and for every slot s the receiver at position i gets
// the word of the player at position (i + offset[s]) mod n. Since every offset is between 1 and n-1, nobody gets
// their own word, and every word is handed out exactly once. With at least slotCount + 1 players the offsets are
// all different, so the words of one receiver come from different players.
// Several orders are tried, keeping the one where the fewest receivers get a word with the same text as their own
// word in that slot (e.g. both typed "dank"). Returns Map<userId, source[]> (one source per slot).
function assignInitial(entries, slotCount = 1)
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
        const offsets = randomOffsets(order.length, slotCount);
        const assignment = new Map();
        let clashes = 0;

        for (let i = 0; i < order.length; i++)
        {
            const receiver = order[i];
            const sources = offsets.map((offset, slot) =>
            {
                const giver = order[(i + offset) % order.length];
                if (normalize(giver.words[slot]) === normalize(receiver.words[slot])) clashes++;
                return { userId: giver.userId, word: giver.words[slot] };
            });
            assignment.set(receiver.userId, sources);
        }

        if (clashes < bestClashes)
        {
            best = assignment;
            bestClashes = clashes;
        }
    }

    return best;
}

// The pool latecomers draw from, one list of sources per slot. It starts with every word of the initial round.
function createPool(entries, slotCount = 1)
{
    return Array.from({ length: slotCount }, (_, slot) =>
        shuffled(entries.map(entry => ({ userId: entry.userId, word: entry.words[slot] }))));
}

// A latecomer adds their words to the pool and draws one word per slot, which is removed from the pool so the next
// latecomer does not get the same one. Since every latecomer adds as many words as they take, the pool never runs
// out. Never draws the latecomer's own word while anything else is left; prefers words from different players and
// words whose text differs from the latecomer's own. Returns source[] (one per slot).
function drawLate(pool, entry)
{
    pool.forEach((slotPool, slot) => slotPool.push({ userId: entry.userId, word: entry.words[slot] }));

    let best = null;
    let bestPenalty = Infinity;

    for (let attempt = 0; attempt < DRAW_ATTEMPTS && bestPenalty > 0; attempt++)
    {
        const picks = new Array(pool.length);
        const usedGivers = new Set();
        let penalty = 0;

        // Random slot order, so no slot is always the one that gets the leftovers
        for (const slot of shuffled(pool.map((_, i) => i)))
        {
            const others = pool[slot].filter(source => source.userId !== entry.userId);
            const candidates = others.length > 0 ? others : pool[slot];
            let lowest = Infinity;
            let bestCandidates = [];

            for (const source of candidates)
            {
                const cost = (source.userId === entry.userId ? 100 : 0) +
                    (usedGivers.has(source.userId) ? 10 : 0) +
                    (normalize(source.word) === normalize(entry.words[slot]) ? 1 : 0);
                if (cost < lowest)
                {
                    lowest = cost;
                    bestCandidates = [];
                }
                if (cost === lowest) bestCandidates.push(source);
            }

            picks[slot] = pickRandom(bestCandidates);
            usedGivers.add(picks[slot].userId);
            penalty += lowest;
        }

        if (penalty < bestPenalty)
        {
            best = picks;
            bestPenalty = penalty;
        }
    }

    best.forEach((source, slot) => pool[slot].splice(pool[slot].indexOf(source), 1));
    return best;
}

module.exports = { GENRES, normalize, nextGenre, assignInitial, createPool, drawLate };
