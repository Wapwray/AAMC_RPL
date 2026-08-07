const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(
  path.join(__dirname, "..", "public", "RPL Emailer.html"),
  "utf8"
);

test("RPL Emailer exposes a fully editable student email draft", () => {
  assert.match(page, /RPL Emailer V0\.8/);
  assert.match(page, /<script src="rpl-student-email-draft\.js"><\/script>/);
  assert.match(page, /id="draftStudentEmailTitle">Draft Student Email/);
  assert.match(page, /id="draftEmailSubject" type="text"/);
  assert.match(page, /id="draftEmailBody"[\s\S]*?contenteditable="true"/);
  assert.match(page, /id="sendStudentEmailBtn" class="primary" type="button">Send/);
});

test("RPL Emailer prepares email drafts without exposing an interview-link panel", () => {
  assert.match(page, /id="sendEmailsBtn" class="primary" type="button" disabled>Prepare Emails/);
  assert.doesNotMatch(page, /AI Interview Link/);
  assert.doesNotMatch(page, /aiInterviewLinkPanel/);
});

test("RPL Emailer defaults the assessor meeting mode to Online", () => {
  assert.match(page, /name="assessorAssignment" value="none" checked[^>]*> Online/);
  assert.match(page, /name="assessorAssignment" value="assigned"[^>]*> In-Person/);
  assert.doesNotMatch(page, /name="assessorAssignment" value="assigned" checked/);
  assert.match(page, /getAssessorAssignmentMode[\s\S]*?\|\| "none"/);
});

test("recipient choices default to info, provide an enabling switch for the student, and support Other", () => {
  assert.match(
    page,
    /id="draftDefaultRecipientOption" value="default" selected>[\s\S]*?info@aamctraining\.edu\.au/
  );
  assert.match(page, /id="enableStudentEmailRecipient"[\s\S]*?role="switch"/);
  assert.match(
    page,
    /id="draftStudentRecipientOption" value="student" disabled/
  );
  assert.match(page, /<option value="other">Other<\/option>/);
  assert.match(page, /id="draftEmailOtherRecipient"[\s\S]*?type="email"/);
  assert.match(page, /draftEmailOtherRecipientRowEl\.style\.display = useOther \? "grid" : "none"/);
  assert.match(page, /draftStudentRecipientOptionEl\.disabled = !enabled/);
  assert.match(page, /draftEmailRecipientEl\.value = "default"/);
});

test("draft generation sends the interview URL and consumes the flow draft outputs", () => {
  assert.match(page, /InterviewLink: buildAiInterviewUrl\(selectedStudentRecord\)/);
  assert.match(page, /normaliseDraftResponse\(responsePayload\)/);
  assert.match(page, /draftEmailSubjectEl\.value = draft\.subject/);
  assert.match(page, /draftEmailBodyEl\.innerHTML = sanitiseEditableEmailHtml\(draft\.bodyHtml\)/);
  assert.match(page, /\$\{draft\.studentRecipient\} \(Student Email Address\)/);
});

test("Send posts only the edited draft to the dedicated online student email flow", () => {
  assert.match(
    page,
    /workflows\/6969857c9682423d82cddd88da255ec3\/triggers\/manual/
  );
  assert.match(page, /buildSendPayload\(\{/);
  assert.match(page, /recipientMode: draftEmailRecipientEl\.value/);
  assert.match(page, /studentRecipient: draftStudentRecipient/);
  assert.match(page, /subject: draftEmailSubjectEl\.value/);
  assert.match(page, /bodyHtml: sanitiseEditableEmailHtml\(draftEmailBodyEl\.innerHTML\)/);
  assert.match(
    page,
    /fetch\(SEND_ONLINE_STUDENT_EMAIL_WEBHOOK_URL,[\s\S]*?body: JSON\.stringify\(payload\)/
  );
});
