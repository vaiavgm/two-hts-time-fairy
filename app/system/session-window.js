// The weekly 2HTS session runs from Sunday 23:16 to midnight, Vienna time.
const COMPO_TZ = "Europe/Vienna";
const SESSION_WEEKDAY = "Sun";
const SESSION_START_MINUTE = 23 * 60 + 16;

const viennaFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: COMPO_TZ,
    hourCycle: "h23",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
});

// True while the weekly session is running at the given instant (ms since epoch, default now).
function isSessionInProgress(ms = Date.now())
{
    const p = {};
    for (const { type, value } of viennaFormat.formatToParts(ms))
    {
        p[type] = value;
    }
    const minuteOfDay = (+p.hour % 24) * 60 + +p.minute;
    return p.weekday === SESSION_WEEKDAY && minuteOfDay >= SESSION_START_MINUTE;
}

module.exports = { isSessionInProgress };
