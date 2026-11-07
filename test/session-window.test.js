const test = require("node:test");
const assert = require("node:assert");
const { isSessionInProgress } = require("../app/system/session-window");

// Vienna is UTC+1 in November and UTC+2 in July (summer time)
test("the session starts at Sunday 23:16 Vienna time", () =>
{
    assert.strictEqual(isSessionInProgress(Date.UTC(2026, 10, 8, 22, 15)), false);
    assert.strictEqual(isSessionInProgress(Date.UTC(2026, 10, 8, 22, 16)), true);
});

test("the session runs until midnight and is over at Monday 00:00", () =>
{
    assert.strictEqual(isSessionInProgress(Date.UTC(2026, 10, 8, 22, 59)), true);
    assert.strictEqual(isSessionInProgress(Date.UTC(2026, 10, 8, 23, 0)), false);
});

test("no session on other days", () =>
{
    assert.strictEqual(isSessionInProgress(Date.UTC(2026, 10, 7, 22, 30)), false);
    assert.strictEqual(isSessionInProgress(Date.UTC(2026, 10, 9, 22, 30)), false);
    assert.strictEqual(isSessionInProgress(Date.UTC(2026, 10, 9, 21, 30)), false);
});

test("summer time shifts the window by one hour in UTC", () =>
{
    assert.strictEqual(isSessionInProgress(Date.UTC(2026, 6, 5, 21, 15)), false);
    assert.strictEqual(isSessionInProgress(Date.UTC(2026, 6, 5, 21, 16)), true);
});
