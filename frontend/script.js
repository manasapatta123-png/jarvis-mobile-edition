"use strict";

// ===== 1. ELEMENTS =====
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");

// Supports either mic ID used in previous HTML versions
const micBtn =
document.getElementById("mic") ||
document.getElementById("mic-btn");

if (!chat || !input || !sendBtn) {
alert("J.A.R.V.I.S: Required HTML elements are missing.");
throw new Error("Check index.html element IDs.");
}

// ===== 2. GEMINI API KEY =====
// WARNING: A key stored in browser storage is NOT secure.
// Use only for private testing. Never publish your key.

let API_KEY = localStorage.getItem("jarvis_key") || "";

if (!API_KEY) {
API_KEY = prompt("Enter your Gemini API key:") || "";
API_KEY = API_KEY.trim();

if (API_KEY) {
    localStorage.setItem("jarvis_key", API_KEY);
}

}

// ===== 3. AVAILABLE MODELS =====
const MODELS = [
"gemini-3.8-flash",
"gemini-3.6-flash"
];

// ===== 4. CHAT HISTORY =====
const history = [];

// ===== 5. MESSAGE DISPLAY =====
function add(text, who) {
const div = document.createElement("div");

div.className = "msg " + who;
div.textContent = text;

chat.appendChild(div);
chat.scrollTop = chat.scrollHeight;

return div;

}

// ===== 6. GEMINI AI CONNECTION =====
async function callGemini(promptText) {
if (!API_KEY) {
throw new Error(
"API key missing. Reload the page and enter your key."
);
}

let lastError = "No available model responded.";

for (const model of MODELS) {
    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            model +
            ":generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": API_KEY
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{
                            text:
                                "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
                                "Address the user as Boss. Answer clearly and naturally."
                        }]
                    },
                    contents: [
                        ...history,
                        {
                            role: "user",
                            parts: [{ text: promptText }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            const message =
                data?.error?.message ||
                "HTTP error " + response.status;

            lastError = message;

            // Do not retry other models for invalid credentials
            // or permission errors.
            if (
                response.status === 400 ||
                response.status === 401 ||
                response.status === 403
            ) {
                throw new Error(message);
            }

            // Try the next model for availability or rate errors.
            continue;
        }

        const reply = data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

        if (!reply) {
            lastError = "The AI returned an empty response.";
            continue;
        }

        history.push(
            { role: "user", parts: [{ text: promptText }] },
            { role: "model", parts: [{ text: reply }] }
        );

        // Keep the conversation history manageable.
        if (history.length > 12) {
            history.splice(0, history.length - 12);
        }

        return reply;

    } catch (error) {
        lastError = error.message || String(error);

        if (
            /API key|permission|unauthorized|invalid argument/i
                .test(lastError)
        ) {
            throw error;
        }
    }
}

throw new Error(lastError);

}

// ===== 7. ASK JARVIS =====
async function askGemini(text) {
const replyBox = add(
"J.A.R.V.I.S: Thinking...",
"ai"
);

sendBtn.disabled = true;

try {
    const reply = await callGemini(text);

    replyBox.textContent = "J.A.R.V.I.S: " + reply;

    // Speak the AI response
    speak(reply);

} catch (error) {
    replyBox.textContent =
        "J.A.R.V.I.S ERROR: " + error.message;

    console.error("Gemini error:", error);

} finally {
    sendBtn.disabled = false;
    chat.scrollTop = chat.scrollHeight;
}

}

// ===== 8. SEND TEXT MESSAGE =====
function sendMessage() {
const text = input.value.trim();

if (!text || sendBtn.disabled) return;

add("YOU: " + text, "user");

input.value = "";

askGemini(text);

}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", function (event) {
if (event.key === "Enter") {
event.preventDefault();
sendMessage();
}
});

// ===== 9. VOICE RECOGNITION =====
const SpeechRecognition =
window.SpeechRecognition ||
window.webkitSpeechRecognition;

let recognition = null;
let listening = false;

function setMicStatus(text) {
if (micBtn) {
micBtn.textContent = text;
}
}

if (micBtn && SpeechRecognition) {
recognition = new SpeechRecognition();

recognition.lang = "en-IN";
recognition.continuous = false;
recognition.interimResults = false;
recognition.maxAlternatives = 1;

micBtn.addEventListener("click", function () {
    if (listening) {
        recognition.stop();
        return;
    }

    try {
        recognition.start();
    } catch (error) {
        add(
            "J.A.R.V.I.S: Microphone is busy. Try again.",
            "ai"
        );
    }
});

recognition.onstart = function () {
    listening = true;
    setMicStatus("🔴");
};

recognition.onresult = function (event) {
    const spokenText =
        event.results[0][0].transcript.trim();

    if (!spokenText) return;

    input.value = spokenText;

    add("YOU (VOICE): " + spokenText, "user");

    askGemini(spokenText);
};

recognition.onerror = function (event) {
    console.error("Voice error:", event.error);

    if (event.error === "not-allowed") {
        add(
            "J.A.R.V.I.S: Allow microphone permission in your browser.",
            "ai"
        );
    } else {
        add(
            "J.A.R.V.I.S: Voice recognition error: " +
            event.error,
            "ai"
        );
    }
};

recognition.onend = function () {
    listening = false;
    setMicStatus("🎤");
};

} else if (micBtn) {
micBtn.disabled = true;
micBtn.title = "Voice recognition is not supported by this browser.";

add(
    "J.A.R.V.I.S: Voice recognition is unavailable in this browser. Try a supported browser.",
    "ai"
);

}

// ===== 10. TEXT-TO-SPEECH =====
function speak(text) {
if (!("speechSynthesis" in window)) {
return;
}

// Avoid overlapping spoken replies.
window.speechSynthesis.cancel();

const utterance = new SpeechSynthesisUtterance(text);

utterance.lang = "en-IN";
utterance.rate = 1;
utterance.pitch = 0.9;

const voices = window.speechSynthesis.getVoices();

const voice =
    voices.find(v => v.lang === "en-IN") ||
    voices.find(v => v.lang.startsWith("en"));

if (voice) {
    utterance.voice = voice;
}

window.speechSynthesis.speak(utterance);

}

// ===== 11. READY MESSAGE =====
console.log("J.A.R.V.I.S interface initialized.");
