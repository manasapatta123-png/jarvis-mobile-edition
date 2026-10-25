"use strict";

/* =====================================
   J.A.R.V.I.S. ADVANCED MOBILE EDITION
   Gemini primary + Groq fallback
   ===================================== */

const CONFIG = {
  geminiModel: "gemini-3.8-flash",
  geminiURL:
    "https://generativelanguage.googleapis.com/v1beta/interactions",

  groqModel: "llama-3.3-70b-versatile",
  groqURL:
    "https://api.groq.com/openai/v1/chat/completions",

  geminiStorage: "jarvis_gemini_key",
  groqStorage: "jarvis_groq_key",
  historyStorage: "jarvis_chat_history"
};

const $ = id => document.getElementById(id);

let conversation = loadHistory();
let isThinking = false;
let isListening = false;
let recognition = null;

const el = {
  chat: $("chat"),
  form: $("chat-form"),
  input: $("msg"),
  send: $("send"),
  mic: $("mic-btn"),
  clear: $("clear-btn"),

  status: $("status"),
  aiStatus: $("ai-status"),
  networkStatus: $("network-status"),
  voiceStatus: $("voice-status"),

  geminiInput: $("apiKey"),
  geminiForm: $("key-form"),
  geminiStatus: $("key-status"),

  groqInput: $("groqApiKey"),
  groqForm: $("groq-key-form"),
  groqStatus: $("groq-key-status")
};

/* ========== STARTUP ========== */

function startJarvis() {
  if (el.geminiInput) {
    el.geminiInput.value =
      localStorage.getItem(CONFIG.geminiStorage) || "";
  }

  if (el.groqInput) {
    el.groqInput.value =
      localStorage.getItem(CONFIG.groqStorage) || "";
  }

  setupEvents();
  setupVoice();
  renderHistory();
  updateNetwork();
  updateAIStatus();

  if (!conversation.length) {
    addMessage(
      "jarvis",
      "Systems online, Boss. I am ready for your commands."
    );
  }

  console.log("JARVIS initialized.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startJarvis, {
    once: true
  });
} else {
  startJarvis();
}

/* ========== EVENT HANDLERS ========== */

function setupEvents() {
  el.form?.addEventListener("submit", async event => {
    event.preventDefault();

    const text = el.input?.value.trim();

    if (!text || isThinking) return;

    el.input.value = "";
    await handleCommand(text);
  });

  el.geminiForm?.addEventListener("submit", event => {
    event.preventDefault();
    saveGeminiKey();
  });

  $("saveKey")?.addEventListener("click", saveGeminiKey);
  $("removeKey")?.addEventListener("click", removeGeminiKey);

  el.groqForm?.addEventListener("submit", event => {
    event.preventDefault();
    saveGroqKey();
  });

  $("removeGroqKey")?.addEventListener("click", removeGroqKey);

  el.clear?.addEventListener("click", clearHistory);
  el.mic?.addEventListener("click", toggleVoice);

  document.querySelectorAll("[data-command]").forEach(button => {
    button.addEventListener("click", () => {
      if (!isThinking) handleCommand(button.dataset.command);
    });
  });

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
      openShortcut(button.dataset.action);
    });
  });

  window.addEventListener("online", updateNetwork);
  window.addEventListener("offline", updateNetwork);
}

/* ========== COMMAND PROCESSING ========== */

async function handleCommand(rawText) {
  const prompt = String(rawText || "").trim();

  if (!prompt || isThinking) return;

  addMessage("user", prompt);

  const local = localCommand(prompt);

  if (local.handled) {
    addMessage("jarvis", local.reply);

    if (local.action) local.action();

    return;
  }

  if (!getGeminiKey() && !getGroqKey()) {
    addMessage(
      "jarvis",
      "Boss, please save a Gemini or Groq API key in AI Configuration."
    );
    return;
  }

  isThinking = true;
  setStatus("PROCESSING");
  showTyping(true);
  setBusy(true);

  try {
    let answer = "";
    let provider = "";

    if (getGeminiKey()) {
      try {
        answer = await askGemini(prompt);
        provider = "GEMINI";
      } catch (error) {
        console.warn("Gemini request failed:", error.message);

        if (!getGroqKey()) throw error;

        answer = await askGroq(prompt);
        provider = "GROQ BACKUP";
      }
    } else {
      answer = await askGroq(prompt);
      provider = "GROQ";
    }

    addMessage("jarvis", answer);
    speak(answer);

    if (el.aiStatus) {
      el.aiStatus.textContent = provider + " ONLINE";
    }
  } catch (error) {
    console.error("JARVIS request failed:", error);

    addMessage(
      "jarvis",
      "Sorry, Boss. " + friendlyError(error)
    );
  } finally {
    isThinking = false;
    showTyping(false);
    setBusy(false);
    setStatus("SYSTEM ONLINE");
  }
}

/* ========== GEMINI ========== */

async function askGemini(prompt) {
  const apiKey = getGeminiKey();

  if (!apiKey) {
    throw new Error("Gemini API key is missing.");
  }

  const history = conversation
    .slice(-13, -1)
    .map(item => {
      const role = item.sender === "user" ? "User" : "JARVIS";
      return `${role}: ${item.text}`;
    })
    .join("\n");

  const input = history
    ? `Recent conversation:\n${history}\n\nUser: ${prompt}`
    : prompt;

  const data = await requestJSON(
    CONFIG.geminiURL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model: CONFIG.geminiModel,
        input,
        system_instruction:
          "You are J.A.R.V.I.S., a helpful personal AI assistant. Address the user as Boss. Answer accurately and clearly. Never claim that you opened an app or sent a message unless that action actually happened."
      })
    }
  );

  const answer = readGeminiAnswer(data);

  if (!answer) {
    throw new Error("Gemini returned no text response.");
  }

  return answer;
}

function readGeminiAnswer(data) {
  if (typeof data.output_text === "string" &&
      data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.steps)) {
    const text = data.steps
      .filter(step => step.type === "model_output")
      .flatMap(step => step.content || [])
      .filter(part => part.type === "text" && part.text)
      .map(part => part.text)
      .join("\n")
      .trim();

    if (text) return text;
  }

  if (Array.isArray(data.output)) {
    return data.output
      .flatMap(item => item.content || [])
      .filter(part => part.type === "text" && part.text)
      .map(part => part.text)
      .join("\n")
      .trim();
  }

  return "";
}

/* ========== GROQ BACKUP ========== */

async function askGroq(prompt) {
  const apiKey = getGroqKey();

  if (!apiKey) {
    throw new Error("Groq API key is missing.");
  }

  const messages = [
    {
      role: "system",
      content:
        "You are J.A.R.V.I.S., a helpful personal AI assistant. Address the user as Boss. Give accurate answers. Never pretend to have performed phone actions."
    },

    ...conversation.slice(-13, -1).map(item => ({
      role: item.sender === "user" ? "user" : "assistant",
      content: item.text
    })),

    {
      role: "user",
      content: prompt
    }
  ];

  const data = await requestJSON(
    CONFIG.groqURL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: CONFIG.groqModel,
        messages,
        temperature: 0.7,
        max_tokens: 900
      })
    }
  );

  const answer =
    data?.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("Groq returned no text response.");
  }

  return answer;
}

/* ========== REQUEST + ERROR DETAILS ========== */

async function requestJSON(url, options) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, 45000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }

    if (!response.ok) {
      const details =
        data?.error?.message ||
        data?.error?.code ||
        data?.message ||
        `HTTP ${response.status}`;

      const error = new Error(
        `${response.status}: ${details}`
      );

      error.status = response.status;
      error.provider = url.includes("generativelanguage")
        ? "Gemini"
        : "Groq";

      console.error("API error details:", {
        provider: error.provider,
        status: response.status,
        details: data
      });

      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Request timed out. Check your internet connection."
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function friendlyError(error) {
  const message = error?.message || "Unknown error.";

  if (/429|quota|rate.limit|resource_exhausted/i.test(message)) {
    return "AI quota or rate limit reached. Check your provider's usage limits and try again later.";
  }

  if (/401|403/.test(message)) {
    return "API key invalid or permission denied. Check the key and project settings.";
  }

  if (/400/.test(message)) {
    return "API request rejected. Details: " + message;
  }

  if (/404/.test(message)) {
    return "Model or endpoint not found. Details: " + message;
  }

  if (/failed to fetch|networkerror/i.test(message)) {
    return "Network request failed. Check your internet connection.";
  }

  return message;
}

/* ========== API KEY STORAGE ========== */

function getGeminiKey() {
  return (
    el.geminiInput?.value.trim() ||
    localStorage.getItem(CONFIG.geminiStorage) ||
    ""
  );
}

function getGroqKey() {
  return (
    el.groqInput?.value.trim() ||
    localStorage.getItem(CONFIG.groqStorage) ||
    ""
  );
}

function saveGeminiKey(event) {
  event?.preventDefault();

  const key = el.geminiInput?.value.trim();

  if (!key) {
    setKeyStatus("Enter your Gemini API key.", false);
    return;
  }

  localStorage.setItem(CONFIG.geminiStorage, key);
  setKeyStatus("Gemini key saved in this browser.", true);
  updateAIStatus();
}

function removeGeminiKey() {
  localStorage.removeItem(CONFIG.geminiStorage);

  if (el.geminiInput) el.geminiInput.value = "";

  setKeyStatus("Gemini key removed.", true);
  updateAIStatus();
}

function saveGroqKey() {
  const key = el.groqInput?.value.trim();

  if (!key) {
    if (el.groqStatus) {
      el.groqStatus.textContent = "Enter your Groq API key.";
    }
    return;
  }

  localStorage.setItem(CONFIG.groqStorage, key);

  if (el.groqStatus) {
    el.groqStatus.textContent = "Groq backup key saved.";
  }

  updateAIStatus();
}

function removeGroqKey() {
  localStorage.removeItem(CONFIG.groqStorage);

  if (el.groqInput) el.groqInput.value = "";

  if (el.groqStatus) {
    el.groqStatus.textContent = "Groq key removed.";
  }

  updateAIStatus();
}

function setKeyStatus(message, success) {
  if (!el.geminiStatus) return;

  el.geminiStatus.textContent = message;
  el.geminiStatus.style.color =
    success ? "#00e6a8" : "#ff667a";
}

/* ========== LOCAL COMMANDS ========== */

function localCommand(raw) {
  const command = raw.toLowerCase().trim();

  if (/^(hi|hello|hey|hi jarvis|hello jarvis)[!. ]*$/.test(command)) {
    return {
      handled: true,
      reply: "Hello, Boss. All systems are standing by."
    };
  }

  if (command === "who are you" ||
      command.includes("your name")) {
    return {
      handled: true,
      reply: "I am J.A.R.V.I.S., your personal mobile assistant."
    };
  }

  if (/\btime\b/.test(command)) {
    return {
      handled: true,
      reply: "The current time is " +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        }) + "."
    };
  }

  if (/\bdate\b|\btoday\b/.test(command)) {
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

  const actions = [
    ["open youtube", "youtube"],
    ["open google", "google"],
    ["open instagram", "instagram"],
    ["open whatsapp", "whatsapp"]
  ];

  for (const [phrase, action] of actions) {
    if (command === phrase) {
      return {
        handled: true,
        reply: `Opening ${action}, Boss.`,
        action: () => openShortcut(action)
      };
    }
  }

  return { handled: false };
}

/* ========== WEBSITE SHORTCUTS ========== */

function openShortcut(action) {
  const urls = {
    youtube: "https://www.youtube.com/",
    google: "https://www.google.com/",
    instagram: "https://www.instagram.com/",
    whatsapp: "https://web.whatsapp.com/"
  };

  if (urls[action]) {
    window.open(urls[action], "_blank", "noopener,noreferrer");
  }
}

/* ========== VOICE RECOGNITION ========== */

function setupVoice() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (el.voiceStatus) {
      el.voiceStatus.textContent = "UNSUPPORTED";
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    if (el.voiceStatus) el.voiceStatus.textContent = "LISTENING";
    setStatus("LISTENING");
  };

  recognition.onresult = async event => {
    const text = event.results?.[0]?.[0]?.transcript?.trim();

    if (text && !isThinking) {
      if (el.input) el.input.value = text;
      await handleCommand(text);
    }
  };

  recognition.onerror = event => {
    console.warn("Voice recognition error:", event.error);

    if (el.voiceStatus) {
      el.voiceStatus.textContent = "VOICE ERROR";
    }
  };

  recognition.onend = () => {
    isListening = false;

    if (el.voiceStatus) el.voiceStatus.textContent = "READY";

    if (!isThinking) setStatus("SYSTEM ONLINE");
  };

  if (el.voiceStatus) el.voiceStatus.textContent = "READY";
}

function toggleVoice() {
  if (!recognition) {
    addMessage(
      "jarvis",
      "Voice recognition is not supported by this browser."
    );
    return;
  }

  try {
    if (isListening) recognition.stop();
    else recognition.start();
  } catch (error) {
    console.warn(error);
  }
}

/* ========== VOICE OUTPUT ========== */

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 0.9;

  window.speechSynthesis.speak(utterance);
}

/* ========== CHAT UI ========== */

function addMessage(sender, text) {
  const item = {
    sender,
    text,
    time: Date.now()
  };

  conversation.push(item);

  if (conversation.length > 80) {
    conversation = conversation.slice(-80);
  }

  saveHistory();
  appendMessage(item);
}

function appendMessage(item) {
  if (!el.chat) return;

  const row = document.createElement("div");

  row.className = item.sender === "user"
    ? "message user-message"
    : "message jarvis-message";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = item.sender === "user"
    ? "YOU"
    : "J.A.R.V.I.S.";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = item.text;

  row.append(label, bubble);
  el.chat.appendChild(row);
  el.chat.scrollTop = el.chat.scrollHeight;
}

function renderHistory() {
  if (!el.chat) return;

  el.chat.replaceChildren();
  conversation.forEach(appendMessage);
}

function showTyping(show) {
  if (!el.chat) return;

  $("typing-indicator")?.remove();

  if (!show) return;

  const indicator = document.createElement("div");
  indicator.id = "typing-indicator";
  indicator.className = "message jarvis-message";
  indicator.textContent = "J.A.R.V.I.S. is thinking...";

  el.chat.appendChild(indicator);
  el.chat.scrollTop = el.chat.scrollHeight;
}

function clearHistory() {
  conversation = [];
  saveHistory();

  if (el.chat) el.chat.replaceChildren();

  addMessage("jarvis", "Conversation cleared, Boss.");
}

function setBusy(busy) {
  if (el.input) el.input.disabled = busy;
  if (el.send) el.send.disabled = busy;
}

function setStatus(message) {
  if (el.status) el.status.textContent = message;
}

function updateNetwork() {
  if (el.networkStatus) {
    el.networkStatus.textContent =
      navigator.onLine ? "ONLINE" : "OFFLINE";
  }
}

function updateAIStatus() {
  if (!el.aiStatus) return;

  if (getGeminiKey() && getGroqKey()) {
    el.aiStatus.textContent = "DUAL AI CONFIGURED";
  } else if (getGeminiKey()) {
    el.aiStatus.textContent = "GEMINI CONFIGURED";
  } else if (getGroqKey()) {
    el.aiStatus.textContent = "GROQ CONFIGURED";
  } else {
    el.aiStatus.textContent = "NOT CONNECTED";
  }
}

/* ========== CHAT HISTORY STORAGE ========== */

function loadHistory() {
  try {
    const raw = localStorage.getItem(CONFIG.historyStorage);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(
      CONFIG.historyStorage,
      JSON.stringify(conversation)
    );
  } catch (error) {
    console.warn("Chat history could not be saved:", error);
  }
}
