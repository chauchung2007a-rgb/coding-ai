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

const languagePreference =
  typeof body.languagePreference === "string"
    ? body.languagePreference
    : "auto";

  const conversationHistory = Array.isArray(req.body.conversationHistory)
  ? req.body.conversationHistory.slice(-2)
  : [];

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    // Check Gemini API key
   

if (!process.env.GROQ_API_KEY) {
  return res.status(500).json({
    error: "GROQ_API_KEY is not configured in Vercel."
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
let projectFileList = [];

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

    const allFiles = (treeData.tree || [])
      .filter(item =>
        item.type === "blob" &&
        !item.path.startsWith(".git/") &&
        !item.path.startsWith("node_modules/")
      );

    // Always show the complete file list
    projectFileList = allFiles.map(file => file.path);

    // Only read a small number of files to save tokens
   

const preferredFiles = [
  "index.html",
  "api/chat.js",
  "api/project.js",
  "api/file.js",
  "api/agent.js",
  "api/commit.js"
];

const filesToRead = preferredFiles
  .map(path =>
    allFiles.find(file => file.path === path)
  )
  .filter(Boolean);

// Detect a specific code search request
const codeSearchMatch = message.match(/`([^`]+)`/);

const codeSearchTerm = codeSearchMatch
  ? codeSearchMatch[1]
      .replace(/\(\)$/, "")
      .trim()
  : "";

const fileSearchMatch = message.match(
  /(?:ក្នុង|នៅក្នុង|in)\s+([A-Za-z0-9_./-]+\.(?:html|js|css))/i
);

const targetFile = fileSearchMatch
  ? fileSearchMatch[1]
  : "";

   const filesForCodeSearch = targetFile
  ? filesToRead.filter(file => file.path === targetFile)
  : filesToRead;

for (const file of filesForCodeSearch) {
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

        if (!response.ok) continue;

        const data = await response.json();

        if (!data.content) continue;

        const content = Buffer.from(
          data.content,
          "base64"
        ).toString("utf-8");

       let contentForContext = "";

if (codeSearchTerm) {
  const searchLower = codeSearchTerm.toLowerCase();
  const contentLower = content.toLowerCase();

  const matches = [];
  let searchStart = 0;

  while (matches.length < 3) {
    const index = contentLower.indexOf(
      searchLower,
      searchStart
    );

    if (index === -1) break;

   

const start = Math.max(0, index - 5000);
const end = Math.min(
  content.length,
  index + codeSearchTerm.length + 5000
);

    matches.push(
      content.slice(start, end)
    );

    searchStart =
      index + codeSearchTerm.length;
  }

  if (matches.length > 0) {
    contentForContext =
      matches.join(
        "\n\n===== NEXT MATCH =====\n\n"
      );
  }
} else {
  // Normal project context
  contentForContext =
    content.slice(0, 5000);
}

console.log(
  "READ PROJECT FILE:",
  file.path,
  "CONTENT LENGTH:",
  content.length,
  "SEARCH:",
  codeSearchTerm || "none",
  "MATCHED:",
  Boolean(contentForContext)
);

if (contentForContext) {
  fileResults.push(
    `\n===== ${file.path} =====\n${contentForContext}`
  );
}

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

if (projectFileList.length > 0) {
  projectContext =
    "\n\nPROJECT FILE LIST:\n" +
    projectFileList.join("\n");

  if (fileResults.length > 0) {
    projectContext +=
      "\n\nIMPORTANT PROJECT FILE CONTENT:\n" +
      fileResults.join("\n");
  }

 // Final safety limit
if (codeSearchTerm) {
  projectContext = projectContext.slice(0, 30000);
} else {
  projectContext = projectContext.slice(0, 12000);
}

} // Close wantsProjectContext

const systemPrompt = `

You are Coding AI, a personal multilingual coding assistant.

### LANGUAGE SYSTEM


Supported languages:
- Khmer (km)
- Vietnamese (vi)
- English (en)

The user's current language preference is:
${languagePreference}

### LANGUAGE DETECTION

1. If the preference is "km", respond in natural Khmer.
2. If the preference is "vi", respond in natural Vietnamese.
3. If the preference is "en", respond in natural English.
4. If the preference is "auto", detect the main language of the user's latest message.
5. If the user clearly changes language, follow the new language.
6. Do not mix languages unnecessarily.

### KHMER LANGUAGE QUALITY

When responding in Khmer:

1. Use natural Cambodian Khmer that is easy to understand.
2. Use correct Khmer grammar and sentence structure.
3. Do not translate English sentences word-for-word into Khmer.
4. Do not create strange or unnatural Khmer words.
5. Keep common programming terms in English when they are clearer:
   HTML, CSS, JavaScript, API, GitHub, Vercel, Firebase, function, variable, code, file, project, frontend, backend.
6. Explain technical terms in simple Khmer when needed.
7. Keep programming code exactly as code.
8. Do not translate variable names, function names, filenames, HTML tags, JavaScript syntax, or code.
9. When giving instructions, use simple Khmer and clear numbered steps.
10. When the user asks a simple question, answer directly and naturally.
11. Avoid overly formal or machine-translated Khmer.
12. Prioritize meaning and clarity over literal translation.

### IMPORTANT

When speaking Khmer, do not simply translate an English response into Khmer.

Think about the meaning first, then explain it naturally in Cambodian Khmer.

The user's goal is to understand the answer easily.

### CODING RULES

- Help the user write, debug, explain, and improve code.
- Preserve existing functionality unless the user explicitly asks to change it.
- Before a major change, explain briefly what will change.
- Do not claim that a change was made unless the change was actually performed.
- When asked to modify code, clearly identify which file should be changed.
- Provide exact code or exact replacement sections when appropriate.
- Never claim that GitHub was modified unless an actual GitHub write operation was performed.
- Never expose secrets, API keys, passwords, or access tokens.

### PROJECT CONTEXT

Use the GitHub project context below to understand the user's existing project.

IMPORTANT:
- When PROJECT FILE LIST is provided, use that list directly.
- If the user asks for all project files, return the files from PROJECT FILE LIST.
- Do NOT tell the user to use Git, Node.js, GitHub CLI, Terminal, curl, or another API to get the file list.
- Do NOT invent another file list.
- Do NOT redirect the user to /api/agent or /api/project.
- When answering about the project, use the project context provided below.
- If the requested information is not present in the project context, say that it was not loaded instead of guessing.

${projectContext}

`;

     // Send request to Groq
const response = await fetch(
  "https://api.groq.com/openai/v1/chat/completions",
  {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },

   body: JSON.stringify({
  model: "openai/gpt-oss-20b",

  max_tokens: 1500,

  messages: [
        {
          role: "system",
          content: systemPrompt
        },

        ...conversationHistory.map(item => ({
          role:
            item.role === "ai"
              ? "assistant"
              : "user",
          content: item.text
        })),

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
    error: "Groq returned an invalid response."
  });
}

if (!response.ok) {
  return res.status(response.status).json({
    error:
      data?.error?.message ||
      "Groq API error."
  });
}

const reply =
  data?.choices?.[0]?.message?.content ||
  "AI មិនបានផ្ញើចម្លើយមកទេ។";

return res.status(200).json({
  reply: reply
});

  } catch (error) {

    console.error("Groq API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Server error."
    });
  }
}
