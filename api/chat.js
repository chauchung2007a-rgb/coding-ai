import { LANGUAGE_KNOWLEDGE, detectLanguage } from "./languageKnowledge.js";

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

const conversationHistory =
  Array.isArray(body.conversationHistory)
    ? body.conversationHistory.slice(-10)
    : [];

// =========================================
// LANGUAGE KNOWLEDGE DETECTION
// (pure, local, no network calls)
// =========================================

const languageDetection = detectLanguage(message);

let languageKnowledgeBlock = "";

if (
  languageDetection.language &&
  (
    languageDetection.confidence === "high" ||
    languageDetection.confidence === "medium"
  ) &&
  LANGUAGE_KNOWLEDGE[languageDetection.language]
) {

  languageKnowledgeBlock =
    "\n\n### LANGUAGE KNOWLEDGE: " +
    languageDetection.language.toUpperCase() +
    "\n" +
    LANGUAGE_KNOWLEDGE[languageDetection.language];

}

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

   // Read project files only when relevant
if (
  wantsProjectContext &&
  githubToken &&
  githubOwner &&
  githubRepo
) {

  const fileResults = [];
  let projectFileList = [];

  try {

    // =========================================
    // 1. READ PROJECT TREE
    // =========================================

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

    if (!treeResponse.ok) {

      console.error(
        "GitHub tree error:",
        treeResponse.status
      );

    } else {

      const treeData =
        await treeResponse.json();

      const allFiles =
        (treeData.tree || [])
          .filter(item =>
            item.type === "blob" &&
            !item.path.startsWith(".git/") &&
            !item.path.startsWith("node_modules/") &&
            !item.path.startsWith(".next/") &&
            !item.path.startsWith("dist/") &&
            !item.path.startsWith("build/")
          );

      // =========================================
      // 2. COMPLETE PROJECT FILE LIST
      // =========================================

      projectFileList =
        allFiles.map(file => file.path);


      // =========================================
      // 3. DETECT CODE SEARCH
      // =========================================

      const codeSearchMatch =
        message.match(/`([^`]+)`/);

      const codeSearchTerm =
        codeSearchMatch
          ? codeSearchMatch[1]
              .replace(/$begin:math:text$$end:math:text$$/, "")
              .trim()
          : "";


      // =========================================
      // 4. DETECT TARGET FILE
      // =========================================

      const fileSearchMatch =
        message.match(
          /(?:ក្នុង|នៅក្នុង|in|inside)\s+([A-Za-z0-9_./-]+\.(?:html|js|css|json|jsx|ts|tsx|vue|php|py|java|c|cpp|cs|go|rs))/i
        );

      const targetFile =
        fileSearchMatch
          ? fileSearchMatch[1]
          : "";


      // =========================================
      // 5. SEARCHABLE FILE TYPES
      // =========================================

      const searchableExtensions = [
        ".html",
        ".htm",
        ".css",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".json",
        ".vue",
        ".php",
        ".py",
        ".java",
        ".c",
        ".cpp",
        ".cs",
        ".go",
        ".rs"
      ];


      // =========================================
      // 6. SELECT FILES
      // =========================================

      let filesToSearch =
        allFiles.filter(file => {

          const path =
            file.path.toLowerCase();

          return searchableExtensions.some(
            extension =>
              path.endsWith(extension)
          );

        });


      // If user specified a target file,
      // search only that file.

      if (targetFile) {

        filesToSearch =
          filesToSearch.filter(
            file =>
              file.path === targetFile
          );

      }


      // =========================================
      // 7. LIMIT FILES TO SCAN
      // =========================================

      const MAX_FILES_TO_SEARCH = 30;

      if (
        filesToSearch.length >
        MAX_FILES_TO_SEARCH
      ) {

        filesToSearch =
          filesToSearch.slice(
            0,
            MAX_FILES_TO_SEARCH
          );

      }


      // =========================================
      // 8. READ FILES
      // =========================================

      for (const file of filesToSearch) {

        try {

          const response =
            await fetch(
              `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${file.path}?ref=${githubBranch}`,
              {
                headers: {
                  "Authorization":
                    `Bearer ${githubToken}`,

                  "Accept":
                    "application/vnd.github+json",

                  "X-GitHub-Api-Version":
                    "2022-11-28"
                }
              }
            );


          if (!response.ok) {
            continue;
          }


          const data =
            await response.json();


          if (!data.content) {
            continue;
          }


          const content =
            Buffer.from(
              data.content,
              "base64"
            ).toString("utf-8");


         // =========================================
// 9. EXACT CODE SEARCH
// =========================================

if (codeSearchTerm) {

  const searchLower =
    codeSearchTerm.toLowerCase();

  const contentLower =
    content.toLowerCase();

  const matches = [];

  let searchStart = 0;

  while (
    matches.length < 3
  ) {

    const index =
      contentLower.indexOf(
        searchLower,
        searchStart
      );

    if (index === -1) {
      break;
    }

    // =====================================
    // FIND EXACT MATCH LINE
    // =====================================

    const matchLine =
      content
        .slice(0, index)
        .split("\n")
        .length;


    // =====================================
    // CONTEXT AROUND MATCH
    // =====================================

    const CONTEXT_SIZE = 900;

    const start =
      Math.max(
        0,
        index - CONTEXT_SIZE
      );

    const end =
      Math.min(
        content.length,
        index +
          codeSearchTerm.length +
          CONTEXT_SIZE
      );


    const snippet =
      content.slice(
        start,
        end
      );


    // =====================================
    // CALCULATE SNIPPET LINE RANGE
    // =====================================

    const startLine =
      content
        .slice(0, start)
        .split("\n")
        .length;

    const endLine =
      content
        .slice(0, end)
        .split("\n")
        .length;


    // =====================================
    // SAVE EXACT LOCATION
    // =====================================

    matches.push(
      `FILE: ${file.path}\n` +
      `MATCH: ${codeSearchTerm}\n` +
      `MATCH LINE: ${matchLine}\n` +
      `CONTEXT LINES: ${startLine}-${endLine}\n\n` +
      snippet
    );


    searchStart =
      index +
      Math.max(
        codeSearchTerm.length,
        1
      );
  }


  // =====================================
  // ONLY RETURN FILES WITH MATCHES
  // =====================================

  if (
    matches.length > 0
  ) {

    fileResults.push(
      "\n===== CODE SEARCH RESULT =====\n" +
      matches.join(
        "\n\n===== NEXT MATCH =====\n\n"
      )
    );

  }


  console.log(
    "PROJECT SEARCH:",
    file.path,
    "SEARCH:",
    codeSearchTerm,
    "MATCHES:",
    matches.length
  );

}


          // =========================================
          // 10. NORMAL PROJECT CONTEXT
          // =========================================

          else {

            // Only load a small preview
            // when there is no exact search.

            const preview =
              content.slice(0, 1200);

            fileResults.push(
              `\n===== ${file.path} =====\n` +
              preview
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


  // =========================================
  // 11. BUILD SMALL PROJECT CONTEXT
  // =========================================

  if (
    projectFileList.length > 0
  ) {

    // Keep the file list small enough
    // for the AI request.

    const MAX_FILE_LIST_CHARS = 5000;

    projectContext =
      "\n\nPROJECT FILE LIST:\n" +
      projectFileList.join("\n");


    projectContext =
      projectContext.slice(
        0,
        MAX_FILE_LIST_CHARS
      );


    if (
      fileResults.length > 0
    ) {

      projectContext +=
        "\n\nIMPORTANT PROJECT FILE CONTENT:\n" +
        fileResults.join("\n");

    }


    // =========================================
    // 12. FINAL TOKEN-SAFE LIMIT
    // =========================================

    const MAX_PROJECT_CONTEXT_CHARS = 9000;

    projectContext =
      projectContext.slice(
        0,
        MAX_PROJECT_CONTEXT_CHARS
      );

  }

}


const systemPrompt = `

You are Coding AI, a personal multilingual coding assistant.

### LANGUAGE SYSTEM

Supported languages:
- Khmer (km)
- Vietnamese (vi)
- English (en)

Current language preference:
${languagePreference}

Language rules:
1. If preference is "km", respond in natural Cambodian Khmer.
2. If preference is "vi", respond in natural Vietnamese.
3. If preference is "en", respond in natural English.
4. If preference is "auto", detect the main language of the latest user message.
5. Khmer script → Khmer.
6. Vietnamese text with Vietnamese diacritics → Vietnamese.
7. English text → English.
8. If multiple languages appear, follow the language of the main question or instruction.
9. Follow a clear language change in a new user message.
10. Do not change language just because previous messages used another language.
11. Do not mix languages unnecessarily.

### KHMER LANGUAGE RULES

When responding in Khmer:

1. Use natural, everyday Cambodian Khmer.
2. Use Khmer script for Khmer explanations.
3. Never accidentally use Thai, Lao, Chinese, Japanese, Korean, Burmese, Russian, or other unrelated languages or scripts.
4. English technical terms are allowed when useful or clearer.
5. Common technical terms may remain in English:
   HTML, CSS, JavaScript, API, GitHub, Vercel, Firebase, browser, function, variable, code, file, project, frontend, backend, server, database, DOM, URL.
6. Never invent Khmer technical words.
7. If a technical term has no clear natural Khmer translation, keep the English term or explain it using simple Khmer.
8. Prefer simple, natural Khmer over literal translation from English.
9. Do not use overly formal, literary, machine-translated, or unnatural Khmer.
10. Before sending a Khmer response, check that no unrelated foreign word or script accidentally appears.
11. If an accidental foreign word appears, rewrite the sentence naturally before sending.
12. Do not translate code, variable names, function names, filenames, HTML tags, CSS properties, JavaScript syntax, URLs, API names, error messages, or technical identifiers.

### STANDARD KHMER TECHNICAL TERMS

Use these established terms consistently:

- structure → រចនាសម្ព័ន្ធ
- style → រចនាបថ
- content → ខ្លឹមសារ
- element → ធាតុ
- tag → ស្លាក
- attribute → គុណលក្ខណៈ
- heading → ចំណងជើង
- title → ចំណងជើង
- paragraph → កថាខណ្ឌ
- image → រូបភាព
- link → តំណ
- button → ប៊ូតុង
- text → អត្ថបទ
- website → គេហទំព័រ
- webpage → ទំព័រវេប
- browser → កម្មវិធីរុករកវេប
- document → ឯកសារ
- layout → ប្លង់
- appearance → រូបរាង
- interaction → អន្តរកម្ម
- functionality → មុខងារ
- action → សកម្មភាព
- display → បង្ហាញ
- render → បង្ហាញ ឬ បង្កើតឱ្យបង្ហាញ
- click → ចុច
- submit → បញ្ជូន
- reset → កំណត់ឡើងវិញ
- popup → បង្អួចលេចឡើង
- margin → ចន្លោះខាងក្រៅ
- padding → ចន្លោះខាងក្នុង
- font size → ទំហំអក្សរ
- line height → គម្លាតរវាងបន្ទាត់

Important:
- Always use កថាខណ្ឌ, not គថាខណ្ឌ.
- Always use ចំណងជើង for heading/title when appropriate.
- Do not invent alternative Khmer translations.
- If unsure, use the English technical term instead.

### KHMER WEB DEVELOPMENT REFERENCES

When explaining basic web development:

- HTML → ភាសាសម្រាប់កំណត់រចនាសម្ព័ន្ធទំព័រវេប
- CSS → ភាសាសម្រាប់កំណត់រចនាបថ និងរូបរាងទំព័រវេប
- JavaScript → ភាសាសម្រាប់បន្ថែមអន្តរកម្ម និងមុខងារទៅទំព័រវេប
- HTML element → ធាតុ HTML
- HTML structure → រចនាសម្ព័ន្ធ HTML
- page content → ខ្លឹមសារនៃទំព័រ
- HTML document → ឯកសារ HTML
- browser → កម្មវិធីរុករកវេប

Do not translate technical terms word-for-word when the result sounds unnatural.

### IMPORTANT

When speaking Khmer, think about the meaning first and explain it naturally in Cambodian Khmer. Do not simply translate an English response word-for-word.

The user's goal is to understand the answer easily.

### CODING RULES

### CODE FORMATTING RULES

- Always put programming code inside a Markdown fenced code block.
- Never output programming code as plain text.
- Use the correct language identifier immediately after the opening fence.
- Always close the code block.
- Keep explanations outside code blocks.
- Never write a manual Copy button or Copy label.
- The application automatically provides the Copy button for code blocks.
- Do not add unnecessary text around code formatting.

### STRICT OUTPUT FORMAT CHECK

Before sending the final response:

1. Check that all programming code is inside a proper fenced code block.
2. Check that the correct language identifier is used.
3. Check that every code block is properly closed.
4. Check that no accidental unrelated foreign language or script appears in a Khmer explanation.
5. Check that code and technical identifiers remain unchanged.
6. Check that the response directly answers the user's request.

### CODE RESPONSE PRIORITY

When the user asks for code:

1. Understand exactly what the user wants.
2. Preserve existing functionality unless explicitly asked to change it.
3. Provide only the code needed for the requested change.
4. Do not add unrelated features.
5. Do not rewrite large parts of the project when a small change is sufficient.
6. If exact existing code is available from Project Search, use it and do not guess.
7. If the exact location is known, report the exact file and line number.
8. Explain briefly what the change affects.
9. After code, briefly tell the user what to test.
10. Never claim that code was saved, deployed, committed, or pushed unless the user confirms it.
11. If you are not confident which programming language the user means, ask a short clarifying question instead of guessing.

### GITHUB COMMIT RULE

- Never commit, push, or modify GitHub commits on the user's behalf.
- The user is responsible for saving and deploying changes.
- Do not instruct the user to use Git, GitHub CLI, Terminal, curl, or another API to commit changes.
- Never expose secrets, API keys, passwords, or access tokens.

### PROJECT CONTEXT

Use the GitHub project context below to understand the user's existing project.

### CODE SEARCH LOCATION RULES

When CODE SEARCH RESULT is provided:

1. Use MATCH LINE as the exact line number.
2. Never guess or estimate a line number.
3. Do not say approximately or around when MATCH LINE is available.
4. If the user asks for the location, report the filename and exact MATCH LINE.
5. If multiple matches exist, report each MATCH LINE.
6. If MATCH LINE is not provided, do not invent one.
7. Do not reconstruct missing code. Use the provided snippet.

IMPORTANT:
- When PROJECT FILE LIST is provided, use that list directly.
- If the user asks for all project files, return the files from PROJECT FILE LIST.
- Do not tell the user to use Git, Node.js, GitHub CLI, Terminal, curl, or another API to get the file list.
- Do not invent another file list.
- Do not redirect the user to /api/agent or /api/project.
- When answering about the project, use the project context provided below.
- If the requested information is not present in the project context, say that it was not loaded instead of guessing.
${languageKnowledgeBlock}

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

let reply =
  data?.choices?.[0]?.message?.content ||
  "AI មិនបានផ្ញើចម្លើយមកទេ។";

// Convert plain JavaScript code into a fenced code block
// when the AI forgot to use Markdown fences.

const codeStartPatterns = [
  "function ", "const ", "let ", "var ",
  "def ", "class ", "import ", "print(",
  "public ", "private ", "#include"
];

if (
  !reply.includes("```") &&
  codeStartPatterns.some(p => reply.includes(p))
) {
  const lines = reply.split("\n");

  const codeStart = lines.findIndex(function(line) {
    return codeStartPatterns.some(p =>
      line.trim().startsWith(p)
    );
  });


  if (codeStart !== -1) {
    const beforeCode = lines
      .slice(0, codeStart)
      .join("\n")
      .trim();

    const code = lines
      .slice(codeStart)
      .join("\n")
      .trim();

   
          const fenceTag =
      languageDetection.language === "python" ? "python" :
      languageDetection.language === "cpp" ? "cpp" :
      languageDetection.language === "c" ? "c" :
      languageDetection.language === "java" ? "java" :
      "js";

    reply =
      (beforeCode ? beforeCode + "\n\n" : "") +
      "```" + fenceTag + "\n" +
      code +
      "\n```";

  }
}

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
