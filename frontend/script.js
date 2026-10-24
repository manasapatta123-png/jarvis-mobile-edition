// ===== 3. TOOLS (THE HANDS) =====

async function handleTools(text) {
    const t = text.toLowerCase().trim();

    // 1. TIME
    if (/\btime\b/.test(t) || t.includes("current time")) {
        return `The time is ${new Date().toLocaleTimeString()}, Boss.`;
    }

    // 2. WEATHER
    if (t.includes("weather")) {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve("Location is not supported, Boss.");
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;

                        const url =
                            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`;

                        const response = await fetch(url);

                        if (!response.ok) {
                            throw new Error("Weather request failed");
                        }

                        const data = await response.json();
                        const temperature =
                            data.current.temperature_2m;

                        resolve(
                            `It is ${temperature} degrees Celsius now, Boss.`
                        );
                    } catch (error) {
                        resolve("Weather service error, Boss.");
                    }
                },
                () => {
                    resolve(
                        "I need location permission to check the weather, Boss."
                    );
                },
                { timeout: 10000 }
            );
        });
    }

    // 3. TIMER
    const match = t.match(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/
    );

    if (t.includes("timer") && match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2];

        let factor = 60000;

        if (/^(hour|hours|hr|hrs)$/.test(unit)) {
            factor = 3600000;
        } else if (/^(second|seconds|sec|secs)$/.test(unit)) {
            factor = 1000;
        }

        const duration = amount * factor;

        setTimeout(() => {
            const message =
                `Your ${amount} ${unit} timer is complete, Boss.`;

            if (typeof speak === "function") {
                speak(message);
            } else {
                alert(message);
            }
        }, duration);

        return `Timer set for ${amount} ${unit}, Boss.`;
    }

    // 4. ENGLISH TO TELUGU TRANSLATION
    if (t.startsWith("translate")) {
        const query = text
            .replace(/^translate\s+(this\s+)?/i, "")
            .trim();

        if (!query) {
            return "Please tell me what to translate, Boss.";
        }

        try {
            const url =
                "https://api.mymemory.translated.net/get?q=" +
                encodeURIComponent(query) +
                "&langpair=en|te";

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("Translation request failed");
            }

            const data = await response.json();

            return "In Telugu: " +
                data.responseData.translatedText;
        } catch (error) {
            return "Translation error, Boss.";
        }
    }

    // 5. YOUTUBE SEARCH
    if (t.includes("youtube") || t.startsWith("play ")) {
        const query = text
            .replace(/^play\s+(on\s+)?youtube\s*/i, "")
            .replace(/^youtube\s*/i, "")
            .trim();

        if (query) {
            window.open(
                "https://www.youtube.com/results?search_query=" +
                encodeURIComponent(query),
                "_blank"
            );

            return `Searching YouTube for ${query}, Boss.`;
        }

        window.open("https://www.youtube.com/", "_blank");
        return "Opening YouTube, Boss.";
    }

    // No tool matched — let Gemini handle the message
    return null;
}
