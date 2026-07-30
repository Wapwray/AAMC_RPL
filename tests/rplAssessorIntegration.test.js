const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const livePage = fs.readFileSync(path.join(root, "public", "AAMC RPL 2026.html"), "utf8");
const q3Page = fs.readFileSync(path.join(root, "public", "AAMC RPL 2026 Q3.html"), "utf8");
const autoTesterPage = fs.readFileSync(path.join(root, "public", "AAMC RPL 2026 Q3 Auto Tester.html"), "utf8");
const emailerPage = fs.readFileSync(path.join(root, "public", "RPL Emailer.html"), "utf8");
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

test("attempt persistence sends compact records instead of full transcript files", () => {
  assert.match(livePage, /<script src="rpl-incremental-persistence\.js"><\/script>/);
  const compactSave = livePage.match(/const sendCurrentAttemptOnEvaluate = async \(([\s\S]*?)\n      \};\n\n      const sendFinalReconstitutionWebhook/);
  assert.ok(compactSave);
  assert.match(compactSave[0], /FileName: fileName/);
  assert.match(compactSave[0], /AttemptRecord: incremental \? JSON\.stringify\(incremental\.envelope\) : ""/);
  assert.doesNotMatch(compactSave[0], /FullTranscript|AI Performance Log/);
  assert.match(livePage, /aiPerformanceLogEntries\.slice\(incrementalAiLogCursor, aiLogEnd\)/);
  assert.match(livePage, /incrementalAiLogCursor = Math\.max/);
});

test("moving to the next question updates the legacy question progress markers", () => {
  assert.match(
    livePage,
    /transcript:\s*"https:\/\/[^"]+\/workflows\/903538467bfb426fb4b074ef9cc3caa4\/triggers\/manual\/paths\/invoke\?/
  );
  const progressSave = livePage.match(
    /const sendQuestionProgressOnNext = async \(currentQuestion\) => \{([\s\S]*?)\n      \};/
  );
  assert.ok(progressSave);
  assert.match(progressSave[1], /CurrentQuestion: String\(currentQuestion\)/);
  assert.match(progressSave[1], /fetchWithTimeout\(TRANSCRIPT_WEBHOOK_URL/);
  assert.match(
    livePage,
    /Promise\.all\(\[\s*sendQuestionProgressOnNext\(nextQuestionValue\),\s*sendNextWebhook\(\),\s*sendResetAttemptWebhook\(\)/
  );
});

test("resume prefers compact attempt records and retains a legacy fallback", () => {
  assert.match(livePage, /INCREMENTAL_RESUME_WEBHOOK_URL/);
  assert.match(livePage, /mergeAttemptRecords\(attemptRecords\)/);
  assert.match(livePage, /applyIncrementalResume\(\)/);
  assert.match(livePage, /postResumeRequest\(RESUME_WEBHOOK_URL, `\$\{label\} legacy fallback`\)/);
});

test("canonical transcript and AI log files are reconstituted once at completion", () => {
  const finalSave = livePage.match(/const sendFinalReconstitutionWebhook = async \(\) => \{([\s\S]*?)\n      \};/);
  assert.ok(finalSave);
  assert.match(finalSave[1], /FullTranscript: finalTranscript/);
  assert.match(finalSave[1], /FullTranscriptJSON: finalTranscriptJson/);
  assert.match(finalSave[1], /"AI Performance Log": finalAiLog/);
  assert.match(livePage, /await sendFinalReconstitutionWebhook\(\);\s*await sendFinalQuestionCompletedWebhook\(\);/);
});

test("new interviews wait for the student SharePoint structure to be ready", () => {
  const structureFlow = livePage.match(
    /const ensureStudentAssessmentStructure = async \(([\s\S]*?)\n      \};/
  );
  assert.ok(structureFlow);
  assert.match(structureFlow[0], /const structureResponse = await fetchWithTimeout\(structureWebhookUrl/);
  assert.match(structureFlow[0], /GivenName:/);
  assert.match(structureFlow[0], /Industry: industryValue/);
  assert.match(structureFlow[0], /jobTitle: jobValue/);
  assert.match(structureFlow[0], /if \(!structureResponse\.ok\)/);
  assert.doesNotMatch(structureFlow[0], /Base64Data|ContentType|FileName:/);
  assert.match(livePage, /await ensureStudentAssessmentStructure\(\{ ctx, industryValue, jobValue \}\);/);
});

test("declaration submission also saves the standard student photo before questions begin", () => {
  assert.match(
    livePage,
    /photoSaver:\s*"https:\/\/[^"]+\/workflows\/eed37019d13445dca3ed1328184834cd\/triggers\/manual\/paths\/invoke\?/
  );
  assert.match(
    livePage,
    /createUserFolder:\s*"https:\/\/[^"]+\/workflows\/b4b86e7b16654f45bd2b7308c92d239f\/triggers\/manual\/paths\/invoke\?/
  );
  const photoSave = livePage.match(
    /const saveStandardStudentPhoto = async \(\{ ctx, photoDataUrl \}\) => \{([\s\S]*?)\n      \};/
  );
  assert.ok(photoSave);
  assert.match(photoSave[1], /FileName: fileName/);
  assert.match(photoSave[1], /const fileName = `\$\{ctx\.fullName\} - \$\{ctx\.contactId\} - Photo`/);
  assert.match(photoSave[1], /ContentType: "image\/jpeg"/);
  assert.match(photoSave[1], /Base64Data: base64Data/);
  assert.match(
    livePage,
    /await ensureStudentAssessmentStructure\(\{ ctx, industryValue, jobValue \}\);[\s\S]*?await saveStandardStudentPhoto\([\s\S]*?fetchWithTimeout\(PERSONAL_DECLARATION_WEBHOOK_URL/
  );
  assert.match(
    livePage,
    /beginAssessmentFlow\(\{\s*skipValidation: false,\s*skipCollect: true,\s*skipStructure: true/
  );
});

test("new-student placeholders do not trigger the existing-session route", () => {
  assert.match(livePage, /hasMeaningfulResumeEvidence\(\{/);
  assert.doesNotMatch(
    livePage,
    /resumeCurrentQuestionNumber\s*\|\|\s*resumeIncrementalState\?\.recordCount/
  );
});

test("completion requires two validated preferred interview times", () => {
  assert.match(
    livePage,
    /You need to provide two possible time ranges for a follow up meeting to take place with an assessor\./
  );
  assert.match(livePage, /id="firstChoiceDate" type="date"/);
  assert.match(livePage, /id="firstChoiceStartTime" required/);
  assert.match(livePage, /id="firstChoiceEndTime" required/);
  assert.match(livePage, /id="secondChoiceDate" type="date"/);
  assert.match(livePage, /id="secondChoiceStartTime" required/);
  assert.match(livePage, /id="secondChoiceEndTime" required/);
  assert.match(livePage, /id="submitPreferredTimesBtn" type="submit">Submit Times/);
  assert.match(livePage, /validatePreferredChoices\(\{/);
  assert.match(livePage, /FullName: ctx\.fullName/);
  assert.match(livePage, /ContactID: String\(ctx\.contactId \|\| ""\)/);
  assert.match(livePage, /CourseName: getCourseName\(\)/);
  assert.match(livePage, /SubmittedAt: preferredTimes\.formatLocalDateTime\(submittedAt\)/);
  assert.match(livePage, /StudentTimeZone:/);
  assert.match(livePage, /FirstChoiceTimeRange:/);
  assert.match(livePage, /SecondChoiceTimeRange:/);
  assert.match(livePage, /FirstChoiceDateTime:/);
  assert.match(livePage, /SecondChoiceDateTime:/);
  assert.match(livePage, /PREFERRED_INTERVIEW_TIMES_WEBHOOK_URL/);
});

test("question numbering is loaded from the SharePoint Title field module", () => {
  assert.match(livePage, /<script src="rpl-question-numbering\.js"><\/script>/);
  assert.match(livePage, /withTitleQuestionNumbers\(questionList\)/);
  assert.match(livePage, /getQuestionNumberingModule\(\)\.getQuestionNumber\(question, listIndex\)/);
});

test("RPL Emailer displays a waiting state while preparing student storage", () => {
  assert.match(emailerPage, /Preparing Student Storage Area/);
  assert.match(emailerPage, /<span>Please Wait<\/span>/);
  assert.match(emailerPage, /setStudentStoragePreparing\(true\);[\s\S]*?fetch\(ASSESSMENT_COMPLETED_WEBHOOK_URL/);
  assert.match(emailerPage, /finally \{[\s\S]*?setStudentStoragePreparing\(false\);/);
  assert.match(emailerPage, /responsePanelEl\.setAttribute\("aria-busy", String\(isPreparing\)\)/);
});

test("published app variants expose their current release versions", () => {
  assert.match(livePage, /welcomeVersionBadge">V2\.10</);
  assert.match(q3Page, /const WELCOME_VERSION = "V3\.3"/);
  assert.match(autoTesterPage, /const WELCOME_VERSION = "V2\.10"/);
  assert.match(autoTesterPage, /const RUNTIME_VERSION = "2\.2"/);
});
