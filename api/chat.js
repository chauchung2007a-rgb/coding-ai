export default async function handler(req, res) {

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // Simple rate limit
  if (!globalThis.chatRateLimit) {
    globalThis.chatRateLimit = {
      count: 0,
      resetAt: Date.now() + 60 * 1000
    };
  }

  const rateLimit = globalThis.chatRateLimit;

  if (Date.now() > rateLimit.resetAt) {
    rateLimit.count = 0;
    rateLimit.resetAt = Date.now() + 60 * 1000;
  }

  if (rateLimit.count >= 5) {
    return res.status(429).json({
      error: "សូមរង់ចាំ 1 នាទី មុនពេលផ្ញើសារបន្ថែម។"
    });
  }

  rateLimit.count++;

  try {

    const body = req.body || {};

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    // Check OpenRouter API key
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: "OPENROUTER_API_KEY is not configured in Vercel."
      });
    }

    // Send request to OpenRouter
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://coding-ai-six.vercel.app",
          "X-Title": "Coding AI"
        },

        body: JSON.stringify({
          model: "inclusionai/ling-3.0-flash-vl:free",

          messages: [
            {
              role: "system",
              content:
                "You are a helpful personal coding AI. Help the user write, debug, explain, improve, and understand code. Answer clearly and provide code when useful."
            },
            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        error: "OpenRouter returned an invalid response."
      });
    }

    // OpenRouter error
    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenRouter API error."
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      "AI មិនបានផ្ញើចម្លើយមកទេ។";

    return res.status(200).json({
      reply: reply
    });

  } catch (error) {

    console.error("OpenRouter API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Server error."
    });
  }
}
