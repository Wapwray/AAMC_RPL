const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractTitleNumber,
  withTitleQuestionNumbers,
  getQuestionNumber,
} = require("../public/rpl-question-numbering");

test("question numbers come from Title and preserve gaps after filtering", () => {
  const source = withTitleQuestionNumbers([
    { Title: "13", prompt: "Question thirteen" },
    { Title: "Question 14", managedStaff: true },
    { Title: "Q17", prompt: "Question seventeen" },
  ]);
  const studentQuestions = source.filter((question) => !question.managedStaff);

  assert.deepEqual(
    studentQuestions.map((question, index) => getQuestionNumber(question, index)),
    [13, 17]
  );
});

test("question numbering never falls back to the filtered list position", () => {
  assert.equal(extractTitleNumber({ Title: "Question 24 - Complaints" }, 0), 24);
  assert.throws(
    () => withTitleQuestionNumbers([{ prompt: "Missing Title" }]),
    /must have a numeric Title or Question Number value/
  );
});

test("Power Automate Question Number projection preserves SharePoint Title values", () => {
  const projectedQuestions = withTitleQuestionNumbers([
    { "Question Number": "13", prompt: "Question thirteen" },
    { "Question Number": "17", prompt: "Question seventeen" },
  ]);

  assert.deepEqual(
    projectedQuestions.map((question, index) => getQuestionNumber(question, index)),
    [13, 17]
  );
});

test("literal Title remains authoritative when both source fields are present", () => {
  assert.equal(
    extractTitleNumber({ Title: "17", "Question Number": "2" }, 0),
    17
  );
});
