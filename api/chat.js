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

    // Check Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in Vercel."
      });
    }

    // GitHub settings
    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;
    const githubBranch = process.env.GITHUB_BRANCH || "main";

    // Detect whether the user is asking about the project/code
    const projectKeywords = [
      "project",
      "code",
      "coding",
      "github",
      "file",
      "html",
      "css",
      "javascript",
      "chat.js",
      "index.html",
      "project.js",
      "file.js",
      "កូដ",
      "គម្រោង",
      "project របស់ខ្ញុំ",
      "មើល project",
      "អាន project",
      "កែ code"
    ];

    const wantsProjectContext = projectKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    let projectContext = "";

    // Read selected project files only when relevant
    if (
      wantsProjectContext &&
      githubToken &&
      githubOwner &&
      githubRepo
    ) {

// Read the project structure from GitHub
const fileResults = [];

try {
  const treeResponse = await fetch(
    `https://api.github.com/repos/${githubOwner}/${githubRepo}/git/trees/${githubBranch}?recursive=1`,
    {
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  if (treeResponse.ok) {
    const treeData = await treeResponse.json();

    const projectFiles = (treeData.tree || [])
      .filter(item =>
        item.type === "blob" &&
        !item.path.startsWith(".git/") &&
        !item.path.startsWith("node_modules/")
      )
      .slice(0, 30);

    for (const file of projectFiles) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${file.path}?ref=${githubBranch}`,
          {
            headers: {
              "Authorization": `Bearer ${githubToken}`,
              "Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28"
            }
          }
        );

        if (!response.ok) {
          continue;
        }

        const data = await response.json();

        if (!data.content) {
          continue;
        }

        const content = Buffer.from(
          data.content,
          "base64"
        ).toString("utf-8");

        // Prevent very large files from using too much context
        const limitedContent = content.slice(0, 50000);

        fileResults.push(
          `\n===== ${file.path} =====\n${limitedContent}`
        );

      } catch (error) {
        console.error(
          `Failed to read ${file.path}:`,
          error
        );
      }
    }
  }

} catch (error) {
  console.error(
    "Failed to read GitHub project tree:",
    error
  );
}

if (fileResults.length > 0) {
  projectContext =
    "\n\nPROJECT FILES FROM GITHUB:\n" +
    fileResults.join("\n");
}
      
    }

    const systemPrompt = `
You are Coding AI, a personal multilingual coding assistant.

### Language Rules
- Understand Khmer, Vietnamese, English, and mixed-language messages.
- Reply in the same language as the user's latest message unless the user asks for another language.
- When replying in Khmer, use natural, clear, easy-to-understand Khmer.
- Keep common programming terms such as HTML, CSS, JavaScript, API, GitHub, Vercel, function, variable, server, frontend, and backend in English when that is clearer.
- Do not use awkward literal translations.
- Keep code, filenames, function names, variables, and syntax exactly as code.
- If the user's request is unclear, ask a short clarification instead of guessing.

### Coding Rules
- Help the user write, debug, explain, and improve code.
- Preserve existing functionality unless the user explicitly asks to change it.
- Before a major change, explain briefly what will change.
- Do not claim that a change was made unless the change was actually performed.
- The user will manually review and save/commit code changes.
- When asked to modify code, clearly identify which file should be changed.
- Provide the exact code or exact replacement section needed.
- Never directly claim that GitHub was modified.
- Do not expose secrets, API keys, passwords, or access tokens.

### Project Context
Use the GitHub project context below to understand the user's existing project.
${projectContext}
`;

    // Send request to Google Gemini
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },

        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: systemPrompt
              }
            ]
          },

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: message
                }
              ]
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
        error: "Gemini returned an invalid response."
      });
    }

    // Gemini API error
    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini API error."
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "AI មិនបានផ្ញើចម្លើយមកទេ។";

    return res.status(200).json({
      reply: reply
    });

  } catch (error) {

    console.error("Gemini API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Server error."
    });
  }
}
