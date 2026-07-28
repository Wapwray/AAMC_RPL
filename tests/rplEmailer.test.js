const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(
  path.join(__dirname, "..", "public", "RPL Emailer.html"),
  "utf8"
);

test("RPL Emailer V0.4 exposes a fully editable student email draft", () => {
  assert.match(page, /RPL Emailer V0\.4/);
  assert.match(page, /<script src="rpl-student-email-draft\.js"><\/script>/);
  assert.match(page, /id="draftStudentEmailTitle">Draft Student Email/);
  assert.match(page, /id="draftEmailSubject" type="text"/);
  assert.match(page, /id="draftEmailBody"[\s\S]*?contenteditable="true"/);
  assert.match(page, /id="sendStudentEmailBtn" class="primary" type="button">Send/);
});

test("recipient choices default to Richard, show the disabled student address, and support Other", () => {
  assert.match(
    page,
    /id="draftDefaultRecipientOption" value="default" selected>[\s\S]*?rwray@aamctraining\.edu\.au/
  );
  assert.match(
    page,
    /id="draftStudentRecipientOption" value="student" disabled/
  );
  assert.match(page, /<option value="other">Other<\/option>/);
  assert.match(page, /id="draftEmailOtherRecipient"[\s\S]*?type="email"/);
  assert.match(page, /draftEmailOtherRecipientRowEl\.style\.display = useOther \? "grid" : "none"/);
});

test("draft generation sends the interview URL and consumes the flow draft outputs", () => {
  assert.match(page, /InterviewLink: buildAiInterviewUrl\(selectedStudentRecord\)/);
  assert.match(page, /normaliseDraftResponse\(responsePayload\)/);
  assert.match(page, /draftEmailSubjectEl\.value = draft\.subject/);
  assert.match(page, /draftEmailBodyEl\.innerHTML = sanitiseEditableEmailHtml\(draft\.bodyHtml\)/);
  assert.match(
    page,
    /\$\{draft\.studentRecipient\} \(Student Email Address - not currently selectable\)/
  );
});

test("Send posts only the edited draft to the dedicated online student email flow", () => {
  assert.match(
    page,
    /workflows\/6969857c9682423d82cddd88da255ec3\/triggers\/manual/
  );
  assert.match(page, /buildSendPayload\(\{/);
  assert.match(page, /recipientMode: draftEmailRecipientEl\.value/);
  assert.match(page, /subject: draftEmailSubjectEl\.value/);
  assert.match(page, /bodyHtml: sanitiseEditableEmailHtml\(draftEmailBodyEl\.innerHTML\)/);
  assert.match(
    page,
    /fetch\(SEND_ONLINE_STUDENT_EMAIL_WEBHOOK_URL,[\s\S]*?body: JSON\.stringify\(payload\)/
  );
});
