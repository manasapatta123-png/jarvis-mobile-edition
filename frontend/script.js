"use strict";

/* ==========================================
   J.A.R.V.I.S MOBILE EDITION
   Gemini AI + Groq Backup + Voice + Memory
========================================== */

const STORAGE = {
  gemini: "jarvis_gemini_key",
  groq: "jarvis_groq_key",
  history: "jarvis_chat_history"
};

const $ = selector => document.querySelector(selector);

const getElement = (...selectors) => {
  for (const selector of selectors) {
    const element = $(selector);
    if (element) return element;
  }
  return null;
};

const ui = {
  chatForm: getElement("#chat-form", "#chatForm"),
  input: getElement("#msg", "#message", "#user-input"),
  send: getElement("#send", "#send-btn"),
  chat: getElement("#chat", "#chat-box", "#messages", "#chat-messages"),
  geminiInput: getElement("#apiKey", "#geminiApiKey"),
  groqInput: getElement("#groqApiKey"),
  keyForm: getElement("#key-form", "#keyForm"),
  keyStatus: getElement("#key-status", "#keyStatus"),
  mic: getElement("#mic-btn", "#micBtn", "#mic"),
  clear: getElement("#clear-btn", "#clearBtn"),
  aiStatus: getElement("#ai-status", "#aiStatus"),
  networkStatus: getElement("#network-status", "#networkStatus"),
  voiceStatus: getElement("#voice-status", "#voiceStatus"),
  status: getElement("#status", "#jarvis-status")
};

let conversation = [];
let busy = false;
let recognition = null;
let listening = false;

/* ==========================================
   STATUS
========================================== */

function setStatus(element, message) {
  if (element) element.textContent = message;
}

/* ==========================================
   API KEYS
========================================== */

function getGeminiKey() {
  return localStorage.getItem(STORAGE.gemini) || "";
}

function getGroqKey() {
  return localStorage.getItem(STORAGE.groq) || "";
}

function saveGeminiKey(key) {
  if (key.trim()) {
    localStorage.setItem(STORAGE.gemini, key.trim());
  } else {
    localStorage.removeItem(STORAGE.gemini);
  }
}

function saveGroqKey(key) {
  if (key.trim()) {
    localStorage.setItem(STORAGE.groq, key.trim());
  } else {
    localStorage.removeItem(STORAGE.groq);
  }
}

/* ==========================================
   CHAT HISTORY
========================================== */

function saveHistory() {
  try {
    localStorage.setItem(
      STORAGE.history,
      JSON.stringify(conversation.slice(-60))
    );
  } catch (error) {
    console.warn("Could not save chat history:", error);
  }
}

function addMessage(role, text, save = true) {
  const message = {
    role,
    text: String(text),
    time: Date.now()
  };

  conversation.push(message);

  if (ui.chat) {
    const bubble = document.createElement("div");

    bubble.className =
      role === "user"
        ? "message user-message"
        : "message bot-message";

    const label = document.createElement("strong");
    label.textContent = role === "user" ? "YOU" : "J.A.R.V.I.S";

    const content = document.createElement("div");
    content.className = "message-text";
    content.textContent = message.text;

    bubble.append(label, content);
    ui.chat.appendChild(bubble);
    ui.chat.scrollTop = ui.chat.scrollHeight;
  }

  if (save) saveHistory();
}

function loadHistory() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE.history) || "[]"
    );

    if (!Array.isArray(stored)) return;

    conversation = stored.slice(-60);

    if (ui.chat) {
      ui.chat.innerHTML = "";

      for (const message of conversation) {
        const bubble = document.createElement("div");

        bubble.className =
          message.role === "user"
            ? "message user-message"
            : "message bot-message";

        const label = document.createElement("strong");
        label.textContent =
          message.role === "user" ? "YOU" : "J.A.R.V.I.S";

        const content = document.createElement("div");
        content.className = "message-text";
        content.textContent = message.text || "";

        bubble.append(label, content);
        ui.chat.appendChild(bubble);
      }

      ui.chat.scrollTop = ui.chat.scrollHeight;
    }
  } catch (error) {
    console.warn("History could not be loaded:", error);
    conversation = [];
  }
}

/* ==========================================
   API RESPONSE HANDLER
========================================== */

async function readResponse(response) {
  const raw = await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    data = { message: raw };
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  return data;
}

/* ==========================================
   GEMINI 3.8 FLASH
   INTERACTIONS API
========================================== */

async function askGemini(prompt) {
  const apiKey = getGeminiKey();

  if (!apiKey) {
    throw new Error("Gemini API key missing. Save your key first.");
  }

  const history = conversation
    .slice(-13, -1)
    .map(message => {
      const name = message.role === "user" ? "User" : "JARVIS";
      return `${name}: ${message.text}`;
    })
    .join("\n");

  const fullPrompt = [
    "You are J.A.R.V.I.S., a helpful personal AI assistant.",
    "Address the user as Boss.",
    "Give clear, useful answers.",
    history ? `Previous conversation:\n${history}` : "",
    `Current message: ${prompt}`
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model: "gemini-3.8-flash",
        input: fullPrompt
      })
    }
  );

  const data = await readResponse(response);

  let answer = "";

  if (typeof data.output_text === "string") {
    answer = data.output_text;
  } else if (Array.isArray(data.output)) {
    answer = data.output
      .map(item => {
        if (typeof item.text === "string") {
          return item.text;
        }

        if (Array.isArray(item.content)) {
          return item.content
            .map(part => part.text || "")
            .join("");
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  answer = answer.trim();

  if (!answer) {
    throw new Error(
      "Gemini returned no text. Check the API response and model access."
    );
  }

  return answer;
}

/* ==========================================
   GROQ BACKUP AI
========================================== */

async function askGroq(prompt) {
  const apiKey = getGroqKey();

  if (!apiKey) {
    throw new Error("Groq backup key is not configured.");
  }

  const messages = [
    {
      role: "system",
      content:
        "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
        "Address the user as Boss and answer clearly."
    }
  ];

  for (const item of conversation.slice(-12, -1)) {
    messages.push({
      role: item.role === "user" ? "user" : "assistant",
      content: item.text
    });
  }

  messages.push({
    role: "user",
    content: prompt
  });

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7,
        max_tokens: 1200
      })
    }
  );

  const data = await readResponse(response);

  const answer =
    data.choices?.[0]?.message?.content?.trim() || "";

  if (!answer) {
    throw new Error("Groq returned an empty response.");
  }

  return answer;
}

/* ==========================================
   GEMINI + BACKUP
========================================== */

async function getAIResponse(prompt) {
  const errors = [];

  if (getGeminiKey()) {
    try {
      setStatus(ui.aiStatus, "GEMINI CONNECTING...");
      return await askGemini(prompt);
    } catch (error) {
      console.error("Gemini error:", error);
      errors.push(`Gemini: ${error.message}`);
    }
  }

  if (getGroqKey()) {
    try {
      setStatus(ui.aiStatus, "BACKUP AI CONNECTING...");
      return await askGroq(prompt);
    } catch (error) {
      console.error("Groq error:", error);
      errors.push(`Groq: ${error.message}`);
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n\n"));
  }

  throw new Error(
    "No API key configured. Save a Gemini API key first."
  );
}

/* ==========================================
   LOCAL COMMANDS
========================================== */

function openWebsite(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function localCommand(prompt) {
  const text = prompt.toLowerCase().trim();

  if (/^(hi|hello|hey|hai|jarvis)[!. ]*$/.test(text)) {
    return "Systems online, Boss. J.A.R.V.I.S. is ready.";
  }

  if (
    text.includes("your name") ||
    text.includes("who are you")
  ) {
    return "I am J.A.R.V.I.S., your personal AI assistant, Boss.";
  }

  if (text === "time" || text.includes("what time")) {
    return `The current time is ${new Date().toLocaleTimeString()}.`;
  }

  if (
    text === "date" ||
    text.includes("today's date") ||
    text.includes("what is the date")
  ) {
    return `Today's date is ${new Date().toLocaleDateString()}.`;
  }

  if (text.includes("open youtube")) {
    openWebsite("https://www.youtube.com");
    return "Opening YouTube, Boss.";
  }

  if (text.includes("open google")) {
    openWebsite("https://www.google.com");
    return "Opening Google, Boss.";
  }

  if (text.includes("open instagram")) {
    openWebsite("https://www.instagram.com");
    return "Opening Instagram, Boss.";
  }

  if (text.includes("open whatsapp")) {
    openWebsite("https://wa.me/");
    return "Opening WhatsApp, Boss.";
  }

  if (text.includes("open facebook")) {
    openWebsite("https://www.facebook.com");
    return "Opening Facebook, Boss.";
  }

  if (text.includes("open settings")) {
    return "Boss, a webpage cannot directly control Android Settings. Please open Settings manually.";
  }

  return null;
}

/* ==========================================
   VOICE OUTPUT
========================================== */

function speak(text) {
  if (!("speechSynthesis" in window)) {
    setStatus(ui.voiceStatus, "VOICE NOT SUPPORTED");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(String(text));

  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 1;

  utterance.onstart = () => {
    setStatus(ui.voiceStatus, "SPEAKING");
  };

  utterance.onend = () => {
    setStatus(ui.voiceStatus, "READY");
  };

  utterance.onerror = () => {
    setStatus(ui.voiceStatus, "VOICE ERROR");
  };

  window.speechSynthesis.speak(utterance);
}

/* ==========================================
   VOICE INPUT
========================================== */

function setupVoiceRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatus(ui.voiceStatus, "VOICE INPUT NOT SUPPORTED");
    if (ui.mic) ui.mic.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    listening = true;
    setStatus(ui.voiceStatus, "LISTENING...");

    if (ui.mic) ui.mic.textContent = "Listening...";
  };

  recognition.onresult = event => {
    const transcript =
      event.results?.[0]?.[0]?.transcript?.trim() || "";

    if (transcript) {
      if (ui.input) ui.input.value = transcript;
      sendMessage(transcript);
    }
  };

  recognition.onerror = event => {
    setStatus(ui.voiceStatus, `VOICE ERROR: ${event.error}`);
  };

  recognition.onend = () => {
    listening = false;
    setStatus(ui.voiceStatus, "READY");

    if (ui.mic) ui.mic.textContent = "🎙️";
  };
}

function toggleMicrophone() {
  if (!recognition) {
    addMessage(
      "assistant",
      "Voice input is not supported in this browser."
    );
    return;
  }

  try {
    if (listening) recognition.stop();
    else recognition.start();
  } catch (error) {
    console.warn("Microphone error:", error);
    setStatus(ui.voiceStatus, "CHECK MICROPHONE PERMISSION");
  }
}

/* ==========================================
   SEND MESSAGE
========================================== */

async function sendMessage(rawPrompt) {
  const prompt = String(rawPrompt || "").trim();

  if (!prompt || busy) return;

  busy = true;

  if (ui.send) ui.send.disabled = true;
  if (ui.input) ui.input.value = "";

  addMessage("user", prompt);

  setStatus(ui.status, "PROCESSING...");
  setStatus(
    ui.networkStatus,
    navigator.onLine ? "ONLINE" : "OFFLINE"
  );

  try {
    const localAnswer = localCommand(prompt);

    if (localAnswer !== null) {
      addMessage("assistant", localAnswer);
      speak(localAnswer);
    } else {
      if (!navigator.onLine) {
        throw new Error("Internet connection unavailable.");
      }

      const answer = await getAIResponse(prompt);

      addMessage("assistant", answer);
      speak(answer);
    }

    setStatus(ui.status, "CORE ACTIVE");
    setStatus(ui.aiStatus, "ONLINE");
  } catch (error) {
    console.error("JARVIS request failed:", error);

    addMessage(
      "assistant",
      `Boss, AI request failed.\n${error.message}`
    );

    setStatus(ui.status, "AI ERROR");
    setStatus(ui.aiStatus, "CHECK API");
  } finally {
    busy = false;

    if (ui.send) ui.send.disabled = false;
    if (ui.input) ui.input.focus();
  }
}

/* ==========================================
   EVENT LISTENERS
========================================== */

if (ui.chatForm) {
  ui.chatForm.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(ui.input?.value || "");
  });
} else if (ui.send) {
  ui.send.addEventListener("click", event => {
    event.preventDefault();
    sendMessage(ui.input?.value || "");
  });
}

if (ui.input) {
  ui.input.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !ui.chatForm
    ) {
      event.preventDefault();
      sendMessage(ui.input.value);
    }
  });
}

if (ui.mic) {
  ui.mic.addEventListener("click", toggleMicrophone);
}

if (ui.clear) {
  ui.clear.addEventListener("click", () => {
    conversation = [];
    saveHistory();

    if (ui.chat) ui.chat.innerHTML = "";

    addMessage("assistant", "Chat cleared, Boss.");
  });
}

if (ui.keyForm) {
  ui.keyForm.addEventListener("submit", event => {
    event.preventDefault();

    if (ui.geminiInput) {
      saveGeminiKey(ui.geminiInput.value);
      ui.geminiInput.value = "";
    }

    if (ui.groqInput) {
      saveGroqKey(ui.groqInput.value);
      ui.groqInput.value = "";
    }

    setStatus(ui.keyStatus, "API KEY SAVED");
    setStatus(ui.aiStatus, "READY");
  });
}

const saveKeyButton = getElement("#saveKey", "#save-key");

if (saveKeyButton && !ui.keyForm) {
  saveKeyButton.addEventListener("click", event => {
    event.preventDefault();

    if (ui.geminiInput) {
      saveGeminiKey(ui.geminiInput.value);
      ui.geminiInput.value = "";
    }

    if (ui.groqInput) {
      saveGroqKey(ui.groqInput.value);
      ui.groqInput.value = "";
    }

    setStatus(ui.keyStatus, "API KEY SAVED");
  });
}

const removeGeminiButton =
  getElement("#removeKey", "#remove-gemini-key");

if (removeGeminiButton) {
  removeGeminiButton.addEventListener("click", event => {
    event.preventDefault();

    localStorage.removeItem(STORAGE.gemini);

    setStatus(ui.keyStatus, "GEMINI KEY REMOVED");
    setStatus(ui.aiStatus, "KEY REQUIRED");
  });
}

const removeGroqButton =
  getElement("#removeGroqKey", "#remove-groq-key");

if (removeGroqButton) {
  removeGroqButton.addEventListener("click", event => {
    event.preventDefault();

    localStorage.removeItem(STORAGE.groq);

    setStatus(ui.keyStatus, "GROQ KEY REMOVED");
  });
}

document.querySelectorAll("[data-command]").forEach(button => {
  button.addEventListener("click", () => {
    sendMessage(
      button.dataset.command || button.textContent
    );
  });
});

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action === "clear") {
      ui.clear?.click();
    } else if (action === "mic") {
      toggleMicrophone();
    } else if (action === "stop-voice") {
      window.speechSynthesis?.cancel();
    }
  });
});

window.addEventListener("online", () => {
  setStatus(ui.networkStatus, "ONLINE");
});

window.addEventListener("offline", () => {
  setStatus(ui.networkStatus, "OFFLINE");
});

/* ==========================================
   START JARVIS
========================================== */

function initializeJarvis() {
  loadHistory();
  setupVoiceRecognition();

  setStatus(ui.status, "CORE ACTIVE");

  setStatus(
    ui.networkStatus,
    navigator.onLine ? "ONLINE" : "OFFLINE"
  );

  setStatus(
    ui.aiStatus,
    getGeminiKey() || getGroqKey()
      ? "READY"
      : "KEY REQUIRED"
  );

  setStatus(ui.voiceStatus, "READY");

  if (!conversation.length) {
    addMessage(
      "assistant",
      "J.A.R.V.I.S. Mobile Edition online, Boss. How may I assist you?"
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeJarvis);
} else {
  initializeJarvis();
           }
