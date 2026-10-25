"use strict";

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");

// Enter your Gemini API key here.
// Never publish this file with your API key exposed.
const API_KEY = "PASTE_YOUR_NEW_API_KEY_HERE";

// Verify the exact model ID available to your API key.
const MODEL = "gemini-3.6-flash";

const API_URL =
"https://generativelanguage.googleapis.com/v1beta/models/" +
MODEL +
":generateContent";

function add(text, who) {
const d = document.createElement("div");
d.className = "msg " + who;
d.innerText = text;
chat.appendChild(d);
chat.scrollTop = chat.scrollHeight;
return d;
}

async function sendMessage() {
const t = input.value.trim();

if (!t || sendBtn.disabled) return;

if (
    !API_KEY ||
    API_KEY === "PASTE_YOUR_NEW_API_KEY_HERE"
) {
    add(
        "J.A.R.V.I.S: Boss, please add your Gemini API key in script.js.",
        "ai"
    );
    return;
}

add("YOU: " + t, "user");
input.value = "";
sendBtn.disabled = true;

const loading = add(
    "J.A.R.V.I.S: Connecting to AI...",
    "ai"
);

const controller = new AbortController();

const timeoutId = setTimeout(
    () => controller.abort(),
    30000
);

try {
    const response = await fetch(
        API_URL + "?key=" + encodeURIComponent(API_KEY),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text:
                            "You are J.A.R.V.I.S, a helpful personal AI assistant. " +
                            "Address the user as Boss when appropriate. " +
                            "Answer clearly and accurately."
                    }]
                },
                contents: [{
                    role: "user",
                    parts: [{ text: t }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024
                }
            }),
            signal: controller.signal
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            "HTTP " + response.status + ": " +
            (data.error?.message || "API request failed")
        );
    }

    const answer =
        data.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .filter(Boolean)
            .join("\n");

    if (!answer) {
        throw new Error(
            "The AI returned no text. Please try again."
        );
    }

    loading.innerText = "J.A.R.V.I.S: " + answer;

} catch (error) {
    loading.innerText =
        error.name === "AbortError"
            ? "J.A.R.V.I.S: Request timed out. Check your internet."
            : "J.A.R.V.I.S: AI connection failed — " +
              error.message;

} finally {
    clearTimeout(timeoutId);
    sendBtn.disabled = false;
    input.focus();
    chat.scrollTop = chat.scrollHeight;
}

}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", function(event) {
if (event.key === "Enter") {
event.preventDefault();
sendMessage();
}
});
