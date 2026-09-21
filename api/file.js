export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";

    const path =
      typeof req.query.path === "string"
        ? req.query.path
        : "";

    if (!token || !owner || !repo) {
      return res.status(500).json({
        error: "GitHub environment variables are not configured."
      });
    }

    if (!path) {
      return res.status(400).json({
        error: "File path is required."
      });
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || "GitHub API error."
      });
    }

    const content = Buffer.from(
      data.content || "",
      "base64"
    ).toString("utf-8");

    return res.status(200).json({
      path: data.path,
      name: data.name,
      content
    });

  } catch (error) {
    console.error("GitHub file error:", error);

    return res.status(500).json({
      error: error?.message || "Server error."
    });
  }
}
