"use strict";

const $ = (id) => document.getElementById(id);

const STORAGE = {
  key: "jarvis_gemini_key",
  chat: "jarvis_chat_history"
};

// Change this to a currently supported Gemini model if needed.
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  GEMINI_MODEL +
  ":generateContent";

let busy = false;
let recognition = null;
let conversation = [];

function setStatus(text) {
  $("status").textContent = text;
}

function addMessage(text, sender = "assistant", save = true) {
  const chat = $("chat");
  const message = document.createElement("div");
  message.className =
    "message " +
    (sender === "user" ? "user-message" : "assistant-message");

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = sender === "user" ? "BOSS" : "J.A.R.V.I.S";

  const body = document.createElement("p");
  body.textContent = text;

  message.append(label, body);
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;

  if (save) {
    conversation.push({ sender, text });
    conversation = conversation.slice(-40);

    try {
      localStorage.setItem(STORAGE.chat, JSON.stringify(conversation));
    } catch (error) {
      console.warn("Chat history could not be saved.", error);
    }
  }
}

function restoreChat() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.chat) || "[]");
    if (!Array.isArray(saved) || saved.length === 0) return;

    conversation = saved.slice(-40);
    $("chat").replaceChildren();

    conversation.forEach((item) => {
      if (item && typeof item.text === "string") {
        addMessage(item.text, item.sender, false);
      }
    });
  } catch (error) {
    console.warn("Could not restore chat.", error);
  }
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

function openWebsite(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function localCommand(command) {
  const text = command.trim();
  const lower = text.toLowerCase();

  if (/\b(hello|hi jarvis|hey jarvis)\b/.test(lower)) {
    return "Hello, Boss. J.A.R.V.I.S is ready.";
  }

  if (/\b(time|current time)\b/.test(lower)) {
    return "The time is " +
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit"
      });
  }

  if (/\b(today'?s date|what date|current date)\b/.test(lower)) {
    return "Today's date is " +
      new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
  }

  if (/\b(open|launch|go to)\s+youtube\b/.test(lower)) {
    openWebsite("https://www.youtube.com/");
    return "Opening YouTube, Boss.";
  }

  if (/\b(open|launch|go to)\s+google\b/.test(lower)) {
    openWebsite("https://www.google.com/");
    return "Opening Google, Boss.";
  }

  if (/\b(open|launch|go to)\s+instagram\b/.test(lower)) {
    openWebsite("https://www.instagram.com/");
    return "Opening Instagram, Boss.";
  }

  if (/\b(open|launch|go to)\s+whatsapp\b/.test(lower)) {
    openWebsite("https://wa.me/");
    return "Opening WhatsApp. You may need to sign in or choose the app.";
  }

  const googleSearch = text.match(
    /^(?:search(?: google)? for|google)\s+(.+)$/i
  );

  if (googleSearch) {
    openWebsite(
      "https://www.google.com/search?q=" +
      encodeURIComponent(googleSearch[1])
    );
    return "Searching Google for: " + googleSearch[1];
  }

  const youtubeSearch = text.match(
    /^(?:search youtube for|play|find on youtube)\s+(.+)$/i
  );

  if (youtubeSearch) {
    openWebsite(
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(youtubeSearch[1])
    );
    return "Searching YouTube for: " + youtubeSearch[1];
  }

  const whatsappMessage = text.match(
    /^message\s+(\+?\d{10,15})\s+(.+)$/i
  );

  if (whatsappMessage) {
    const number = whatsappMessage[1].replace(/\D/g, "");
    const message = whatsappMessage[2];

    openWebsite(
      "https://wa.me/" + number + "?text=" +
      encodeURIComponent(message)
    );

    return "I've prepared the WhatsApp message. Please check the recipient and tap Send yourself.";
  }

  if (/\b(tell me a joke|joke)\b/.test(lower)) {
    const jokes = [
      "Why did the computer go to the doctor? It had a virus!",
      "Why was the smartphone wearing glasses? It lost its contacts!",
      "Why do programmers prefer dark mode? Because light attracts bugs!"
    ];

    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  if (/\bwhat can you do\b/.test(lower)) {
    return "I can answer questions with Gemini AI, tell the time, search Google or YouTube, open supported websites, speak replies, and prepare WhatsApp messages when you provide a phone number. I cannot silently send messages or control every Android app.";
  }

  return null;
}

async function askGemini(command) {
  const apiKey = $("apiKey").value.trim() ||
    localStorage.getItem(STORAGE.key) ||
    "";

  if (!apiKey) {
    return "Gemini AI is not configured yet, Boss. Enter your API key in AI Configuration. Local commands still work.";
  }

  const recentMessages = conversation
    .slice(-12)
    .map((item) => ({
      role: item.sender === "user" ? "user" : "model",
      parts: [{ text: item.text }]
    }));

  // The current command is already included in conversation.
  const contents = recentMessages.filter(
    (item) => item.parts[0].text.trim().length > 0
  );

  const instructions =
    "You are J.A.R.V.I.S, a helpful personal AI assistant. " +
    "Address the user as Boss occasionally. Be clear, friendly, and concise. " +
    "Never claim you performed an action unless the application confirms it. " +
    "Explain limitations honestly.";

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: instructions }]
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 700
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiMessage =
      data?.error?.message || "Gemini API request failed.";

    if (response.status === 400 || response.status === 403) {
      throw new Error(
        "Gemini rejected the request or API key. Check the key, API access, billing requirements, and supported model. Details: " +
        apiMessage
      );
    }

    if (response.status === 404) {
      throw new Error(
        "The selected Gemini model may be unavailable. Check the currently supported model name. Details: " +
        apiMessage
      );
    }

    throw new Error(apiMessage);
  }

  const answer = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!answer) {
    throw new Error("Gemini returned no text. Please try again.");
  }

  return answer;
}

async function sendMessage(commandOverride = null) {
  if (busy) return;

  const input = $("msg");
  const command = (
    commandOverride === null ? input.value : commandOverride
  ).trim();

  if (!command) {
    input.focus();
    return;
  }

  input.value = "";
  addMessage(command, "user");
  busy = true;
  setStatus("THINKING");

  const sendButton = $("send");
  sendButton.disabled = true;
  sendButton.textContent = "...";

  try {
    const localReply = localCommand(command);
    const reply = localReply !== null
      ? localReply
      : await askGemini(command);

    addMessage(reply, "assistant");
    speak(reply);
  } catch (error) {
    console.error(error);

    const reply = "Sorry, Boss. " +
      (error.message || "Something went wrong.");

    addMessage(reply, "assistant");
  } finally {
    busy = false;
    setStatus("ONLINE");
    sendButton.disabled = false;
    sendButton.textContent = "SEND";
    input.focus();
  }
}

function setupVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    $("voice-status").textContent = "UNAVAILABLE";
    $("mic-btn").addEventListener("click", () => {
      addMessage(
        "Voice input is not supported in this browser. Try a supported browser and allow microphone permission.",
        "assistant"
      );
    });
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    $("voice-status").textContent = "LISTENING";
    setStatus("LISTENING");
  };

  recognition.onend = () => {
    $("voice-status").textContent = "STANDBY";
    setStatus("ONLINE");
  };

  recognition.onerror = (event) => {
    console.warn("Voice recognition error:", event.error);
    addMessage(
      "Voice input failed: " + event.error +
      ". Check microphone permission and internet connection.",
      "assistant"
    );
  };

  recognition.onresult = (event) => {
    const spokenText = event.results[0][0].transcript;
    $("msg").value = spokenText;
    sendMessage(spokenText);
  };

  $("mic-btn").addEventListener("click", () => {
    try {
      recognition.start();
    } catch (error) {
      console.warn(error);
    }
  });
}

function setupAPIKey() {
  const savedKey = localStorage.getItem(STORAGE.key);

  if (savedKey) {
    $("apiKey").value = savedKey;
    $("key-status").textContent =
      "An API key is saved in this browser.";
  }

  $("key-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const key = $("apiKey").value.trim();

    if (!key) {
      $("key-status").textContent = "Enter an API key first.";
      return;
    }

    try {
      localStorage.setItem(STORAGE.key, key);
      $("key-status").textContent =
        "API key saved in this browser.";
      addMessage(
        "API key saved locally. Test Gemini with a question, Boss.",
        "assistant"
      );
    } catch (error) {
      $("key-status").textContent =
        "Could not save the key in browser storage.";
    }
  });

  $("removeKey").addEventListener("click", () => {
    localStorage.removeItem(STORAGE.key);
    $("apiKey").value = "";
    $("key-status").textContent = "Saved API key removed.";
  });
}

function setupButtons() {
  $("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      sendMessage(button.dataset.command);
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const actions = {
        youtube: "https://www.youtube.com/",
        google: "https://www.google.com/",
        instagram: "https://www.instagram.com/",
        whatsapp: "https://wa.me/"
      };

      const url = actions[button.dataset.action];

      if (url) {
        openWebsite(url);
      }
    });
  });

  $("clear-btn").addEventListener("click", () => {
    conversation = [];
    localStorage.removeItem(STORAGE.chat);
    $("chat").replaceChildren();

    addMessage("Chat cleared, Boss. Ready for your next command.", "assistant");
  });
}

function initializeJarvis() {
  $("network-status").textContent = navigator.onLine
    ? "ONLINE"
    : "OFFLINE";

  window.addEventListener("online", () => {
    $("network-status").textContent = "ONLINE";
  });

  window.addEventListener("offline", () => {
    $("network-status").textContent = "OFFLINE";
  });

  restoreChat();
  setupButtons();
  setupVoice();
  setupAPIKey();
}

document.addEventListener("DOMContentLoaded", initializeJarvis);
