const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const send = document.getElementById("send");

function add(text, who) {
  const d = document.createElement("div");
  d.className = "msg " + who;
  d.innerText = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  return d;
}

function speak(text) {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-IN";
    speechSynthesis.speak(speech);
  }
}

function getReply(text) {
  const msg = text.toLowerCase().trim();

  if (msg.includes("hello") || msg === "hi" || msg.includes("hey")) {
    return "Hello, Boss! All systems are ready. How can I help you?";
  }

  if (msg.includes("your name") || msg.includes("who are you")) {
    return "I am J.A.R.V.I.S., your mobile assistant.";
  }

  if (msg.includes("time")) {
    return "The current time is " +
      new Date().toLocaleTimeString("en-IN");
  }

  if (msg.includes("date") || msg.includes("today")) {
    return "Today's date is " +
      new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
  }

  if (msg.includes("how are you")) {
    return "All systems are functioning normally, Boss.";
  }

  if (msg.includes("thank")) {
    return "You're welcome, Boss!";
  }

  if (msg.includes("open youtube")) {
    window.open("https://www.youtube.com/", "_blank");
    return "Opening YouTube, Boss.";
  }

  if (msg.includes("open google")) {
    window.open("https://www.google.com/", "_blank");
    return "Opening Google, Boss.";
  }

  if (msg.includes("help")) {
    return "Try asking me the time, date, my name, or say open YouTube.";
  }

  return "I received your message, Boss. General AI answers require connecting an AI API.";
}

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  add("YOU: " + text, "user");
  input.value = "";

  const reply = add("J.A.R.V.I.S: Processing...", "ai");

  setTimeout(() => {
    const answer = getReply(text);
    reply.innerText = "J.A.R.V.I.S: " + answer;
    speak(answer);
  }, 400);
}

send.addEventListener("click", sendMessage);

input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});
