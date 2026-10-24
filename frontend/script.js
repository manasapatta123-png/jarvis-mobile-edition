// ========================================
// J.A.R.V.I.S ADVANCED MOBILE ASSISTANT
// Voice + AI + Memory + Local Commands
// ========================================

const $ = id => document.getElementById(id);

const chat = $("chat");
const input = $("message");
const statusText = $("status");
const aiStatus = $("aiStatus");
const voiceStatus = $("voiceStatus");

let recognition = null;
let listening = false;

let notes = JSON.parse(
  localStorage.getItem("jarvisNotes") || "[]"
);

let history = JSON.parse(
  localStorage.getItem("jarvisHistory") || "[]"
);

// For personal testing only.
// Do not publish your API key in public JavaScript files.
let apiKey = "";

const savedKey = localStorage.getItem("jarvisApiKey");
if (savedKey) {
  apiKey = savedKey;
  $("apiKey").value = savedKey;
}

// Check the current Gemini model list in official documentation
// if the model configured below is unavailable.
const MODEL = "gemini-2.5-flash";

// ----------------------------------------
// MESSAGES
// ----------------------------------------

function addMessage(type, text) {
  const box = document.createElement("div");
  box.className = "message " + type;

  const title = document.createElement("b");
  title.textContent = type === "user" ? "YOU" : "J.A.R.V.I.S";

  const body = document.createElement("p");
  body.textContent = text;

  box.append(title, body);
  chat.appendChild(box);
  chat.scrollTop = chat.scrollHeight;
}

function setStatus(text) {
  statusText.textContent = text;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 0.95;

  speechSynthesis.speak(utterance);
}

function reply(text, shouldSpeak = true) {
  addMessage("jarvis", text);
  setStatus("SYSTEM READY");

  if (shouldSpeak) speak(text);
}

function saveHistory() {
  localStorage.setItem(
    "jarvisHistory",
    JSON.stringify(history.slice(-24))
  );
}

// ----------------------------------------
// API KEY
// ----------------------------------------

$("saveKey").addEventListener("click", () => {
  const key = $("apiKey").value.trim();

  if (!key) {
    reply("Please enter your API key first.");
    return;
  }

  apiKey = key;
  localStorage.setItem("jarvisApiKey", key);

  reply(
    "API key saved in this browser. Remember, browser storage " +
    "is not secure for secrets. Do not publish this project publicly."
  );
});

// ----------------------------------------
// CALCULATOR
// ----------------------------------------

function calculate(expression) {
  const value = expression.replace(/\s/g, "");

  if (!/^[0-9+\-*/().%]+$/.test(value)) {
    return null;
  }

  try {
    const result = Function(
      '"use strict"; return (' + value + ')'
    )();

    return Number.isFinite(result) ? String(result) : null;
  } catch {
    return null;
  }
}

// ----------------------------------------
// GOOGLE AND YOUTUBE
// ----------------------------------------

function googleSearch(query) {
  window.open(
    "https://www.google.com/search?q=" +
      encodeURIComponent(query || ""),
    "_blank"
  );
}

function youtubeSearch(query) {
  window.open(
    "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query || ""),
    "_blank"
  );
}

// ----------------------------------------
// LOCAL COMMANDS
// ----------------------------------------

function runLocalCommand(command) {
  const text = command.toLowerCase().trim();

  if (/^(hi|hello|hey)\b/.test(text)) {
    reply("Hello Boss. All systems online.");
    return true;
  }

  if (text.includes("time")) {
    reply("The time is " + new Date().toLocaleTimeString("en-IN"));
    return true;
  }

  if (text.includes("date") || text.includes("today")) {
    reply("Today's date is " +
      new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    );
    return true;
  }

  if (text.startsWith("calculate ")) {
    const result = calculate(command.slice(10));

    reply(result === null
      ? "I could not calculate that. Try: Calculate 25 * 4."
      : "The answer is " + result
    );

    return true;
  }

  if (text === "open google" || text === "google") {
    googleSearch("");
    reply("Opening Google, Boss.");
    return true;
  }

  if (text.startsWith("search ")) {
    googleSearch(command.slice(7));
    reply("Searching the web, Boss.");
    return true;
  }

  if (text === "open youtube" || text === "youtube") {
    youtubeSearch("");
    reply("Opening YouTube, Boss.");
    return true;
  }

  if (text.startsWith("search youtube ")) {
    youtubeSearch(command.slice(15));
    reply("Searching YouTube, Boss.");
    return true;
  }

  if (text.startsWith("remember ")) {
    notes.push(command.slice(9));
    localStorage.setItem("jarvisNotes", JSON.stringify(notes));
    reply("Memory updated, Boss.");
    return true;
  }

  if (text.includes("show notes")) {
    reply(notes.length
      ? notes.map((note, i) => `${i + 1}. ${note}`).join("\n")
      : "No notes saved yet."
    );
    return true;
  }

  if (text.includes("clear notes")) {
    notes = [];
    localStorage.setItem("jarvisNotes", "[]");
    reply("All notes cleared.");
    return true;
  }

  if (text === "clear chat") {
    history = [];
    saveHistory();
    chat.replaceChildren();
    reply("Chat cleared.");
    return true;
  }

  if (text === "help" || text.includes("commands")) {
    reply(
      "Try these commands: What time is it? What is today's date? " +
      "Open Google. Search cats. Open YouTube. " +
      "Calculate 25 * 4. Remember buy a notebook. Show notes."
    );
    return true;
  }

  return false;
}

// ----------------------------------------
// GEMINI AI
// ----------------------------------------

async function askAI(userText) {
  if (!apiKey) {
    reply(
      "My AI brain is not connected yet, Boss. Add a Gemini API key " +
      "in AI Configuration. Local commands still work without AI."
    );
    return;
  }

  aiStatus.textContent = "THINKING";
  setStatus("AI PROCESSING...");

  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      MODEL + ":generateContent";

    const contents = [
      ...history.slice(-20).map(item => ({
        role: item.role,
        parts: [{ text: item.text }]
      })),
      {
        role: "user",
        parts: [{ text: userText }]
      }
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              "You are JARVIS, a helpful futuristic AI assistant. " +
              "Address the user as Boss. Be accurate, safe, and clear. " +
              "Never claim you performed a phone action unless you did."
          }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message || "API error " + response.status
      );
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      throw new Error("No answer received from AI.");
    }

    history.push(
      { role: "user", text: userText },
      { role: "model", text: answer }
    );

    history = history.slice(-24);
    saveHistory();

    aiStatus.textContent = "CONNECTED";
    reply(answer);

  } catch (error) {
    console.error(error);
    aiStatus.textContent = "ERROR";

    reply(
      "AI connection failed. Check your internet, API key, API access " +
      "and model availability. Error: " + error.message
    );
  }
}

// ----------------------------------------
// COMMAND ROUTER
// ----------------------------------------

async function runCommand(command) {
  const text = command.trim();

  if (!text) return;

  addMessage("user", text);
  input.value = "";

  if (runLocalCommand(text)) return;

  await askAI(text);
}

// ----------------------------------------
// TEXT INPUT
// ----------------------------------------

$("chatForm").addEventListener("submit", event => {
  event.preventDefault();
  runCommand(input.value);
});

// ----------------------------------------
// QUICK COMMANDS
// ----------------------------------------

document.querySelectorAll("[data-command]").forEach(button => {
  button.addEventListener("click", () => {
    runCommand(button.dataset.command);
  });
});

// ----------------------------------------
// VOICE INPUT
// ----------------------------------------

$("mic").addEventListener("click", () => {
  const SpeechAPI =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechAPI) {
    reply(
      "Voice recognition is unavailable in this browser. " +
      "Try Chrome and allow microphone access."
    );
    return;
  }

  if (listening && recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechAPI();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    voiceStatus.textContent = "LISTENING";
    setStatus("LISTENING, BOSS...");
  };

  recognition.onresult = event => {
    const spoken = event.results[0][0].transcript;
    input.value = spoken;
    runCommand(spoken);
  };

  recognition.onerror = event => {
    setStatus("VOICE ERROR: " + event.error);
  };

  recognition.onend = () => {
    listening = false;
    voiceStatus.textContent = "STANDBY";
  };

  recognition.start();
});

// ----------------------------------------
// STOP VOICE
// ----------------------------------------

$("stopVoice").addEventListener("click", () => {
  if (recognition) recognition.stop();

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }

  setStatus("VOICE STOPPED");
  voiceStatus.textContent = "STANDBY";
});

// ----------------------------------------
// CORE BUTTON
// ----------------------------------------

$("core").addEventListener("click", () => {
  reply("All systems online, Boss. How may I assist you?");
});

// ----------------------------------------
// CLEAR CHAT
// ----------------------------------------

$("clearChat").addEventListener("click", () => {
  history = [];
  saveHistory();

  chat.replaceChildren();

  reply("Conversation cleared.");
});

// ----------------------------------------
// STARTUP
// ----------------------------------------

aiStatus.textContent = apiKey ? "CONFIGURED" : "LOCAL MODE";
setStatus("SYSTEM ONLINE");

console.log("J.A.R.V.I.S initialized.");
