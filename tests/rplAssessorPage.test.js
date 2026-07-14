const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pagePath = path.join(__dirname, "..", "public", "RPL Report Generator - Assessor.html");
const page = fs.readFileSync(pagePath, "utf8");

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
  assert.match(initialiseBody[1], /await generateReport\(\{ sendWebhook: true \}\)/);
  assert.match(page, /event\.data\?\.type !== "rpl-assessor-submission-saved"/);
  assert.match(page, /await sendFinalReportWebhook\(currentReportHtml\)/);
});
