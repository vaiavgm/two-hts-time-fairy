const test = require("node:test");
const assert = require("node:assert");
const { buildEmbed } = require("../app/modules/time");

// Description text of the embed built for the given instant (ms since epoch)
function descriptionAt(ms)
{
    return buildEmbed(ms).data.description;
}

// Discord timestamp for 21:00 Vienna on the given date (CET, UTC+1, in November)
function compoStartUnix(month, day)
{
    return Math.floor(Date.UTC(2026, month - 1, day, 20, 0) / 1000);
}

test("upcoming-compo line is shown while the compo is running", () =>
{
    // Sunday 2026-11-01, 21:30 Vienna
    const text = descriptionAt(Date.UTC(2026, 10, 1, 20, 30));
    assert.match(text, /in progress/);
    assert.match(text, /\(Upcoming compo, next week: \*\*2HTS\d+\*\* starts <t:\d+:F> \(<t:\d+:R>\)\)$/);
    assert.ok(text.includes(`<t:${compoStartUnix(11, 8)}:F>`));
});

test("upcoming-compo line is shown during the listening party", () =>
{
    // Sunday 2026-11-01, 23:30 Vienna
    const text = descriptionAt(Date.UTC(2026, 10, 1, 22, 30));
    assert.match(text, /listening party/);
    assert.ok(text.endsWith(`(Upcoming compo, next week: **2HTS${idIn(text, "in progress") + 1}** starts <t:${compoStartUnix(11, 8)}:F> (<t:${compoStartUnix(11, 8)}:R>))`));
});

test("no next-week line when the upcoming compo is the one announced", () =>
{
    // Saturday 2026-11-07, midday Vienna
    const text = descriptionAt(Date.UTC(2026, 10, 7, 11, 0));
    assert.match(text, /Starts <t:\d+:F>/);
    assert.doesNotMatch(text, /Upcoming compo, next week/);
});

// Compo number from the "2HTSxxx in progress" line
function idIn(text, marker)
{
    const match = text.match(/\*\*2HTS(\d+)\*\* in progress/);
    assert.ok(match && text.includes(marker));
    return Number(match[1]);
}
