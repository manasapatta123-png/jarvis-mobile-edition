// ===== J.A.R.V.I.S GEMINI 3.6 FLASH =====

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
  API_KEY = prompt("Enter your Gemini API Key:");
  if (API_KEY) {
    API_KEY = API_KEY.trim();
    localStorage.setItem("jarvis_key", API_KEY);
  }
}

// Requested model
const MODEL = "gemini-3.6-flash";

// Display messages
function add(text, who = "ai") {
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

// Connect to Gemini
async function callGemini(promptText) {
  if (!API_KEY) {
    throw new Error("API key missing. Refresh the page and enter it.");
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
          role: "user",
          parts: [{ text: promptText }]
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || "HTTP error " + response.status
    );
  }

  const reply = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("");

  if (!reply) {
    throw new Error("Gemini returned no response.");
  }

  return reply;
}

// Ask J.A.R.V.I.S
async function askGemini(text) {
  const loading = add("J.A.R.V.I.S: Thinking...", "ai");

  try {
    const reply = await callGemini(text);
    loading.innerText = "J.A.R.V.I.S: " + reply;
    speak(reply);
  } catch (error) {
    loading.innerText = "J.A.R.V.I.S ERROR: " + error.message;
  }
}

// Send message
function sendMessage() {
  const text = input.value.trim();

  if (!text) return;

  add("YOU: " + text, "user");
  input.value = "";
  sendBtn.disabled = true;

  askGemini(text).finally(() => {
    sendBtn.disabled = false;
  });
}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

// Text-to-speech
function speak(text) {
  if (!("speechSynthesis" in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  speechSynthesis.speak(utterance);
}

// Optional microphone support
const micBtn = document.getElementById("mic-btn");
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (micBtn && SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";

  micBtn.addEventListener("click", () => {
    recognition.start();
    micBtn.innerText = "LISTENING...";
  });

  recognition.onresult = event => {
    input.value = event.results[0][0].transcript;
    sendMessage();
  };

  recognition.onend = () => {
    micBtn.innerText = "🎙️";
  };

  recognition.onerror = () => {
    add("J.A.R.V.I.S: Microphone error. Check browser permission.", "ai");
  };
}

add("J.A.R.V.I.S: Ready, Boss. Gemini connection initialized.", "ai");
