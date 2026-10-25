"use strict";

/* ======================================
   J.A.R.V.I.S ADVANCED MOBILE EDITION
   ====================================== */

const MODEL = "gemini-3.8-flash";

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const KEYS = {
  api: "jarvis_gemini_key",
  history: "jarvis_advanced_history",
  memories: "jarvis_advanced_memories",
  notes: "jarvis_advanced_notes",
  voice: "jarvis_voice_enabled"
};

const $ = (selector) => document.querySelector(selector);

let busy = false;
let recognition = null;
let listening = false;

let history = load(KEYS.history, []);
let memories = load(KEYS.memories, []);
let notes = load(KEYS.notes, []);

let voiceEnabled =
  localStorage.getItem(KEYS.voice) !== "false";

/* ======================================
   STARTUP
   ====================================== */

document.addEventListener("DOMContentLoaded", () => {
  $("#keyForm").addEventListener("submit", saveApiKey);
  $("#testAI").addEventListener("click", testAI);
  $("#removeKey").addEventListener("click", removeApiKey);

  $("#chatForm").addEventListener("submit", sendMessage);
  $("#micButton").addEventListener("click", toggleMic);
  $("#clearChat").addEventListener("click", clearChat);
  $("#speakToggle").addEventListener("click", toggleVoice);

  $("#memoryForm").addEventListener("submit", saveMemory);
  $("#clearMemory").addEventListener("click", clearMemories);

  $("#noteForm").addEventListener("submit", saveNote);
  $("#runDiagnostics").addEventListener("click", diagnostics);

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      processMessage(button.dataset.command);
    });
  });

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      openWebsite(button.dataset.open);
    });
  });

  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);

  updateClock();
  setInterval(updateClock, 1000);

  updateStatus();
  renderChat();
  renderMemories();
  renderNotes();
  updateVoiceButton();
  setupSpeechRecognition();
  diagnostics();

  $("#systemStatus").textContent = "SYSTEM READY";
  $("#coreState").textContent = "STANDBY";
});

/* ======================================
   SAFE LOCAL STORAGE
   ====================================== */

function load(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    setFeedback(
      "Storage unavailable or full. Check browser storage.",
      true
    );
  }
}

function updateClock() {
  $("#clock").textContent =
    new Date().toLocaleTimeString("en-IN", {
      hour12: false
    });
}

/* ======================================
   STATUS
   ====================================== */

function updateStatus() {
  $("#networkStatus").textContent =
    navigator.onLine ? "ONLINE" : "OFFLINE";

  $("#aiStatus").textContent =
    localStorage.getItem(KEYS.api)
      ? "KEY SAVED"
      : "NOT CONNECTED";

  $("#memoryStatus").textContent =
    memories.length + " ITEMS";

  $("#systemStatus").textContent =
    navigator.onLine ? "SYSTEM READY" : "NO NETWORK";
}

function setFeedback(message, error = false) {
  const element = $("#keyMessage");
  element.textContent = message;
  element.style.color = error ? "#ff8397" : "#52ffb8";
}

function setCoreState(state) {
  $("#coreState").textContent = state;
}

/* ======================================
   API KEY
   ====================================== */

function saveApiKey(event) {
  event.preventDefault();

  const key = $("#apiKey").value.trim();

  if (!key) {
    setFeedback("Please enter your Gemini API key.", true);
    return;
  }

  localStorage.setItem(KEYS.api, key);
  $("#apiKey").value = "";

  updateStatus();

  setFeedback(
    "Key saved locally. Press TEST CONNECTION to check API access."
  );
}

function removeApiKey() {
  localStorage.removeItem(KEYS.api);
  updateStatus();

  setFeedback("API key removed from this browser.");
}

async function testAI() {
  const key = localStorage.getItem(KEYS.api);

  if (!key) {
    setFeedback("Save your Gemini API key first.", true);
    return;
  }

  $("#testAI").disabled = true;
  setFeedback("Testing Gemini connection...");
  setCoreState("CONNECTING");

  try {
    const reply = await askGemini(
      "Reply with exactly: JARVIS CONNECTION SUCCESS",
      key
    );

    setFeedback("Connection successful: " + reply);
    setCoreState("ONLINE");
  } catch (error) {
    setFeedback(error.message, true);
    setCoreState("ERROR");
  } finally {
    $("#testAI").disabled = false;
    updateStatus();
  }
}

/* ======================================
   GEMINI INTERACTIONS API
   ====================================== */

async function askGemini(prompt, apiKey) {
  if (!navigator.onLine) {
    throw new Error("Your device is offline.");
  }

  const recentHistory = history
    .slice(-12)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      text: item.text
    }));

  const memoryText = memories
    .map((item) => "- " + item.text)
    .join("\n");

  const noteText = notes
    .map((item) => "- " + item.text)
    .join("\n");

  const input = [
    {
      role: "user",
      content:
        "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
        "Address the user as Boss when appropriate. " +
        "Be accurate, concise, and honest. " +
        "You cannot directly control the Android operating system. " +
        "Never claim that a device action succeeded unless it did.\n\n" +
        "Saved user memories:\n" +
        (memoryText || "No saved memories.") +
        "\n\nSaved notes:\n" +
        (noteText || "No saved notes.") +
        "\n\nUse the following conversation for context."
    },
    ...recentHistory.map((item) => ({
      role: item.role,
      content: item.text
    })),
    {
      role: "user",
      content: prompt
    }
  ];

  let response;

  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model: MODEL,
        input,
        store: false
      })
    });
  } catch (error) {
    throw new Error(
      "Network request failed. Check internet, browser access, " +
      "and the API endpoint. " + (error.message || "")
    );
  }

  const raw = await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "The API returned an unreadable response (HTTP " +
      response.status + ")."
    );
  }

  if (!response.ok) {
    throw new Error(
      "Gemini HTTP " + response.status + ": " +
      (data.error?.message || raw.slice(0, 250))
    );
  }

  if (data.status === "failed") {
    throw new Error(
      "Gemini interaction failed. Check model access and API settings."
    );
  }

  if (
    typeof data.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const texts = [];

  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (
        step.type === "model_output" &&
        Array.isArray(step.content)
      ) {
        for (const part of step.content) {
          if (part.type === "text" && part.text) {
            texts.push(part.text);
          }
        }
      }
    }
  }

  if (texts.length) {
    return texts.join("\n").trim();
  }

  if (Array.isArray(data.output)) {
    for (const part of data.output) {
      if (part.type === "text" && part.text) {
        texts.push(part.text);
      }
    }
  }

  if (texts.length) {
    return texts.join("\n").trim();
  }

  throw new Error(
    "API responded without text. Check the model response format."
  );
}

/* ======================================
   CHAT
   ====================================== */

async function sendMessage(event) {
  event.preventDefault();

  const input = $("#messageInput");
  const message = input.value.trim();

  if (!message || busy) return;

  input.value = "";

  await processMessage(message);
}

async function processMessage(message) {
  if (busy || !message.trim()) return;

  addChatMessage("user", message);

  const local = await runLocalCommand(message);

  if (local !== null) {
    addChatMessage("assistant", local);
    speak(local);
    return;
  }

  const key = localStorage.getItem(KEYS.api);

  if (!key) {
    addChatMessage(
      "assistant",
      "Boss, please save your Gemini API key in AI CONNECTION first."
    );
    setFeedback("API key required.", true);
    return;
  }

  busy = true;

  $("#sendButton").disabled = true;
  $("#micButton").disabled = true;

  setCoreState("THINKING");
  $("#systemStatus").textContent = "AI PROCESSING";

  try {
    const answer = await askGemini(message, key);

    addChatMessage("assistant", answer);
    speak(answer);

    setFeedback("AI response received.");
  } catch (error) {
    console.error("JARVIS AI error:", error);

    const errorText =
      "AI connection failed: " + error.message;

    addChatMessage("assistant", errorText);
    setFeedback(error.message, true);
  } finally {
    busy = false;

    $("#sendButton").disabled = false;
    $("#micButton").disabled = false;

    setCoreState("STANDBY");
    updateStatus();
  }
}

function addChatMessage(role, text) {
  history.push({
    role,
    text,
    time: Date.now()
  });

  history = history.slice(-80);

  store(KEYS.history, history);
  renderChat();
}

function renderChat() {
  const container = $("#chatMessages");
  container.replaceChildren();

  history.forEach((item) => {
    const message = document.createElement("div");

    message.className =
      "message " +
      (item.role === "user"
        ? "user-message"
        : "assistant-message");

    const label = document.createElement("span");
    label.className = "message-label";

    label.textContent =
      item.role === "user" ? "BOSS" : "J.A.R.V.I.S";

    const content = document.createElement("div");
    content.textContent = item.text;

    message.append(label, content);
    container.appendChild(message);
  });

  container.scrollTop = container.scrollHeight;
}

function clearChat() {
  if (!confirm("Clear all chat history?")) return;

  history = [];
  store(KEYS.history, history);
  renderChat();
}

/* ======================================
   LOCAL COMMANDS
   ====================================== */

async function runLocalCommand(message) {
  const text = message.trim().toLowerCase();

  if (text === "help" || text === "commands") {
    return [
      "Available commands, Boss:",
      "• Open YouTube",
      "• Open Google",
      "• Open Instagram",
      "• Open WhatsApp",
      "• System diagnostics",
      "• What do you remember?",
      "• Show my notes",
      "• Save a note: your text",
      "• Remember: your preference"
    ].join("\n");
  }

  if (
    text === "system diagnostics" ||
    text === "system status" ||
    text === "status report"
  ) {
    return [
      "SYSTEM DIAGNOSTICS",
      "Network: " + (navigator.onLine ? "Online" : "Offline"),
      "AI key: " +
        (localStorage.getItem(KEYS.api) ? "Saved" : "Missing"),
      "Saved memories: " + memories.length,
      "Saved notes: " + notes.length,
      "Voice synthesis: " +
        ("speechSynthesis" in window ? "Available" : "Unavailable"),
      "Voice recognition: " +
        ((window.SpeechRecognition ||
          window.webkitSpeechRecognition)
          ? "Available"
          : "Unavailable")
    ].join("\n");
  }

  if (
    text === "what do you remember?" ||
    text === "show my memories"
  ) {
    return memories.length
      ? memories.map((item, i) => `${i + 1}. ${item.text}`).join("\n")
      : "No saved memories yet, Boss.";
  }

  if (text === "show my notes" || text === "list notes") {
    return notes.length
      ? notes.map((item, i) => `${i + 1}. ${item.text}`).join("\n")
      : "You have no saved notes.";
  }

  if (text.startsWith("remember:")) {
    const value = message.slice(message.indexOf(":") + 1).trim();

    if (!value) return "Tell me what you want me to remember.";

    addMemory(value);
    return "Memory saved on this device, Boss.";
  }

  if (text.startsWith("save a note:")) {
    const value = message.slice(message.indexOf(":") + 1).trim();

    if (!value) return "Please provide the note text.";

    addNote(value);
    return "Note saved on this device, Boss.";
  }

  if (text === "clear my notes") {
    notes = [];
    store(KEYS.notes, notes);
    renderNotes();

    return "All notes cleared.";
  }

  if (text === "clear my memories") {
    memories = [];
    store(KEYS.memories, memories);
    renderMemories();
    updateStatus();

    return "All saved memories cleared.";
  }

  if (
    text === "hello jarvis" ||
    text === "hi jarvis" ||
    text === "hello"
  ) {
    return "Systems online, Boss. J.A.R.V.I.S is standing by.";
  }

  const websites = {
    "open youtube": "youtube",
    "open google": "google",
    "open instagram": "instagram",
    "open whatsapp": "whatsapp"
  };

  if (websites[text]) {
    openWebsite(websites[text]);
    return "Opening " + websites[text] + ", Boss.";
  }

  return null;
}

function openWebsite(name) {
  const urls = {
    youtube: "https://www.youtube.com/",
    google: "https://www.google.com/",
    instagram: "https://www.instagram.com/",
    whatsapp: "https://www.whatsapp.com/"
  };

  if (!urls[name]) return;

  window.open(urls[name], "_blank", "noopener,noreferrer");
}

/* ======================================
   MEMORY
   ====================================== */

function addMemory(text) {
  memories.push({
    text,
    time: Date.now()
  });

  memories = memories.slice(-50);

  store(KEYS.memories, memories);
  renderMemories();
  updateStatus();
}

function saveMemory(event) {
  event.preventDefault();

  const input = $("#memoryInput");
  const text = input.value.trim();

  if (!text) return;

  addMemory(text);
  input.value = "";
  setFeedback("Memory saved locally.");
}

function renderMemories() {
  const container = $("#memoryList");
  container.replaceChildren();

  memories.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "memory-item";

    const content = document.createElement("span");
    content.textContent = item.text;

    const button = document.createElement("button");
    button.className = "delete-item";
    button.textContent = "DELETE";
    button.type = "button";

    button.addEventListener("click", () => {
      memories.splice(index, 1);

      store(KEYS.memories, memories);
      renderMemories();
      updateStatus();
    });

    row.append(content, button);
    container.appendChild(row);
  });
}

function clearMemories() {
  if (!confirm("Delete all saved memories?")) return;

  memories = [];

  store(KEYS.memories, memories);
  renderMemories();
  updateStatus();
}

/* ======================================
   NOTES
   ====================================== */

function addNote(text) {
  notes.push({
    text,
    time: Date.now()
  });

  notes = notes.slice(-100);

  store(KEYS.notes, notes);
  renderNotes();
}

function saveNote(event) {
  event.preventDefault();

  const input = $("#noteInput");
  const text = input.value.trim();

  if (!text) return;

  addNote(text);
  input.value = "";
  setFeedback("Note saved locally.");
}

function renderNotes() {
  const container = $("#notesList");
  container.replaceChildren();

  notes.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "note-item";

    const content = document.createElement("span");
    content.textContent = item.text;

    const button = document.createElement("button");
    button.className = "delete-item";
    button.textContent = "DELETE";
    button.type = "button";

    button.addEventListener("click", () => {
      notes.splice(index, 1);

      store(KEYS.notes, notes);
      renderNotes();
    });

    row.append(content, button);
    container.appendChild(row);
  });
}

/* ======================================
   SPEECH RECOGNITION
   ====================================== */

function setupSpeechRecognition() {
  const SpeechAPI =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechAPI) {
    $("#voiceStatus").textContent = "NOT SUPPORTED";
    return;
  }

  recognition = new SpeechAPI();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    listening = true;
    $("#voiceStatus").textContent = "LISTENING";
    setCoreState("LISTENING");
  };

  recognition.onresult = (event) => {
    const text =
      event.results?.[0]?.[0]?.transcript?.trim();

    if (text) {
      $("#messageInput").value = text;
      processMessage(text);
    }
  };

  recognition.onerror = (event) => {
    setFeedback("Voice error: " + event.error, true);
  };

  recognition.onend = () => {
    listening = false;
    $("#voiceStatus").textContent = "STANDBY";
    setCoreState("STANDBY");
  };
}

function toggleMic() {
  if (!recognition) {
    setFeedback(
      "Voice input is not supported in this browser.",
      true
    );
    return;
  }

  try {
    if (listening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  } catch (error) {
    setFeedback("Could not start microphone: " + error.message, true);
  }
}

/* ======================================
   TEXT-TO-SPEECH
   ====================================== */

function toggleVoice() {
  voiceEnabled = !voiceEnabled;

  localStorage.setItem(
    KEYS.voice,
    String(voiceEnabled)
  );

  updateVoiceButton();

  if (!voiceEnabled && "speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

function updateVoiceButton() {
  $("#speakToggle").textContent =
    voiceEnabled ? "VOICE: ON" : "VOICE: OFF";

  $("#voiceStatus").textContent =
    voiceEnabled ? "ENABLED" : "MUTED";
}

function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) {
    return;
  }

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 0.95;

  speechSynthesis.speak(utterance);
}

/* ======================================
   DIAGNOSTICS
   ====================================== */

function diagnostics() {
  const rows = [
    ["Internet", navigator.onLine ? "ONLINE" : "OFFLINE"],
    [
      "Gemini key",
      localStorage.getItem(KEYS.api) ? "SAVED" : "MISSING"
    ],
    ["Memory items", String(memories.length)],
    ["Notes", String(notes.length)],
    [
      "Voice input",
      (window.SpeechRecognition ||
        window.webkitSpeechRecognition)
        ? "SUPPORTED"
        : "UNSUPPORTED"
    ],
    [
      "Voice output",
      "speechSynthesis" in window ? "SUPPORTED" : "UNSUPPORTED"
    ],
    ["Browser", navigator.userAgent]
  ];

  const container = $("#diagnostics");
  container.replaceChildren();

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "diagnostic-row";

    const left = document.createElement("span");
    left.textContent = label;

    const right = document.createElement("span");
    right.textContent = value;

    row.append(left, right);
    container.appendChild(row);
  });

  updateStatus();
}
