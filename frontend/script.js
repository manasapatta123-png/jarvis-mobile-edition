const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        if (url.pathname !== "/api/chat") {
            return jsonResponse(
                { error: "JARVIS API is running." },
                200
            );
        }

        if (request.method !== "POST") {
            return jsonResponse(
                { error: "Method not allowed." },
                405
            );
        }

        if (!env.GEMINI_API_KEY) {
            return jsonResponse(
                { error: "Gemini API key Cloudflare secret లో configure చేయాలి." },
                500
            );
        }

        try {
            const body = await request.json();
            const message = body.message;
            const history = Array.isArray(body.history)
                ? body.history
                : [];

            if (!message || typeof message !== "string") {
                return jsonResponse(
                    { error: "Message పంపించు." },
                    400
                );
            }

            const contents = [];

            for (const item of history.slice(-12)) {
                if (
                    !item ||
                    !["user", "model"].includes(item.role) ||
                    !Array.isArray(item.parts)
                ) {
                    continue;
                }

                const parts = item.parts
                    .filter(part =>
                        part && typeof part.text === "string"
                    )
                    .map(part => ({ text: part.text }));

                if (parts.length > 0) {
                    contents.push({
                        role: item.role,
                        parts
                    });
                }
            }

            // చివరి history message user message అయితే
            // దాన్ని మళ్లీ జోడించకుండా చూసుకోవాలి.
            const last = contents[contents.length - 1];

            if (
                !last ||
                last.role !== "user" ||
                last.parts[0]?.text !== message
            ) {
                contents.push({
                    role: "user",
                    parts: [{ text: message }]
                });
            }

            const geminiResponse = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": env.GEMINI_API_KEY
                    },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{
                                text: "You are J.A.R.V.I.S., a helpful personal AI assistant. Answer clearly, politely, and concisely. If the user speaks Telugu, reply in Telugu."
                            }]
                        },
                        contents,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1000
                        }
                    })
                }
            );

            const data = await geminiResponse.json();

            if (!geminiResponse.ok) {
                return jsonResponse(
                    {
                        error:
                            data.error?.message ||
                            "Gemini API request failed."
                    },
                    geminiResponse.status
                );
            }

            const reply =
                data.candidates?.[0]?.content?.parts
                    ?.map(part => part.text || "")
                    .join("")
                    .trim();

            if (!reply) {
                return jsonResponse(
                    { error: "Gemini నుంచి reply రాలేదు." },
                    502
                );
            }

            return jsonResponse({ reply }, 200);

        } catch (error) {
            return jsonResponse(
                { error: error.message || "Internal server error." },
                500
            );
        }
    }
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8"
        }
    });
}
