const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
  assert.match(page, /"coorganizer", assessorUser/);
  assert.match(page, /\$select=id,displayName,userPrincipalName,mail,userType/);
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

const scheduleHelpers = page.slice(page.indexOf("      const resolveMeetingStart ="), page.indexOf("      const hasRequiredMeetingDetails ="));
const scheduleContext = vm.createContext({});
vm.runInContext(`${scheduleHelpers}\nglobalThis.schedule = buildMeetingSchedule;`, scheduleContext);
const schedule = (...args) => JSON.parse(JSON.stringify(scheduleContext.schedule(...args)));

test("meeting date, time and timezone share a responsive row with Sydney/Melbourne selected", () => {
  assert.match(page, /class="meetingDateTime wide"[\s\S]*?id="meetingDate"[\s\S]*?id="meetingTime"[\s\S]*?id="meetingTimezone"/);
  assert.match(page, /<option value="Australia\/Sydney" selected>Sydney \/ Melbourne<\/option>/);
  assert.match(page, /\.meetingDateTime \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(page, /@media \(max-width: 650px\)[\s\S]*?\.meetingDateTime \{ grid-template-columns: 1fr; \}/);
  assert.match(page, /meetingTime, meetingTimezone, meetingDuration/);
});

test("Sydney meetings automatically use standard time in winter and daylight time in summer", () => {
  assert.deepEqual(schedule("2026-07-15", "09:00", "60", "Australia/Sydney"), {
    start: { dateTime: "2026-07-14T23:00:00", timeZone: "UTC" },
    end: { dateTime: "2026-07-15T00:00:00", timeZone: "UTC" }
  });
  assert.deepEqual(schedule("2026-10-06", "09:00", "60", "Australia/Sydney"), {
    start: { dateTime: "2026-10-05T22:00:00", timeZone: "UTC" },
    end: { dateTime: "2026-10-05T23:00:00", timeZone: "UTC" }
  });
});

test("timezone choices handle Queensland, central half-hour offsets and Western Australia", () => {
  const cases = [
    ["Australia/Brisbane", "2026-10-05T23:00:00"],
    ["Australia/Adelaide", "2026-10-05T22:30:00"],
    ["Australia/Darwin", "2026-10-05T23:30:00"],
    ["Australia/Perth", "2026-10-06T01:00:00"],
    ["Australia/Hobart", "2026-10-05T22:00:00"],
    ["Australia/Lord_Howe", "2026-10-05T22:00:00"],
    ["Australia/Eucla", "2026-10-06T00:15:00"],
    ["UTC", "2026-10-06T09:00:00"]
  ];
  for (const [zone, expected] of cases) {
    assert.equal(schedule("2026-10-06", "09:00", "60", zone).start.dateTime, expected, zone);
  }
});

test("meeting duration remains sixty minutes across midnight and daylight-saving transitions", () => {
  for (const [date, time] of [["2026-10-04", "01:30"], ["2026-04-05", "01:30"], ["2026-10-06", "23:30"]]) {
    const result = schedule(date, time, "60", "Australia/Sydney");
    assert.equal(Date.parse(`${result.end.dateTime}Z`) - Date.parse(`${result.start.dateTime}Z`), 3600000);
  }
  const spring = schedule("2026-10-04", "01:30", "60", "Australia/Sydney");
  assert.equal(spring.end.dateTime, "2026-10-03T16:30:00"); // 03:30 after the clock jumps.
  const midnight = schedule("2026-10-06", "23:30", "60", "Australia/Sydney");
  assert.equal(midnight.end.dateTime, "2026-10-06T13:30:00"); // 00:30 on the following local day.
});

test("skipped and repeated local times are rejected before a meeting can be created", () => {
  assert.throws(() => schedule("2026-10-04", "02:30", "60", "Australia/Sydney"), /does not exist/);
  assert.throws(() => schedule("2026-04-05", "02:30", "60", "Australia/Sydney"), /occurs twice/);
  assert.throws(() => schedule("2026-10-04", "02:15", "60", "Australia/Lord_Howe"), /does not exist/);
  assert.match(page, /const schedule = buildMeetingSchedule\([\s\S]*?const token = await getGraphToken\(\)/);
  assert.match(page, /start: schedule\.start,[\s\S]*?end: schedule\.end/);
  assert.doesNotMatch(page, /GRAPH_TIME_ZONE|T\$\{timeValue\}:00\+10:00/);
});

test("shared invitation and both direct email drafts show the selected timezone and date-specific offset", () => {
  assert.equal((page.match(/<strong>Timezone:<\/strong> \$\{escapeHtml\(getMeetingTimezoneText\(\)\)\}/g) || []).length, 3);
  scheduleContext.meetingTimezone = { value: "Australia/Sydney", selectedOptions: [{ textContent: "Sydney / Melbourne" }] };
  scheduleContext.meetingDate = { value: "2026-07-15" };
  scheduleContext.meetingTime = { value: "09:00" };
  assert.equal(vm.runInContext("getMeetingTimezoneText()", scheduleContext), "Sydney / Melbourne (UTC+10:00)");
  scheduleContext.meetingDate.value = "2026-10-06";
  assert.equal(vm.runInContext("getMeetingTimezoneText()", scheduleContext), "Sydney / Melbourne (UTC+11:00)");
});

