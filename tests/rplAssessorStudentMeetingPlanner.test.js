const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(
  path.join(__dirname, "..", "public", "RPL Assessor Student Meeting Planner.html"),
  "utf8"
);

test("meeting planner reuses the Emailer student and assessor data sources", () => {
  assert.match(page, /workflows\/6550b2c761904160b0bae9baf9d59d7b\/triggers\/manual/);
  assert.match(page, /body: JSON\.stringify\(\{ ContactID: contactId \}\)/);
  assert.match(page, /workflows\/bcc8d653415344048d5659c08b47bf2c\/triggers\/manual/);
  assert.match(page, /-- Select an assessor --/);
});

test("student confirmation gates assessor selection and meeting details", () => {
  assert.match(page, /id="studentPanel" class="hidden"/);
  assert.match(page, /id="confirmStudentBtn"/);
  assert.match(page, /confirmStudentBtn"\)\.addEventListener\("click"[\s\S]*?assessorPanel\.classList\.remove\("hidden"\)/);
  assert.match(page, /id="meetingDate" type="date"/);
  assert.match(page, /id="meetingTime" type="time"/);
  assert.match(page, /id="teamsLink" type="url"/);
});

test("planner builds the production assessor-report identity URL", () => {
  assert.match(page, /RPL%20Report%20Generator%20-%20Assessor\.html/);
  assert.match(page, /new URLSearchParams\(\{[\s\S]*?fullName:[\s\S]*?givenName:[\s\S]*?contactId:[\s\S]*?assessorName:[\s\S]*?assessorEmail:/);
  assert.match(page, /id="studentReportLink"/);
});

test("assessor and student outputs are explicitly non-sending dummy drafts", () => {
  assert.match(page, /DUMMY DRAFTS ONLY — email sending is not enabled on this page/);
  assert.match(page, /id="assessorEmailTo" type="email" readonly/);
  assert.match(page, /id="assessorEmailBody"><\/textarea>/);
  assert.match(page, /id="studentEmailTo" type="email" readonly/);
  assert.match(page, /id="studentEmailBody"><\/textarea>/);
  assert.doesNotMatch(page, /SEND_EMAIL|sendEmail|Send Email|type="submit">Send/);
});
