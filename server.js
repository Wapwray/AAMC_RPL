const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/analysis/chat", async (req, res) => {
  const apiKey = process.env.RPL_API_KEY;
  const apiVersion = process.env.RPL_API_VERSION;
  const endpoint = process.env.RPL_AZURE_ENDPOINT;
  const deployment = process.env.RPL_DEPLOYMENT;
  const modelName = process.env.RPL_MODEL_NAME;

  if (!apiKey || !apiVersion || !endpoint || !deployment) {
    res.status(500).json({
      error:
        "Missing required environment variables: RPL_API_KEY, RPL_API_VERSION, RPL_AZURE_ENDPOINT, RPL_DEPLOYMENT.",
    });
    return;
  }

  const { prompt, temperature = 0.2, max_tokens = 300 } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Missing prompt." });
    return;
  }

  const normalizedBase = endpoint
    .replace(/\/+$/, "")
    .replace(/\/openai(\/v\d+)?$/i, "");
  const url = `${normalizedBase}/openai/deployments/${encodeURIComponent(
    deployment
  )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const body = {
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_tokens,
  };
  if (modelName) {
    body.model = modelName;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).send(text || "Azure OpenAI error");
      return;
    }

    const json = await response.json();
    const content =
      json?.choices?.[0]?.message?.content ||
      json?.choices?.[0]?.text ||
      json?.content ||
      json?.response ||
      json?.text ||
      "";

    res.json({ content, raw: json });
  } catch (error) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});

app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
