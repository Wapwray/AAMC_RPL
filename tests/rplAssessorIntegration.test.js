const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const livePage = fs.readFileSync(path.join(root, "public", "AAMC RPL 2026.html"), "utf8");
const q3Page = fs.readFileSync(path.join(root, "public", "AAMC RPL 2026 Q3.html"), "utf8");
const autoTesterPage = fs.readFileSync(path.join(root, "public", "AAMC RPL 2026 Q3 Auto Tester.html"), "utf8");
const assessorDecision = require("../public/rpl-assessor-decision");

test("server builds assessor Responses API requests from existing RPL_ASSESSOR settings", () => {
  assert.match(server, /RPL_ASSESSOR_AZURE__REASONING_EFFORT/);
  assert.match(server, /RPL_ASSESSOR_AZURE__VERBOSITY/);
  assert.match(server, /RPL_ASSESSOR_AZURE__MAX_OUTPUT_TOKENS/);
  assert.match(server, /RPLPromptPackV3\.makeAssessmentRequest\(\s*deployment,\s*assessmentPayload/);
  assert.match(server, /const isResponsesApiModel = isAssessor \|\|/);
  assert.match(server, /modelName = isAssessor \? "" : getModelEnv\("MODEL_NAME"\)/);
  assert.match(server, /response\.status === 429 \|\| response\.status >= 500/);
  assert.match(server, /maxRetries: 2/);
});

test("live page sends dynamic assessment data separately without sampling parameters", () => {
  assert.equal(typeof assessorDecision.buildAssessmentPayload, "function");
  const assessorRequest = livePage.match(/const requestBody = isAssessmentRequest([\s\S]*?)const requestHeaders/);
  assert.ok(assessorRequest);
  assert.match(assessorRequest[1], /assessmentPayload: prompt/);
  assert.doesNotMatch(assessorRequest[1].split(": {", 2)[0], /temperature|top_p/);
  assert.match(livePage, /buildAssessmentPayload\(\{/);
  assert.doesNotMatch(livePage.match(/const buildPrompt = \(question, answers\) => \{([\s\S]*?)\n      \};/)[1], /fullName|givenName|contactId|maxAttempts/);
  assert.match(livePage, /entry\.attempts\.push\(attemptRecord\);[\s\S]*?evaluateAssessorPrompt/);
  assert.match(livePage, /const parseAndValidateAssessorDecision = \(responseText, attemptCount\)/);
  assert.match(livePage, /learnerEvidenceText: currentResponses\.join\("\\n"\)/);
  assert.match(livePage, /appendAiDebugEntry\(`\$\{debugLabel\} validation retry`/);
  assert.match(livePage, /evaluateAssessorPrompt\(prompt, \{[\s\S]*?attemptCount: currentAttempts/);
  assert.match(livePage, /The automated preliminary assessment was unavailable\. Assessor review is required\./);
  assert.match(livePage, /setAttemptLockState\(true\);[\s\S]*?nextDisabled: false, evaluateDisabled: true/);
});

test("technical assessment failures are not exported as likely sufficient", () => {
  const statusHelper = livePage.match(/const getOverallAssessment = \(feedback\) => \{([\s\S]*?)\n      \};/);
  assert.ok(statusHelper);
  assert.match(statusHelper[1], /automated preliminary assessment was unavailable/);
  assert.match(statusHelper[1], /response has been recorded and will be provided to the assessor for review/);
  assert.match(statusHelper[1], /return "";\s*$/);
});

test("Q3 and Auto Tester inherit the current live application source", () => {
  assert.match(q3Page, /const SOURCE_FILE = "AAMC RPL 2026\.html"/);
  assert.match(autoTesterPage, /const SOURCE_FILE = "AAMC RPL 2026\.html"/);
});
