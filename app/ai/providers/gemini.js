async function generate({ prompt, system, maxTokens, signal, env })
{
    const base = (env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal,
        headers: {
            "content-type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const parts = data.candidates && data.candidates[0] && data.candidates[0].content ? data.candidates[0].content.parts || [] : [];
    return parts.map(p => p.text || "").join("");
}

module.exports = { name: "gemini", keyVar: "GEMINI_API_KEY", generate };
