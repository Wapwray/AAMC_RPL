const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(
  path.join(__dirname, "..", "public", "RPL Assessor Student Meeting Planner.html"),
  "utf8"
);

test("meeting planner displays version 1.2", () => {
  assert.match(page, /<title>RPL Assessor Student Meeting Planner V1\.2<\/title>/);
  assert.match(page, /<h1>RPL Assessor Student Meeting Planner V1\.2<\/h1>/);
});

test("meeting planner reuses the Emailer student, assessor and qualification data sources", () => {
  assert.match(page, /workflows\/6550b2c761904160b0bae9baf9d59d7b\/triggers\/manual/);
  assert.match(page, /body: JSON\.stringify\(\{ ContactID: contactId \}\)/);
  assert.match(page, /workflows\/bcc8d653415344048d5659c08b47bf2c\/triggers\/manual/);
  assert.match(page, /workflows\/4664fd1c8ec24e5394a965c006249eb6\/triggers\/manual/);
  assert.match(page, /id="qualificationSelect"/);
});

test("student and assessor confirmation gate Microsoft meeting creation", () => {
  assert.match(page, /id="studentPanel" class="hidden"/);
  assert.match(page, /id="confirmStudentBtn"/);
  assert.match(page, /confirmStudentBtn"\)\.addEventListener\("click"[\s\S]*?assessorPanel\.classList\.remove\("hidden"\)/);
  assert.match(page, /id="microsoftSignInBtn"/);
  assert.match(page, /id="meetingDate" type="date"/);
  assert.match(page, /id="meetingTime" type="time"/);
  assert.match(page, /id="meetingDuration"/);
  assert.match(page, /id="createMeetingBtn"[\s\S]*?disabled>Create meeting and send invitations/);
  assert.doesNotMatch(page, /id="teamsLink" type="url"/);
});

test("planner creates an online calendar event and then sends invitations", () => {
  assert.match(page, /"Calendars\.ReadWrite"/);
  assert.match(page, /"OnlineMeetings\.ReadWrite"/);
  assert.match(page, /graphRequest\("\/me\/events", token/);
  assert.match(page, /isOnlineMeeting: true/);
  assert.match(page, /onlineMeetingProvider: "teamsForBusiness"/);
  assert.match(page, /graphRequest\(`\/me\/events\/\$\{encodeURIComponent\(createdEvent\.id\)\}\?sendUpdates=all`/);
  assert.match(page, /inviteAssessor\.checked/);
  assert.match(page, /inviteStudent\.checked/);
});

test("assessor is a co-organiser while the student is an authenticated lobby attendee", () => {
  assert.match(page, /"User\.Read\.All"/);
  assert.doesNotMatch(page, /"User\.ReadBasic\.All"/);
  assert.match(page, /"coorganizer", assessorUser/);
  assert.match(page, /\$select=id,displayName,userPrincipalName,mail,userType/);
  assert.match(page, /proxyAddresses\/any\(address:address eq 'smtp:\$\{escapedEmail\}'/);
  assert.match(page, /ConsistencyLevel: "eventual"/);
  assert.match(page, /tenant administrator must grant this app delegated User\.Read\.All permission/i);
  assert.match(page, /assessor could not be found in Microsoft 365/i);
  assert.match(page, /assessorUser\.userType !== "Member"/);
  assert.match(page, /internal Microsoft 365 member to become co-organiser and download the transcript/i);
  assert.match(page, /"attendee", studentUser/);
  assert.match(page, /allowedLobbyAdmitters: "organizerAndCoOrganizers"/);
  assert.match(page, /lobbyBypassSettings: \{ scope: "organizer", isDialInBypassEnabled: false \}/);
  assert.match(page, /student must sign in using the invited Microsoft identity/i);
  assert.match(page, /anonymous meeting access must also be disabled/i);
});

test("meeting is automatically recorded and transcribed in Australian English", () => {
  assert.match(page, /allowRecording: true/);
  assert.match(page, /allowTranscription: true/);
  assert.match(page, /recordAutomatically: true/);
  assert.match(page, /meetingSpokenLanguageTag: "en-AU"/);
  assert.match(page, /automatically recorded and transcribed/i);
  assert.match(page, /Microsoft Teams will notify all participants when recording begins/i);
  assert.match(page, /co-organiser, you can download the transcript from the meeting recap/i);
});

test("planner builds the production assessor-report identity URL and named link", () => {
  assert.match(page, /RPL%20Report%20Generator%20-%20Assessor\.html/);
  assert.match(page, /new URLSearchParams\(\{[\s\S]*?fullName:[\s\S]*?givenName:[\s\S]*?contactId:[\s\S]*?assessorName:[\s\S]*?assessorEmail:/);
  assert.match(page, /`RPL Report - \$\{studentRecord\.FullName\} - \$\{getContactId\(\)\} - \$\{getQualification\(\)\}`/);
  assert.match(page, /buildLink\(reportUrl, reportLinkText\)/);
});

test("shared Teams invitation names both student and assessor without exposing the report", () => {
  assert.match(page, /const buildSharedMeetingHtml = \(activeTeamsUrl = ""\) =>/);
  const sharedBody = page.match(/const buildSharedMeetingHtml = \(activeTeamsUrl = ""\) => \{([\s\S]*?)\n      \};/);
  assert.ok(sharedBody);
  assert.match(sharedBody[1], /between RPL student/);
  assert.match(sharedBody[1], /and assessor/);
  assert.match(sharedBody[1], /getAssessorName\(selectedAssessor\)/);
  assert.match(sharedBody[1], /discuss the student's RPL assessment/);
  assert.doesNotMatch(sharedBody[1], /reportUrl|reportLinkText|Student report/);
  assert.match(page, /buildSharedMeetingHtml\(joinUrl\)/);
  assert.match(page, /Join the Microsoft Teams meeting/);
});

test("student and assessor direct emails use dedicated Power Automate flows and explicit send buttons", () => {
  assert.match(page, /workflows\/149ed963712540c0a334b307a6565f3c\/triggers\/manual/);
  assert.match(page, /workflows\/ee77cab593444a3383db2d5c1de0b1a3\/triggers\/manual/);
  assert.match(page, /id="sendStudentEmailBtn"[\s\S]*?disabled>Send Student Email/);
  assert.match(page, /id="sendAssessorEmailBtn"[\s\S]*?disabled>Send Assessor Email/);
  assert.match(page, /sendMeetingEmail\("student"\)/);
  assert.match(page, /sendMeetingEmail\("assessor"\)/);
  assert.match(page, /Recipient: recipient/);
  assert.match(page, /BodyHtml: bodyHtml/);
  assert.doesNotMatch(page, /await sendAssessorReportEmail\(joinUrl\)/);
});

test("direct email drafts contain hyperlinks and the assessor draft includes the report", () => {
  assert.match(page, /id="assessorEmailBody"[\s\S]*?contenteditable="true"/);
  assert.match(page, /id="studentEmailBody"[\s\S]*?contenteditable="true"/);
  assert.match(page, /buildLink\(activeTeamsUrl, "Join the Microsoft Teams meeting"\)/);
  assert.match(page, /buildLink\(reportUrl, reportLinkText\)/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
});

