export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";

    if (!token || !owner || !repo) {
      return res.status(500).json({
        error: "GitHub environment variables are not configured."
      });
    }

    const {
      path,
      content,
      message
    } = req.body || {};

    if (
      typeof path !== "string" ||
      !path.trim()
    ) {
      return res.status(400).json({
        error: "File path is required."
      });
    }

    if (typeof content !== "string") {
      return res.status(400).json({
        error: "File content is required."
      });
    }

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Commit message is required."
      });
    }

    const cleanPath = path
      .trim()
      .replace(/^\/+/, "");

    if (
      cleanPath.startsWith(".git/") ||
      cleanPath.includes("..")
    ) {
      return res.status(400).json({
        error: "Invalid file path."
      });
    }

    const apiUrl =
      `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

    // Get the current file SHA.
    let existingSha = null;

    const existingResponse = await fetch(
      `${apiUrl}?ref=${encodeURIComponent(branch)}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );

    if (existingResponse.ok) {
      const existingData = await existingResponse.json();
      existingSha = existingData.sha || null;
    } else if (existingResponse.status !== 404) {
      const errorData = await existingResponse.json().catch(() => ({}));

      return res.status(existingResponse.status).json({
        error:
          errorData?.message ||
          "Unable to read the existing GitHub file."
      });
    }

    const body = {
      message: message.trim(),
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch
    };

    if (existingSha) {
      body.sha = existingSha;
    }

    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.message ||
          "GitHub commit failed."
      });
    }

    return res.status(200).json({
      success: true,
      message: "GitHub commit completed.",
      path: cleanPath,
      branch,
      commit: data?.commit
        ? {
            sha: data.commit.sha,
            message: data.commit.message
          }
        : null
    });

  } catch (error) {
    console.error("GitHub commit error:", error);

    return res.status(500).json({
      error: error?.message || "Server error."
    });
  }
}
