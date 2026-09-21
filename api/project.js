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

    if (!token || !owner || !repo) {
      return res.status(500).json({
        error: "GitHub environment variables are not configured."
      });
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
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

    const files = (data.tree || [])
      .filter(item => item.type === "blob")
      .map(item => item.path);

    return res.status(200).json({
      owner,
      repo,
      branch,
      files
    });

  } catch (error) {
    console.error("GitHub project error:", error);

    return res.status(500).json({
      error: error?.message || "Server error."
    });
  }
}
