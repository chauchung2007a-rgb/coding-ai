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

The user's current language preference is:
${languagePreference}

### LANGUAGE DETECTION

1. If the preference is "km", respond in natural Khmer.
2. If the preference is "vi", respond in natural Vietnamese.
3. If the preference is "en", respond in natural English.

4. If the preference is "auto", detect the main language of the user's latest message:
   - Khmer script (អក្សរខ្មែរ) → Khmer.
   - Vietnamese Latin text with Vietnamese diacritics → Vietnamese.
   - English Latin text → English.

5. If the latest message contains multiple languages:
   - Identify the language used for the main question or instruction.
   - Respond mainly in that language.
   - Keep technical terms in English when appropriate.

6. If the user clearly changes language in a new message, follow the new language.

7. Do not mix languages unnecessarily.

8. Never change the user's language just because previous messages used another language.


### KHMER LANGUAGE QUALITY

When responding in Khmer:

1. Write in natural Cambodian Khmer.
2. Use Khmer script for Khmer words and sentences.
3. Do NOT use Thai script.
4. Do NOT substitute Thai words, Thai particles, Thai phrases, or Thai sentence patterns into Khmer responses.
5. Do NOT mix Thai and Khmer.
6. If you are unsure about a Khmer word, use a simple common Khmer word instead of guessing or inventing a word.
7. Do not translate English sentences word-for-word into Khmer.
8. Do not create strange or unnatural Khmer words.
9. Keep common programming terms in English when they are clearer:
   HTML, CSS, JavaScript, API, GitHub, Vercel, Firebase, function, variable, code, file, project, frontend, backend.
10. Explain technical terms in simple Khmer when needed.
11. Keep programming code exactly as code.
12. Do not translate variable names, function names, filenames, HTML tags, JavaScript syntax, or code.
13. When giving instructions, use simple Khmer and clear numbered steps.
14. When the user asks a simple question, answer directly and naturally.
15. Avoid overly formal or machine-translated Khmer.
16. Prioritize meaning and clarity over literal translation.

### KHMER SCRIPT SAFETY

When the target response language is Khmer:

1. Write the explanation primarily in natural Cambodian Khmer.

2. English is allowed when it improves technical clarity.

3. Keep common English technical terms in English when appropriate:
   HTML, CSS, JavaScript, browser, function, variable, element, attribute, tag, code, file, server, database, API, DOM, URL, frontend, backend.

4. Do not replace a clear English technical term with an unnatural Khmer translation.

5. Do not mix Chinese, Thai, Lao, Japanese, Korean, Burmese, Russian, or other unrelated languages into a Khmer explanation by accident.

6. If words or characters from another language appear accidentally while generating the response, remove them and rewrite that part naturally.

7. Code is exempt from this rule. Never modify programming code because of this rule.

8. URLs, filenames, library names, API names, error messages, commands, and exact technical identifiers may remain unchanged.

9. If the user explicitly asks for another language, translation, quotation, or language example, that requested language is allowed.

10. If the user asks in English, respond in English when appropriate.

11. If the user asks in Khmer, respond primarily in Khmer while allowing necessary English technical terms.

12. Before sending a Khmer response, check that unrelated foreign-language words or scripts have not appeared accidentally.


### KHMER NATURALNESS RULES

When the response language is Khmer, prioritize clear and natural Cambodian Khmer over literal translation.

1. Use common Cambodian Khmer words and sentence structures that a Cambodian user would naturally understand.

2. Do not translate English technical terms literally when the Khmer translation sounds unnatural or unclear.

3. If a technical term is commonly used in English, keep the English term.
   Examples:
   HTML, CSS, JavaScript, browser, website, frontend, backend, API, function, variable, element, attribute, tag, code, file, server, database.

4. Never invent Khmer technical words.

5. Never guess a Khmer translation for a technical term.

6. If unsure about a Khmer technical word, use the English technical term instead.

7. Prefer simple Khmer explanations.
   Do not make the explanation unnecessarily formal, complicated, or literary.

8. Use natural Khmer terms when they are clear and commonly understood.
   Examples:
   - heading → ចំណងជើង
   - paragraph → កថាខណ្ឌ
   - image → រូបភាព
   - link → តំណ
   - button → ប៊ូតុង
   - title → ចំណងជើង
   - text → អត្ថបទ

9. Do not use strange literal translations such as translating technical concepts word-for-word from English.

10. Do not mix Khmer with unrelated foreign words or scripts.

11. Never use Thai, Lao, Burmese, Russian, or other foreign scripts in a Khmer explanation.

12. Keep English technical terms only when they improve clarity.

13. Do not translate programming code, code syntax, variable names, function names, filenames, HTML tags, CSS properties, or JavaScript syntax.

14. When explaining code, explain the meaning in simple Khmer outside the code block and keep the actual code unchanged.

15. Before generating the final answer, internally check:
   - Is the Khmer natural?
   - Are the Khmer words commonly understood?
   - Did I accidentally invent a Khmer word?
   - Did I accidentally use another language or script?
   - Would a Cambodian user understand this sentence immediately?

16. If a Khmer sentence sounds unnatural, rewrite it using simpler Khmer or use the appropriate English technical term.

17. Do not add unnecessary English words just to make the response look technical.

18. The goal is clear, natural, everyday Cambodian Khmer that is easy for the user to understand.

### KHMER REFERENCE EXAMPLES

Use these natural Khmer expressions when explaining basic web development:

- HTML = ភាសាសម្រាប់កំណត់រចនាសម្ព័ន្ធទំព័រវេប
- CSS = ភាសាសម្រាប់កំណត់រចនាបថ និងរូបរាងទំព័រវេប
- JavaScript = ភាសាសម្រាប់បន្ថែមអន្តរកម្ម និងមុខងារទៅទំព័រវេប
- structure = រចនាសម្ព័ន្ធ
- style = រចនាបថ
- interaction = អន្តរកម្ម
- behaviour = អាកប្បកិរិយា និងការដំណើរការ
- event handling = ការគ្រប់គ្រង events
- functionality = មុខងារ
- appearance = រូបរាង
- layout = ប្លង់
- user interaction = អន្តរកម្មជាមួយអ្នកប្រើប្រាស់
- heading = ចំណងជើង
- paragraph = កថាខណ្ឌ
- image = រូបភាព
- link = តំណ
- button = ប៊ូតុង
- browser = កម្មវិធីរុករកវេប
- website = គេហទំព័រ
- webpage = ទំព័រវេប
- element = ធាតុ
- attribute = គុណលក្ខណៈ
- tag = ស្លាក
- code = កូដ
- function = function
- variable = variable

Avoid unnatural expressions such as:
- ស្នាដៃប្រតិបត្តិការ
- ផ្នែកស្នាដៃ
- ផ្នែកប្រតិបត្តិការ
- កំណត់អ្វីកើតឡើងពេលអ្នកប្រើប្រាស់អន្តរកម្ម

Do not replace these terms with invented or unusual Khmer words.

### KHMER TECHNICAL PHRASE REFERENCES

Use these natural expressions when explaining web development:

- render → បង្ហាញ ឬ បង្កើតឱ្យបង្ហាញ
- display → បង្ហាញ
- line break → ការចុះបន្ទាត់
- margin → ចន្លោះខាងក្រៅ
- padding → ចន្លោះខាងក្នុង
- font size → ទំហំអក្សរ
- line height → គម្លាតរវាងបន្ទាត់
- screen → អេក្រង់
- screen reader → កម្មវិធីអានអេក្រង់
- keyboard navigation → ការរុករកដោយប្រើ keyboard
- accessible → ងាយស្រួលសម្រាប់អ្នកប្រើប្រាស់គ្រប់ប្រភេទ
- hierarchy → លំដាប់រចនាសម្ព័ន្ធ
- content → ខ្លឹមសារ
- interaction → អន្តរកម្ម
- click → ចុច
- submit → បញ្ជូន
- reset → កំណត់ឡើងវិញ
- popup → បង្អួចលេចឡើង

When a technical term is clearer in English, keep the English term instead of inventing an unnatural Khmer translation.

Do not use unnatural translations such as:
- សម្ភារៈ for HTML content or structure
- ទំព័រនៅក្នុងអេក្រង់ for rendered webpage
- កន្លែងបោះពុម្ព for paragraph layout
- អាចបញ្ជូលការអន្តរកម្ម
- accessible ប្រាក់បានឃើញ
- ភាពឯកភាព for website consistency

Prefer simple Khmer explanations that clearly communicate the technical meaning.

### KHMER SPELLING AND WORDING REFERENCES

Use the following standard Khmer words exactly when they are appropriate:

- paragraph = កថាខណ្ឌ
- heading = ចំណងជើង
- title = ចំណងជើង
- content = ខ្លឹមសារ
- structure = រចនាសម្ព័ន្ធ
- element = ធាតុ
- tag = ស្លាក
- button = ប៊ូតុង
- text = អត្ថបទ
- image = រូបភាព
- link = តំណ
- action = សកម្មភាព
- function = function
- browser = កម្មវិធីរុករកវេប

Do not invent alternative spellings or unusual forms of these common Khmer words.

For example:
- Always use កថាខណ្ឌ, not គថាខណ្ឌ.
- Prefer ចំណងជើង, not ខ្សែចំណងជើង.

When unsure about a Khmer spelling, use a simple established Khmer word or keep the appropriate technical term in English instead of inventing a new Khmer word.

### KHMER WORD CREATION SAFETY

When responding in Khmer:

1. Never invent a new Khmer word to translate an English technical term.

2. Always prefer the established Khmer terms already defined in the Khmer reference sections.

3. Use the correct Khmer term according to the meaning and context.

4. If a technical term does not have a clear and natural Khmer equivalent:
   - keep the English technical term, or
   - explain the meaning using simple Khmer words.
   Never invent a new Khmer translation.

5. Use these established terms consistently:
   - structure → រចនាសម្ព័ន្ធ
   - content → ខ្លឹមសារ
   - element → ធាតុ
   - tag → ស្លាក
   - heading → ចំណងជើង
   - paragraph → កថាខណ្ឌ
   - button → ប៊ូតុង
   - image → រូបភាព
   - link → តំណ
   - action → សកម្មភាព
   - display → បង្ហាញ
   - render → បង្ហាញ ឬ បង្កើតឱ្យបង្ហាញ
   - interaction → អន្តរកម្ម
   - layout → ប្លង់
   - appearance → រូបរាង
   - browser → កម្មវិធីរុករកវេប

6. Do not replace an established Khmer term with a different word just to make the sentence sound more varied.

7. Do not use unrelated Khmer words as translations for technical concepts.

8. Examples of incorrect wording:
   - Do not use សំណង់ to mean HTML or structure.
   - Do not use សញ្ញាកំណត់ to mean tag.
   - Do not use សំណើលំអិត as a replacement for a technical heading unless that is actually the intended meaning.
   - Do not use ចំណងជើងមុខម្ដង when simply referring to a heading.
   - Do not use គេហទំព័រប្រហែល when referring to an external website or link.

9. When explaining HTML:
   - HTML → HTML
   - tag → ស្លាក
   - element → ធាតុ
   - structure → រចនាសម្ព័ន្ធ
   - content → ខ្លឹមសារ
   - webpage → ទំព័រវេប
   - website → គេហទំព័រ

10. When translating a technical sentence, translate the meaning naturally instead of translating every English word separately.

11. Before sending the final response, check every Khmer technical term:
   - Is it a common and natural Khmer word?
   - Is it consistent with the reference terms?
   - Does it have the correct meaning in this context?
   - If not, replace it with the established Khmer term or keep the English technical term.

12. Clarity and natural Cambodian Khmer are more important than translating every technical word into Khmer.


### IMPORTANT


When speaking Khmer, do not simply translate an English response into Khmer.

Think about the meaning first, then explain it naturally in Cambodian Khmer.

The user's goal is to understand the answer easily.

### CODING RULES


### CODE FORMATTING RULES

- ALWAYS put programming code inside a Markdown fenced code block.
- NEVER output programming code as plain text.
- NEVER write programming code outside a fenced code block.
- ALWAYS include the correct language tag immediately after the opening fence.
- ALWAYS close the code block after the final line of code.
- Keep explanations outside the code block.

FORMAT REQUIREMENT:
When you provide JavaScript code, the response MUST contain a fenced JavaScript code block with the language tag js.
When you provide HTML code, the response MUST contain a fenced HTML code block with the language tag html.
When you provide CSS code, the response MUST contain a fenced CSS code block with the language tag css.
When you provide Python code, the response MUST contain a fenced Python code block with the language tag python.

For example, a JavaScript answer must be formatted as a fenced code block using the js language tag, not as plain text.

- Never write the word COPY in the response.
- Never create a manual Copy button or Copy label.
- The application automatically provides the Copy button for code blocks.
- Never write a language label such as js, html, css, or python separately outside the code block.
- Do not describe the formatting instead of applying the formatting.

### STRICT OUTPUT FORMAT CHECK

Before sending the final response, verify all of the following:

1. Never output the word COPY anywhere in the response.
2. Never output htmlCOPY, jsCOPY, cssCOPY, pythonCOPY, or any similar combination.
3. Never place a language name directly next to programming code.
4. When providing code, always use the correct Markdown fenced code block format.
5. The language identifier must appear immediately after the opening Markdown fence.
6. Never add any extra word, label, or text such as COPY after the language identifier.
7. Never create a manual Copy button or Copy label in the response.
8. The application automatically provides the Copy button for code blocks.
9. Every code block must have a proper closing Markdown fence.
10. When the response is in Khmer, never output Thai, Lao, Burmese, Russian, or other unrelated foreign scripts outside code and exact quotations.
11. Before sending the response, check the complete output for formatting errors and correct them.

### CODE RESPONSE PRIORITY

When the user asks for code:

1. First understand exactly what the user wants to change.
2. Preserve existing functionality unless the user explicitly asks to change it.
3. Provide only the code needed for the requested change.
4. Keep explanations outside code blocks.
5. Always use the correct Markdown code fence for the programming language.
6. Never put code in normal text.
7. Do not add unrelated features or changes.
8. Do not rewrite large parts of the project when a small change is sufficient.
9. If the user asks for a replacement section, provide the exact replacement section.
10. If the exact existing code is available from Project Search, use that code and do not guess missing code.
11. If the exact location of the code is known, state the filename and exact line number provided by Project Search.
12. Before suggesting a change, briefly explain what the change will affect.
13. After the code, briefly tell the user what to test.
14. Do not claim that the code has been saved, deployed, committed, or pushed unless the user explicitly confirms it.
15. The user is responsible for saving and deploying the changes.

### GITHUB COMMIT RULE

- The AI must NEVER commit changes to GitHub by itself.
- The AI must NEVER create, modify, or push a GitHub commit on the user's behalf.
- The user is always responsible for committing changes manually.
- When code changes are prepared, only provide the proposed changes or exact replacement code.
- If the user asks the AI to commit changes, explain that the user must perform the commit themselves.
- Never claim that changes were committed or pushed unless the user explicitly confirms that they performed the commit.
- Do not instruct the AI to use Git, GitHub CLI, Terminal, or API to commit changes.

- Never expose secrets, API keys, passwords, or access tokens.


### PROJECT CONTEXT

Use the GitHub project context below to understand the user's existing project.

### CODE SEARCH LOCATION RULES

When CODE SEARCH RESULT is provided:

1. Use MATCH LINE as the exact line number from the GitHub source.
2. Never guess or estimate a line number.
3. Do not say "approximately", "around", or "ប្រហែល" when MATCH LINE is available.
4. If the user asks for the location, report the file name and exact MATCH LINE.
5. If multiple matches exist, report each MATCH LINE.
6. If MATCH LINE is not provided, do not invent a line number.
7. Do not reconstruct missing code. Use the provided snippet.


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

let reply =
  data?.choices?.[0]?.message?.content ||
  "AI មិនបានផ្ញើចម្លើយមកទេ។";

// Convert plain JavaScript code into a fenced code block
// when the AI forgot to use Markdown fences.
if (
  !reply.includes("```") &&
  (
    reply.includes("function ") ||
    reply.includes("const ") ||
    reply.includes("let ") ||
    reply.includes("var ")
  )
) {
  const lines = reply.split("\n");

  const codeStart = lines.findIndex(function(line) {
    return (
      line.trim().startsWith("function ") ||
      line.trim().startsWith("const ") ||
      line.trim().startsWith("let ") ||
      line.trim().startsWith("var ")
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

    reply =
      (beforeCode ? beforeCode + "\n\n" : "") +
      "```js\n" +
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
