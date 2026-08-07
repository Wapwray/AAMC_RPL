const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pagePath = path.join(__dirname, "..", "public", "RPL Report Generator - Assessor.html");
const page = fs.readFileSync(pagePath, "utf8");
const generatorPath = path.join(__dirname, "..", "public", "rpl-final-report-generator.js");
const generator = fs.readFileSync(generatorPath, "utf8");

test("assessor page uses a full-width student information section above the draft report", () => {
  const studentInformationIndex = page.indexOf('id="studentInformationTitle"');
  const draftReportIndex = page.indexOf('id="previewTitle">Draft Report');

  assert.ok(studentInformationIndex >= 0);
  assert.ok(draftReportIndex > studentInformationIndex);
  assert.match(page, /\.grid\s*\{\s*display:\s*block;/);
  assert.match(page, /<label for="fullName">Student name<\/label>/);
  assert.match(page, /<label for="contactId">Contact ID<\/label>/);
  assert.match(page, /<label for="qualification">Qualification<\/label>/);
  assert.match(page, /<label for="industry">Industry<\/label>/);
  assert.match(page, /<label for="jobTitle">Job title<\/label>/);
  assert.match(page, /<label for="interviewDate">Interview date<\/label>/);
  assert.doesNotMatch(page, /<h2 id="controlsTitle">Transcript<\/h2>/);
  assert.doesNotMatch(page, /id="transcriptFile"/);
});

test("assessor page automatically loads comments, generates the report, and handles saved submissions", () => {
  const initialiseBody = page.match(/const initialiseAssessorPage = async \(\) => \{([\s\S]*?)\n      \};/);

  assert.ok(initialiseBody);
  assert.match(page, /<title>RPL Review 1\.3<\/title>/);
  assert.match(page, /<h1>RPL Review 1\.3<\/h1>/);
  assert.match(initialiseBody[1], /await loadTranscriptFromUrlContext\(\)/);
  assert.match(initialiseBody[1], /await loadAssessorCommentsFromWebhook\(\)/);
  assert.match(initialiseBody[1], /await generateReport\(\{ sendWebhook: false \}\)/);
  assert.match(page, /event\.data\?\.type !== "rpl-assessor-submission-saved"/);
  assert.match(page, /setStatus\(`Assessor \$\{submitLabel\} saved\.`, "ok"\)/);
  assert.match(page, /Assessor submission saved via configured submit webhook/);
});

test("assessor page uploads the interview transcript document through the isolated flow", () => {
  const initialiseBody = page.match(/const initialiseAssessorPage = async \(\) => \{([\s\S]*?)\n      \};/);
  assert.ok(initialiseBody);
  assert.match(page, /const UPLOAD_ASSESSOR_TRANSCRIPT_WEBHOOK_URL = .*workflows\/2b76d8819f764937905e232ea561f796/);
  assert.match(page, /assessorTranscriptEnabled: true/);
  assert.match(page, /assessorTranscriptUploadUrl: UPLOAD_ASSESSOR_TRANSCRIPT_WEBHOOK_URL/);
  assert.doesNotMatch(page, /GET_ASSESSOR_TRANSCRIPT_WEBHOOK_URL/);
  assert.doesNotMatch(page, /loadAssessorTranscriptFromWebhook/);
  assert.doesNotMatch(page, /assessorTranscriptPrefill/);
  assert.doesNotMatch(initialiseBody[1], /assessor transcript/i);
});

test("assessor page loads the student's stored assessor-question file", () => {
  assert.match(page, /const STUDENT_QUESTIONS_WEBHOOK_URL = .*workflows\/37f4aa51417c4a31827a9c43cc84952a/);
  assert.match(page, /responsePayload\?\.AssessorQuestions/);
  assert.match(page, /FullName: fullName/);
  assert.match(page, /ContactID: String/);
  assert.match(page, /GivenName: cleanValue\(studentContext\.givenName\)/);
  assert.doesNotMatch(page, /workflows\/776a38fbbe6449c996fd3a4127212eff/);
});

test("Send PDF posts the button-free live report to the dedicated webhook", () => {
  assert.match(page, /const SEND_PDF_WEBHOOK_URL = "https:\/\/default63871d3cd05d49fa86b6420054699f\.b4\.environment\.api\.powerplatform\.com:443\/powerautomate\/automations\/direct\/cu\/05\/workflows\/ec0a8791be6a4b43ad3489e5a7edc71c\/triggers\/manual\/paths\/invoke\?/);
  assert.match(page, /event\.data\?\.type === "rpl-assessor-send-pdf"/);
  assert.match(page, /sendWebhookWithIdentity\(\{/);
  assert.match(page, /html: currentReportHtml/);
  assert.match(page, /webhookUrl: SEND_PDF_WEBHOOK_URL/);
  assert.match(page, /activityLabel: "Send PDF"/);
  assert.match(page, /includeAssessorIdentity: true/);
  assert.match(page, /FullName: identity\.fullName/);
  assert.match(page, /ContactID: identity\.contactId/);
  assert.match(page, /FinalReport: html/);
  assert.match(page, /payload\.AssessorName = assessor\.assessorName/);
  assert.match(page, /payload\.AssessorEmail = assessor\.assessorEmail/);
  assert.match(page, /Qualification: cleanValue\(qualificationEl\.value\)/);
  assert.match(page, /AssessorSignatureTime: cleanFileNamePart\(event\.data\?\.assessorSignatureTime\)/);
  assert.match(page, /\.\.\.additionalPayload/);
});

test("PDF sections start on new pages with their first question kept under the heading", () => {
  assert.match(generator, /class="question-review-section assessor-questions-section"/);
  assert.match(generator, /<h2 id="assessorQuestionsTitle">Assessor Questions<\/h2>/);
});
