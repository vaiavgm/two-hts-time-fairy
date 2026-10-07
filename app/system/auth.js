// Who may do what. Matching works by user ID or by username (the unique, lowercase Discord handle,
// e.g. "vaia" - not the display name). Usernames can be changed by their owner, IDs cannot, so
// IDs are preferred: add them to the *_IDS lists below (Discord: enable Developer Mode, then
// right-click a user > Copy User ID), and remove the username once its ID is in.

const ADMIN_IDS = [];
const ADMIN_USERNAMES = ["vaia", "antik0959"];

// Users whose "Now Playing: ..." messages trigger the track length check
const TRACK_REPORTER_IDS = [];
const TRACK_REPORTER_USERNAMES = ["vaia", "antik0959", "urinalpooper"];

function matches(user, ids, usernames)
{
    return ids.includes(user.id) || usernames.includes(user.username);
}

function isAdmin(user)
{
    return matches(user, ADMIN_IDS, ADMIN_USERNAMES);
}

function isTrackReporter(user)
{
    return matches(user, TRACK_REPORTER_IDS, TRACK_REPORTER_USERNAMES);
}

module.exports = { isAdmin, isTrackReporter };
