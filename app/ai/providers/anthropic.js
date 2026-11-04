async function generate({ prompt, system, maxTokens, signal, env })
{
    const base = (env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
    const body = {
        model: env.ANTHROPIC_MODEL || "claude-haiku-4-5",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
    };
    if (system) body.system = system;

    const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        signal,
        headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return (data.content || []).filter(p => p.type === "text").map(p => p.text).join("");
}

module.exports = { name: "anthropic", keyVar: "ANTHROPIC_API_KEY", generate };
