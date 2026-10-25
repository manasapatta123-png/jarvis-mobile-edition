"use strict";

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");

const API_KEY = "PASTE_YOUR_NEW_API_KEY_HERE";

// Use a model ID that is actually available to your API key.
const MODEL = "gemini-3.6-flash";

function add(text, who) {
const d = document.createElement("div");
d.className = "msg " + who;
d.textContent = text;
chat.appendChild(d);
chat.scrollTop = chat.scrollHeight;
return d;
}

async function sendMessage() {
const message = input.value.trim();

if (!message || sendBtn.disabled) return;

add("YOU: " + message, "user");
input.value = "";

const loading = add("J.A.R.V.I.S: Connecting to AI...", "ai");

if (
    !API_KEY ||
    API_KEY === "PASTE_YOUR_NEW_API_KEY_HERE"
) {
    loading.textContent =
        "J.A.R.V.I.S: API key missing. Configure your Gemini API key.";
    return;
}

sendBtn.disabled = true;

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 25000);

try {
    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        MODEL + ":generateContent?key=" +
        encodeURIComponent(API_KEY),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: message }]
                }]
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

    const answer = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .filter(Boolean)
        .join("\n");

    if (!answer) {
        throw new Error("No response received from Gemini.");
    }

    loading.textContent = "J.A.R.V.I.S: " + answer;

} catch (error) {
    loading.textContent =
        error.name === "AbortError"
            ? "J.A.R.V.I.S: Request timed out. Check your internet."
            : "J.A.R.V.I.S: " + error.message;

} finally {
    clearTimeout(timer);
    sendBtn.disabled = false;
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
