const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const chat = document.getElementById("chat");
const status = document.getElementById("status");

function addMessage(text, type) {
    const message = document.createElement("div");
    message.className = "message " + type;
    message.textContent = text;
    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
    const text = input.value.trim();

    if (!text) {
        input.focus();
        status.textContent = "PLEASE TYPE A MESSAGE";
        return;
    }

    addMessage(text, "user");
    input.value = "";
    status.textContent = "THINKING...";

    // Button పనిచేస్తుందో లేదో పరీక్షించడానికి
    addMessage("నీ message అందింది! SEND button పనిచేస్తోంది. AI connection ఇంకా configure చేయాలి.", "bot");
    status.textContent = "SYSTEM READY";
}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

console.log("JARVIS script loaded successfully!");
