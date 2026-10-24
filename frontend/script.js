// 3. TOOLS (THE HANDS)

// Main tool handler
async function handleTools(text) {
    const t = text.toLowerCase().trim();

    // 1. TIME
    if (/\btime\b/.test(t) || t.includes("current time")) {
        return "The time is " + new Date().toLocaleTimeString() + ", Boss.";
    }

    // 2. WEATHER
    if (t.includes("weather")) {
        return await new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve("Location is not supported on this browser, Boss.");
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const latitude = position.coords.latitude;
                        const longitude = position.coords.longitude;

                        const url =
                            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`;

                        const response = await fetch(url);

                        if (!response.ok) {
                            throw new Error("Weather request failed");
                        }

                        const data = await response.json();
                        const temperature = data.current.temperature_2m;

                        resolve(
                            `The current temperature is ${temperature} degrees Celsius, Boss.`
                        );
                    } catch (error) {
                        resolve("Weather service error, Boss.");
                    }
                },
                () => {
                    resolve("Please allow location permission to check the weather, Boss.");
                }
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
            if (typeof speak === "function") {
                speak(`Your ${amount} ${unit} timer is complete, Boss.`);
            } else {
                alert(`Your ${amount} ${unit} timer is complete, Boss.`);
            }
        }, duration);

        return `Timer set for ${amount} ${unit}, Boss.`;
    }

    // 4. TRANSLATE ENGLISH TO TELUGU
    if (t.startsWith("translate")) {
        const query = text
            .replace(/^translate\s+(this\s+)?/i, "")
            .trim();

        if (!query) {
            return "Please tell me what you want to translate, Boss.";
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
            return "Translation service error, Boss.";
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

    // No matching tool
    return null;
}
