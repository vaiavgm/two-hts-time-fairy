const fs = require("fs");
const path = require("path");

function pickLine(file, fallbackFile, values)
{
    let lines = [];
    for (const candidate of [file, fallbackFile])
    {
        if (!candidate) continue;
        try
        {
            lines = fs.readFileSync(candidate, "utf8").split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
            if (lines.length > 0) break;
        }
        catch (err)
        {
            console.error(`[AI] Could not read ${candidate}:`, err.message);
        }
    }
    if (lines.length === 0) return null;

    const line = lines[Math.floor(Math.random() * lines.length)];
    return line.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));
}

const dir = __dirname;
const resolve = (envPath, defaultName) => (envPath ? path.resolve(envPath) : path.join(dir, defaultName));

module.exports = { pickLine, resolve, dir };
