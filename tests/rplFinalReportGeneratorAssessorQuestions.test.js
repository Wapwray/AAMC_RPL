const test = require("node:test");
const assert = require("node:assert/strict");
global.window = {};
require("../public/rpl-final-report-generator");
const moduleUnderTest = global.window.RplFinalReportGenerator;

test("keeps all assessor questions including overlapping Question 20", async () => {
  const q20 = "Explain how you review the effectiveness of the professional relationship and how you make changes to improve it.";
  const model = { metadata: {}, warnings: [], questions: [{ questionNumber: 20, questionAsked: q20 }] };
  const reportModule = {
    buildReportModelFromJsonTranscript: () => model,
    renderInteractiveReportHtml: () => '<main><section class="interview-transcript">Transcript</section><section class="limitations">Limitations</section></main>',
    validateReportHtmlCoverage: () => ({ valid: true, questionCount: 20, statusRows: 20, articleCount: 20 }),
  };
  const questions = Array.from({ length: 20 }, (_, i) => ({ Title: String(i + 1).padStart(2, "0"), field_1: "Professional Relationships", field_2: i === 19 ? q20 : `Assessor question ${i + 1}`, Hints: `Hint ${i + 1}`, Objective: `Objective ${i + 1}` }));
  const generator = moduleUnderTest.create({ reportModule, callTextModel: async () => "{}", fetchAssessorQuestions: async () => ({ body: JSON.stringify({ AssessorQuestions: questions }) }) });
  const result = await generator.buildPreliminaryReviewReport({ jsonTranscript: { questions: [] } });
  assert.equal(result.assessorQuestions.length, 20);
  assert.match(result.html, /id="assessorQuestionsTitle"/);
  assert.match(result.html, /Assessor Question 20 - Professional Relationships/);
  assert.match(result.html, /data-question-number="20"/);
  assert.ok(result.html.indexOf('id="assessorQuestionsTitle"') < result.html.indexOf('class="interview-transcript"'));
  assert.ok(result.html.indexOf('class="interview-transcript"') < result.html.indexOf('class="limitations"'));
});
