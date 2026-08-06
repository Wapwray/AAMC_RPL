const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_RECIPIENT,
  normaliseDraftResponse,
  resolveRecipient,
  buildSendPayload,
} = require("../public/rpl-student-email-draft");

test("draft response exposes the flow-generated recipient, subject, body, and student address", () => {
  const draft = normaliseDraftResponse({
    student_email_default_to: "rwray@aamctraining.edu.au",
    student_email_address: "student@example.com",
    student_email_subject: "RPL consultation",
    student_email_body_html: "<p>Hello</p>",
  });

  assert.deepEqual(draft, {
    defaultRecipient: "info@aamctraining.edu.au",
    studentRecipient: "student@example.com",
    subject: "RPL consultation",
    bodyHtml: "<p>Hello</p>",
  });
});

test("recipient defaults to the AAMC information address and permits a validated Other address", () => {
  assert.equal(
    resolveRecipient({ mode: "default", defaultRecipient: DEFAULT_RECIPIENT }),
    "info@aamctraining.edu.au"
  );
  assert.equal(
    resolveRecipient({ mode: "other", otherRecipient: "other@example.com" }),
    "other@example.com"
  );
});

test("student recipient can be selected when the page enables it", () => {
  assert.equal(
    resolveRecipient({
      mode: "student",
      defaultRecipient: DEFAULT_RECIPIENT,
      studentRecipient: "student@example.com",
    }),
    "student@example.com"
  );
});

test("send payload can target the enabled student address", () => {
  assert.equal(
    buildSendPayload({
      recipientMode: "student",
      defaultRecipient: DEFAULT_RECIPIENT,
      studentRecipient: "student@example.com",
      subject: "RPL information",
      bodyHtml: "<p>Hello</p>",
      fullName: "Ms Student Example",
      contactId: "123456",
      courseName: "FNS50322",
    }).Recipient,
    "student@example.com"
  );
});

test("send payload uses only the edited draft and selected recipient", () => {
  assert.deepEqual(
    buildSendPayload({
      recipientMode: "other",
      defaultRecipient: DEFAULT_RECIPIENT,
      otherRecipient: "reviewer@example.com",
      subject: " Edited subject ",
      bodyHtml: " <p>Edited body</p> ",
      fullName: "Ms Student Example",
      contactId: "123456",
      courseName: "FNS50322",
    }),
    {
      Recipient: "reviewer@example.com",
      Subject: "Edited subject",
      BodyHtml: "<p>Edited body</p>",
      FullName: "Ms Student Example",
      ContactID: "123456",
      CourseName: "FNS50322",
    }
  );
});
