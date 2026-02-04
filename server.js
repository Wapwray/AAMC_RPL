const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/speech/token", async (_req, res) => {
  const speechKey = process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION || process.env.SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    res.status(500).json({
      error: "Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION environment variables.",
    });
    return;
  }

  const tokenUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": speechKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).send(text || "Azure Speech token error");
      return;
    }

    const token = await response.text();
    res.json({
      token,
      region: speechRegion,
      expiresIn: 540,
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});

app.post("/api/analysis/chat", async (req, res) => {
  const modeHeader = String(req.headers["x-rpl-mode"] || "").toLowerCase();
  const isFinal = modeHeader === "final";
  const useRouter = !isFinal;

  const apiKey = isFinal ? process.env.RPL_FINAL_API_KEY : process.env.RPL_ROUTER_API_KEY;
  const apiVersion = isFinal ? process.env.RPL_FINAL_API_VERSION : process.env.RPL_ROUTER_API_VERSION;
  const endpoint = isFinal ? process.env.RPL_FINAL_AZURE_ENDPOINT : process.env.RPL_ROUTER_AZURE_ENDPOINT;
  const deployment = isFinal ? process.env.RPL_FINAL_DEPLOYMENT : process.env.RPL_ROUTER_DEPLOYMENT;
  const modelName = isFinal ? process.env.RPL_FINAL_MODEL_NAME : process.env.RPL_ROUTER_MODEL_NAME;

  if (!apiKey || !apiVersion || !endpoint || !deployment) {
    res.status(500).json({
      error: isFinal
        ? "Missing required RPL_FINAL_* environment variables."
        : "Missing required RPL_ROUTER_* environment variables.",
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

  const messages = useRouter || isFinal
    ? [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ]
    : [{ role: "user", content: prompt }];

  const requestedMaxTokens = Number.isFinite(Number(max_tokens)) ? Number(max_tokens) : 300;
  const resolvedMaxTokens = isFinal
    ? Math.max(1200, requestedMaxTokens)
    : useRouter
      ? Math.max(800, requestedMaxTokens)
      : requestedMaxTokens;

  const body = {
    messages,
    temperature,
    max_tokens: resolvedMaxTokens,
    model: modelName || deployment,
  };

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

    const extractContent = (payload) => {
      if (!payload) return "";
      const direct =
        payload?.choices?.[0]?.message?.content ||
        payload?.choices?.[0]?.text ||
        payload?.content ||
        payload?.response ||
        payload?.text;
      if (typeof direct === "string") return direct;
      if (Array.isArray(direct)) {
        const parts = direct
          .map((part) => (typeof part?.text === "string" ? part.text : ""))
          .filter(Boolean);
        if (parts.length) return parts.join("");
      }
      const contentArray = payload?.choices?.[0]?.message?.content;
      if (Array.isArray(contentArray)) {
        const parts = contentArray
          .map((part) => (typeof part?.text === "string" ? part.text : ""))
          .filter(Boolean);
        if (parts.length) return parts.join("");
      }
      return "";
    };

    const content = extractContent(json);
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
