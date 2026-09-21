export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      message,
      approved = false
    } = req.body || {};

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const openRouterKey =
      process.env.OPENROUTER_API_KEY;

    if (!openRouterKey) {
      return res.status(500).json({
        error: "OPENROUTER_API_KEY is not configured."
      });
    }

    const githubToken =
      process.env.GITHUB_TOKEN;

    const githubOwner =
      process.env.GITHUB_OWNER;

    const githubRepo =
      process.env.GITHUB_REPO;

    const githubBranch =
      process.env.GITHUB_BRANCH || "main";

    if (
      !githubToken ||
      !githubOwner ||
      !githubRepo
    ) {
      return res.status(500).json({
        error: "GitHub environment variables are not configured."
      });
    }

    // Read the project file tree.
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

    const treeData = await treeResponse.json();

    if (!treeResponse.ok) {
      return res.status(treeResponse.status).json({
        error:
          treeData?.message ||
          "Unable to read GitHub project."
      });
    }

    const files = (treeData.tree || [])
      .filter(item => item.type === "blob")
      .map(item => item.path);

    const systemPrompt = `
You are Coding AI, a careful coding agent.

Your job at this stage is PLAN ONLY.

The user wants:
${message.trim()}

GitHub project:
${githubOwner}/${githubRepo}
Branch:
${githubBranch}

Files in the project:
${files.join("\n")}

Rules:
- Understand the user's request.
- Do not claim that you changed any file.
- Do not create a commit.
- Do not expose secrets.
- Do not invent files or existing functionality.
- Explain which files would need to change.
- Explain the intended changes briefly.
- Ask the user for approval before any actual modification or commit.
- Reply in the same language as the user.

Return a concise plan and an explicit approval request.
`;

    const aiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${openRouterKey}`,
          "HTTP-Referer":
            "https://coding-ai-six.vercel.app",
          "X-Title": "Coding AI"
        },
        body: JSON.stringify({
          model:
            "inclusionai/ling-3.0-flash-vl:free",
          messages: [
            {
              role: "system",
              content: systemPrompt
            }
          ]
        })
      }
    );

    const responseText =
      await aiResponse.text();

    let aiData;

    try {
      aiData = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        error:
          "OpenRouter returned an invalid response."
      });
    }

    if (!aiResponse.ok) {
      return res.status(aiResponse.status).json({
        error:
          aiData?.error?.message ||
          "OpenRouter API error."
      });
    }

    const plan =
      aiData?.choices?.[0]?.message?.content ||
      "AI មិនបានបង្កើតផែនការទេ។";

    return res.status(200).json({
      success: true,
      approved: Boolean(approved),
      status: "waiting_approval",
      plan,
      files
    });

  } catch (error) {
    console.error("Agent error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Agent server error."
    });
  }
}
