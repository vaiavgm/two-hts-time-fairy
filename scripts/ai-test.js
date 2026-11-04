require("dotenv").config();
const { generateComment, settings } = require("../app/ai");

const [track = "Test Track", author = "Test Author", provider] = process.argv.slice(2);
const cfg = settings();
if (provider) cfg.chain = [provider.toLowerCase()];

generateComment(track, author, cfg).then(result =>
{
    console.log(result ? `[${result.source}] ${result.text}` : "No comment produced.");
});
