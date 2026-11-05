const test = require("node:test");
const assert = require("node:assert");
const { GENRES, nextGenre, assignInitial, assignLate } = require("../app/system/gendom-logic");

function entries(...words)
{
    return words.map((word, i) => ({ userId: String(i), word }));
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
            for (const [receiverId, source] of result)
            {
                assert.notStrictEqual(source.userId, receiverId);
            }
        }
    }
});

test("assignInitial uses every word exactly once", () =>
{
    const list = entries("a", "b", "c", "d", "e");
    const sources = [...assignInitial(list).values()].map(s => s.userId).sort();
    assert.deepStrictEqual(sources, ["0", "1", "2", "3", "4"]);
});

test("assignInitial avoids identical text when possible", () =>
{
    const list = entries("dank", "dank", "wet", "wet", "dry");
    for (let run = 0; run < 50; run++)
    {
        for (const [receiverId, source] of assignInitial(list))
        {
            const receiver = list.find(e => e.userId === receiverId);
            assert.notStrictEqual(source.word, receiver.word);
        }
    }
});

test("assignInitial still works when identical text cannot be avoided", () =>
{
    const list = entries("dank", "dank", "dank");
    const result = assignInitial(list);
    assert.strictEqual(result.size, 3);
    for (const [receiverId, source] of result)
    {
        assert.notStrictEqual(source.userId, receiverId);
    }
});

test("assignInitial rejects fewer than 2 entries", () =>
{
    assert.throws(() => assignInitial(entries("solo")));
});

test("assignLate never returns the player's own entry", () =>
{
    const pool = entries("a", "b", "c");
    const late = { userId: "0", word: "a" };
    for (let run = 0; run < 100; run++)
    {
        assert.notStrictEqual(assignLate(late, pool).userId, "0");
    }
});

test("assignLate prefers different text, falls back to the same text", () =>
{
    const pool = [{ userId: "1", word: "dank" }, { userId: "2", word: "wet" }];
    const late = { userId: "9", word: "dank" };
    for (let run = 0; run < 50; run++)
    {
        assert.strictEqual(assignLate(late, pool).word, "wet");
    }
    assert.strictEqual(assignLate(late, [{ userId: "1", word: "Dank " }]).word, "Dank ");
});

test("assignLate returns null when only the player's own entry exists", () =>
{
    assert.strictEqual(assignLate({ userId: "1", word: "a" }, [{ userId: "1", word: "a" }]), null);
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
