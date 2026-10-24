// =============================================
// J.A.R.V.I.S — AI COMMAND SYSTEM
// =============================================

const $ = id => document.getElementById(id);

let apiKey = localStorage.getItem("jarvisApiKey") || "";
let history = JSON.parse(
    localStorage.getItem("jarvisMemory") || "[]"
);

let busy = false;
let recognition = null;

// =============================================
// STARTUP
// =============================================

document.addEventListener("DOMContentLoaded", () => {
    if ($("apiKey")) $("apiKey").value = apiKey;

    $("send")?.addEventListener("click", sendMessage);

    $("msg")?.addEventListener("keydown", e => {
        if (e.key === "Enter") sendMessage();
    });

    $("saveKey")?.addEventListener("click", saveKey);
    $("save-key-btn")?.addEventListener("click", saveKey);
    $("save-key")?.addEventListener("click", saveKey);

    $("mic-btn")?.addEventListener("click", toggleVoice);
    $("clear-btn")?.addEventListener("click", clearMemory);

    setupVoice();

    addMessage(
        "jarvis",
        "J.A.R.V.I.S online, Boss. Give me a command."
    );
});

// =============================================
// API KEY
// =============================================

function saveKey() {
    const input = $("apiKey");

    if (!input?.value.trim()) {
        addMessage("jarvis", "Please enter your Gemini API key, Boss.");
        return;
    }

    apiKey = input.value.trim();

    localStorage.setItem("jarvisApiKey", apiKey);

    addMessage(
        "jarvis",
        "API key saved. Try saying: Hello Jarvis."
    );
}

// =============================================
// CHAT UI
// =============================================

function addMessage(sender, message) {
    const chat = $("chat");

    if (!chat) {
        console.log(sender, message);
        return;
    }

    const element = document.createElement("div");

    element.className =
        sender === "user" ? "user-message" : "jarvis-message";

    element.textContent = message;

    chat.appendChild(element);
    chat.scrollTop = chat.scrollHeight;
}

function setStatus(message) {
    const element =
        $("status") || $("core-status") || $("ai-status");

    if (element) element.textContent = message;
}

// =============================================
// MAIN COMMAND HANDLER
// =============================================

async function sendMessage() {
    if (busy) return;

    const input = $("msg");
    if (!input) return;

    const command = input.value.trim();
    if (!command) return;

    input.value = "";

    addMessage("user", command);

    // Handle straightforward local commands first.
    const localResult = await executeLocalCommand(command);

    if (localResult !== null) {
        addMessage("jarvis", localResult);
        speak(localResult);
        return;
    }

    if (!apiKey) {
        addMessage(
            "jarvis",
            "Boss, AI is not connected. Add your Gemini API key in AI Configuration."
        );
        return;
    }

    busy = true;
    setStatus("AI THINKING...");

    const thinking = document.createElement("div");
    thinking.className = "jarvis-message";
    thinking.textContent = "Understanding your command...";

    $("chat")?.appendChild(thinking);

    try {
        const result = await askAI(command);

        thinking.remove();

        if (result.action) {
            const response = await executeAIAction(result);

            addMessage("jarvis", response);
            speak(response);
        } else {
            addMessage(
                "jarvis",
                result.reply || "I couldn't understand that command, Boss."
            );

            if (result.reply) speak(result.reply);
        }

    } catch (error) {
        thinking.remove();

        console.error(error);

        addMessage(
            "jarvis",
            "AI error: " + error.message
        );

    } finally {
        busy = false;
        setStatus("CORE ACTIVE");
    }
}

// =============================================
// GEMINI AI — NATURAL LANGUAGE UNDERSTANDING
// =============================================

async function askAI(command) {
    const instructions = `
You are JARVIS, an assistant running inside a mobile website.

Understand the user's command and return ONLY valid JSON.

Supported actions:
1. {"action":"reply","reply":"Your response"}
2. {"action":"open_website","site":"youtube"}
3. {"action":"search","query":"search terms"}
4. {"action":"whatsapp","message":"message text","phone":"international number or empty"}
5. {"action":"time"}
6. {"action":"date"}
7. {"action":"calculator","expression":"12*5"}

Rules:
- If the user requests an ordinary conversation, use action reply.
- If the user asks to search the web, use action search.
- If the user asks to message a contact but provides no phone number,
  return action reply and ask for their phone number.
- Never invent a contact's phone number.
- For WhatsApp, prepare the message but never claim it was sent.
- Do not claim an action succeeded unless the website actually performed it.
- Only select an action that matches the user's intent.
- Keep replies concise.
- Address the user as Boss.
- Understand Telugu, English and Telugu written in English letters.

Allowed website names: youtube, google, instagram, facebook.
`;

    // Gemini model names can vary by API availability.
    const models = [
        "gemini-3.8-flash",
        "gemini-2.5-flash"
    ];

    let lastError = "No compatible Gemini model was available.";

    for (const model of models) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": apiKey
                    },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: instructions }]
                        },
                        contents: [
                            ...history,
                            {
                                role: "user",
                                parts: [{ text: command }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.2,
                            responseMimeType: "application/json"
                        }
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                lastError = data?.error?.message || response.statusText;

                if (response.status === 404 || response.status === 400) {
                    continue;
                }

                throw new Error(lastError);
            }

            const output = data?.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("");

            if (!output) {
                throw new Error("Gemini returned an empty response.");
            }

            const result = JSON.parse(
                output.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
            );

            history.push(
                { role: "user", parts: [{ text: command }] },
                { role: "model", parts: [{ text: JSON.stringify(result) }] }
            );

            history = history.slice(-16);

            localStorage.setItem("jarvisMemory", JSON.stringify(history));

            return result;

        } catch (error) {
            lastError = error.message;

            if (
                error.message.includes("API key") ||
                error.message.includes("quota") ||
                error.message.includes("403") ||
                error.message.includes("429")
            ) {
                throw error;
            }
        }
    }

    throw new Error(lastError);
}

// =============================================
// EXECUTE SUPPORTED ACTIONS
// =============================================

async function executeAIAction(result) {
    switch (result.action) {
        case "reply":
            return result.reply || "How can I help, Boss?";

        case "open_website":
            return openWebsite(result.site);

        case "search":
            if (!result.query) {
                return "Boss, what should I search for?";
            }

            window.open(
                "https://www.google.com/search?q=" +
                    encodeURIComponent(result.query),
                "_blank"
            );

            return "Opening Google search for " + result.query + ", Boss.";

        case "whatsapp":
            return openWhatsApp(result.message, result.phone);

        case "time":
            return "The current time is " +
                new Date().toLocaleTimeString();

        case "date":
            return "Today's date is " +
                new Date().toLocaleDateString();

        case "calculator":
            return calculate(result.expression);

        default:
            return "I understood your command, Boss, but that action isn't supported by this website yet.";
    }
}

// =============================================
// OPEN WEBSITE
// =============================================

function openWebsite(site) {
    const websites = {
        youtube: "https://www.youtube.com/",
        google: "https://www.google.com/",
        instagram: "https://www.instagram.com/",
        facebook: "https://www.facebook.com/"
    };

    const url = websites[String(site).toLowerCase()];

    if (!url) {
        return "That website isn't configured yet, Boss.";
    }

    window.open(url, "_blank");

    return "Opening " + site + ", Boss.";
}

// =============================================
// WHATSAPP — ANY PHONE NUMBER
// =============================================

function openWhatsApp(message, phone) {
    if (!message) {
        return "Boss, what message should I prepare?";
    }

    if (!phone) {
        return "Boss, I need the recipient's phone number. Example: Send hi to 9876543210.";
    }

    let number = String(phone).replace(/\D/g, "");

    if (number.length === 10) {
        number = "91" + number;
    }

    if (number.length < 8 || number.length > 15) {
        return "That phone number doesn't look valid, Boss.";
    }

    const url =
        "https://wa.me/" +
        number +
        "?text=" +
        encodeURIComponent(message);

    window.open(url, "_blank");

    return "WhatsApp is opening with your message prepared. Check the recipient and tap Send, Boss.";
}

// =============================================
// SAFE CALCULATOR
// =============================================

function calculate(expression) {
    if (!expression) {
        return "Boss, please provide a calculation.";
    }

    const exp = String(expression).replace(/\s/g, "");

    if (!/^[0-9+\-*/().%]+$/.test(exp)) {
        return "I can calculate basic arithmetic expressions only, Boss.";
    }

    try {
        // Restrict input to arithmetic characters only.
        const result = Function('"use strict"; return (' + exp + ')')();

        if (!Number.isFinite(result)) {
            return "That calculation has no finite result, Boss.";
        }

        return "The answer is " + result + ", Boss.";
    } catch {
        return "I couldn't calculate that expression, Boss.";
    }
}

// =============================================
// LOCAL COMMANDS
// =============================================

async function executeLocalCommand(command) {
    const text = command.toLowerCase().trim();

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

    if (text === "open youtube") {
        return openWebsite("youtube");
    }

    if (text === "open google") {
        return openWebsite("google");
    }

    if (text === "open instagram") {
        return openWebsite("instagram");
    }

    if (text === "open facebook") {
        return openWebsite("facebook");
    }

    if (text.startsWith("search ")) {
        const query = command.substring(7).trim();

        if (query) {
            window.open(
                "https://www.google.com/search?q=" +
                    encodeURIComponent(query),
                "_blank"
            );

            return "Searching for " + query + ", Boss.";
        }
    }

    return null;
}

// =============================================
// VOICE RECOGNITION
// =============================================

function setupVoice() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        setStatus("LISTENING...");
    };

    recognition.onresult = event => {
        const spokenText = event.results[0][0].transcript;

        if ($("msg")) {
            $("msg").value = spokenText;
            sendMessage();
        }
    };

    recognition.onerror = event => {
        console.error("Voice recognition error:", event.error);
        setStatus("VOICE ERROR");
    };

    recognition.onend = () => {
        setStatus("CORE ACTIVE");
    };
}

function toggleVoice() {
    if (!recognition) {
        addMessage(
            "jarvis",
            "Voice recognition isn't supported in this browser. Try Chrome."
        );
        return;
    }

    try {
        recognition.start();
    } catch (error) {
        console.log(error);
    }
}

// =============================================
// TEXT TO SPEECH
// =============================================

function speak(text) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-IN";
    speech.rate = 1;
    speech.pitch = 0.9;

    window.speechSynthesis.speak(speech);
}

// =============================================
// CLEAR CONVERSATION MEMORY
// =============================================

function clearMemory() {
    history = [];

    localStorage.removeItem("jarvisMemory");

    if ($("chat")) {
        $("chat").replaceChildren();
    }

    addMessage(
        "jarvis",
        "Conversation memory cleared, Boss."
    );
}

console.log("J.A.R.V.I.S AI command system loaded.");
