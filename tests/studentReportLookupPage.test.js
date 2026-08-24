const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pagePath = path.join(__dirname, "..", "public", "Student Report Lookup.html");
const page = fs.readFileSync(pagePath, "utf8");

test("student report lookup starts with the meeting-planner lookup and confirmation UI", () => {
  assert.match(page, /<title>Student Report Lookup<\/title>/);
  assert.match(page, /<label for="contactIdInput">Student Contact ID \(Axcelerate\)<\/label>/);
  assert.match(page, /id="studentLookupBtn"[\s\S]*?>Submit<\/button>/);
  assert.match(page, /id="studentPanel" class="lookup-panel hidden"/);
  assert.match(page, /Is this the correct student\?/);
  assert.match(page, /id="confirmStudentBtn"[\s\S]*?>Yes<\/button>/);
  assert.match(page, /id="rejectStudentBtn"[\s\S]*?>No<\/button>/);
});
test("student lookup reuses the meeting-planner webhook contract", () => {
  assert.match(page, /workflows\/6550b2c761904160b0bae9baf9d59d7b\/triggers\/manual/);
  assert.match(page, /body: JSON\.stringify\(\{ ContactID: contactId \}\)/);
  assert.match(page, /normaliseStudentRecord\(source\)/);
  assert.match(page, /\["Name", studentRecord\?\.FullName\]/);
  assert.match(page, /\["Email", studentRecord\?\.Email \|\| "Not available"\]/);
  assert.match(page, /\["Mobile", studentRecord\?\.Mobile \|\| "Not available"\]/);
});

test("Yes confirms the student and generates the assessor report onscreen", () => {
  const handler = page.match(/confirmStudentButton\.addEventListener\("click", async \(\) => \{([\s\S]*?)\n      \}\);/);
  assert.ok(handler, "expected the Yes-button handler");
  assert.match(handler[1], /applyConfirmedStudentContext\(\)/);
  assert.match(handler[1], /reportWorkspace\.classList\.remove\("hidden"\)/);
  assert.match(handler[1], /await initialiseStudentReport\(\)/);
  assert.match(handler[1], /Student report generated\./);
});

test("No returns the page to a fresh lookup without generating a report", () => {
  const handler = page.match(/rejectStudentButton\.addEventListener\("click", \(\) => \{([\s\S]*?)\n      \}\);/);
  assert.ok(handler, "expected the No-button handler");
  assert.match(handler[1], /studentPanel\.classList\.add\("hidden"\)/);
  assert.match(handler[1], /reportWorkspace\.classList\.add\("hidden"\)/);
  assert.match(handler[1], /contactIdInput\.focus\(\)/);
  assert.doesNotMatch(handler[1], /initialiseStudentReport/);
});

test("the combined page retains the current assessor report integrations", () => {
  assert.match(page, /<script src="rpl-preliminary-review\.js"><\/script>/);
  assert.match(page, /<script src="rpl-final-report-generator\.js"><\/script>/);
  assert.match(page, /const URL_TRANSCRIPT_WEBHOOK_URL = .*workflows\/41fdc1293b8547b1ac672c8aa1ccf7f8/);
  assert.match(page, /const STUDENT_QUESTIONS_WEBHOOK_URL = .*workflows\/37f4aa51417c4a31827a9c43cc84952a/);
  assert.match(page, /const GET_COMMENTS_WEBHOOK_URL = .*workflows\/fae53cfbfdf34e41ad287e99b5e5ae27/);
  assert.match(page, /const SEND_PDF_WEBHOOK_URL = .*workflows\/ec0a8791be6a4b43ad3489e5a7edc71c/);
  assert.match(page, /const ASSESSOR_SUBMIT_WEBHOOK_URL = .*workflows\/c16eb7b6410046b9b9c42f9ea0906f6e/);
  assert.match(page, /const generateReport = async/);
  assert.match(page, /previewFrame\.srcdoc = html/);
});

test("the report is not loaded until the student is confirmed", () => {
  assert.equal((page.match(/initialiseStudentReport\(\)/g) || []).length, 1);
  assert.match(page, /const initialiseStudentReport = async \(\) =>/);
  assert.match(page, /studentPhotoLoadPromise = loadStudentPhotoFromWebhook\(\)/);
  assert.match(page, /await loadTranscriptFromUrlContext\(\)/);
  assert.match(page, /await loadAssessorCommentsFromWebhook\(\)/);
  assert.match(page, /await generateReport\(\{ sendWebhook: false \}\)/);
});
