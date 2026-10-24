// ==================================================
// J.A.R.V.I.S MOBILE EDITION — ADVANCED SCRIPT
// Gemini AI | Voice | Commands | WhatsApp | Memory
// ==================================================

"use strict";

// ---------- CONFIGURATION ----------

const CONFIG = {
    model: "gemini-3.8-flash",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/",
    historyLimit: 20
};

const $ = id => document.getElementById(id);

let apiKey = localStorage.getItem("jarvisApiKey") || "";
let conversation = [];
let busy = false;
let recognition = null;

// ---------- FIND HTML ELEMENTS ----------

function findElement(ids) {
    for (const id of ids) {
        const element = $(id);
        if (element) return element;
    }
    return null;
}

function getInput() {
    return findElement([
        "msg", "userInput", "user-input",
        "messageInput", "message-input", "prompt"
    ]);
}

function getChat() {
    return findElement([
        "chat", "chatBox", "chat-box",
        "chatMessages", "messages", "conversation"
    ]);
}

function getApiInput() {
    return findElement([
        "apiKey", "api-key", "geminiKey",
        "gemini-key", "api-key-input"
    ]);
}

// ---------- START JARVIS ----------

function initializeJarvis() {
    console.log("J.A.R.V.I.S initializing...");

    if (getApiInput()) {
        getApiInput().value = apiKey;
    }

    try {
        conversation = JSON.parse(
            localStorage.getItem("jarvisMemory") || "[]"
        );
    } catch {
        conversation = [];
    }

    bindButtons();
    setupVoice();

    setStatus("CORE ACTIVE");

    if (!getChat()?.children.length) {
        addMessage(
            "jarvis",
            "J.A.R.V.I.S online, Boss. All available systems initialized."
        );
    }

    console.log("J.A.R.V.I.S ready.");
}

// ---------- BUTTON CONNECTIONS ----------

function bindButtons() {
    const sendButton = findElement([
        "send", "sendBtn", "send-btn",
        "sendButton", "send-button"
    ]);

    const input = getInput();

    if (sendButton && !sendButton.dataset.jarvisBound) {
        sendButton.dataset.jarvisBound = "true";

        sendButton.addEventListener("click", event => {
            event.preventDefault();
            sendMessage();
        });
    }

    if (input && !input.dataset.jarvisBound) {
        input.dataset.jarvisBound = "true";

        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    const saveButton = findElement([
        "saveKey", "save-key", "save-key-btn",
        "saveApiKey", "save-api-key"
    ]);

    if (saveButton && !saveButton.dataset.jarvisBound) {
        saveButton.dataset.jarvisBound = "true";
        saveButton.addEventListener("click", saveApiKey);
    }

    const micButton = findElement([
        "mic-btn", "micBtn", "voiceBtn", "voice-btn",
        "microphone", "mic"
    ]);

    if (micButton && !micButton.dataset.jarvisBound) {
        micButton.dataset.jarvisBound = "true";
        micButton.addEventListener("click", toggleVoice);
    }

    const clearButton = findElement([
        "clear-btn", "clearBtn", "clearMemory"
    ]);

    if (clearButton && !clearButton.dataset.jarvisBound) {
        clearButton.dataset.jarvisBound = "true";
        clearButton.addEventListener("click", clearMemory);
    }
}

// ---------- STATUS DISPLAY ----------

function setStatus(message) {
    const element = findElement([
        "status", "core-status", "ai-status",
        "systemStatus", "system-status"
    ]);

    if (element) {
        element.textContent = message;
    }

    console.log("JARVIS STATUS:", message);
}

// ---------- CHAT DISPLAY ----------

function addMessage(sender, message) {
    const chat = getChat();

    if (!chat) {
        console.error(
            "Chat container not found. Check your HTML element ID."
        );
        return;
    }

    const bubble = document.createElement("div");

    bubble.className =
        sender === "user"
            ? "user-message"
            : "jarvis-message";

    bubble.textContent = String(message);

    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
}

function showThinking() {
    const chat = getChat();

    if (!chat) return null;

    const element = document.createElement("div");

    element.className = "jarvis-message";
    element.textContent = "Analyzing command...";

    chat.appendChild(element);
    chat.scrollTop = chat.scrollHeight;

    return element;
}

// ---------- SAVE GEMINI API KEY ----------

function saveApiKey() {
    const input = getApiInput();

    if (!input || !input.value.trim()) {
        addMessage(
            "jarvis",
            "Boss, enter your Gemini API key first."
        );
        return;
    }

    apiKey = input.value.trim();

    localStorage.setItem("jarvisApiKey", apiKey);

    addMessage(
        "jarvis",
