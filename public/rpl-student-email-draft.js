(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RplStudentEmailDraft = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_RECIPIENT = "info@aamctraining.edu.au";
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const pickValue = (source, names) => {
    for (const name of names) {
      const value = source?.[name];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }
    return "";
  };

  const normaliseDraftResponse = (source) => {
    const body = source?.body && typeof source.body === "object" ? source.body : source;
    return {
      defaultRecipient: DEFAULT_RECIPIENT,
      studentRecipient: pickValue(body, [
        "student_email_address",
        "studentEmailAddress",
        "email",
      ]),
      subject: pickValue(body, ["student_email_subject", "studentEmailSubject"]),
      bodyHtml: pickValue(body, ["student_email_body_html", "studentEmailBodyHtml"]),
    };
  };

  const resolveRecipient = ({
    mode,
    defaultRecipient = DEFAULT_RECIPIENT,
    studentRecipient = "",
    otherRecipient = "",
  }) => {
    const candidate =
      mode === "student"
        ? studentRecipient
        : mode === "other"
          ? otherRecipient
          : defaultRecipient;
    const recipient = String(candidate || "").trim();
    if (!EMAIL_PATTERN.test(recipient)) {
      throw new Error("Enter a valid recipient email address.");
    }
    return recipient;
  };

  const buildSendPayload = ({
    recipientMode,
    defaultRecipient,
    studentRecipient,
    otherRecipient,
    subject,
    bodyHtml,
    fullName,
    contactId,
    courseName,
  }) => {
    const recipient = resolveRecipient({
      mode: recipientMode,
      defaultRecipient,
      studentRecipient,
      otherRecipient,
    });
    const cleanSubject = String(subject || "").trim();
    const cleanBodyHtml = String(bodyHtml || "").trim();

    if (!cleanSubject) {
      throw new Error("Enter an email subject.");
    }
    if (!cleanBodyHtml) {
      throw new Error("Enter the email message.");
    }

    return {
      Recipient: recipient,
      Subject: cleanSubject,
      BodyHtml: cleanBodyHtml,
      FullName: String(fullName || "").trim(),
      ContactID: String(contactId || "").trim(),
      CourseName: String(courseName || "").trim(),
    };
  };

  return {
    DEFAULT_RECIPIENT,
    normaliseDraftResponse,
    resolveRecipient,
    buildSendPayload,
  };
});
