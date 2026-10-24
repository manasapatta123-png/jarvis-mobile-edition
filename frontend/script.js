/* ==========================================
   J.A.R.V.I.S. MOBILE EDITION
   Advanced JavaScript
   ========================================== */

"use strict";

// ---------- CONFIGURATION ----------
const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const STORAGE_KEY = "jarvis_gemini_key";
const HISTORY_KEY = "jarvis_chat_history";

// ---------- ELEMENTS ----------
const $ = (id) => document.getElementById(id);

const chat = $("chat");
const chatForm = $("chat-form");
const messageInput = $("msg");
const micButton = $("mic-btn");
const clearButton = $("clear-btn");
const statusElement = $("status");
const aiStatus = $("ai-status");
const networkStatus = $("network-status");
const voiceStatus = $("voice-status");
const apiKeyInput = $("apiKey");
const keyForm = $("key-form");
const removeKeyButton = $("removeKey");
const keyStatus = $("key-status");

// ---------- STATE ----------
let isThinking = false;
let isListening = false;
let recognition = null;
let conversation = loadHistory();

// ---------- STARTUP ----------
document.addEventListener("DOMContentLoaded", initializeJarvis);

function initializeJarvis() {
  updateStatus("SYSTEM ONLINE", "online");
  updateAIStatus();
  updateNetworkStatus();

  if (apiKeyInput) {
    apiKeyInput.value = localStorage.getItem(STORAGE_KEY) || "";
  }

  renderConversation();

  // Welcome message for a new chat.
  if (conversation.length === 0) {
    addMessage(
      "jarvis",
      "Systems online, Boss. J.A.R.V.I.S. is ready. Enter your Gemini API key to activate AI intelligence."
    );
  }

  setupVoiceRecognition();
  setupEventListeners();
}

// ---------- EVENT LISTENERS ----------
function setupEventListeners() {
  if (chatForm) {
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const message = messageInput?.value.trim();
      if (!message || isThinking) return;

      messageInput.value = "";
      await handleCommand(message);
    });
  }

  if (keyForm) {
    keyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveApiKey();
    });
  }

  if (removeKeyButton) {
    removeKeyButton.addEventListener("click", removeApiKey);
  }

  if (clearButton) {
    clearButton.addEventListener("click", clearConversation);
  }

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", async () => {
      const command = button.dataset.command;
      if (command && !isThinking) {
        await handleCommand(command);
      }
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      openShortcut(button.dataset.action);
    });
  });

  if (micButton) {
    micButton.addEventListener("click", toggleVoiceRecognition);
  }

  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
}

// ---------- CHAT ----------
async function handleCommand(command) {
  const text = command.trim();
  if (!text || isThinking) return;

  addMessage("user", text);

  const localResponse = await processLocalCommand(text);

  if (localResponse.handled) {
    addMessage("jarvis", localResponse.reply);
    if (localResponse.action) localResponse.action();
    return;
  }

  const key = getApiKey();

  if (!key) {
    addMessage(
      "jarvis",
      "I received your command, Boss. To activate Gemini AI, enter your Gemini API key in the API Key section and press Save Key."
    );
    updateAIStatus(false);
    return;
  }

  isThinking = true;
  updateStatus("PROCESSING", "thinking");
  showTypingIndicator(true);
  setInputEnabled(false);

  try {
    const answer = await askGemini(text, key);
    addMessage("jarvis", answer);
    speak(answer);
  } catch (error) {
    console.error("JARVIS AI error:", error);

    addMessage(
      "jarvis",
      "Sorry, Boss. " + friendlyError(error)
    );

    updateAIStatus(false);
  } finally {
    isThinking = false;
    showTypingIndicator(false);
    setInputEnabled(true);
    updateStatus("SYSTEM ONLINE", "online");
    messageInput?.focus();
  }
}

function addMessage(sender, text) {
  const message = {
    sender,
    text,
    time: Date.now()
  };

  conversation.push(message);

  // Keep recent messages only.
  if (conversation.length > 80) {
    conversation = conversation.slice(-80);
  }

  saveHistory();
  appendMessageToScreen(message);
}

function appendMessageToScreen(message) {
  if (!chat) return;

  const row = document.createElement("div");
  row.className =
    message.sender === "user"
      ? "message user-message"
      : "message jarvis-message";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent =
    message.sender === "user" ? "YOU" : "J.A.R.V.I.S.";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = message.text;

  row.append(label, bubble);
  chat.appendChild(row);

  chat.scrollTop = chat.scrollHeight;
}

function renderConversation() {
  if (!chat) return;

  chat.replaceChildren();

  conversation.forEach(appendMessageToScreen);
}

function clearConversation() {
  conversation = [];
  saveHistory();

  if (chat) chat.replaceChildren();

  addMessage("jarvis", "Conversation cleared, Boss. Systems ready.");
}

function showTypingIndicator(show) {
  if (!chat) return;

  const existing = $("typing-indicator");

  if (!show) {
    existing?.remove();
    return;
  }

  if (existing) return;

  const indicator = document.createElement("div");
  indicator.id = "typing-indicator";
  indicator.className = "message jarvis-message";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = "J.A.R.V.I.S.";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = "Analyzing your request...";

  indicator.append(label, bubble);
  chat.appendChild(indicator);
  chat.scrollTop = chat.scrollHeight;
}

function setInputEnabled(enabled) {
  if (messageInput) messageInput.disabled = !enabled;

  const sendButton = $("send");
  if (sendButton) sendButton.disabled = !enabled;
}

// ---------- GEMINI AI ----------
async function askGemini(userPrompt, apiKey) {
  const recentHistory = conversation
    .slice(-15, -1)
    .map((item) => {
      const role = item.sender === "user" ? "User" : "JARVIS";
      return `${role}: ${item.text}`;
    })
    .join("\n");

  const fullPrompt = recentHistory
    ? `Recent conversation:\n${recentHistory}\n\nUser's latest message: ${userPrompt}`
    : userPrompt;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let response;

  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: fullPrompt,
        system_instruction:
          "You are J.A.R.V.I.S., a helpful personal AI assistant inspired by a futuristic technology assistant. Address the user as Boss. Be clear, capable, concise, and friendly. Help with questions, explanations, planning, coding, and phone-related tasks. Never claim you performed a device action unless it actually happened. You cannot directly control the phone or open apps by yourself; browser shortcuts must be triggered separately."
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The AI request timed out. Check your connection and try again.");
    }

    throw new Error("Could not connect to Gemini. Check your internet connection.");
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiMessage =
      data?.error?.message || `HTTP ${response.status}`;

    throw new Error(`${response.status}: ${apiMessage}`);
  }

  const answer = extractGeminiText(data);

  if (!answer) {
    console.error("Unexpected Gemini response:", data);
    throw new Error("Gemini returned no readable text. Please try again.");
  }

  updateAIStatus(true);
  return answer;
}

function extractGeminiText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.output)) {
    const text = data.output
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (text) return text;
  }

  if (Array.isArray(data.steps)) {
    const text = data.steps
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || [])
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (text) return text;
  }

  return "";
}

function friendlyError(error) {
  const message = error?.message || "Unknown error.";

  if (message.includes("401") || message.includes("403")) {
    return "Your API key was rejected or lacks permission. Check the key and API access.";
  }

  if (message.includes("400")) {
    return "Gemini rejected the request. Check the model name and request format.";
  }

  if (message.includes("404")) {
    return "The API endpoint or model was not found. Check the current Gemini API documentation.";
  }

  if (message.includes("429")) {
    return "The API request limit was reached. Check your Gemini usage and quota.";
  }

  return message;
}

// ---------- API KEY ----------
function getApiKey() {
  return (
    apiKeyInput?.value.trim() ||
    localStorage.getItem(STORAGE_KEY) ||
    ""
  );
}

function saveApiKey() {
  const key = apiKeyInput?.value.trim();

  if (!key) {
    setKeyStatus("Please enter an API key first.", false);
    return;
  }

  localStorage.setItem(STORAGE_KEY, key);
  setKeyStatus("API key saved in this browser.", true);
  updateAIStatus();
}

function removeApiKey() {
  localStorage.removeItem(STORAGE_KEY);

  if (apiKeyInput) apiKeyInput.value = "";

  setKeyStatus("Saved API key removed.", true);
  updateAIStatus(false);
}

function setKeyStatus(message, success) {
  if (!keyStatus) return;

  keyStatus.textContent = message;
  keyStatus.style.color = success ? "#00e6a8" : "#ff667a";
}

function updateAIStatus(connected) {
  const hasKey = Boolean(getApiKey());

  if (aiStatus) {
    aiStatus.textContent =
      connected === true
        ? "ONLINE"
        : hasKey
          ? "KEY SAVED"
          : "NOT CONNECTED";
  }

  if (voiceStatus) {
    voiceStatus.textContent = recognition
      ? "READY"
      : "BROWSER CHECK";
  }
}

function updateNetworkStatus() {
  const online = navigator.onLine;

  if (networkStatus) {
    networkStatus.textContent = online ? "ONLINE" : "OFFLINE";
  }
}

function updateStatus(message, state) {
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.dataset.state = state || "online";
}

// ---------- LOCAL COMMANDS ----------
async function processLocalCommand(rawCommand) {
  const command = rawCommand.toLowerCase().trim();

  if (
    /^(hi|hello|hey|hello jarvis|hi jarvis|hey jarvis)[!. ]*$/.test(command)
  ) {
    return {
      handled: true,
      reply: "Hello, Boss. All systems are standing by."
    };
  }

  if (command.includes("your name") || command === "who are you") {
    return {
      handled: true,
      reply: "I am J.A.R.V.I.S., your personal mobile assistant."
    };
  }

  if (command.includes("time")) {
    return {
      handled: true,
      reply: "The current time is " +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        }) + "."
    };
  }

  if (command.includes("date") || command.includes("today's day")) {
    return {
      handled: true,
      reply: "Today is " +
        new Date().toLocaleDateString([], {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        }) + "."
    };
  }

  if (command === "clear chat" || command === "clear conversation") {
    return {
      handled: true,
      reply: "Use the Clear button to clear the conversation."
    };
  }

  const shortcutCommands = [
    { words: ["open youtube", "youtube"], action: "youtube" },
    { words: ["open google", "google"], action: "google" },
    { words: ["open instagram", "instagram"], action: "instagram" },
    { words: ["open whatsapp", "whatsapp"], action: "whatsapp" }
  ];

  for (const item of shortcutCommands) {
    if (
      item.words.some((word) =>
        command === word || command === `jarvis ${word}`
      )
    ) {
      return {
        handled: true,
        reply: `Opening ${item.action}, Boss.`,
        action: () => openShortcut(item.action)
      };
    }
  }

  return { handled: false, reply: "" };
}

// ---------- QUICK SHORTCUTS ----------
function openShortcut(action) {
  const destinations = {
    youtube: "https://www.youtube.com/",
    google: "https://www.google.com/",
    instagram: "https://www.instagram.com/",
    whatsapp: "https://web.whatsapp.com/"
  };

  const url = destinations[action];

  if (!url) return;

  window.open(url, "_blank", "noopener,noreferrer");
}

// ---------- VOICE INPUT ----------
function setupVoiceRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    recognition = null;

    if (voiceStatus) voiceStatus.textContent = "UNSUPPORTED";

    if (micButton) {
      micButton.title = "Voice recognition is not supported in this browser.";
    }

    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    if (voiceStatus) voiceStatus.textContent = "LISTENING";
    updateStatus("LISTENING", "thinking");
  };

  recognition.onresult = async (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim();

    if (transcript && messageInput) {
      messageInput.value = transcript;
      await handleCommand(transcript);
    }
  };

  recognition.onerror = (event) => {
    console.warn("Voice recognition error:", event.error);

    if (voiceStatus) {
      voiceStatus.textContent = "VOICE ERROR";
    }
  };

  recognition.onend = () => {
    isListening = false;

    if (voiceStatus) voiceStatus.textContent = "READY";

    if (!isThinking) {
      updateStatus("SYSTEM ONLINE", "online");
    }
  };
}

function toggleVoiceRecognition() {
  if (!recognition) {
    addMessage(
      "jarvis",
      "Voice recognition is not supported by this browser. Try opening this page in a compatible browser with microphone permission enabled."
    );
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  try {
    recognition.start();
  } catch (error) {
    console.warn("Could not start voice recognition:", error);
  }
}

// ---------- TEXT TO SPEECH ----------
function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 0.9;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

// ---------- CHAT HISTORY ----------
function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Could not load chat history:", error);
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(conversation)
    );
  } catch (error) {
    console.warn("Could not save chat history:", error);
  }
}
