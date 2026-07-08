const express = require("express");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

// Load environment variables from .env file (if present).
try {
  const dotenv = require("dotenv");
  dotenv.config({ path: path.join(__dirname, ".env") });
} catch {
  // dotenv not installed — env vars must come from shell/system.
}

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
const FINAL_REPORT_WEBHOOK_URL =
  process.env.FINAL_REPORT_WEBHOOK_URL ||
  "https://default63871d3cd05d49fa86b6420054699f.b4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ad445c5a35534861933f60ee864eecfa/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=qiOM0ZtGoUf_75xUdMZJ6B5zVSzpc9qYVZJbEbYm6pM";
const ASSESSOR_QUESTIONS_WEBHOOK_URL =
  process.env.ASSESSOR_QUESTIONS_WEBHOOK_URL ||
  "https://default63871d3cd05d49fa86b6420054699f.b4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/776a38fbbe6449c996fd3a4127212eff/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=kA6BlWXbHh-ymnHGDWqRt25m_BEzVEAW1vHmiYur7vw";
const URL_TRANSCRIPT_WEBHOOK_URL =
  process.env.URL_TRANSCRIPT_WEBHOOK_URL ||
  "https://default63871d3cd05d49fa86b6420054699f.b4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/41fdc1293b8547b1ac672c8aa1ccf7f8/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=32qfqtKjiupj1eLtp31QEPjPGqGSCj9AOdZ-c3Bdy7Y";
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

// Webhook endpoints - these should be secured and only accessible by authenticated users
app.post("/api/webhook/final-report", async (req, res) => {
  try {
    const response = await fetch(FINAL_REPORT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ success: false, error: `Webhook failed: ${errorText}` });
    }
    
    const result = await response.json();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

app.post("/api/webhook/assessor-questions", async (req, res) => {
  try {
    const response = await fetch(ASSESSOR_QUESTIONS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ success: false, error: `Webhook failed: ${errorText}` });
    }
    
    const result = await response.json();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

app.post("/api/webhook/transcript", async (req, res) => {
  try {
    const response = await fetch(URL_TRANSCRIPT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ success: false, error: `Webhook failed: ${errorText}` });
    }
    
    const result = await response.json();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || String(error) });
  }
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

// DEBUG: dump current model config (remove after verifying)
app.get("/api/debug/models", (_req, res) => {
  try {
    const modes = ["ROUTER", "ASSESSOR", "FINAL"];
    const result = {};
    let hasConfig = false;

    for (const mode of modes) {
      const pfx = `RPL_${mode}`;
      const endpoint = process.env[`${pfx}_AZURE_ENDPOINT`] || "";
      const deployment = process.env[`${pfx}_DEPLOYMENT`] || "";
      const modelName = process.env[`${pfx}_MODEL_NAME`] || "";
      const apiVersion = process.env[`${pfx}_API_VERSION`] || "";

      result[mode] = {
        endpoint: endpoint || "(not set)",
        deployment: deployment || "(not set)",
        model_name: modelName || "(uses deployment name)",
        api_version: apiVersion || "auto-detect",
        has_config: !!(endpoint && deployment),
      };

      if (endpoint && deployment) hasConfig = true;
    }

    // Check for API key presence (don't expose the actual key)
    const assessorKey = process.env["RPL_ASSESSOR_API_KEY"];
    result.api_key_status = {
      assessor: assessorKey ? `Set (${assessorKey.length} chars)` : "(not set)",
    };

    // Return HTML for easy browser viewing
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>RPL Model Config Debug</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #1a1a1a; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e5e5; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .status-ok { color: #059669; font-weight: 600; }
    .status-missing { color: #dc2626; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
  </style>
</head>
<body>
  <h1>RPL Model Configuration Debug</h1>
  <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>

  <div class="card">
    <h2>Configuration Status</h2>
    <table>
      <tr><th>Mode</th><th>Status</th></tr>
      ${modes.map(mode => `
        <tr>
          <td><strong>${mode}</strong></td>
          <td class="${result[mode].has_config ? 'status-ok' : 'status-missing'}">
            ${result[mode].has_config ? "✓ Configured" : "✗ Not configured"}
          </td>
        </tr>`).join("")}
    </table>
  </div>

  <div class="card">
    <h2>Detailed Settings</h2>
    ${modes.map(mode => `
      <div style="margin-bottom: 16px;">
        <h3>${mode}</h3>
        <pre>{
  "endpoint": "${result[mode].endpoint}",
  "deployment": "${result[mode].deployment}",
  "model_name": "${result[mode].model_name}",
  "api_version": "${result[mode].api_version}"
}</pre>
      </div>`).join("")}
  </div>

  <div class="card">
    <h2>API Key Status</h2>
    <pre>${JSON.stringify(result.api_key_status, null, 2)}</pre>
  </div>

  <details>
    <summary>Show raw JSON response</summary>
    <pre>${JSON.stringify(result, null, 2)}</pre>
  </details>
</body>
</html>`;
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/analysis/chat", async (req, res) => {
  const modeHeader = String(req.headers["x-rpl-mode"] || "").toLowerCase();
  
  console.log(`[AI] ========== /api/analysis/chat called ==========`);
  console.log(`[AI] x-rpl-mode header: "${modeHeader}"`);

  let apiKey, apiVersion, endpoint, deployment, modelName, useOpenAiV1;
  let authHeader = "api-key";

  const isDeepseek = modeHeader === "deepseek";
  
  console.log(`[AI] isDeepseek=${isDeepseek}`);
  const isFinal = !isDeepseek && modeHeader === "final";
  const isAssessor = !isDeepseek && modeHeader === "assessor";

  if (isDeepseek) {
    const deepEndpoint = String(process.env["RPL_DEEPSEEK_MODEL_ENDPOINT"] || "").replace(/\/+$/, "");
    const deepModelName = process.env["RPL_DEEPSEEK_MODEL_NAME"] || "deepseek-chat";
    const deepApiVersion = process.env["RPL_DEEPSEEK_MODEL_VERSION"] || "v1";
    const deepApiKey = process.env["RPL_DEEPSEEK_MODEL_API_KEY"] || "";

    apiKey = deepApiKey;

    if (!deepApiVersion) {
      res.status(500).json({ error: "Missing RPL_DEEPSEEK_MODEL_VERSION environment variable." });
      return;
    }
    if (!deepApiKey) {
      res.status(500).json({ error: "Missing RPL_DEEPSEEK_MODEL_API_KEY environment variable." });
      return;
    }
    endpoint = deepEndpoint;
    modelName = deepModelName;
    apiVersion = deepApiVersion;
    deployment = deepModelName;
    useOpenAiV1 = true;
    authHeader = "api-key";
  } else {
    const envPrefix = isFinal ? "RPL_FINAL" : isAssessor ? "RPL_ASSESSOR" : "RPL_ROUTER";
    const getModelEnv = (suffix) => process.env[`${envPrefix}_${suffix}`] || "";

    apiKey = getModelEnv("API_KEY");
    apiVersion = getModelEnv("API_VERSION");
    endpoint = getModelEnv("AZURE_ENDPOINT");
    deployment = getModelEnv("DEPLOYMENT");
    modelName = getModelEnv("MODEL_NAME");
    
    // Default to OpenAI v1 format for non-Deepseek modes (matches original working behavior).
    useOpenAiV1 = true;  // Always true unless explicitly overridden
    
    // Allow override via API_STYLE env var or endpoint pattern
    const apiStyleOverride = getModelEnv("API_STYLE").toLowerCase();
    if (apiStyleOverride === "legacy" || apiStyleOverride === "azure-native") {
      useOpenAiV1 = false;
    } else if (/\/openai\/v\d$/i.test(String(endpoint || "").replace(/\/+$/, ""))) {
      // Endpoint already ends with /openai/vN — no need to append again.
      useOpenAiV1 = true;
    }

    // Validate required env vars based on mode
    const missingVars = [];
    if (!apiKey) missingVars.push("API_KEY");
    if (!endpoint) missingVars.push("AZURE_ENDPOINT");
    if (!deployment) missingVars.push("DEPLOYMENT");
    if (!useOpenAiV1 && !apiVersion) missingVars.push("API_VERSION (required when API_STYLE is legacy/azure-native)");

    if (missingVars.length > 0) {
      console.error(`[AI] Missing env vars for ${envPrefix}:`);
      console.error(`  API_KEY: ${!!apiKey}`);
      console.error(`  AZURE_ENDPOINT: ${!!endpoint}`);
      console.error(`  DEPLOYMENT: ${!!deployment}`);
      console.error(`  useOpenAiV1: ${useOpenAiV1}, API_VERSION: ${!!apiVersion}`);
      res.status(500).json({
        error: `Missing required ${envPrefix}_* environment variables.`,
      });
      return;
    }
  }

  const { prompt, temperature = 0.2, max_tokens = 300 } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Missing prompt." });
    return;
  }

  // Build URL based on mode (Deepseek vs Azure OpenAI)
  const endpointBase = String(endpoint || "").replace(/\/+$/, "");
  
  let url;
  if (isDeepseek) {
    const deepVersion = String(apiVersion || "v1").replace(/^\/+|\/+$/g, "") || "v1";
    const deepBase = endpointBase
      .replace(/\/?chat\/completions$/i, "")
      .replace(/\/?openai\/v\d+$/i, "")
      .replace(/\/?openai$/i, "");
    url = `${deepBase}/openai/${deepVersion}/chat/completions`;
  } else {
    const normalizedBase = endpointBase
      .replace(/\/api\/projects\/[^/]+$/i, "")
      .replace(/\/openai(\/v\d+)?$/i, "");
    
    if (useOpenAiV1) {
      url = `${normalizedBase}/openai/v1/chat/completions`;
    } else {
      url = `${normalizedBase}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    }
  }

  console.log(`[AI] Mode: ${modeHeader} | Deepseek: ${isDeepseek} | URL: ${url} | Model: ${modelName}`);

  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: prompt },
  ];

  const requestedMaxTokens = Number.isFinite(Number(max_tokens)) ? Number(max_tokens) : 300;
  const resolvedMaxTokens = isFinal
    ? Math.max(1200, requestedMaxTokens)
    : isDeepseek
      ? Math.max(450, requestedMaxTokens)
      : isAssessor
        ? Math.max(450, requestedMaxTokens)
        : Math.max(800, requestedMaxTokens);

  const body = {
    messages,
    model: modelName || deployment,
  };
  if (!useOpenAiV1) {
    body.temperature = temperature;
  }
  if (useOpenAiV1) {
    body.max_completion_tokens = resolvedMaxTokens;
  } else {
    body.max_tokens = resolvedMaxTokens;
  }

  try {
    const authValue = apiKey;

    console.log(`[AI] Auth header: ${authHeader} | Model: ${modelName}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [authHeader]: authValue,
      },
      body: JSON.stringify(body),
    });

    console.log(`[AI] Upstream status: ${response.status} | URL: ${url}`);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[AI] Upstream error (${response.status}):`, text.substring(0, 500));
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
