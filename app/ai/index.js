const { pickLine, resolve } = require("./text-files");

const PROVIDERS = {
    anthropic: require("./providers/anthropic"),
    openai: require("./providers/openai"),
    gemini: require("./providers/gemini"),
};

const MIN_FRACTION = 0.4;
const MAX_FRACTION = 0.85;
const DISCORD_MAX_LENGTH = 2000;

const pending = new Map();

function settings(env = process.env)
{
    const chain = [env.AI_PROVIDER || "anthropic"]
        .concat((env.AI_FALLBACK || "").split(","))
        .map(s => s.trim().toLowerCase())
        .filter((s, i, arr) => s && arr.indexOf(s) === i);

    return {
        enabled: String(env.AI_ENABLED || "").toLowerCase() === "true",
        chain,
        maxTokens: parseInt(env.AI_MAX_TOKENS, 10) || 150,
        timeoutMs: parseInt(env.AI_TIMEOUT_MS, 10) || 15000,
        system: env.AI_SYSTEM_PROMPT || "",
        promptsFile: resolve(env.AI_PROMPTS_FILE, "prompts.txt"),
        fallbackFile: resolve(env.AI_FALLBACK_FILE, "fallback.txt"),
        env,
    };
}

function clean(text)
{
    let out = String(text || "").trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();
    if (out.length > DISCORD_MAX_LENGTH) out = out.slice(0, DISCORD_MAX_LENGTH - 1) + "…";
    return out;
}

async function callProvider(provider, prompt, cfg)
{
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try
    {
        return await provider.generate({ prompt, system: cfg.system, maxTokens: cfg.maxTokens, signal: controller.signal, env: cfg.env });
    }
    finally
    {
        clearTimeout(timer);
    }
}

async function generateComment(trackName, authorName, cfg = settings())
{
    const values = { track: trackName, author: authorName };
    const prompt = pickLine(cfg.promptsFile, null, values);

    if (prompt)
    {
        for (const name of cfg.chain)
        {
            const provider = PROVIDERS[name];
            if (!provider || !cfg.env[provider.keyVar]) continue;
            try
            {
                const text = clean(await callProvider(provider, prompt, cfg));
                if (text) return { text, source: name };
                console.error(`[AI] ${name} returned an empty reply.`);
            }
            catch (err)
            {
                console.error(`[AI] ${name} failed:`, err.name === "AbortError" ? "timed out" : err.message);
            }
        }
    }

    const canned = pickLine(cfg.fallbackFile, null, values);
    return canned ? { text: clean(canned), source: "fallback" } : null;
}

function scheduleComment(message, trackName, authorName, durationSecs)
{
    const cfg = settings();
    if (!cfg.enabled) return;

    const channelId = message.channel.id;
    clearTimeout(pending.get(channelId));

    const min = Math.floor(durationSecs * MIN_FRACTION * 1000);
    const max = Math.floor(durationSecs * MAX_FRACTION * 1000);
    const delay = min + Math.floor(Math.random() * Math.max(1, max - min));

    const timer = setTimeout(async () =>
    {
        pending.delete(channelId);
        try
        {
            const result = await generateComment(trackName, authorName, cfg);
            if (!result) return;
            console.log(`[AI] Comment for "${trackName}" via ${result.source}.`);
            await message.channel.send({ content: result.text, allowedMentions: { parse: [] } });
        }
        catch (err)
        {
            console.error("[AI] Failed to post comment:", err);
        }
    }, delay);

    pending.set(channelId, timer);
}

function logStartup(env = process.env)
{
    const cfg = settings(env);
    if (!cfg.enabled)
    {
        console.log("[AI] Comments disabled (set AI_ENABLED=true to enable).");
        return;
    }
    const parts = cfg.chain.map(name =>
    {
        const provider = PROVIDERS[name];
        if (!provider) return `${name} (unknown provider)`;
        const model = env[`${name.toUpperCase()}_MODEL`] || "default model";
        return `${name} [${model}, key ${env[provider.keyVar] ? "set" : "MISSING"}]`;
    });
    console.log(`[AI] Comments enabled. Provider chain: ${parts.join(" -> ")}, then canned fallback.`);
}

module.exports = { scheduleComment, generateComment, logStartup, settings, PROVIDERS };
