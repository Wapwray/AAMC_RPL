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
  assert.match(initialiseBody[1], /await loadTranscriptFromUrlContext\(\)/);
  assert.match(initialiseBody[1], /await loadAssessorCommentsFromWebhook\(\)/);
  assert.match(initialiseBody[1], /await generateReport\(\{ sendWebhook: false \}\)/);
  assert.match(page, /event\.data\?\.type !== "rpl-assessor-submission-saved"/);
  assert.match(page, /await sendFinalReportWebhook\(currentReportHtml\)/);
});

test("Send PDF posts the button-free live report to the dedicated webhook", () => {
  assert.match(page, /const SEND_PDF_WEBHOOK_URL = "https:\/\/default63871d3cd05d49fa86b6420054699f\.b4\.environment\.api\.powerplatform\.com:443\/powerautomate\/automations\/direct\/cu\/06\/workflows\/ad445c5a35534861933f60ee864eecfa\/triggers\/manual\/paths\/invoke\?/);
  assert.match(page, /event\.data\?\.type === "rpl-assessor-send-pdf"/);
  assert.match(page, /sendFinalReportWebhook\(currentReportHtml, SEND_PDF_WEBHOOK_URL, "Send PDF", true\)/);
  assert.match(page, /FullName: identity\.fullName/);
  assert.match(page, /ContactID: identity\.contactId/);
  assert.match(page, /FinalReport: html/);
  assert.match(page, /payload\.AssessorName = assessor\.assessorName/);
  assert.match(page, /payload\.AssessorEmail = assessor\.assessorEmail/);
});

test("PDF sections start on new pages with their first question kept under the heading", () => {
  assert.match(generator, /class="question-review-section assessor-questions-section"/);
  assert.match(generator, /<h2 id="assessorQuestionsTitle">Assessor Questions<\/h2>/);
});
