const test = require("node:test");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const fixtures = require("./fixtures/rpl-prompt-regression-fixtures-v3.json");
const promptPack = require("../public/rpl-prompt-pack-v3");

const shouldRun = process.env.RPL_RUN_LIVE_PROMPT_TESTS === "1";
const endpoint = process.env.RPL_LIVE_TEST_URL || "http://127.0.0.1:3000/api/analysis/chat";

if (!shouldRun) {
  test.skip("live GPT-5.4 prompt-pack regression tests require RPL_RUN_LIVE_PROMPT_TESTS=1", () => {});
} else {
  test("live GPT-5.4 prompt-pack fixtures return parseable structured assessments", { timeout: 300000 }, async (t) => {
    const diagnostics = [];

    for (const fixture of fixtures.fixtures) {
      const startedAt = performance.now();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rpl-mode": "assessor",
        },
        body: JSON.stringify({
          prompt: promptPack.buildAssessmentPrompt(fixture.payload),
          max_tokens: 1600,
          responseSchemaKey: "assessment",
        }),
      });

      assert.equal(response.ok, true, `${fixture.id} HTTP ${response.status}`);
      const payload = await response.json();
      const text = String(payload?.content || "").trim();
      const parsed = JSON.parse(text);
      assert.ok(parsed.overallAssessment === "LIKELY SUFFICIENT" || parsed.overallAssessment === "ADDITIONAL EVIDENCE MAY BE NEEDED", fixture.id);

      diagnostics.push({
        fixtureId: fixture.id,
        promptPackVersion: fixtures.version,
        modelDeployment: payload?.raw?.model || "unknown",
        status: payload?.raw?.status || "unknown",
        incompleteReason: payload?.raw?.incomplete_details?.reason || "",
        latencyMs: Math.round(performance.now() - startedAt),
      });
    }

    t.diagnostic(JSON.stringify(diagnostics, null, 2));
  });
}
