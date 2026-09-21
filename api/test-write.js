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

    const path = "WRITE_TEST.txt";

    const apiUrl =
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

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

    let sha = null;

    if (existingResponse.ok) {
      const existingData = await existingResponse.json();
      sha = existingData.sha;
    } else if (existingResponse.status !== 404) {
      const errorData = await existingResponse.json().catch(() => ({}));

      return res.status(existingResponse.status).json({
        error: errorData?.message || "GitHub read failed."
      });
    }

    const body = {
      message: "Test GitHub Write access",
      content: Buffer.from(
        "GitHub Write test successful."
      ).toString("base64"),
      branch
    };

    if (sha) {
      body.sha = sha;
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
        error: data?.message || "GitHub Write failed."
      });
    }

    return res.status(200).json({
      success: true,
      message: "GitHub Write test successful.",
      file: path,
      commit: data?.commit?.sha || null
    });

  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Server error."
    });
  }
}
