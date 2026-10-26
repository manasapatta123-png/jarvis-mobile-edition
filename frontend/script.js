// J.A.R.V.I.S — Free Mobile Edition
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const send = document.getElementById("send");

if (chat && input && send) {
  // Load saved chat
  let history = [];

  try {
    history = JSON.parse(
      localStorage.getItem("jarvis_chat") || "[]"
    );
  } catch (error) {
    history = [];
  }

  function add(text, who) {
    const d = document.createElement("div");
    d.className = "msg " + who;
    d.textContent = text;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
  }

  function saveHistory() {
    try {
      localStorage.setItem(
        "jarvis_chat",
        JSON.stringify(history.slice(-30))
      );
    } catch (error) {
      console.log("Chat could not be saved.");
    }
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const message = new SpeechSynthesisUtterance(text);
    message.lang = "en-IN";
    message.rate = 1;
    window.speechSynthesis.speak(message);
  }

  function remember(text) {
    try {
      const memories = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
      );

      memories.push(text);

      localStorage.setItem(
        "jarvis_memory",
        JSON.stringify(memories.slice(-50))
      );

      return "Saved to my memory, Boss.";
    } catch (error) {
      return "Sorry Boss, I could not save that.";
    }
  }

  function getMemory() {
    try {
      return JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
      );
    } catch (error) {
      return [];
    }
  }

  function reply(message) {
    const text = message.toLowerCase().trim();

    if (/^(hi|hello|hey)\b/.test(text)) {
      return "Hello Boss! J.A.R.V.I.S is online. How can I help you?";
    }

    if (text.includes("your name") || text.includes("who are you")) {
      return "I am J.A.R.V.I.S, your personal browser assistant.";
    }

    if (text.includes("time")) {
      return "The current time is " +
        new Date().toLocaleTimeString();
    }

    if (text.includes("date") || text.includes("today")) {
      return "Today's date is " +
        new Date().toLocaleDateString();
    }

    if (text.includes("remember")) {
      const item = message
        .replace(/remember/ig, "")
        .replace(/\bthis\b/ig, "")
        .trim();

      if (!item) {
        return "Boss, type: remember my favourite colour is blue";
      }

      return remember(item);
    }

    if (
      text.includes("what do you remember") ||
      text.includes("show memory")
    ) {
      const memories = getMemory();

      return memories.length
        ? "Here is what I remember:\n" + memories.join("\n")
        : "My memory is empty, Boss.";
    }

    if (text.includes("clear memory")) {
      localStorage.removeItem("jarvis_memory");
      return "Saved memory cleared, Boss.";
    }

    if (text.includes("youtube")) {
      window.open(
        "https://www.youtube.com/",
        "_blank"
      );
      return "Opening YouTube, Boss.";
    }

    if (text.includes("google")) {
      window.open(
        "https://www.google.com/",
        "_blank"
      );
      return "Opening Google, Boss.";
    }

    if (text.includes("instagram")) {
      window.open(
        "https://www.instagram.com/",
        "_blank"
      );
      return "Opening Instagram, Boss.";
    }

    if (text.includes("whatsapp")) {
      window.open(
        "https://web.whatsapp.com/",
        "_blank"
      );
      return "Opening WhatsApp Web, Boss.";
    }

    if (text.includes("search")) {
      const query = message.replace(/search/ig, "").trim();

      if (query) {
        window.open(
          "https://www.google.com/search?q=" +
          encodeURIComponent(query),
          "_blank"
        );

        return "Searching Google for " + query;
      }
    }

    if (text.includes("weather")) {
      window.open(
        "https://www.google.com/search?q=weather+today",
        "_blank"
      );
      return "Opening today's weather information.";
    }

    if (text.includes("help") || text.includes("commands")) {
      return "Available commands:\n" +
        "• What time is it?\n" +
        "• What is today's date?\n" +
        "• Open YouTube\n" +
        "• Open Google\n" +
        "• Open Instagram\n" +
        "• Open WhatsApp\n" +
        "• Search cricket news\n" +
        "• Remember my favourite colour is blue\n" +
        "• Show memory\n" +
        "• Clear memory";
    }

    if (text.includes("how are you")) {
      return "All systems are ready, Boss!";
    }

    if (text.includes("thank")) {
      return "You're welcome, Boss!";
    }

    return "Boss, I received your message. I can perform my built-in commands, but advanced AI answers need an AI service.";
  }

  function sendMessage() {
    const message = input.value.trim();

    if (!message) return;

    add("YOU: " + message, "user");

    history.push({
      role: "user",
      text: message
    });

    input.value = "";
    send.disabled = true;

    setTimeout(() => {
      const answer = reply(message);

      add("J.A.R.V.I.S: " + answer, "ai");

      history.push({
        role: "ai",
        text: answer
      });

      saveHistory();
      send.disabled = false;
      input.focus();
    }, 250);
  }

  // Display previously saved chat
  history.forEach(item => {
    add(
      (item.role === "user" ? "YOU: " : "J.A.R.V.I.S: ") +
      item.text,
      item.role === "user" ? "user" : "ai"
    );
  });

  send.addEventListener("click", sendMessage);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });

  // Voice input
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const mic = document.createElement("button");
    mic.textContent = "🎤 MIC";
    mic.type = "button";
    mic.style.marginTop = "10px";
    send.parentElement.insertAdjacentElement("afterend", mic);

    mic.addEventListener("click", () => {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.interimResults = false;

      recognition.onresult = event => {
        input.value =
          event.results[0][0].transcript;
        sendMessage();
      };

      recognition.onerror = () => {
        add(
          "J.A.R.V.I.S: Voice recognition failed. Check microphone permission.",
          "ai"
        );
      };

      recognition.start();
    });
  }

  // Clear conversation
  const clear = document.createElement("button");
  clear.textContent = "CLEAR CHAT";
  clear.type = "button";
  clear.style.marginTop = "10px";
  chat.parentElement.insertAdjacentElement("afterend", clear);

  clear.addEventListener("click", () => {
    chat.replaceChildren();
    history = [];
    localStorage.removeItem("jarvis_chat");
  });

  if (!history.length) {
    add(
      "J.A.R.V.I.S: Systems online. Type HELP to see my commands, Boss.",
      "ai"
    );
  }
      }
