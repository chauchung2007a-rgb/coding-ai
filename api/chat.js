export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // Make sure request body exists
    const body = req.body || {};
    const message = typeof body.message === "string"
      ? body.message.trim()
      : "";

    // Check message
    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    // Check API key exists
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured in Vercel."
      });
    }

    // Send request to OpenAI
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-4.1-mini",

          instructions:
            "You are a helpful personal coding AI. Help the user write, debug, explain, improve, and understand code. Answer clearly and provide code when useful.",

          input: message
        })
      }
    );

    // Read response as text first
    // This prevents JSON parsing errors if the server
    // returns something unexpected.
    const responseText = await openaiResponse.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        error: "OpenAI returned an invalid response."
      });
    }

    // OpenAI returned an error
    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error:
          data?.error?.message ||
          "OpenAI API error."
      });
    }

    // Get AI response text
    const reply =
      data?.output_text ||
      "AI មិនបានផ្ញើចម្លើយមកទេ។";

    // Send clean JSON back to frontend
    return res.status(200).json({
      reply: reply
    });

  } catch (error) {
    console.error("API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Server error."
    });
  }
}
