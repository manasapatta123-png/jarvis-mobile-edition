// ========================================
// J.A.R.V.I.S MOBILE ASSISTANT
// Fixed JavaScript
// ========================================

"use strict";

// 1. CONFIGURATION
const MODELS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest"
];

const API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/";

// 2. HTML ELEMENTS
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const clearBtn = document.getElementById("clear-btn");
const camBtn = document.getElementById("cam-btn");
const imgInput = document.getElementById("img-input");

const aiStatus = document.getElementById("aiStatus");
const connectionStatus = document.getElementById("connectionStatus");
const voiceStatus = document.getElementById("voiceStatus");
const memoryStatus = document.getElementById("memoryStatus");

// 3. API KEY
let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API key:");

    if (API_KEY && API_KEY.trim()) {
        API_KEY = API_KEY.trim();
        localStorage.setItem("jarvis_key", API_KEY);
    } else {
        API_KEY = "";
    }
}

// 4. LOCAL MEMORY
let MEMORY = [];

try {
    MEMORY = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
    );

    if (!Array.isArray(MEMORY)) {
        MEMORY = [];
    }
} catch (error) {
    MEMORY = [];
}

function saveMemory() {
    try {
        localStorage.setItem(
            "jarvis_memory",
            JSON.stringify(MEMORY)
        );

        if (memoryStatus) {
            memoryStatus.textContent = "● LOCAL";
            memoryStatus.className = "on";
        }
    } catch (error) {
        console.error("Memory save failed:", error);

        if (memoryStatus) {
            memoryStatus.textContent = "● SAVE ERROR";
            memoryStatus.className = "off";
        }
    }
}

// 5. CHAT DISPLAY
function add(message, type = "ai") {
    if (!chat) return null;

    const element = document.createElement("div");

    element.className = "msg " + type;
    element.textContent = message;

    chat.appendChild(element);
    chat.scrollTop = chat.scrollHeight;

    return element;
}

// Restore previous chat messages
MEMORY.forEach(function (item) {
    if (!item || !item.text) return;

    if (item.role === "user") {
        add("YOU: " + item.text, "user");
    } else if (item.role === "model") {
        add("J.A.R.V.I.S: " + item.text, "ai");
    }
});

// 6. API KEY VALIDATION
function getAPIKey() {
    if (API_KEY) return API_KEY;

    const enteredKey = prompt("Enter your Gemini API key:");

    if (!enteredKey || !enteredKey.trim()) {
        throw new Error("API key is missing.");
    }

    API_KEY = enteredKey.trim();
    localStorage.setItem("jarvis_key", API_KEY);

    return API_KEY;
}

// 7. GEMINI API REQUEST
async function requestGemini(contents) {
    const key = getAPIKey();
    let lastError = "No available Gemini model.";

    for (const model of MODELS) {
        try {
            const response = await fetch(
                API_URL + model + ":generateContent",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": key
                    },
                    body: JSON.stringify({
                        contents: contents
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || data.error) {
                const message =
                    data.error?.message ||
                    "HTTP error " + response.status;

                lastError = message;

                // Retry another model only for model availability
                // or temporary service errors.
                if (
                    response.status === 404 ||
                    response.status === 429 ||
                    response.status >= 500 ||
                    /not found|unavailable|temporar|high demand/i.test(message)
                ) {
                    continue;
                }

                throw new Error(message);
            }

            const parts = data.candidates?.[0]?.content?.parts || [];

            const answer = parts
                .filter(part => typeof part.text === "string")
                .map(part => part.text)
                .join("\n")
                .trim();

            if (!answer) {
                throw new Error(
                    "The AI returned no text. Try another message."
                );
            }

            if (aiStatus) {
                aiStatus.textContent = "● OPERATIONAL";
                aiStatus.className = "on";
            }

            if (connectionStatus) {
                connectionStatus.textContent = "● ONLINE";
                connectionStatus.className = "on";
            }

            return answer;

        } catch (error) {
            lastError = error.message || "Network request failed.";

            if (
                /API key|permission|unauthorized|invalid argument|billing/i
                    .test(lastError)
            ) {
                throw error;
            }
        }
    }

    if (aiStatus) {
        aiStatus.textContent = "● ERROR";
        aiStatus.className = "off";
    }

    if (connectionStatus) {
        connectionStatus.textContent = "● OFFLINE";
        connectionStatus.className = "off";
    }

    throw new Error(lastError);
}

// 8. CHAT HISTORY FORMAT
function getConversation(promptText) {
    const contents = MEMORY
        .filter(item =>
            item &&
            (item.role === "user" || item.role === "model") &&
            typeof item.text === "string"
        )
        .slice(-12)
        .map(item => ({
            role: item.role,
            parts: [{ text: item.text }]
        }));

    contents.push({
        role: "user",
        parts: [{ text: promptText }]
    });

    return contents;
}

// 9. ASK JARVIS
let busy = false;

async function askGemini(promptText) {
    const question = promptText.trim();

    if (!question || busy) return;

    if (!API_KEY) {
        add("J.A.R.V.I.S: API key is required to connect to the AI.", "ai");
        return;
    }

    busy = true;

    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;

    const thinking = add("J.A.R.V.I.S: Thinking...", "ai");

    try {
        const contents = getConversation(question);
        const reply = await requestGemini(contents);

        MEMORY.push({ role: "user", text: question });
        MEMORY.push({ role: "model", text: reply });

        // Keep recent messages in local storage.
        MEMORY = MEMORY.slice(-40);
        saveMemory();

        if (thinking) {
            thinking.textContent = "J.A.R.V.I.S: " + reply;
        }

        speak(reply);

    } catch (error) {
        console.error("JARVIS error:", error);

        if (thinking) {
            thinking.textContent =
                "J.A.R.V.I.S ERROR: " +
                (error.message || "Something went wrong.");
        }

    } finally {
        busy = false;

        if (sendBtn) sendBtn.disabled = false;
        if (input) {
            input.disabled = false;
            input.focus();
        }
    }
}

// 10. SEND BUTTON AND ENTER KEY
function sendMessage(event) {
    if (event) event.preventDefault();

    if (!input) return;

    const message = input.value.trim();

    if (!message || busy) return;

    add("YOU: " + message, "user");
    input.value = "";

    askGemini(message);
}

const chatForm = document.getElementById("chatForm");

if (chatForm) {
    chatForm.addEventListener("submit", sendMessage);
} else if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
}

// 11. IMAGE ANALYSIS
if (camBtn && imgInput) {
    camBtn.addEventListener("click", function () {
        imgInput.click();
    });

    imgInput.addEventListener("change", async function () {
        const file = imgInput.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            add("J.A.R.V.I.S: Please select an image file.", "ai");
            imgInput.value = "";
            return;
        }

        if (file.size > 8 * 1024 * 1024) {
            add("J.A.R.V.I.S: Please select an image smaller than 8 MB.", "ai");
            imgInput.value = "";
            return;
        }

        const question =
            input?.value.trim() ||
            "Describe this image briefly.";

        if (input) input.value = "";

        add("YOU: [IMAGE] " + question, "user");

        const thinking = add(
            "J.A.R.V.I.S: Analyzing image...",
            "ai"
        );

        camBtn.disabled = true;

        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();

                reader.onload = function () {
                    const result = String(reader.result);
                    resolve(result.split(",")[1]);
                };

                reader.onerror = function () {
                    reject(new Error("Could not read the image."));
                };

                reader.readAsDataURL(file);
            });

            const contents = [{
                role: "user",
                parts: [
                    { text: question },
                    {
                        inline_data: {
                            mime_type: file.type,
                            data: base64
                        }
                    }
                ]
            }];

            const reply = await requestGemini(contents);

            if (thinking) {
                thinking.textContent = "J.A.R.V.I.S: " + reply;
            }

            speak(reply);

        } catch (error) {
            if (thinking) {
                thinking.textContent =
                    "J.A.R.V.I.S ERROR: " + error.message;
            }

        } finally {
            camBtn.disabled = false;
            imgInput.value = "";
        }
    });
}

// 12. VOICE INPUT
const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = function () {
        micBtn.textContent = "LISTENING...";
        micBtn.disabled = true;

        if (voiceStatus) {
            voiceStatus.textContent = "● LISTENING";
            voiceStatus.className = "on";
        }
    };

    recognition.onresult = function (event) {
        const transcript =
            event.results?.[0]?.[0]?.transcript?.trim();

        if (transcript) {
            if (input) input.value = transcript;
            sendMessage();
        }
    };

    recognition.onerror = function (event) {
        console.error("Voice error:", event.error);

        add(
            "J.A.R.V.I.S: Voice input error: " + event.error,
            "ai"
        );
    };

    recognition.onend = function () {
        micBtn.textContent = "🎙️";
        micBtn.disabled = false;

        if (voiceStatus) {
            voiceStatus.textContent = "● READY";
            voiceStatus.className = "on";
        }
    };

    micBtn.addEventListener("click", function () {
        try {
            recognition.start();
        } catch (error) {
            add(
                "J.A.R.V.I.S: Voice recognition is already running.",
                "ai"
            );
        }
    });

} else if (micBtn) {
    micBtn.addEventListener("click", function () {
        add(
            "J.A.R.V.I.S: Voice recognition is not supported in this browser. Try a supported browser.",
            "ai"
        );
    });

    if (voiceStatus) {
        voiceStatus.textContent = "● UNSUPPORTED";
        voiceStatus.className = "off";
    }
}

// 13. TEXT-TO-SPEECH
function speak(text) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1.0;
    utterance.pitch = 0.9;

    const availableVoices =
        window.speechSynthesis.getVoices();

    const voice = availableVoices.find(v =>
        v.lang.toLowerCase().startsWith("en-in")
    ) || availableVoices.find(v =>
        v.lang.toLowerCase().startsWith("en")
    );

    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
}

// 14. CLEAR LOCAL MEMORY
if (clearBtn) {
    clearBtn.addEventListener("click", function () {
        const confirmed = confirm(
            "Clear all saved JARVIS chat memory on this device?"
        );

        if (!confirmed) return;

        MEMORY = [];
        saveMemory();

        if (chat) chat.innerHTML = "";

        add("SYSTEM: Local chat memory cleared.", "ai");
    });
}

// 15. INITIAL STATUS
if (memoryStatus) {
    memoryStatus.textContent = "● LOCAL";
    memoryStatus.className = "on";
}

if (aiStatus) {
    aiStatus.textContent = API_KEY
        ? "● READY"
        : "● API KEY REQUIRED";

    aiStatus.className = API_KEY ? "on" : "off";
}

if (connectionStatus) {
    connectionStatus.textContent = navigator.onLine
        ? "● ONLINE"
        : "● OFFLINE";

    connectionStatus.className = navigator.onLine
        ? "on"
        : "off";
}

window.addEventListener("online", function () {
    if (connectionStatus) {
        connectionStatus.textContent = "● ONLINE";
        connectionStatus.className = "on";
    }
});

window.addEventListener("offline", function () {
    if (connectionStatus) {
        connectionStatus.textContent = "● OFFLINE";
        connectionStatus.className = "off";
    }
});

console.log("J.A.R.V.I.S initialized.");
