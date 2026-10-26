// ===== J.A.R.V.I.S GEMINI AI =====

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");

// Gemini API key
let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
  API_KEY = prompt("Enter your Gemini API Key:");
  if (API_KEY) {
    localStorage.setItem("jarvis_key", API_KEY.trim());
    API_KEY = API_KEY.trim();
  }
}

// Supported model
const MODEL = "gemini-flash-latest";

// Add message to chat
function add(text, who = "ai") {
  const d = document.createElement("div");
  d.className = "msg " + (who === "user" ? "user" : "ai");
  d.innerText = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  return d;
}

// Ask Gemini
async function callGemini(promptText) {
  if (!API_KEY) {
    throw new Error("API key missing. Refresh and enter your key.");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    MODEL +
    ":generateContent?key=" +
    encodeURIComponent(API_KEY);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || "Gemini request failed: " + response.status
    );
  }

  const reply = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("");

  if (!reply) {
    throw new Error("Gemini returned no text. Try again.");
  }

  return reply;
}

// Send message to AI
async function askGemini(text) {
  const thinking = add("J.A.R.V.I.S: Thinking...", "ai");

  try {
    const reply = await callGemini(text);
    thinking.innerText = "J.A.R.V.I.S: " + reply;
    speak(reply);
  } catch (error) {
    thinking.innerText = "J.A.R.V.I.S ERROR: " + error.message;
  }
}

// Send button
function sendMessage() {
  const text = input.value.trim();

  if (!text) return;

  add("YOU: " + text, "user");
  input.value = "";
  askGemini(text);
}

sendBtn.addEventListener("click", sendMessage);

// Enter key also sends message
input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

// ===== TEXT TO SPEECH =====

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

// ===== VOICE RECOGNITION =====

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const micBtn = document.getElementById("mic-btn");

  if (micBtn) {
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    micBtn.addEventListener("click", function () {
      recognition.start();
      micBtn.innerText = "LISTENING...";
    });

    recognition.onresult = function (event) {
      const text = event.results[0][0].transcript;
      input.value = text;
      sendMessage();
    };

    recognition.onerror = function () {
      add("J.A.R.V.I.S: Voice recognition failed. Try again.", "ai");
    };

    recognition.onend = function () {
      micBtn.innerText = "🎙️";
    };
  }
}

add("J.A.R.V.I.S: AI interface ready, Boss.", "ai");
