const express = require("express");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const INDUSTRY_API_URL =
  "https://default63871d3cd05d49fa86b6420054699f.b4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/cdaf89af8b5349478d4801c5d3bc1587/triggers/manual/paths/invoke?api-version=1";
const LIVE_ASSESSMENT_QUESTIONS_URL =
  process.env.LIVE_ASSESSMENT_QUESTIONS_URL ||
  "https://default63871d3cd05d49fa86b6420054699f.b4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/4e73e4946e2f4d68a1c327ffd94ab86e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=PL4kQafihKKASyjQ6277VCbFKpq76tRgecIcNrKuBps";
const MS_TEAMS_CLIENT_ID =
  process.env.MS_TEAMS_CLIENT_ID ||
  process.env.MICROSOFT_CLIENT_ID ||
  process.env.AZURE_CLIENT_ID ||
  "";
const MS_TEAMS_TENANT_ID =
  process.env.MS_TEAMS_TENANT_ID ||
  process.env.AZURE_TENANT_ID ||
  "63871d3c-d05d-49fa-86b6-420054699fb4";
const INDUSTRY_FALLBACK_ITEMS = [
  { Title: "Banking" },
  { Title: "Lending" },
  { Title: "Mortgage Broking" },
  { Title: "Finance Broking" },
];

const app = express();
const port = process.env.PORT || 3000;
const jsonBodyLimit = process.env.RPL_FILTER_MAX_BODY_SIZE || process.env.RPL_JSON_BODY_LIMIT || "2mb";
const promptsFilePath = path.join(__dirname, "public", "prompts.json");
const promptAdminKey = process.env.RPL_PROMPTS_ADMIN_KEY || process.env.RPL_ADMIN_API_KEY || "";

app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.static(path.join(__dirname, "public")));

const getRplFilter = () => {
  try {
    return require("./dist/rpl-filter/rplFilter").filterRplQuestions;
  } catch (error) {
    const nextError = new Error("RPL filter module is not built. Run npm run build before starting the server.");
    nextError.cause = error;
    throw nextError;
  }
};

const getHeader = (req, name) => {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
};

const safeEquals = (provided, expected) => {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const requireRplFilterAuth = (req, res, next) => {
  const apiKey = process.env.RPL_FILTER_API_KEY || process.env.RPL_API_KEY || "";
  const bearerToken = process.env.RPL_FILTER_BEARER_TOKEN || process.env.RPL_FILTER_TOKEN || "";

  if (!apiKey && !bearerToken) {
    res.status(503).json({
      success: false,
      error: "RPL filter API authentication is not configured. Set RPL_FILTER_API_KEY or RPL_FILTER_BEARER_TOKEN.",
    });
    return;
  }

  const providedApiKey = getHeader(req, "x-api-key") || getHeader(req, "api-key");
  const authHeader = getHeader(req, "authorization");
  const providedBearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  if ((apiKey && safeEquals(providedApiKey, apiKey)) || (bearerToken && safeEquals(providedBearer, bearerToken))) {
    next();
    return;
  }

  res.status(401).json({ success: false, error: "Missing or invalid RPL filter API credentials." });
};

const requirePromptAdminAuth = (req, res, next) => {
  if (!promptAdminKey) {
    next();
    return;
  }

  const providedApiKey = getHeader(req, "x-admin-key") || getHeader(req, "x-api-key") || getHeader(req, "api-key");
  const authHeader = getHeader(req, "authorization");
  const providedBearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  if (safeEquals(providedApiKey, promptAdminKey) || safeEquals(providedBearer, promptAdminKey)) {
    next();
    return;
  }

  res.status(401).json({ success: false, error: "Missing or invalid prompt admin credentials." });
};

const readPromptsFile = async () => {
  const raw = await fs.readFile(promptsFilePath, "utf8");
  return JSON.parse(raw);
};

const writePromptsFile = async (prompts) => {
  await fs.writeFile(promptsFilePath, `${JSON.stringify(prompts, null, 2)}\n`, "utf8");
};

app.post("/api/prompts", requirePromptAdminAuth, async (req, res) => {
  const body = req.body || {};
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, "assessmentPrompt")) {
    if (typeof body.assessmentPrompt !== "string") {
      res.status(400).json({ success: false, error: "assessmentPrompt must be a string." });
      return;
    }
    updates.assessmentPrompt = body.assessmentPrompt;
  }

  if (Object.prototype.hasOwnProperty.call(body, "finalReviewPrompt")) {
    if (typeof body.finalReviewPrompt !== "string") {
      res.status(400).json({ success: false, error: "finalReviewPrompt must be a string." });
      return;
    }
    updates.finalReviewPrompt = body.finalReviewPrompt;
  }

  if (!Object.keys(updates).length) {
    res.status(400).json({ success: false, error: "No prompt updates were supplied." });
    return;
  }

  try {
    const currentPrompts = await readPromptsFile();
    const nextPrompts = { ...currentPrompts, ...updates };
    await writePromptsFile(nextPrompts);
    res.json({ success: true, prompts: nextPrompts });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

app.get("/api/teams-auth-config", (req, res) => {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || req.protocol || "https";
  const baseUrl = `${proto}://${host}`;

  res.json({
    clientId: MS_TEAMS_CLIENT_ID,
    tenantId: MS_TEAMS_TENANT_ID,
    redirectUri: `${baseUrl}/Live%20Assessment.html`,
  });
});

app.post("/api/industries", async (req, res) => {
  const bearerToken =
    process.env.POWER_AUTOMATE_BEARER_TOKEN ||
    process.env.POWER_PLATFORM_BEARER_TOKEN ||
    process.env.RPL_POWER_AUTOMATE_BEARER_TOKEN ||
    "";
  const requestUrl = typeof req.body?.upstreamUrl === "string" ? req.body.upstreamUrl.trim() : "";
  const upstreamUrl = requestUrl || INDUSTRY_API_URL;

  try {
    const headers = { "Content-Type": "application/json" };
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    const text = await response.text();

    if (response.ok) {
      res.status(200).json({
        source: "upstream",
        upstreamStatus: response.status,
        rawText: text,
      });
      return;
    }

    if (response.status === 401) {
      res.status(200).json({
        source: "fallback",
        upstreamStatus: response.status,
        error: "DirectApiAuthorizationRequired",
        rawText: JSON.stringify({
          statusCode: "200",
          body: {
            listitems: JSON.stringify(INDUSTRY_FALLBACK_ITEMS),
          },
        }),
      });
      return;
    }

    res.status(response.status).send(text || "Industry API error");
  } catch (error) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});

app.post("/api/live-assessment/questions", async (_req, res) => {
  try {
    const response = await fetch(LIVE_ASSESSMENT_QUESTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const text = await response.text();

    res.status(response.status);
    res.type(response.headers.get("content-type") || "application/json");
    res.send(text || "");
  } catch (error) {
    res.status(500).json({ error: error?.message || String(error) });
  }
});

app.post("/api/rpl/filter", requireRplFilterAuth, (req, res) => {
  const body = req.body || {};
  const errors = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    errors.push("Request body must be a JSON object.");
  }
  if (!Array.isArray(body.units)) {
    errors.push("Request body must include a units array.");
  }
  if (!Array.isArray(body.questions)) {
    errors.push("Request body must include a questions array.");
  }
  if (body.config !== undefined && (!body.config || typeof body.config !== "object" || Array.isArray(body.config))) {
    errors.push("config must be a JSON object when provided.");
  }

  if (errors.length) {
    res.status(400).json({ success: false, error: "Invalid RPL filter request.", details: errors });
    return;
  }

  try {
    const filterRplQuestions = getRplFilter();
    const result = filterRplQuestions({
      units: body.units,
      questions: body.questions,
      config: body.config || {},
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || String(error),
    });
  }
});

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
  const isAssessor = modeHeader === "assessor";
  const envPrefix = isFinal ? "RPL_FINAL" : isAssessor ? "RPL_ASSESSOR" : "RPL_ROUTER";
  const getModelEnv = (suffix) => process.env[`${envPrefix}_${suffix}`] || "";

  const apiKey = getModelEnv("API_KEY");
  const apiVersion = getModelEnv("API_VERSION");
  const endpoint = getModelEnv("AZURE_ENDPOINT");
  const deployment = getModelEnv("DEPLOYMENT");
  const modelName = getModelEnv("MODEL_NAME");
  const apiStyle = getModelEnv("API_STYLE").toLowerCase();
  const endpointBase = String(endpoint || "").replace(/\/+$/, "");
  const useOpenAiV1 = apiStyle === "v1" ||
    apiStyle === "openai-v1" ||
    /\/openai\/v1$/i.test(endpointBase) ||
    (isAssessor && !apiVersion);

  if (!apiKey || !endpoint || !deployment || (!useOpenAiV1 && !apiVersion)) {
    res.status(500).json({
      error: `Missing required ${envPrefix}_* environment variables.`,
    });
    return;
  }

  const { prompt, temperature = 0.2, max_tokens = 300 } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Missing prompt." });
    return;
  }

  const normalizedBase = endpointBase
    .replace(/\/api\/projects\/[^/]+$/i, "")
    .replace(/\/+$/, "")
    .replace(/\/openai(\/v\d+)?$/i, "");
  const url = useOpenAiV1
    ? `${normalizedBase}/openai/v1/chat/completions`
    : `${normalizedBase}/openai/deployments/${encodeURIComponent(
        deployment
      )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: prompt },
  ];

  const requestedMaxTokens = Number.isFinite(Number(max_tokens)) ? Number(max_tokens) : 300;
  const resolvedMaxTokens = isFinal
    ? Math.max(1200, requestedMaxTokens)
    : isAssessor
      ? Math.max(900, requestedMaxTokens)
      : Math.max(800, requestedMaxTokens);

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

app.use((error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    res.status(413).json({
      success: false,
      error: `Request body is too large. Maximum JSON body size is ${jsonBodyLimit}.`,
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ success: false, error: "Invalid JSON request body." });
    return;
  }

  next(error);
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
