"use strict";

/* ========== CONFIGURATION ========== */

const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODEL = "llama-3.3-70b-versatile";

const GEMINI_KEY = "jarvis_gemini_key";
const GROQ_KEY = "jarvis_groq_key";
const HISTORY_KEY = "jarvis_chat_history";

const $ = (id) => document.getElementById(id);

let conversation = loadHistory();
let isThinking = false;
let isListening = false;
let recognition = null;

/* ========== ELEMENTS ========== */

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
const keyStatus = $("key-status");

/* ========== STARTUP ========== */

function initializeJarvis() {
  if (apiKeyInput) {
    apiKeyInput.value = localStorage.getItem(GEMINI_KEY) || "";
  }

  if ($("groqApiKey")) {
    $("groqApiKey").value =
      localStorage.getItem(GROQ_KEY) || "";
  }

  setupEventListeners();
  setupVoiceRecognition();
  renderConversation();
  updateNetworkStatus();
  updateAIStatus();

  if (conversation.length === 0) {
    addMessage(
      "jarvis",
      "Systems online, Boss. JARVIS AI is ready."
    );
  }

  console.log("JARVIS initialized.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeJarvis, {
    once: true
  });
} else {
  initializeJarvis();
}

/* ========== EVENTS ========== */

function setupEventListeners() {
  chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = messageInput?.value.trim();

    if (!text || isThinking) return;

    messageInput.value = "";
    await handleCommand(text);
  });

  keyForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveGeminiKey();
  });

  $("saveKey")?.addEventListener("click", saveGeminiKey);
  $("removeKey")?.addEventListener("click", removeGeminiKey);

  $("groq-key-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveGroqKey();
  });

  $("removeGroqKey")?.addEventListener("click", removeGroqKey);

  clearButton?.addEventListener("click", clearConversation);
  micButton?.addEventListener("click", toggleVoiceRecognition);

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!isThinking) handleCommand(button.dataset.command);
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

/* ========== MAIN CHAT ========== */

async function handleCommand(rawCommand) {
  const command = String(rawCommand || "").trim();

  if (!command || isThinking) return;

  addMessage("user", command);

  const local = processLocalCommand(command);

  if (local.handled) {
    addMessage("jarvis", local.reply);

    if (local.action) {
      local.action();
    }

    return;
  }

  if (!getGeminiKey() && !getGroqKey()) {
    addMessage(
      "jarvis",
      "Boss, enter and save your Gemini or Groq API key first."
    );
    return;
  }

  isThinking = true;
  setStatus("PROCESSING");
  showTyping(true);
  setInputEnabled(false);

  try {
    let answer;
    let provider;

    if (getGeminiKey()) {
      try {
        answer = await askGemini(command, getGeminiKey());
        provider = "GEMINI";
      } catch (geminiError) {
        console.warn("Gemini failed:", geminiError.message);

        if (!getGroqKey()) throw geminiError;

        answer = await askGroq(command, getGroqKey());
        provider = "GROQ BACKUP";
      }
    } else {
      answer = await askGroq(command, getGroqKey());
      provider = "GROQ";
    }

    addMessage("jarvis", answer);
    speak(answer);

    if (aiStatus) aiStatus.textContent = provider + " ONLINE";
  } catch (error) {
    console.error("JARVIS AI ERROR:", error);

    addMessage("jarvis", "Sorry, Boss. " + friendlyError(error));
  } finally {
    isThinking = false;
    showTyping(false);
    setInputEnabled(true);
    setStatus("SYSTEM ONLINE");
  }
}

/* ========== GEMINI API ========== */

async function askGemini(prompt, apiKey) {
  const recentHistory = conversation.slice(-15, -1).map((item) => {
    const role = item.sender === "user" ? "User" : "JARVIS";
    return `${role}: ${item.text}`;
  }).join("\n");

  const input = recentHistory
    ? `Recent conversation:\n${recentHistory}\n\nUser: ${prompt}`
    : prompt;

  const data = await fetchJSON(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: input,
      system_instruction:
        "You are JARVIS, a helpful AI assistant. Address the user as Boss. Answer clearly and truthfully. Do not claim to have performed phone actions unless they actually happened."
    })
  });

  const answer = extractGeminiText(data);

  if (!answer) {
    throw new Error("Gemini returned no readable text.");
  }

  return answer;
}

function extractGeminiText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.output)) {
    const result = data.output
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (result) return result;
  }

  if (Array.isArray(data.steps)) {
    const result = data.steps
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || [])
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (result) return result;
  }

  return "";
}

/* ========== GROQ BACKUP API ========== */

async function askGroq(prompt, apiKey) {
  const messages = [
    {
      role: "system",
      content:
        "You are JARVIS, a helpful futuristic AI assistant. Address the user as Boss. Be clear and truthful."
    },
    ...conversation.slice(-15, -1).map((item) => ({
      role: item.sender === "user" ? "user" : "assistant",
      content: item.text
    })),
    {
      role: "user",
      content: prompt
    }
  ];

  const data = await fetchJSON(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 900
    })
  });

  const answer = data?.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("Groq returned no readable answer.");
  }

  return answer;
}

/* ========== IMPROVED API ERROR DETAILS ========== */

async function fetchJSON(url, options) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, 45000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw_response: rawText };
    }

    if (!response.ok) {
      const apiMessage =
        data?.error?.message ||
        data?.message ||
        data?.raw_response ||
        "No error details provided";

      console.error("JARVIS API ERROR:", {
        status: response.status,
        url: url,
        details: data
      });

      throw new Error(`${response.status}: ${apiMessage}`);
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

/* ========== API KEY MANAGEMENT ========== */

function getGeminiKey() {
  return (
    apiKeyInput?.value.trim() ||
    localStorage.getItem(GEMINI_KEY) ||
    ""
  );
}

function getGroqKey() {
  return (
    $("groqApiKey")?.value.trim() ||
    localStorage.getItem(GROQ_KEY) ||
    ""
  );
}

function saveGeminiKey(event) {
  event?.preventDefault();

  const key = apiKeyInput?.value.trim();

  if (!key) {
    setKeyStatus("Enter a Gemini API key.", false);
    return;
  }

  localStorage.setItem(GEMINI_KEY, key);
  setKeyStatus("Gemini key saved.", true);
  updateAIStatus();
}

function removeGeminiKey() {
  localStorage.removeItem(GEMINI_KEY);

  if (apiKeyInput) apiKeyInput.value = "";

  setKeyStatus("Gemini key removed.", true);
  updateAIStatus();
}

function saveGroqKey() {
  const input = $("groqApiKey");
  const status = $("groq-key-status");
  const key = input?.value.trim();

  if (!key) {
    if (status) status.textContent = "Enter a Groq API key.";
    return;
  }

  localStorage.setItem(GROQ_KEY, key);

  if (status) status.textContent = "Groq key saved.";
  updateAIStatus();
}

function removeGroqKey() {
  localStorage.removeItem(GROQ_KEY);

  if ($("groqApiKey")) $("groqApiKey").value = "";
  if ($("groq-key-status")) {
    $("groq-key-status").textContent = "Groq key removed.";
  }

  updateAIStatus();
}

function setKeyStatus(message, success) {
  if (!keyStatus) return;

  keyStatus.textContent = message;
  keyStatus.style.color = success ? "#00e6a8" : "#ff667a";
}

/* ========== LOCAL COMMANDS ========== */

function processLocalCommand(raw) {
  const command = raw.toLowerCase().trim();

  if (/^(hi|hello|hey|hi jarvis|hello jarvis)[!. ]*$/.test(command)) {
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

  const shortcuts = [
    ["open youtube", "youtube"],
    ["open google", "google"],
    ["open instagram", "instagram"],
    ["open whatsapp", "whatsapp"]
  ];

  for (const [phrase, action] of shortcuts) {
    if (command === phrase || command === action) {
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

/* ========== VOICE INPUT ========== */

function setupVoiceRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (voiceStatus) voiceStatus.textContent = "UNSUPPORTED";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    if (voiceStatus) voiceStatus.textContent = "LISTENING";
    setStatus("LISTENING");
  };

  recognition.onresult = async (event) => {
    const text = event.results?.[0]?.[0]?.transcript?.trim();

    if (text && messageInput && !isThinking) {
      messageInput.value = text;
      await handleCommand(text);
    }
  };

  recognition.onerror = (event) => {
    console.warn("Voice recognition error:", event.error);
    if (voiceStatus) voiceStatus.textContent = "VOICE ERROR";
  };

  recognition.onend = () => {
    isListening = false;
    if (voiceStatus) voiceStatus.textContent = "READY";
    if (!isThinking) setStatus("SYSTEM ONLINE");
  };

  if (voiceStatus) voiceStatus.textContent = "READY";
}

function toggleVoiceRecognition() {
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

/* ========== CHAT DISPLAY ========== */

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
  if (!chat) return;

  const row = document.createElement("div");

  row.className =
    item.sender === "user"
      ? "message user-message"
      : "message jarvis-message";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent =
    item.sender === "user" ? "YOU" : "J.A.R.V.I.S.";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = item.text;

  row.append(label, bubble);
  chat.appendChild(row);

  chat.scrollTop = chat.scrollHeight;
}

function renderConversation() {
  if (!chat) return;

  chat.replaceChildren();
  conversation.forEach(appendMessage);
}

function showTyping(show) {
  if (!chat) return;

  $("typing-indicator")?.remove();

  if (!show) return;

  const row = document.createElement("div");
  row.id = "typing-indicator";
  row.className = "message jarvis-message";
  row.textContent = "J.A.R.V.I.S. is thinking...";

  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function clearConversation() {
  conversation = [];
  saveHistory();

  if (chat) chat.replaceChildren();

  addMessage("jarvis", "Conversation cleared, Boss.");
}

function setInputEnabled(enabled) {
  if (messageInput) messageInput.disabled = !enabled;
  if (sendButton) sendButton.disabled = !enabled;
}

/* ========== STATUS ========== */

function setStatus(text) {
  if (statusElement) statusElement.textContent = text;
}

function updateNetworkStatus() {
  if (networkStatus) {
    networkStatus.textContent =
      navigator.onLine ? "ONLINE" : "OFFLINE";
  }
}

function updateAIStatus() {
  if (!aiStatus) return;

  if (getGeminiKey() && getGroqKey()) {
    aiStatus.textContent = "DUAL AI CONFIGURED";
  } else if (getGeminiKey()) {
    aiStatus.textContent = "GEMINI KEY SAVED";
  } else if (getGroqKey()) {
    aiStatus.textContent = "GROQ KEY SAVED";
  } else {
    aiStatus.textContent = "NOT CONNECTED";
  }
}

function friendlyError(error) {
  const message = error?.message || "Unknown error.";

  if (/429|quota|rate.limit|resource_exhausted/i.test(message)) {
    return "AI quota or rate limit reached. Check provider usage and try again later.";
  }

  if (/401|403/.test(message)) {
    return "API key rejected or permission denied. Check the API key.";
  }

  if (/400/.test(message)) {
    return "API request error: " + message;
  }

  if (/404/.test(message)) {
    return "Model or API endpoint not found: " + message;
  }

  return message;
}

/* ========== HISTORY ========== */

function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
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
    console.warn("Unable to save chat history:", error);
  }
}
