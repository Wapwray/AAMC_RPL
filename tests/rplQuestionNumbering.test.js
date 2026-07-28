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
    /must have a numeric Title value/
  );
});
