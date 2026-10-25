"use strict";

/* ==========================================
   J.A.R.V.I.S MOBILE EDITION
   Gemini 3.8 Flash + Optional Groq Backup
   ========================================== */

const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const STORAGE = {
  gemini: "jarvis_gemini_key",
  groq: "jarvis_groq_key",
  history: "jarvis_chat_history"
};

const $ = (selector) => document.querySelector(selector);

let isBusy = false;
let recognition = null;
let isListening = false;

let chatHistory = loadHistory();

/* ==========================================
   INITIALIZATION
   ========================================== */

document.addEventListener("DOMContentLoaded", initJarvis);

function initJarvis() {
  updateNetworkStatus();
  updateKeyStatus();
  renderHistory();
  setupEventListeners();
  setupVoiceRecognition();
  setupOnlineStatus();

  setStatus("J.A.R.V.I.S is ready, Boss.");

  console.log("J.A.R.V.I.S initialized.");
}

/* ==========================================
   EVENT LISTENERS
   ========================================== */

function setupEventListeners() {
  const chatForm = $("#chat-form");

  if (chatForm) {
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const input = $("#msg");
      if (!input) return;

      const message = input.value.trim();
      if (!message) return;

      input.value = "";
      await handleMessage(message);
    });
  }

  const keyForm = $("#key-form");

  if (keyForm) {
    keyForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const input = $("#apiKey");
      const key = input?.value.trim();

      if (!key) {
        setKeyStatus("Enter your Gemini API key.");
        return;
      }

      localStorage.setItem(STORAGE.gemini, key);

      if (input) input.value = "";

      updateKeyStatus();
      setKeyStatus("Gemini API key saved.");
      setStatus("Gemini connection configured.");
    });
  }

  $("#saveKey")?.addEventListener("click", saveGeminiKey);

  $("#removeKey")?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE.gemini);
    updateKeyStatus();
    setKeyStatus("Gemini API key removed.");
  });

  $("#groq-key-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const input = $("#groqApiKey");
    const key = input?.value.trim();

    if (!key) {
      setGroqKeyStatus("Enter your Groq API key.");
      return;
    }

    localStorage.setItem(STORAGE.groq, key);

    if (input) input.value = "";

    setGroqKeyStatus("Groq API key saved.");
  });

  $("#removeGroqKey")?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE.groq);
    setGroqKeyStatus("Groq API key removed.");
  });

  $("#mic-btn")?.addEventListener("click", toggleVoice);

  $("#clear-btn")?.addEventListener("click", clearChat);

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", async () => {
      const command = button.getAttribute("data-command");

      if (command) {
        await handleMessage(command);
      }
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      handleAction(button.getAttribute("data-action"));
    });
  });
}

function saveGeminiKey() {
  const input = $("#apiKey");
  const key = input?.value.trim();

  if (!key) {
    setKeyStatus("Enter your Gemini API key.");
    return;
  }

  localStorage.setItem(STORAGE.gemini, key);

  if (input) input.value = "";

  updateKeyStatus();
  setKeyStatus("Gemini API key saved.");
}

/* ==========================================
   STATUS INDICATORS
   ========================================== */

function setStatus(message) {
  const element = $("#status");

  if (element) {
    element.textContent = message;
  }
}

function setKeyStatus(message) {
  const element = $("#key-status");

  if (element) {
    element.textContent = message;
  }
}

function setGroqKeyStatus(message) {
  const element = $("#groq-key-status");

  if (element) {
    element.textContent = message;
  }
}

function updateKeyStatus() {
  const hasGemini = Boolean(
    localStorage.getItem(STORAGE.gemini)
  );

  const hasGroq = Boolean(
    localStorage.getItem(STORAGE.groq)
  );

  const aiStatus = $("#ai-status");

  if (aiStatus) {
    aiStatus.textContent = hasGemini
      ? "GEMINI CONFIGURED"
      : hasGroq
        ? "GROQ CONFIGURED"
        : "API KEY REQUIRED";
  }

  const voiceStatus = $("#voice-status");

  if (voiceStatus) {
    voiceStatus.textContent = "VOICE READY";
  }
}

function updateNetworkStatus() {
  const element = $("#network-status");

  if (element) {
    element.textContent = navigator.onLine
      ? "NETWORK ONLINE"
      : "NETWORK OFFLINE";
  }
}

function setupOnlineStatus() {
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
}

/* ==========================================
   CHAT HISTORY
   ========================================== */

function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE.history);

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    // Keep the most recent 100 messages.
    chatHistory = chatHistory.slice(-100);

    localStorage.setItem(
      STORAGE.history,
      JSON.stringify(chatHistory)
    );
  } catch (error) {
    console.warn("Could not save chat history:", error);
  }
}

function addMessage(role, text) {
  chatHistory.push({
    role,
    text,
    time: Date.now()
  });

  saveHistory();
  renderHistory();
}

function renderHistory() {
  const container = $("#chat-messages");

  if (!container) return;

  container.replaceChildren();

  chatHistory.forEach((message) => {
    const row = document.createElement("div");

    row.className =
      message.role === "user"
        ? "message user-message"
        : "message jarvis-message";

    const label = document.createElement("strong");

    label.textContent =
      message.role === "user" ? "YOU" : "J.A.R.V.I.S";

    const content = document.createElement("div");

    // textContent prevents chat text from being treated as HTML.
    content.textContent = message.text;

    row.append(label, content);
    container.appendChild(row);
  });

  container.scrollTop = container.scrollHeight;
}

function clearChat() {
  chatHistory = [];
  saveHistory();
  renderHistory();

  setStatus("Chat history cleared, Boss.");
}

/* ==========================================
   MAIN CHAT HANDLER
   ========================================== */

async function handleMessage(message) {
  if (isBusy) {
    setStatus("One moment, Boss. I'm processing your request.");
    return;
  }

  const cleanMessage = message.trim();

  if (!cleanMessage) return;

  addMessage("user", cleanMessage);

  const localReply = await handleLocalCommand(cleanMessage);

  if (localReply !== null) {
    addMessage("assistant", localReply);
    speak(localReply);
    setStatus("Command completed.");
    return;
  }

  isBusy = true;

  const sendButton = $("#send");

  if (sendButton) {
    sendButton.disabled = true;
  }

  setStatus("J.A.R.V.I.S is thinking...");

  try {
    const reply = await askAI(cleanMessage);

    addMessage("assistant", reply);
    speak(reply);

    setStatus("Response received, Boss.");
  } catch (error) {
    console.error("AI request failed:", error);

    const errorMessage =
      "Boss, AI request failed: " +
      (error.message || "Unknown error");

    addMessage("assistant", errorMessage);
    setStatus("AI connection failed.");
  } finally {
    isBusy = false;

    if (sendButton) {
      sendButton.disabled = false;
    }
  }
}

/* ==========================================
   AI ROUTER
   Try Gemini first, then optional Groq.
   ========================================== */

async function askAI(prompt) {
  const geminiKey = localStorage.getItem(STORAGE.gemini);
  const groqKey = localStorage.getItem(STORAGE.groq);

  let geminiError = null;

  if (geminiKey) {
    try {
      return await askGemini(prompt, geminiKey);
    } catch (error) {
      geminiError = error;
      console.error("Gemini error:", error);
    }
  }

  if (groqKey) {
    try {
      return await askGroq(prompt, groqKey);
    } catch (error) {
      console.error("Groq error:", error);

      throw new Error(
        "Gemini: " +
        (geminiError?.message || "Not configured") +
        " | Groq: " +
        error.message
      );
    }
  }

  if (!geminiKey && !groqKey) {
    throw new Error(
      "No API key found. Save a Gemini API key first."
    );
  }

  throw geminiError || new Error("AI request failed.");
}

/* ==========================================
   GEMINI 3.8 FLASH — INTERACTIONS API
   ========================================== */

async function askGemini(prompt, apiKey) {
  const response = await fetch(GEMINI_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },

    body: JSON.stringify({
      model: GEMINI_MODEL,

      input:
        "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
        "Address the user as Boss when natural. " +
        "Reply clearly and concisely. " +
        "You are running inside a mobile web application. " +
        "Do not claim to have performed actions that you have not performed.\n\n" +
        buildConversationPrompt(prompt)
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      `Gemini HTTP ${response.status}`
    );
  }

  // The REST response can contain text in steps[].content[].
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.steps)) {
    const text = data.steps
      .filter((step) => step.type === "model_output")
      .flatMap((step) => Array.isArray(step.content) ? step.content : [])
      .filter((part) => part.type === "text")
      .map((part) => part.text || "")
      .join("\n")
      .trim();

    if (text) return text;
  }

  // Compatibility with responses containing output items.
  if (Array.isArray(data.output)) {
    const text = data.output
      .filter((item) => item.type === "text")
      .map((item) => item.text || "")
      .join("\n")
      .trim();

    if (text) return text;
  }

  throw new Error(
    "Gemini returned no text. Check the API response and model access."
  );
}

/* ==========================================
   OPTIONAL GROQ BACKUP
   ========================================== */

async function askGroq(prompt, apiKey) {
  const messages = [
    {
      role: "system",
      content:
        "You are J.A.R.V.I.S., a helpful mobile AI assistant. " +
        "Address the user as Boss when natural. " +
        "Be clear, accurate, and concise."
    },

    ...chatHistory
      .slice(-12, -1)
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.text
      })),

    {
      role: "user",
      content: prompt
    }
  ];

  const response = await fetch(GROQ_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },

    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 700
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error?.message || `Groq HTTP ${response.status}`
    );
  }

  const text = data.choices?.[0]?.message?.content;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Groq returned an empty response.");
  }

  return text.trim();
}

/* ==========================================
   BUILD CONVERSATION PROMPT
   ========================================== */

function buildConversationPrompt(currentPrompt) {
  const previousMessages = chatHistory
    .slice(-12, -1)
    .map((message) => {
      const speaker =
        message.role === "assistant" ? "J.A.R.V.I.S" : "Boss";

      return `${speaker}: ${message.text}`;
    })
    .join("\n");

  return (
    (previousMessages
      ? "Recent conversation:\n" + previousMessages + "\n\n"
      : "") +
    "Boss: " + currentPrompt + "\n" +
    "J.A.R.V.I.S:"
  );
}

/* ==========================================
   LOCAL COMMANDS
   These open websites; they do not control
   other apps or Android system settings.
   ========================================== */

async function handleLocalCommand(message) {
  const text = message.toLowerCase().trim();

  const commands = [
    {
      matches: ["open youtube", "launch youtube"],
      url: "https://www.youtube.com",
      reply: "Opening YouTube, Boss."
    },
    {
      matches: ["open google", "launch google"],
      url: "https://www.google.com",
      reply: "Opening Google, Boss."
    },
    {
      matches: ["open instagram", "launch instagram"],
      url: "https://www.instagram.com",
      reply: "Opening Instagram, Boss."
    },
    {
      matches: ["open whatsapp", "launch whatsapp"],
      url: "https://www.whatsapp.com",
      reply: "Opening WhatsApp, Boss."
    },
    {
      matches: ["open facebook", "launch facebook"],
      url: "https://www.facebook.com",
      reply: "Opening Facebook, Boss."
    }
  ];

  for (const command of commands) {
    if (command.matches.some((item) => text === item)) {
      window.open(command.url, "_blank", "noopener,noreferrer");
      return command.reply;
    }
  }

  if (
    text === "hello jarvis" ||
    text === "hi jarvis" ||
    text === "hello"
  ) {
    return "Systems online, Boss. J.A.R.V.I.S is ready.";
  }

  if (text === "status report" || text === "system status") {
    return (
      "J.A.R.V.I.S status report, Boss.\n" +
      "Network: " + (navigator.onLine ? "Online" : "Offline") + "\n" +
      "Gemini key: " +
      (localStorage.getItem(STORAGE.gemini) ? "Saved" : "Not saved") + "\n" +
      "Groq backup: " +
      (localStorage.getItem(STORAGE.groq) ? "Configured" : "Not configured")
    );
  }

  return null;
}

/* ==========================================
   ACTION BUTTONS
   ========================================== */

function handleAction(action) {
  switch ((action || "").toLowerCase()) {
    case "clear":
      clearChat();
      break;

    case "mic":
    case "voice":
      toggleVoice();
      break;

    case "youtube":
      window.open(
        "https://www.youtube.com",
        "_blank",
        "noopener,noreferrer"
      );
      break;

    case "google":
      window.open(
        "https://www.google.com",
        "_blank",
        "noopener,noreferrer"
      );
      break;

    default:
      console.log("Unknown action:", action);
  }
}

/* ==========================================
   VOICE INPUT
   Requires browser speech recognition support.
   ========================================== */

function setupVoiceRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    const voiceStatus = $("#voice-status");

    if (voiceStatus) {
      voiceStatus.textContent = "VOICE INPUT UNSUPPORTED";
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
    setStatus("Listening, Boss...");

    const button = $("#mic-btn");

    if (button) {
      button.classList.add("listening");
    }
  };

  recognition.onresult = async (event) => {
    const transcript =
      event.results?.[0]?.[0]?.transcript?.trim();

    if (!transcript) return;

    const input = $("#msg");

    if (input) {
      input.value = transcript;
    }

    await handleMessage(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Voice recognition error:", event.error);

    setStatus("Voice recognition error: " + event.error);
  };

  recognition.onend = () => {
    isListening = false;

    const button = $("#mic-btn");

    if (button) {
      button.classList.remove("listening");
    }
  };
}

function toggleVoice() {
  if (!recognition) {
    setStatus(
      "Voice input is not supported in this browser. Try a supported browser."
    );
    return;
  }

  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (error) {
      console.warn("Could not start voice recognition:", error);
      setStatus("Could not start the microphone.");
    }
  }
}

/* ==========================================
   TEXT-TO-SPEECH
   ========================================== */

function speak(text) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

/* ==========================================
   END
   ========================================== */
