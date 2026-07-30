const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const declaration = require("../public/rpl-personal-declaration.js");

const publicDir = path.join(__dirname, "..", "public");
const mainPage = fs.readFileSync(path.join(publicDir, "AAMC RPL 2026.html"), "utf8");
const q3Page = fs.readFileSync(path.join(publicDir, "AAMC RPL 2026 Q3.html"), "utf8");
const autoTesterPage = fs.readFileSync(
  path.join(publicDir, "AAMC RPL 2026 Q3 Auto Tester.html"),
  "utf8"
);

test("personal declaration contains the four required statements", () => {
  assert.equal(declaration.DECLARATION_POINTS.length, 4);
  assert.match(declaration.DECLARATION_POINTS[0], /authors, organisations or AI tools/i);
  assert.match(declaration.DECLARATION_POINTS[1], /assessment in any other unit or course/i);
  assert.match(declaration.DECLARATION_POINTS[2], /recent and unedited/i);
  assert.match(declaration.DECLARATION_POINTS[3], /Plagiarism and Cheating Policy/i);
});

test("personal declaration requires acceptance, a typed signature, and a photo", () => {
  assert.equal(
    declaration.validateDeclaration({
      accepted: false,
      signature: "Billy Broker",
      photoDataUrl: "data:image/jpeg;base64,abc",
    }).ok,
    false
  );
  assert.equal(
    declaration.validateDeclaration({
      accepted: true,
      signature: " ",
      photoDataUrl: "data:image/jpeg;base64,abc",
    }).ok,
    false
  );
  assert.equal(
    declaration.validateDeclaration({
      accepted: true,
      signature: "Billy Broker",
      photoDataUrl: "",
    }).ok,
    false
  );
  assert.equal(
    declaration.validateDeclaration({
      accepted: true,
      signature: "Billy Broker",
      photoDataUrl: "data:image/jpeg;base64,abc",
    }).ok,
    true
  );
});

test("declaration payload includes student, course, photo, signature, and audit data", () => {
  const signedAt = new Date(2026, 6, 29, 10, 15, 30);
  const payload = declaration.buildDeclarationPayload({
    fullName: "Billy Broker",
    givenName: "Billy",
    contactId: "123456",
    qualification: "FNS50322 Diploma of Finance and Mortgage Broking Management",
    courseName: "FNS50322 Diploma of Finance and Mortgage Broking Management",
    industry: "Mortgage Broking",
    jobTitle: "Mortgage Broker",
    photoDataUrl: "data:image/jpeg;base64,abc",
    accepted: true,
    signature: "Billy Broker",
    signedAt,
    timeZone: "Australia/Brisbane",
  });

  assert.equal(payload.FullName, "Billy Broker");
  assert.equal(payload.ContactID, "123456");
  assert.equal(payload.DeclarationAccepted, true);
  assert.equal(payload.Signature, "Billy Broker");
  assert.equal(payload.PhotoDataUrl, "data:image/jpeg;base64,abc");
  assert.equal(payload.StudentTimeZone, "Australia/Brisbane");
  assert.equal(payload.SignedAtFileNamePart, "2026-07-29 10-15-30");
  assert.match(payload.DeclarationText, /^I Billy Broker confirm that:/);
  assert.equal(
    declaration.getDeclarationFileName(payload),
    "Billy Broker - 123456 - FNS50322 Diploma of Finance and Mortgage Broking Management - Declaration - 2026-07-29 10-15-30.txt"
  );
});

test("main page blocks Begin on the Personal Declaration flow", () => {
  assert.match(mainPage, /id="personalDeclarationOverlay"/);
  assert.match(mainPage, /id="personalDeclarationAccepted"/);
  assert.match(mainPage, /id="personalDeclarationSignature"/);
  assert.match(mainPage, /openPersonalDeclaration\(\);/);
  assert.match(mainPage, /await submitPersonalDeclaration\(\);/);
  assert.match(mainPage, /PhotoDataUrl/);
  assert.match(mainPage, /skipStructure: true/);
  assert.doesNotMatch(
    mainPage,
    /personalDeclaration:\s*"__RPL_PERSONAL_DECLARATION_WEBHOOK__"/
  );
  assert.match(mainPage, /personalDeclaration:\s*"https:\/\/[^"]+\/triggers\/manual\/paths\/invoke\?/);
});

test("published page variants expose their current declaration runtime", () => {
  assert.match(mainPage, /welcomeVersionBadge">V2\.9</);
  assert.match(mainPage, /src="rpl-personal-declaration\.js"/);
  assert.match(q3Page, /WELCOME_VERSION = "V3\.2"/);
  assert.match(q3Page, /V2\\\.9\/g, WELCOME_VERSION/);
  assert.match(q3Page, /V2\\\.8\/g, WELCOME_VERSION/);
  assert.match(autoTesterPage, /RUNTIME_VERSION = "2\.2"/);
  assert.match(autoTesterPage, /WELCOME_VERSION = "V2\.9"/);
  assert.match(autoTesterPage, /V2\\\.8\/g, WELCOME_VERSION/);
});
