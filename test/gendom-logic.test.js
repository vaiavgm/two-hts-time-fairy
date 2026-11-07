const test = require("node:test");
const assert = require("node:assert");
const { GENRES, nextGenre, assignInitial, createPool, drawLate } = require("../app/system/gendom-logic");

// Single-slot entries (Gendom 3): one word each
function entries(...words)
{
    return words.map((word, i) => ({ userId: String(i), words: [word] }));
}

// Entries with `slots` distinct words each (e.g. Gendom 4)
function multiEntries(count, slots)
{
    return Array.from({ length: count }, (_, i) => ({
        userId: String(i),
        words: Array.from({ length: slots }, (__, s) => `p${i}s${s}`),
    }));
}

test("assignInitial never gives anyone their own entry", () =>
{
    for (let n = 2; n <= 12; n++)
    {
        const list = entries(...Array.from({ length: n }, (_, i) => "word" + i));
        for (let run = 0; run < 50; run++)
        {
            const result = assignInitial(list);
            assert.strictEqual(result.size, n);
            for (const [receiverId, sources] of result)
            {
                assert.strictEqual(sources.length, 1);
                assert.notStrictEqual(sources[0].userId, receiverId);
            }
        }
    }
});

test("assignInitial uses every word exactly once", () =>
{
    const list = entries("a", "b", "c", "d", "e");
    const sources = [...assignInitial(list).values()].map(s => s[0].userId).sort();
    assert.deepStrictEqual(sources, ["0", "1", "2", "3", "4"]);
});

test("assignInitial avoids identical text when possible", () =>
{
    const list = entries("dank", "dank", "wet", "wet", "dry");
    for (let run = 0; run < 50; run++)
    {
        for (const [receiverId, sources] of assignInitial(list))
        {
            const receiver = list.find(e => e.userId === receiverId);
            assert.notStrictEqual(sources[0].word, receiver.words[0]);
        }
    }
});

test("assignInitial still works when identical text cannot be avoided", () =>
{
    const list = entries("dank", "dank", "dank");
    const result = assignInitial(list);
    assert.strictEqual(result.size, 3);
    for (const [receiverId, sources] of result)
    {
        assert.notStrictEqual(sources[0].userId, receiverId);
    }
});

test("assignInitial rejects fewer than 2 entries", () =>
{
    assert.throws(() => assignInitial(entries("solo")));
});

test("with enough players, every slot comes from a different player and never from the receiver", () =>
{
    const slots = 4;
    for (let n = slots + 1; n <= 12; n++)
    {
        const list = multiEntries(n, slots);
        for (let run = 0; run < 30; run++)
        {
            for (const [receiverId, sources] of assignInitial(list, slots))
            {
                const givers = sources.map(s => s.userId);
                assert.strictEqual(new Set(givers).size, slots, `n=${n}: ${givers}`);
                assert.ok(!givers.includes(receiverId));
                sources.forEach((source, slot) => assert.strictEqual(source.word, `p${source.userId}s${slot}`));
            }
        }
    }
});

test("every word of every slot is handed out exactly once", () =>
{
    for (let n = 2; n <= 8; n++)
    {
        const result = assignInitial(multiEntries(n, 4), 4);
        for (let slot = 0; slot < 4; slot++)
        {
            const used = [...result.values()].map(sources => sources[slot].word).sort();
            assert.deepStrictEqual(used, multiEntries(n, 4).map(e => e.words[slot]).sort());
        }
    }
});

test("small rounds wrap around: nobody gets their own words, givers repeat", () =>
{
    for (let n = 2; n <= 4; n++)
    {
        for (let run = 0; run < 30; run++)
        {
            for (const [receiverId, sources] of assignInitial(multiEntries(n, 4), 4))
            {
                assert.ok(sources.every(s => s.userId !== receiverId));
                // As many different givers as possible: everybody else
                assert.strictEqual(new Set(sources.map(s => s.userId)).size, n - 1);
            }
        }
    }
});

test("small rounds keep slots listed in `apart` from the same player", () =>
{
    // With 3 or 4 players and 4 slots one player must provide two parts, but never both "who" and "does what"
    for (let n = 3; n <= 4; n++)
    {
        for (let run = 0; run < 50; run++)
        {
            for (const [receiverId, sources] of assignInitial(multiEntries(n, 4), 4, [[0, 1]]))
            {
                assert.ok(sources.every(s => s.userId !== receiverId));
                assert.notStrictEqual(sources[0].userId, sources[1].userId, `n=${n}`);
            }
        }
    }
    // With 2 players it cannot be avoided, but still works
    for (const [receiverId, sources] of assignInitial(multiEntries(2, 4), 4, [[0, 1]]))
    {
        assert.ok(sources.every(s => s.userId !== receiverId));
    }
});

test("drawLate repeats a player on other slots rather than on slots listed in `apart`", () =>
{
    for (let run = 0; run < 50; run++)
    {
        // Somebody has to provide two parts: slot 1 must take B (shared with slot 2), not A (shared with slot 0)
        const pool = [[{ userId: "A", word: "a0" }], [{ userId: "A", word: "a1" }, { userId: "B", word: "b1" }], [{ userId: "B", word: "b2" }]];
        const sources = drawLate(pool, { userId: "late", words: ["x", "y", "z"] }, [[0, 1]]);
        assert.deepStrictEqual(sources.map(s => s.userId), ["A", "B", "B"]);
    }
});

test("drawLate never returns the latecomer's own words and removes what it drew", () =>
{
    const pool = createPool(multiEntries(5, 4), 4);
    for (let late = 0; late < 30; late++)
    {
        const entry = { userId: "late" + late, words: ["a", "b", "c", "d"].map(w => w + late) };
        const sources = drawLate(pool, entry);
        assert.strictEqual(sources.length, 4);
        assert.ok(sources.every(s => s.userId !== entry.userId));
        assert.strictEqual(new Set(sources.map(s => s.userId)).size, 4, "four different players");
        // Every latecomer adds as much as they take: the pool keeps its size
        pool.forEach((slotPool, slot) =>
        {
            assert.strictEqual(slotPool.length, 5);
            assert.ok(!slotPool.includes(sources[slot]));
        });
    }
});

test("drawLate lets the next latecomer draw an earlier latecomer's words, without repeating drawn ones", () =>
{
    const pool = createPool(entries("dank", "wet"), 1);
    const drawn = [];
    for (let i = 0; i < 20; i++)
    {
        drawn.push(drawLate(pool, { userId: "late" + i, words: ["word" + i] })[0]);
    }
    // Every word can be drawn at most once
    assert.strictEqual(new Set(drawn).size, drawn.length);
    assert.ok(drawn.some(s => s.userId.startsWith("late")));
});

test("drawLate prefers different text, falls back to the same text", () =>
{
    for (let run = 0; run < 50; run++)
    {
        const pool = [[{ userId: "1", word: "dank" }, { userId: "2", word: "wet" }]];
        assert.strictEqual(drawLate(pool, { userId: "9", words: ["dank"] })[0].word, "wet");
    }
    const pool = [[{ userId: "1", word: "Dank " }]];
    assert.strictEqual(drawLate(pool, { userId: "9", words: ["dank"] })[0].word, "Dank ");
});

test("nextGenre never repeats until the buffer is exhausted, then refills", () =>
{
    const buffer = [];
    const seen = new Set();
    for (let i = 0; i < GENRES.length; i++)
    {
        seen.add(nextGenre(buffer));
    }
    assert.strictEqual(seen.size, GENRES.length);
    assert.ok(GENRES.includes(nextGenre(buffer)));
});
