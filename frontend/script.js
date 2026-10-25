"use strict";

/* =========================================
   J.A.R.V.I.S. MOBILE EDITION
   Complete Advanced Script
   ========================================= */

// CONFIGURATION
const GEMINI_MODEL = "gemini-3.8-flash";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const API_KEY_STORAGE = "jarvis_gemini_key";
const CHAT_STORAGE = "jarvis_chat_history";

// ELEMENT HELPERS
const $ = (id) => document.getElementById(id);

const chat = $("chat");
const chatForm = $("chat-form");
const messageInput = $("msg");
const sendButton = $("send");
const micButton = $("mic-btn");
const clearButton = $("clear-btn");

const statusElement = $("status");
const aiStatus = $("ai-status");
const networkStatus = $("network-status");
const voiceStatus = $("voice-status");

const apiKeyInput = $("apiKey");
const keyForm = $("key-form");
const saveKeyButton = $("saveKey");
const removeKeyButton = $("removeKey");
const keyStatus = $("key-status");

// STATE
let isThinking = false;
let isListening = false;
let recognition = null;
let conversation = loadHistory();

// INITIALIZATION
function initializeJarvis() {
  updateStatus("SYSTEM ONLINE");
  updateNetworkStatus();
  updateAIStatus();

  if (apiKeyInput) {
    apiKeyInput.value =
      localStorage.getItem(API_KEY_STORAGE) || "";
  }

  renderConversation();
  setupEventListeners();
  setupVoiceRecognition();

  if (conversation.length === 0) {
    addMessage(
      "jarvis",
      "Systems online, Boss. J.A.R.V.I.S. is ready. Enter your Gemini API key to activate AI intelligence."
    );
  }

  console.log("J.A.R.V.I.S. initialized successfully.");
}

// SUPPORT BOTH NORMAL AND ALREADY-LOADED DOCUMENTS
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeJarvis,
    { once: true }
  );
} else {
  initializeJarvis();
}

// EVENT LISTENERS
function setupEventListeners() {
  if (chatForm) {
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const text = messageInput?.value.trim();

      if (!text || isThinking) return;

      messageInput.value = "";
      await handleCommand(text);
    });
  }

  // Support older HTML layouts without key-form.
  if (keyForm) {
    keyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveApiKey();
    });
  } else if (saveKeyButton) {
    saveKeyButton.addEventListener("click", saveApiKey);
  }

  removeKeyButton?.addEventListener("click", removeApiKey);

  clearButton?.addEventListener("click", clearConversation);

  micButton?.addEventListener(
    "click",
    toggleVoiceRecognition
  );

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!isThinking && button.dataset.command) {
        await handleCommand(button.dataset.command);
      }
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      openShortcut(button.dataset.action);
    });
  });

  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
}

// MAIN COMMAND HANDLER
async function handleCommand(rawCommand) {
  const command = String(rawCommand || "").trim();

  if (!command || isThinking) return;

  addMessage("user", command);

  const local = processLocalCommand(command);

  if (local.handled) {
    addMessage("jarvis", local.reply);

    if (local.action) {
      try {
        local.action();
      } catch (error) {
        console.error("Shortcut error:", error);
      }
    }

    return;
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    addMessage(
      "jarvis",
      "I received your command, Boss. Please enter your Gemini API key and press Save Key to activate AI responses."
    );

    updateAIStatus();
    return;
  }

  isThinking = true;
  updateStatus("PROCESSING");
  showTypingIndicator(true);
  setInputEnabled(false);

  try {
    const answer = await askGemini(command, apiKey);

    addMessage("jarvis", answer);
    speak(answer);

    updateAIStatus(true);
  } catch (error) {
    console.error("Gemini error:", error);

    addMessage(
      "jarvis",
      "Sorry, Boss. " + friendlyError(error)
    );

    updateAIStatus(false);
  } finally {
    isThinking = false;

    showTypingIndicator(false);
    setInputEnabled(true);
    updateStatus("SYSTEM ONLINE");

    messageInput?.focus();
  }
}

// GEMINI INTERACTIONS API
async function askGemini(userPrompt, apiKey) {
  const recentHistory = conversation
    .slice(-15, -1)
    .map((item) => {
      const role =
        item.sender === "user" ? "User" : "J.A.R.V.I.S.";

      return `${role}: ${item.text}`;
    })
    .join("\n");

  const fullPrompt = recentHistory
    ? `Recent conversation:\n${recentHistory}\n\nLatest user message:\n${userPrompt}`
    : userPrompt;

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 45000);

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
          "You are J.A.R.V.I.S., a helpful futuristic personal AI assistant. Address the user as Boss. Give clear and useful answers. Help with questions, coding, learning, planning, and technology. Never claim that you have performed a phone action unless it actually happened. You cannot directly control Android settings or launch every installed application from a normal webpage."
      }),

      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "The request timed out. Check your internet connection and try again."
      );
    }

    throw new Error(
      "Cannot connect to Gemini. Check your internet connection."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `HTTP ${response.status}`;

    throw new Error(`${response.status}: ${message}`);
  }

  const answer = extractGeminiText(data);

  if (!answer) {
    console.error("Unexpected Gemini response:", data);

    throw new Error(
      "Gemini returned no readable answer. Please try again."
    );
  }

  return answer;
}

// READ GEMINI RESPONSE
function extractGeminiText(data) {
  if (
    typeof data.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.output)) {
    const outputText = data.output
      .flatMap((item) => item.content || [])
      .filter(
        (item) =>
          item.type === "text" &&
          typeof item.text === "string"
      )
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (outputText) return outputText;
  }

  if (Array.isArray(data.steps)) {
    const stepText = data.steps
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || [])
      .filter(
        (item) =>
          item.type === "text" &&
          typeof item.text === "string"
      )
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (stepText) return stepText;
  }

  return "";
}

// FRIENDLY ERROR MESSAGES
function friendlyError(error) {
  const message = error?.message || "Unknown error.";

  if (/401|403/.test(message)) {
    return "Your API key was rejected or does not have permission. Check your key and API access.";
  }

  if (/400/.test(message)) {
    return "Gemini rejected the request. Check the model name and request format.";
  }

  if (/404/.test(message)) {
    return "The requested model or API endpoint was not found. Verify the currently supported model name in Google's Gemini documentation.";
  }

  if (/429/.test(message)) {
    return "The API usage limit was reached. Check your Gemini quota and billing settings.";
  }

  if (/gemini-2\.5-flash/i.test(message)) {
    return "An old Gemini model is still being requested. Check whether another JavaScript file or cached page contains gemini-2.5-flash.";
  }

  return message;
}

// API KEY MANAGEMENT
function getApiKey() {
  return (
    apiKeyInput?.value.trim() ||
    localStorage.getItem(API_KEY_STORAGE) ||
    ""
  );
}

function saveApiKey(event) {
  event?.preventDefault();

  const key = apiKeyInput?.value.trim();

  if (!key) {
    setKeyStatus("Please enter an API key.", false);
    return;
  }

  localStorage.setItem(API_KEY_STORAGE, key);

  setKeyStatus("API key saved in this browser.", true);
  updateAIStatus();
}

function removeApiKey() {
  localStorage.removeItem(API_KEY_STORAGE);

  if (apiKeyInput) {
    apiKeyInput.value = "";
  }

  setKeyStatus("Saved API key removed.", true);
  updateAIStatus(false);
}

function setKeyStatus(message, success) {
  if (!keyStatus) return;

  keyStatus.textContent = message;

  keyStatus.style.color = success
    ? "#00e6a8"
    : "#ff667a";
}

// STATUS UPDATES
function updateStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function updateAIStatus(connected) {
  if (!aiStatus) return;

  if (connected === true) {
    aiStatus.textContent = "ONLINE";
  } else if (getApiKey()) {
    aiStatus.textContent = "KEY SAVED";
  } else {
    aiStatus.textContent = "NOT CONNECTED";
  }
}

function updateNetworkStatus() {
  if (networkStatus) {
    networkStatus.textContent = navigator.onLine
      ? "ONLINE"
      : "OFFLINE";
  }
}

// LOCAL COMMANDS
function processLocalCommand(rawCommand) {
  const command = rawCommand.toLowerCase().trim();

  if (
    /^(hi|hello|hey|hi jarvis|hello jarvis|hey jarvis)[!. ]*$/.test(command)
  ) {
    return {
      handled: true,
      reply: "Hello, Boss. All systems are standing by."
    };
  }

  if (
    command.includes("your name") ||
    command === "who are you"
  ) {
    return {
      handled: true,
      reply: "I am J.A.R.V.I.S., your personal mobile assistant."
    };
  }

  if (/\b(time|current time)\b/.test(command)) {
    return {
      handled: true,
      reply:
        "The current time is " +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        }) +
        "."
    };
  }

  if (
    /\b(date|today's date|today's day)\b/.test(command)
  ) {
    return {
      handled: true,
      reply:
        "Today is " +
        new Date().toLocaleDateString([], {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        }) +
        "."
    };
  }

  const shortcuts = [
    {
      patterns: ["open youtube", "youtube"],
      action: "youtube"
    },
    {
      patterns: ["open google", "google"],
      action: "google"
    },
    {
      patterns: ["open instagram", "instagram"],
      action: "instagram"
    },
    {
      patterns: ["open whatsapp", "whatsapp"],
      action: "whatsapp"
    }
  ];

  for (const shortcut of shortcuts) {
    if (
      shortcut.patterns.some(
        (pattern) => command === pattern
      )
    ) {
      return {
        handled: true,
        reply: `Opening ${shortcut.action}, Boss.`,
        action: () => openShortcut(shortcut.action)
      };
    }
  }

  return {
    handled: false,
    reply: ""
  };
}

// WEBSITE SHORTCUTS
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

// CHAT MESSAGES
function addMessage(sender, text) {
  const message = {
    sender,
    text,
    time: Date.now()
  };

  conversation.push(message);

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
    message.sender === "user"
      ? "YOU"
      : "J.A.R.V.I.S.";

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

  addMessage(
    "jarvis",
    "Conversation cleared, Boss. Systems ready."
  );
}

function showTypingIndicator(show) {
  if (!chat) return;

  const existing = $("typing-indicator");

  if (!show) {
    existing?.remove();
    return;
  }

  if (existing) return;

  const row = document.createElement("div");
  row.id = "typing-indicator";
  row.className = "message jarvis-message";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = "J.A.R.V.I.S.";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = "Analyzing your request...";

  row.append(label, bubble);
  chat.appendChild(row);

  chat.scrollTop = chat.scrollHeight;
}

function setInputEnabled(enabled) {
  if (messageInput) {
    messageInput.disabled = !enabled;
  }

  if (sendButton) {
    sendButton.disabled = !enabled;
  }
}

// VOICE RECOGNITION
function setupVoiceRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (voiceStatus) {
      voiceStatus.textContent = "UNSUPPORTED";
    }

    return;
  }

  recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  if (voiceStatus) {
    voiceStatus.textContent = "READY";
  }

  recognition.onstart = () => {
    isListening = true;

    if (voiceStatus) {
      voiceStatus.textContent = "LISTENING";
    }

    updateStatus("LISTENING");
  };

  recognition.onresult = async (event) => {
    const transcript =
      event.results?.[0]?.[0]?.transcript?.trim();

    if (transcript && messageInput && !isThinking) {
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

    if (voiceStatus) {
      voiceStatus.textContent = "READY";
    }

    if (!isThinking) {
      updateStatus("SYSTEM ONLINE");
    }
  };
}

function toggleVoiceRecognition() {
  if (!recognition) {
    addMessage(
      "jarvis",
      "Voice recognition is not supported in this browser. Try a compatible browser and allow microphone access."
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

// TEXT TO SPEECH
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

// SAVE AND LOAD CHAT HISTORY
function loadHistory() {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE);
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
      CHAT_STORAGE,
      JSON.stringify(conversation)
    );
  } catch (error) {
    console.warn("Could not save chat history:", error);
  }
      }
