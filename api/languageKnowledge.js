/* =========================================
   LANGUAGE KNOWLEDGE LAYER

   Compact, structured knowledge per
   programming language.

   IMPORTANT:
   This file is never sent to the AI as a
   whole. Only ONE language block is
   selected and injected into systemPrompt,
   and only when detection is confident.
========================================= */

export const LANGUAGE_KNOWLEDGE = {

  html: `
Used for: structuring web page content.
Syntax: tags like <div>, <p>, attributes like class="", href="".
Core concepts: elements, attributes, nesting, semantic tags, the DOM tree.
Common patterns: forms, lists, tables, semantic layout (header/main/footer).
Explain by: describing what each tag/element represents in the page.
Common errors: unclosed tags, wrong nesting, missing required attributes (alt, href).
Safe changes: edit inside existing tags/attributes without breaking structure or removing sibling elements.
Differs from CSS/JS: HTML defines structure/content only, no styling or logic.`.trim(),

  css: `
Used for: styling and layout of web pages.
Syntax: selectors { property: value; }, classes ".name", ids "#name".
Core concepts: selectors, specificity, box model, flexbox/grid, cascading/inheritance.
Common patterns: responsive layout, media queries, hover/active states, transitions.
Explain by: describing visual effect and which selector it targets.
Common errors: missing semicolons/braces, wrong selector specificity, unit mistakes.
Safe changes: edit values inside existing rules; avoid renaming classes used in HTML/JS.
Differs from HTML/JS: CSS only affects appearance, not structure or behavior.`.trim(),

  javascript: `
Used for: interactivity and logic in the browser (or Node.js on the server).
Syntax: function/const/let/var, =>, {}, template literals with backticks.
Core concepts: variables, functions, events, DOM manipulation, async/await, promises.
Common patterns: event listeners, fetch() calls, array methods (map/filter/forEach).
Explain by: describing what triggers the code and what it changes.
Common errors: undefined variables, missing await, incorrect scope (var vs let/const).
Safe changes: modify function bodies without changing function names/params used elsewhere.
Differs from TypeScript: no static types; differs from HTML/CSS: adds behavior, not structure/style.`.trim(),

  typescript: `
Used for: JavaScript with static types, for safer large-scale code.
Syntax: same as JS plus type annotations, e.g. "let x: number", interfaces, "as Type".
Core concepts: types, interfaces, generics, type inference, compiling to JS.
Common patterns: typed function signatures, interfaces for objects, enums.
Explain by: describing the type contract in addition to behavior.
Common errors: type mismatches, missing types on function params, wrong generic usage.
Safe changes: preserve existing type signatures unless the change requires updating them.
Differs from JavaScript: adds a type system; code still runs as JS after compiling.`.trim(),

  python: `
Used for: general-purpose scripting, automation, data, backend, AI/ML.
Syntax: indentation-based blocks (no braces), "def", "if/elif/else", snake_case names.
Core concepts: variables, functions, lists/dicts, classes, modules/imports.
Common patterns: for/while loops, list comprehensions, try/except, with-blocks.
Explain by: walking through execution order, since indentation defines structure.
Common errors: indentation mistakes, mixing tabs/spaces, mutable default arguments.
Safe changes: preserve indentation level exactly; do not reformat unrelated blocks.
Differs from JS/Java: whitespace-significant, dynamically typed, no braces/semicolons.`.trim(),

  java: `
Used for: large applications, Android apps, enterprise backend systems.
Syntax: class-based, strongly typed, e.g. "public class X { ... }", semicolons required.
Core concepts: classes, objects, interfaces, inheritance, access modifiers (public/private).
Common patterns: getters/setters, constructors, try/catch, collections (List/Map).
Explain by: describing the class/method responsible and its access level.
Common errors: missing semicolons, mismatched braces, wrong type casting, null pointers.
Safe changes: preserve method signatures/class names referenced elsewhere in the project.
Differs from C++: runs on the JVM, has automatic garbage collection, no manual pointers.`.trim(),

  c: `
Used for: low-level systems programming, embedded devices, OS-level code.
Syntax: manual memory management, "#include <...>", semicolons, pointers "*".
Core concepts: pointers, manual memory (malloc/free), structs, no built-in classes.
Common patterns: loops with manual indexing, struct definitions, header files (.h).
Explain by: tracking memory and pointer behavior carefully, line by line.
Common errors: memory leaks, buffer overflows, missing free(), pointer misuse.
Safe changes: never remove a matching free()/malloc() pair; preserve pointer types exactly.
Differs from C++: no classes/objects, no built-in string type, manual memory only.`.trim(),

  cpp: `
Used for: performance-critical applications, games, systems software.
Syntax: like C plus classes, "std::", templates, "new"/"delete" for memory.
Core concepts: classes, objects, inheritance, templates, RAII, pointers/references.
Common patterns: constructors/destructors, STL containers (vector, map), operator overloading.
Explain by: describing both the object-oriented design and any manual memory involved.
Common errors: memory leaks, dangling pointers, missing destructors, mismatched new/delete.
Safe changes: preserve class interfaces (public methods) unless change explicitly requires it.
Differs from C: adds classes/objects/templates; differs from Java: manual memory, no JVM.`.trim(),

  php: `
Used for: server-side web development, often embedded directly in HTML.
Syntax: code inside "<?php ... ?>", variables start with "$", "->" for object access.
Core concepts: variables, functions, arrays, superglobals ($_GET/$_POST), includes.
Common patterns: form handling, database queries (often via PDO/MySQLi), sessions.
Explain by: describing what runs on the server before the page is sent to the browser.
Common errors: missing "$" on variables, unescaped user input (SQL/XSS risk), missing semicolons.
Safe changes: preserve surrounding HTML structure when editing embedded PHP blocks.
Differs from JavaScript: PHP runs on the server, not in the browser.`.trim(),

  sql: `
Used for: querying and managing relational databases.
Syntax: SELECT/INSERT/UPDATE/DELETE, FROM, WHERE, JOIN, keywords usually uppercase.
Core concepts: tables, rows/columns, primary/foreign keys, joins, indexes.
Common patterns: filtering with WHERE, joining tables, aggregating with GROUP BY/COUNT.
Explain by: describing what rows/columns the query selects, filters, or changes.
Common errors: missing WHERE on UPDATE/DELETE, wrong JOIN type, unquoted string values.
Safe changes: double-check WHERE clauses before suggesting UPDATE/DELETE statements.
Differs from general-purpose languages: declarative, describes "what" not "how".`.trim()

};

/* =========================================
   FILE EXTENSION MAP
   Reuses the same extensions already
   recognized elsewhere in chat.js.
========================================= */

const EXTENSION_MAP = {
  html: "html",
  htm: "html",
  css: "css",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  java: "java",
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  php: "php",
  sql: "sql"
};

/* =========================================
   NAME / ALIAS MAP
   Matched as whole words only, to avoid
   false positives (e.g. "java" inside
   "javascript").
========================================= */

const NAME_ALIASES = {
  html: ["html", "html5"],
  css: ["css", "css3"],
  javascript: ["javascript", "js"],
  typescript: ["typescript", "ts"],
  python: ["python", "py"],
  java: ["java"],
  c: ["c language"],
  cpp: ["c++", "cpp"],
  php: ["php"],
  sql: ["sql", "mysql", "postgresql", "sqlite"]
};

/* =========================================
   PATTERN SNIFFING
   Only a few unambiguous markers, checked
   last and only if nothing else matched.
========================================= */

const PATTERN_MARKERS = [
  { language: "php", pattern: /<\?php/i },
  { language: "html", pattern: /<!doctype html>/i },
  { language: "c", pattern: /#include\s*<[a-z.]+>/i },
  { language: "sql", pattern: /\bselect\b[\s\S]*\bfrom\b/i },
  { language: "python", pattern: /^\s*def\s+\w+\s*\([^)]*\)\s*:/m }
];

/* =========================================
   DETECT LANGUAGE

   Returns:
   { language: "python", confidence: "high" }
   { language: null, confidence: "low" }

   No network/DB calls. Pure function.
========================================= */

export function detectLanguage(message) {

  if (typeof message !== "string" || !message.trim()) {
    return { language: null, confidence: "low" };
  }

  const text = message.toLowerCase();

  // 1. Fenced code block language tag, e.g. ```python
  const fenceMatch = message.match(/```([a-zA-Z+#]+)/);

  if (fenceMatch) {

    const tag = fenceMatch[1].toLowerCase();

    const fromExtension = EXTENSION_MAP[tag];

    if (fromExtension) {
      return { language: fromExtension, confidence: "high" };
    }

    for (const [language, aliases] of Object.entries(NAME_ALIASES)) {
      if (aliases.includes(tag)) {
        return { language, confidence: "high" };
      }
    }

  }

  // 2. File extension mentioned, e.g. "style.css"
  const extensionMatch = text.match(
    /\.([a-z0-9]+)\b/
  );

  if (extensionMatch) {

    const extension = extensionMatch[1];
    const fromExtension = EXTENSION_MAP[extension];

    if (fromExtension) {
      return { language: fromExtension, confidence: "high" };
    }

  }

  // 3. Explicit language name/alias, matched as whole words
  const foundLanguages = [];

  for (const [language, aliases] of Object.entries(NAME_ALIASES)) {

    const matchesAlias = aliases.some(alias => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordBoundary = new RegExp(`\\b${escaped}\\b`, "i");
      return wordBoundary.test(text);
    });

    if (matchesAlias) {
      foundLanguages.push(language);
    }

  }

  if (foundLanguages.length === 1) {
    return { language: foundLanguages[0], confidence: "high" };
  }

  if (foundLanguages.length > 1) {
    // Ambiguous: more than one language named explicitly.
    return { language: null, confidence: "low" };
  }

  // 4. Distinctive code-pattern sniffing (last resort)
  for (const marker of PATTERN_MARKERS) {
    if (marker.pattern.test(message)) {
      return { language: marker.language, confidence: "medium" };
    }
  }

  return { language: null, confidence: "low" };

}
