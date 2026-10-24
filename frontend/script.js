async function askGemini(command) {
  const apiKey =
    document.getElementById("apiKey").value.trim() ||
    localStorage.getItem("jarvis_gemini_key") ||
    "";

  if (!apiKey) {
    throw new Error(
      "Gemini API key missing. Enter your key in AI Configuration."
    );
  }

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/interactions";

  const previousMessages = conversation
    .slice(-12, -1)
    .map(item => ({
      role: item.sender === "user" ? "user" : "assistant",
      text: item.text
    }));

  const historyText = previousMessages
    .map(item =>
      (item.role === "user" ? "User: " : "JARVIS: ") + item.text
    )
    .join("\n");

  const prompt = historyText
    ? historyText + "\nUser: " + command
    : command;

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model: "gemini-3.8-flash",
        input: prompt,
        system_instruction:
          "You are JARVIS, an intelligent and helpful personal AI assistant. " +
          "Address the user as Boss. Give clear, accurate answers. " +
          "Never claim you performed an action unless it actually happened."
      })
    });
  } catch (error) {
    throw new Error(
      "Network error. Check your internet connection and try again."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || "Unknown API error";

    if (response.status === 400) {
      throw new Error("Invalid API request: " + message);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "API key invalid, API access restricted, or model permission missing: " +
        message
      );
    }

    if (response.status === 404) {
      throw new Error(
        "Model or endpoint not found. Check current Gemini API model availability: " +
        message
      );
    }

    if (response.status === 429) {
      throw new Error(
        "API usage limit reached. Check your Gemini API quota: " + message
      );
    }

    throw new Error("Gemini API error: " + message);
  }

  const answer =
    data.output_text ||
    (data.steps || [])
      .filter(step => step.type === "model_output")
      .flatMap(step => step.content || [])
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("\n");

  if (!answer || !answer.trim()) {
    throw new Error(
      "Gemini returned no text. Please try another command."
    );
  }

  return answer.trim();
}
