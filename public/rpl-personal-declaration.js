(function attachRplPersonalDeclaration(globalScope) {
  "use strict";

  const DECLARATION_TITLE = "Personal Declaration";
  const DECLARATION_POINTS = Object.freeze([
    "The work I am submitting is my own, and any material sourced from other authors, organisations or AI tools will be appropriately referenced.",
    "I have not submitted this work, in whole or in part, for assessment in any other unit or course, except where prior approval has been given.",
    "The image used to represent me as part of this submission is recent and unedited. It was either taken as part of this process or within the last month and accurately represents my current appearance.",
    "I understand that providing false or misleading information, or submitting work that is not my own, may be treated as a breach of AAMC's Plagiarism and Cheating Policy and may result in disciplinary action, including but not limited to withholding of results or cancellation of enrolment.",
  ]);

  const cleanValue = (value) => String(value ?? "").trim();
  const pad = (value) => String(value).padStart(2, "0");

  const getDeclarationText = (fullName) => {
    const studentName = cleanValue(fullName) || "the student";
    return [
      `I ${studentName} confirm that:`,
      ...DECLARATION_POINTS.map((point, index) => `${index + 1}. ${point}`),
    ].join("\n");
  };

  const formatSignedAt = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);
  };

  const formatSignedAtFileNamePart = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join("-") + ` ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  };

  const validateDeclaration = ({
    accepted,
    signature,
    photoDataUrl,
  } = {}) => {
    if (!accepted) {
      return { ok: false, message: "Please confirm that you understand the declaration." };
    }
    if (!cleanValue(signature)) {
      return { ok: false, message: "Please type your signature before submitting." };
    }
    if (!cleanValue(photoDataUrl)) {
      return { ok: false, message: "A recent photo is required before the declaration can be submitted." };
    }
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(cleanValue(photoDataUrl))) {
      return { ok: false, message: "The captured photo is not in a supported format. Please take or upload it again." };
    }
    return { ok: true, message: "" };
  };

  const buildDeclarationPayload = ({
    fullName,
    givenName,
    contactId,
    qualification,
    courseName,
    industry,
    jobTitle,
    photoDataUrl,
    accepted,
    signature,
    signedAt = new Date(),
    timeZone,
  } = {}) => {
    const signedDate = signedAt instanceof Date ? signedAt : new Date(signedAt);
    if (Number.isNaN(signedDate.getTime())) {
      throw new Error("A valid declaration signature date and time is required.");
    }

    const studentName = cleanValue(fullName);
    const resolvedQualification = cleanValue(qualification || courseName);
    const resolvedTimeZone = cleanValue(timeZone)
      || Intl.DateTimeFormat().resolvedOptions().timeZone
      || "Student local time";

    return {
      FullName: studentName,
      GivenName: cleanValue(givenName),
      ContactID: cleanValue(contactId),
      Qualification: resolvedQualification,
      CourseName: cleanValue(courseName || qualification),
      Industry: cleanValue(industry),
      JobTitle: cleanValue(jobTitle),
      PhotoDataUrl: cleanValue(photoDataUrl),
      DeclarationTitle: DECLARATION_TITLE,
      DeclarationText: getDeclarationText(studentName),
      DeclarationAccepted: accepted === true,
      Signature: cleanValue(signature),
      SignedAt: signedDate.toISOString(),
      SignedAtDisplay: formatSignedAt(signedDate),
      SignedAtFileNamePart: formatSignedAtFileNamePart(signedDate),
      StudentTimeZone: resolvedTimeZone,
    };
  };

  const getDeclarationFileName = (payload) => {
    const fullName = cleanValue(payload?.FullName);
    const contactId = cleanValue(payload?.ContactID);
    const qualification = cleanValue(payload?.Qualification);
    const signedAtPart = cleanValue(payload?.SignedAtFileNamePart);
    return `${fullName} - ${contactId} - ${qualification} - Declaration - ${signedAtPart}.txt`;
  };

  const api = Object.freeze({
    DECLARATION_TITLE,
    DECLARATION_POINTS,
    getDeclarationText,
    formatSignedAt,
    formatSignedAtFileNamePart,
    validateDeclaration,
    buildDeclarationPayload,
    getDeclarationFileName,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.RplPersonalDeclaration = api;
})(typeof window !== "undefined" ? window : globalThis);
