const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const currentPagePath = path.join(__dirname, "..", "public", "RPL Report Generator - Assessor.html");
const archivePagePath = path.join(__dirname, "..", "public", "RPL Report Generator - Assessor - Archive.html");
const currentPage = fs.readFileSync(currentPagePath, "utf8");
const archivePage = fs.readFileSync(archivePagePath, "utf8");

test("archive page is a distinct text-transcript assessor surface", () => {
  assert.match(archivePage, /<title>RPL Review 1\.3 - Archive<\/title>/);
  assert.match(archivePage, /<h1>RPL Review 1\.3 - Archive<\/h1>/);
  assert.match(archivePage, /const extractLegacyTranscriptText = \(payload\) =>/);
  assert.match(archivePage, /"Full Transcription Text"/);
  assert.match(archivePage, /"Full Transcription"/);
  assert.match(archivePage, /typeof source === "string" && source\.trim\(\)/);
  assert.ok(archivePage.indexOf("const transcriptText = extractLegacyTranscriptText(payload)") < archivePage.indexOf("const jsonCandidates = ["));
  assert.match(archivePage, /buildArgs\.jsonTranscript = transcriptInput\.json/);
  assert.match(archivePage, /buildArgs\.fullTranscriptText = transcriptInput\.text/);
});

test("archive page can fall back to the directory JSON field used by the supplied Lawrence record", () => {
  assert.match(archivePage, /safeJsonParse\(envelope\?\.\["Full Transcription JSON"\]\)/);
  assert.match(archivePage, /transcriptInput = \{ kind: "json", text: "", json: jsonTranscript \}/);
  assert.match(archivePage, /return jsonTranscript\.questions\.length/);
});

test("archive page retains the current assessor identity URL contract", () => {
  assert.match(archivePage, /params\.get\("fullName"\)/);
  assert.match(archivePage, /params\.get\("givenName"\)/);
  assert.match(archivePage, /params\.get\("contactId"\)/);
  assert.match(archivePage, /params\.get\("assessorName"\)/);
  assert.match(archivePage, /params\.get\("assessorEmail"\)/);
});

test("archive page appends SharePoint assessor Questions 21 and 22", () => {
  assert.match(archivePage, /const ARCHIVE_ASSESSOR_QUESTIONS = \[/);
  assert.match(archivePage, /Title: "21"/);
  assert.match(archivePage, /field_1: "Complex Lending"/);
  assert.match(archivePage, /Provide three different examples of clients you have assisted/);
  assert.match(archivePage, /Title: "22"/);
  assert.match(archivePage, /field_1: "Risk Management"/);
  assert.match(archivePage, /Identify ONE risk from the list below/);
  assert.match(archivePage, /const extractStoredAssessorQuestionRows = \(payload\) =>/);
  assert.match(archivePage, /return \[\.\.\.retainedStoredQuestions, \.\.\.ARCHIVE_ASSESSOR_QUESTIONS\]/);
});

test("archive page remains byte-for-byte while the regular assessor page evolves", () => {
  const { execFileSync } = require("node:child_process");
  const originPage = execFileSync("git", ["show", "origin/main:public/RPL Report Generator - Assessor - Archive.html"], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
  });
  assert.equal(archivePage.replace(/\r\n/g, "\n"), originPage.replace(/\r\n/g, "\n"));
  assert.notEqual(currentPage.replace(/\r\n/g, "\n"), archivePage.replace(/\r\n/g, "\n"));
});
