const test = require("node:test");
const assert = require("node:assert/strict");
const { filterRplQuestions } = require("../dist/rpl-filter/rplFilter");

const ctUnit = (overrides = {}) => ({ STATUS: "CT - Credit Transfer", CODE: "BSBABC123", ...overrides });
const question = (overrides = {}) => ({ Title: "Question", "Question Live": "Yes", "CT Do Not Ask 1": "", ...overrides });

test("blank CT Do Not Ask 1 does not exclude a question", () => {
  const result = filterRplQuestions({ units: [ctUnit()], questions: [question({ "CT Do Not Ask 1": "" })] });
  assert.equal(result.counts.questionsIncluded, 1);
  assert.equal(result.counts.questionsExcluded, 0);
  assert.equal(result.studentQuestions.length, 1);
});

test("null CT Do Not Ask 1 does not exclude a question", () => {
  const result = filterRplQuestions({ units: [ctUnit()], questions: [question({ "CT Do Not Ask 1": null })] });
  assert.equal(result.counts.questionsIncluded, 1);
  assert.equal(result.counts.questionsExcluded, 0);
});

test("multiple comma-separated exclusions exclude matching questions", () => {
  const result = filterRplQuestions({
    units: [ctUnit()],
    questions: [question({ "CT Do Not Ask 1": "BSBZZZ999, BSBABC123" })],
  });
  assert.equal(result.counts.questionsIncluded, 0);
  assert.equal(result.counts.questionsExcluded, 1);
  assert.deepEqual(result.diagnostics.excludedBy[0].unitCodes, ["BSBABC123"]);
});

test("case differences are ignored by default", () => {
  const result = filterRplQuestions({
    units: [ctUnit({ CODE: "bsbabc123" })],
    questions: [question({ "CT Do Not Ask 1": "BSBABC123" })],
  });
  assert.deepEqual(result.unitCodes, ["BSBABC123"]);
  assert.equal(result.counts.questionsExcluded, 1);
});

test("duplicate CT unit codes are deduplicated", () => {
  const result = filterRplQuestions({
    units: [ctUnit({ CODE: "BSBABC123" }), ctUnit({ Code: "bsbabc123" })],
    questions: [],
  });
  assert.deepEqual(result.unitCodes, ["BSBABC123"]);
  assert.equal(result.counts.ctUnitsFound, 2);
  assert.equal(result.counts.unitCodes, 1);
});

test("no CT units includes all questions", () => {
  const result = filterRplQuestions({
    units: [{ STATUS: "C", CODE: "BSBABC123" }],
    questions: [question({ "CT Do Not Ask 1": "BSBABC123" })],
  });
  assert.deepEqual(result.unitCodes, []);
  assert.equal(result.counts.questionsIncluded, 1);
  assert.equal(result.counts.questionsExcluded, 0);
});

test("all questions can be excluded", () => {
  const result = filterRplQuestions({
    units: [ctUnit()],
    questions: [question({ Title: "Q1", "CT Do Not Ask 1": "BSBABC123" }), question({ Title: "Q2", "CT Do Not Ask 1": "BSBABC123" })],
  });
  assert.equal(result.includedQuestions.length, 0);
  assert.equal(result.excludedQuestions.length, 2);
});

test("no questions are excluded when exclusion values do not match CT unit codes", () => {
  const result = filterRplQuestions({
    units: [ctUnit()],
    questions: [question({ Title: "Q1", "CT Do Not Ask 1": "BSBDEF456" }), question({ Title: "Q2", "CT Do Not Ask 1": "" })],
  });
  assert.equal(result.includedQuestions.length, 2);
  assert.equal(result.excludedQuestions.length, 0);
});

test("Question Live equals Yes goes to student questions", () => {
  const result = filterRplQuestions({ units: [ctUnit()], questions: [question({ "Question Live": "Yes" })] });
  assert.equal(result.studentQuestions.length, 1);
  assert.equal(result.assessorQuestions.length, 0);
});

test("Question Live equals No goes to assessor questions", () => {
  const result = filterRplQuestions({ units: [ctUnit()], questions: [question({ "Question Live": "No" })] });
  assert.equal(result.studentQuestions.length, 0);
  assert.equal(result.assessorQuestions.length, 1);
});

test("missing Question Live goes to assessor questions and warns", () => {
  const result = filterRplQuestions({ units: [ctUnit()], questions: [{ Title: "Missing live", "CT Do Not Ask 1": "" }] });
  assert.equal(result.studentQuestions.length, 0);
  assert.equal(result.assessorQuestions.length, 1);
  assert.ok(result.warnings.some((warning) => warning.includes("Question Live")));
});

test("CODE and Unit Code field names are both supported", () => {
  const result = filterRplQuestions({
    units: [
      { STATUS: "CT", CODE: "BSBABC123" },
      { Status: "CT", "Unit Code": "BSBDEF456" },
    ],
    questions: [question({ "CT Do Not Ask 1": "BSBDEF456" })],
  });
  assert.deepEqual(result.unitCodes, ["BSBABC123", "BSBDEF456"]);
  assert.equal(result.counts.questionsExcluded, 1);
});

test("custom semicolon and pipe delimiters are supported", () => {
  const result = filterRplQuestions({
    units: [ctUnit()],
    questions: [question({ "CT Do Not Ask 1": "BSBZZZ999|BSBABC123" })],
    config: { exclusionDelimiters: ["semicolon", "pipe"] },
  });
  assert.equal(result.counts.questionsExcluded, 1);
});

test("selected output fields return projected question objects", () => {
  const result = filterRplQuestions({
    units: [ctUnit()],
    questions: [question({ Title: "Projected", Extra: "Hidden" })],
    config: { output: { mode: "selected", fields: ["Title", "Question Live"] } },
  });
  assert.deepEqual(result.includedQuestions[0], { Title: "Projected", "Question Live": "Yes" });
});