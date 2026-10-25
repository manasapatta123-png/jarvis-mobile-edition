"use strict";

/* =========================================
   J.A.R.V.I.S MOBILE EDITION
   Gemini AI + Voice + Chat + Commands
========================================= */

const $ = (selector) => document.querySelector(selector);

const STORAGE = {
  gemini: "jarvis_gemini_key",
  groq: "jarvis_groq_key",
  history: "jarvis_chat_history"
};

const state = {
  busy: false,
  listening: false,
  recognition: null
};

let conversation = [];

function getElement(...selectors) {
  for (const selector of selectors) {
    const element = $(selector);
    if (element) return element;
  }
  return null;
}

const chatForm = getElement("#chat-form", "#chatForm");
const messageInput = getElement("#msg", "#message", "#user-input");
const sendButton = getElement("#send", "#send-btn");
const chatBox = getElement("#chat", "#chat-box", "#messages", "#chat-messages");
const geminiInput = getElement("#apiKey", "#geminiApiKey");
const groqInput = getElement("#groqApiKey");
const keyForm = getElement("#key-form", "#keyForm");
const keyStatus = getElement("#key-status", "#keyStatus");
const micButton = getElement("#mic-btn", "#micBtn", "#mic");
const clearButton = getElement("#clear-btn", "#clearBtn");
const aiStatus = getElement("#ai-status", "#aiStatus");
const networkStatus = getElement("#network-status", "#networkStatus");
const voiceStatus = getElement("#voice-status", "#voiceStatus");
const mainStatus = getElement("#status", "#jarvis-status");

function setStatus(element, message) {
  if (element) element.textContent = message;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

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

  if (chatBox) {
    const bubble = document.createElement("div");
    bubble.className =
      role === "user" ? "message user-message" : "message bot-message";

    bubble.dataset.role = role;

    const label = document.createElement("strong");
    label.textContent = role === "user" ? "YOU" : "J.A.R.V.I.S";

    const content = document.createElement("div");
    content.className = "message-text";
    content.textContent = message.text;

    bubble.append(label, content);
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  if (save) saveHistory();
  return message;
}

function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE.history) || "[]");

    if (!Array.isArray(stored)) return;

    conversation = stored.slice(-60);

    if (chatBox) {
      chatBox.innerHTML = "";

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
        chatBox.appendChild(bubble);
      }

      chatBox.scrollTop = chatBox.scrollHeight;
    }
  } catch (error) {
    console.warn("Chat history could not be loaded:", error);
    conversation = [];
  }
}

function getGeminiKey() {
  return localStorage.getItem(STORAGE.gemini) || "";
}

function getGroqKey() {
  return localStorage.getItem(STORAGE.groq) || "";
}

function saveGeminiKey(value) {
  const key = value.trim();

  if (key) localStorage.setItem(STORAGE.gemini, key);
  else localStorage.removeItem(STORAGE.gemini);
}

function saveGroqKey(value) {
  const key = value.trim();

  if (key) localStorage.setItem(STORAGE.groq, key);
  else localStorage.removeItem(STORAGE.groq);
}

/* =========================================
   API ERROR HANDLING
========================================= */

async function readResponse(response) {
  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      data?.raw ||
      `HTTP ${response.status}`;

    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  return data;
}

/* =========================================
   GEMINI API
========================================= */

async function askGemini(prompt) {
  const apiKey = getGeminiKey();

  if (!apiKey) {
    throw new Error("Gemini API key missing. Save your API key first.");
  }

  const history = conversation
    .slice(-13, -1)
    .map(item => {
      const who = item.role === "user" ? "User" : "JARVIS";
      return `${who}: ${item.text}`;
    })
    .join("\n");

  const fullPrompt = [
    "You are J.A.R.V.I.S., a helpful personal AI assistant.",
    "Address the user as Boss.",
    "Respond clearly and helpfully.",
    history ? `Previous conversation:\n${history}` : "",
    `Current message: ${prompt}`
  ].filter(Boolean).join("\n\n");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: fullPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200
        }
      })
    }
  );

  const data = await readResponse(response);

  const answer = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  if (!answer) {
    const reason = data.promptFeedback?.blockReason;
    throw new Error(
      reason
        ? `Request blocked: ${reason}`
        : "Gemini returned an empty response."
    );
  }

  return answer;
}

/* =========================================
   OPTIONAL GROQ BACKUP API
========================================= */

async function askGroq(prompt) {
  const apiKey = getGroqKey();

  if (!apiKey) {
    throw new Error("Groq backup API key is not configured.");
  }

  const messages = [
    {
      role: "system",
      content:
        "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
        "Address the user as Boss. Answer clearly."
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
        "Authorization": `Bearer ${apiKey}`
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
  const answer = data.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("Groq returned an empty response.");
  }

  return answer;
}

/* =========================================
   AI WITH BACKUP
========================================= */

async function getAIResponse(prompt) {
  const errors = [];

  if (getGeminiKey()) {
    try {
      setStatus(aiStatus, "GEMINI CONNECTING...");
      return await askGemini(prompt);
    } catch (error) {
      errors.push(`Gemini: ${error.message}`);
      console.error("Gemini request failed:", error);
    }
  }

  if (getGroqKey()) {
    try {
      setStatus(aiStatus, "BACKUP AI CONNECTING...");
      return await askGroq(prompt);
    } catch (error) {
      errors.push(`Groq: ${error.message}`);
      console.error("Groq request failed:", error);
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n\n"));
  }

  throw new Error(
    "No AI API key configured. Save a Gemini key in AI Configuration."
  );
}

/* =========================================
   LOCAL COMMANDS
========================================= */

function localCommand(prompt) {
  const text = prompt.toLowerCase().trim();

  if (/^(hi|hello|hey|hai|jarvis|wake up)[!. ]*$/.test(text)) {
    return "Systems online, Boss. J.A.R.V.I.S. is ready.";
  }

  if (text.includes("your name") || text.includes("who are you")) {
    return "I am J.A.R.V.I.S., your personal AI assistant, Boss.";
  }

  if (text.includes("what time") || text === "time") {
    return `The current time is ${new Date().toLocaleTimeString()}.`;
  }

  if (text.includes("today's date") || text === "date" ||
      text.includes("what is the date")) {
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
    return "Boss, Android Settings cannot be opened directly by this webpage. Use your phone's Settings app.";
  }

  return null;
}

function openWebsite(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/* =========================================
   SPEECH OUTPUT
========================================= */

function speak(text) {
  if (!("speechSynthesis" in window)) {
    setStatus(voiceStatus, "VOICE NOT SUPPORTED");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 1;

  utterance.onstart = () => setStatus(voiceStatus, "SPEAKING");
  utterance.onend = () => setStatus(voiceStatus, "READY");
  utterance.onerror = () => setStatus(voiceStatus, "VOICE ERROR");

  window.speechSynthesis.speak(utterance);
}

/* =========================================
   SPEECH RECOGNITION
========================================= */

function setupVoiceRecognition() {
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Recognition) {
    setStatus(voiceStatus, "VOICE INPUT NOT SUPPORTED");
    if (micButton) micButton.disabled = true;
    return;
  }

  state.recognition = new Recognition();
  state.recognition.lang = "en-IN";
  state.recognition.continuous = false;
  state.recognition.interimResults = false;

  state.recognition.onstart = () => {
    state.listening = true;
    setStatus(voiceStatus, "LISTENING...");
    if (micButton) micButton.textContent = "Listening...";
  };

  state.recognition.onresult = event => {
    const transcript =
      event.results?.[0]?.[0]?.transcript?.trim() || "";

    if (transcript && messageInput) {
      messageInput.value = transcript;

      if (chatForm) {
        chatForm.requestSubmit();
      } else {
        sendMessage(transcript);
      }
    }
  };

  state.recognition.onerror = event => {
    setStatus(voiceStatus, `VOICE ERROR: ${event.error}`);
  };

  state.recognition.onend = () => {
    state.listening = false;
    setStatus(voiceStatus, "READY");
    if (micButton) micButton.textContent = "🎙️";
  };
}

function toggleMicrophone() {
  if (!state.recognition) {
    addMessage("assistant", "Voice recognition is not supported in this browser.");
    return;
  }

  if (state.listening) {
    state.recognition.stop();
  } else {
    try {
      state.recognition.start();
    } catch (error) {
      console.warn("Microphone error:", error);
      setStatus(voiceStatus, "CHECK MICROPHONE PERMISSION");
    }
  }
}

/* =========================================
   CHAT HANDLER
========================================= */

async function sendMessage(rawPrompt) {
  const prompt = String(rawPrompt || "").trim();

  if (!prompt || state.busy) return;

  state.busy = true;

  if (sendButton) sendButton.disabled = true;
  if (messageInput) messageInput.value = "";

  addMessage("user", prompt);
  setStatus(mainStatus, "PROCESSING...");
  setStatus(networkStatus, navigator.onLine ? "ONLINE" : "OFFLINE");

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

    setStatus(mainStatus, "CORE ACTIVE");
    setStatus(aiStatus, "ONLINE");
  } catch (error) {
    console.error("JARVIS error:", error);

    const message =
      `Boss, AI request failed.\n\n${error.message}`;

    addMessage("assistant", message);
    setStatus(mainStatus, "AI ERROR");
    setStatus(aiStatus, "CHECK API");
  } finally {
    state.busy = false;
    if (sendButton) sendButton.disabled = false;

    if (messageInput) messageInput.focus();
  }
}

/* =========================================
   EVENT LISTENERS
========================================= */

if (chatForm) {
  chatForm.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(messageInput?.value || "");
  });
} else if (sendButton) {
  sendButton.addEventListener("click", event => {
    event.preventDefault();
    sendMessage(messageInput?.value || "");
  });
}

if (messageInput) {
  messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !chatForm) {
      event.preventDefault();
      sendMessage(messageInput.value);
    }
  });
}

if (micButton) {
  micButton.addEventListener("click", toggleMicrophone);
}

if (clearButton) {
  clearButton.addEventListener("click", () => {
    conversation = [];
    saveHistory();

    if (chatBox) chatBox.innerHTML = "";

    addMessage("assistant", "Chat cleared, Boss.");
  });
}

if (keyForm) {
  keyForm.addEventListener("submit", event => {
    event.preventDefault();

    if (geminiInput) saveGeminiKey(geminiInput.value);
    if (groqInput) saveGroqKey(groqInput.value);

    setStatus(keyStatus, "API KEY SAVED");
    setStatus(aiStatus, "READY");

    if (geminiInput) geminiInput.value = "";
    if (groqInput) groqInput.value = "";
  });
}

/* Support separate key-save buttons if the HTML uses them. */
const saveKeyButton = getElement("#saveKey", "#save-key");

if (saveKeyButton && !keyForm) {
  saveKeyButton.addEventListener("click", event => {
    event.preventDefault();

    if (geminiInput) saveGeminiKey(geminiInput.value);
    if (groqInput) saveGroqKey(groqInput.value);

    if (geminiInput) geminiInput.value = "";
    if (groqInput) groqInput.value = "";

    setStatus(keyStatus, "API KEY SAVED");
  });
}

const removeGeminiButton = getElement("#removeKey", "#remove-gemini-key");

if (removeGeminiButton) {
  removeGeminiButton.addEventListener("click", event => {
    event.preventDefault();
    localStorage.removeItem(STORAGE.gemini);
    setStatus(keyStatus, "GEMINI KEY REMOVED");
  });
}

const removeGroqButton = getElement("#removeGroqKey", "#remove-groq-key");

if (removeGroqButton) {
  removeGroqButton.addEventListener("click", event => {
    event.preventDefault();
    localStorage.removeItem(STORAGE.groq);
    setStatus(keyStatus, "GROQ KEY REMOVED");
  });
}

document.querySelectorAll("[data-command]").forEach(button => {
  button.addEventListener("click", () => {
    const command = button.dataset.command || button.textContent;
    sendMessage(command);
  });
});

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action === "clear") {
      clearButton?.click();
    } else if (action === "mic") {
      toggleMicrophone();
    } else if (action === "stop-voice") {
      window.speechSynthesis?.cancel();
    }
  });
});

window.addEventListener("online", () => {
  setStatus(networkStatus, "ONLINE");
});

window.addEventListener("offline", () => {
  setStatus(networkStatus, "OFFLINE");
});

/* =========================================
   INITIALIZE
========================================= */

function initializeJarvis() {
  loadHistory();
  setupVoiceRecognition();

  setStatus(mainStatus, "CORE ACTIVE");
  setStatus(networkStatus, navigator.onLine ? "ONLINE" : "OFFLINE");
  setStatus(aiStatus, getGeminiKey() || getGroqKey() ? "READY" : "KEY REQUIRED");
  setStatus(voiceStatus, "READY");

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
