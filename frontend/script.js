// ==========================================
// J.A.R.V.I.S MOBILE EDITION
// Gemini AI Connection + Voice + Memory
// ==========================================

const $ = (id) => document.getElementById(id);

// Gemini models: try the preferred model first.
const MODELS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest"
];

let apiKey = localStorage.getItem("jarvisApiKey") || "";
let chatHistory = JSON.parse(
    localStorage.getItem("jarvisMemory") || "[]"
);

let isListening = false;
let recognition = null;
let selectedImage = null;

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const keyInput = $("apiKey");

    if (keyInput) {
        keyInput.value = apiKey;
    }

    setStatus("CORE ACTIVE");

    if (chatHistory.length > 0) {
        chatHistory.forEach((item) => {
            if (item.role === "user") {
                addMessage("user", item.parts?.[0]?.text || "");
            } else if (item.role === "model") {
                addMessage("jarvis", item.parts?.[0]?.text || "");
            }
        });
    } else {
        addMessage(
            "jarvis",
            "J.A.R.V.I.S online, Boss. My systems are ready."
        );
    }

    $("send")?.addEventListener("click", sendMessage);

    $("msg")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });

    $("save-key-btn")?.addEventListener("click", saveApiKey);
    $("saveKey")?.addEventListener("click", saveApiKey);
    $("save-key")?.addEventListener("click", saveApiKey);

    $("clear-btn")?.addEventListener("click", clearMemory);
    $("mic-btn")?.addEventListener("click", toggleMicrophone);

    $("cam-btn")?.addEventListener("click", () => {
        $("img-input")?.click();
    });

    $("img-input")?.addEventListener("change", handleImage);

    setupVoiceRecognition();
});

// ==========================================
// API KEY
// ==========================================

function saveApiKey() {
    const input = $("apiKey");

    if (!input || !input.value.trim()) {
        addMessage("jarvis", "Please enter your Gemini API key, Boss.");
        return;
    }

    apiKey = input.value.trim();

    localStorage.setItem("jarvisApiKey", apiKey);

    setStatus("AI KEY SAVED");

    addMessage(
        "jarvis",
        "API key saved on this device. Let's test the AI connection, Boss."
    );
}

// ==========================================
// STATUS
// ==========================================

function setStatus(message) {
    const status =
        $("status") ||
        $("core-status") ||
        $("ai-status");

    if (status) {
        status.textContent = message;
    }
}

// ==========================================
// CHAT MESSAGES
// ==========================================

function addMessage(sender, text) {
    const chat = $("chat");

    if (!chat) {
        console.log(sender + ": " + text);
        return;
    }

    const bubble = document.createElement("div");

    bubble.className =
        sender === "user" ? "user-message" : "jarvis-message";

    bubble.textContent = text;

    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
}

function showThinking() {
    const chat = $("chat");

    if (!chat) return null;

    const bubble = document.createElement("div");

    bubble.className = "jarvis-message";
    bubble.textContent = "J.A.R.V.I.S is thinking...";

    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;

    return bubble;
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage() {
    const input = $("msg");

    if (!input) return;

    const text = input.value.trim();

    if (!text && !selectedImage) return;

    input.value = "";

    if (text) {
        addMessage("user", text);
    }

    const imageToSend = selectedImage;
    selectedImage = null;

    const imageInput = $("img-input");

    if (imageInput) {
        imageInput.value = "";
    }

    // Run basic local commands without using the API.
    if (text && !imageToSend) {
        const localResult = runLocalCommand(text);

        if (localResult !== null) {
            addMessage("jarvis", localResult);
            speak(localResult);
            return;
        }
    }

    if (!apiKey) {
        addMessage(
            "jarvis",
            "My AI brain is not connected yet, Boss. Enter your Gemini API key in AI Configuration and save it."
        );
        return;
    }

    const thinking = showThinking();

    try {
        const reply = await askGemini(text, imageToSend);

        if (thinking) thinking.remove();

        addMessage("jarvis", reply);
        speak(reply);

    } catch (error) {
        if (thinking) thinking.remove();

        console.error("JARVIS AI error:", error);

        addMessage(
            "jarvis",
            "AI connection failed. " + error.message
        );

        setStatus("AI CONNECTION ERROR");
    }
}

// ==========================================
// GEMINI AI CONNECTION
// ==========================================

async function askGemini(text, imageData) {
    let lastError = "Unable to connect to Gemini.";

    for (const model of MODELS) {
        try {
            const contents = [...chatHistory];

            const parts = [];

            if (text) {
                parts.push({
                    text:
                        "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
                        "Address the user as Boss. Respond clearly and helpfully. " +
                        "The user may communicate in Telugu or English.\n\n" +
                        text
                });
            }

            if (imageData) {
                parts.push({
                    inline_data: {
                        mime_type: imageData.mimeType,
                        data: imageData.data
                    }
                });
            }

            contents.push({
                role: "user",
                parts: parts
            });

            const response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                    model +
                    ":generateContent",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": apiKey
                    },
                    body: JSON.stringify({
                        contents: contents,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1024
                        }
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                const errorMessage =
                    data?.error?.message ||
                    "HTTP error " + response.status;

                lastError = errorMessage;

                // Try the next model if this model is unavailable.
                if (
                    response.status === 404 ||
                    response.status === 400
                ) {
                    continue;
                }

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    throw new Error(
                        "API key invalid or API access denied. Check your Gemini API key."
                    );
                }

                if (response.status === 429) {
                    throw new Error(
                        "API quota or rate limit reached. Check your Gemini API usage and limits."
                    );
                }

                throw new Error(errorMessage);
            }

            const reply = data?.candidates?.[0]?.content?.parts
                ?.map((part) => part.text || "")
                .join("\n")
                .trim();

            if (!reply) {
                throw new Error(
                    "Gemini returned no text. Try another message."
                );
            }

            // Store conversation for the next request.
            chatHistory.push(
                {
                    role: "user",
                    parts: [{ text: text || "Analyze this image." }]
                },
                {
                    role: "model",
                    parts: [{ text: reply }]
                }
            );

            // Keep recent conversation history manageable.
            chatHistory = chatHistory.slice(-20);

            localStorage.setItem(
                "jarvisMemory",
                JSON.stringify(chatHistory)
            );

            setStatus("AI ONLINE");

            return reply;

        } catch (error) {
            if (
                error.message.includes("API key invalid") ||
                error.message.includes("quota") ||
                error.message.includes("rate limit")
            ) {
                throw error;
            }

            lastError = error.message;

            if (error.name === "TypeError") {
                throw new Error(
                    "Network error. Check your internet connection."
                );
            }
        }
    }

    throw new Error(
        "No configured model worked. " +
        lastError +
        " Check the model names available to your API key."
    );
}

// ==========================================
// BASIC LOCAL COMMANDS
// ==========================================

function runLocalCommand(message) {
    const text = message.toLowerCase().trim();

    if (
        text === "time" ||
        text.includes("what time") ||
        text.includes("current time")
    ) {
        return "The current time is " +
            new Date().toLocaleTimeString();
    }

    if (
        text === "date" ||
        text.includes("today's date") ||
        text.includes("what date")
    ) {
        return "Today's date is " +
            new Date().toLocaleDateString();
    }

    if (text === "hello jarvis" || text === "hi jarvis") {
        return "Hello, Boss. J.A.R.V.I.S systems are online.";
    }

    if (text === "open youtube") {
        window.open(
            "https://www.youtube.com/",
            "_blank"
        );
        return "Opening YouTube, Boss.";
    }

    if (text === "open google") {
        window.open(
            "https://www.google.com/",
            "_blank"
        );
        return "Opening Google, Boss.";
    }

    if (text.startsWith("search ")) {
        const query = message.substring(7).trim();

        if (query) {
            window.open(
                "https://www.google.com/search?q=" +
                    encodeURIComponent(query),
                "_blank"
            );

            return "Searching the web for " + query + ", Boss.";
        }
    }

    if (text.startsWith("play ")) {
        const query = message.substring(5).trim();

        if (query) {
            window.open(
                "https://www.youtube.com/results?search_query=" +
                    encodeURIComponent(query),
                "_blank"
            );

            return "Searching YouTube for " + query + ", Boss.";
        }
    }

    return null;
}

// ==========================================
// IMAGE ANALYSIS
// ==========================================

async function handleImage(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        addMessage("jarvis", "Please select an image file, Boss.");
        return;
    }

    if (file.size > 4 * 1024 * 1024) {
        addMessage(
            "jarvis",
            "Please select an image smaller than 4 MB."
        );
        event.target.value = "";
        return;
    }

    try {
        const dataURL = await new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(
                new Error("Could not read the image.")
            );

            reader.readAsDataURL(file);
        });

        const commaIndex = dataURL.indexOf(",");

        selectedImage = {
            mimeType: file.type,
            data: dataURL.substring(commaIndex + 1)
        };

        addMessage(
            "jarvis",
            "Image selected, Boss. Type a question about the image and press Send."
        );

    } catch (error) {
        addMessage("jarvis", error.message);
    }
}

// ==========================================
// VOICE RECOGNITION
// ==========================================

function setupVoiceRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        setStatus("VOICE NOT SUPPORTED");
        return;
    }

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        setStatus("LISTENING...");
    };

    recognition.onresult = (event) => {
        const transcript =
            event.results[0][0].transcript;

        const input = $("msg");

        if (input) {
            input.value = transcript;
            sendMessage();
        }
    };

    recognition.onerror = (event) => {
        console.log("Voice error:", event.error);
        setStatus("VOICE ERROR");
    };

    recognition.onend = () => {
        isListening = false;
        setStatus("CORE ACTIVE");
    };
}

function toggleMicrophone() {
    if (!recognition) {
        addMessage(
            "jarvis",
            "Voice recognition is not supported in this browser. Try Chrome."
        );
        return;
    }

    try {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    } catch (error) {
        console.log(error);
    }
}

// ==========================================
// TEXT TO SPEECH
// ==========================================

function speak(text) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.pitch = 0.9;

    window.speechSynthesis.speak(utterance);
}

// ==========================================
// CLEAR MEMORY
// ==========================================

function clearMemory() {
    chatHistory = [];

    localStorage.removeItem("jarvisMemory");

    const chat = $("chat");

    if (chat) {
        chat.replaceChildren();
    }

    addMessage(
        "jarvis",
        "Conversation memory cleared, Boss. I'm ready for a new conversation."
    );
}

// ==========================================
// SYSTEM READY
// ==========================================

console.log("J.A.R.V.I.S Mobile Edition loaded.");
