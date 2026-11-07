async function generate({ prompt, system, maxTokens, signal, env })
{
    const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: env.OPENAI_MODEL || "gpt-4o-mini",
            max_completion_tokens: maxTokens,
            messages,
        }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content || "" : "";
}

module.exports = { name: "openai", keyVar: "OPENAI_API_KEY", generate };
