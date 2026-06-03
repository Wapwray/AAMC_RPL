const test = require("node:test");
const assert = require("node:assert/strict");
const review = require("../public/rpl-preliminary-review");

const baseTranscript = `=============================
Assessment Transcript
=============================
Name: Alex Candidate
Contact ID: C-100
Assessment: RPL
Date: 3/06/2026
Initial Start Date: 3/06/2026, 9:00:00 am
Industry: Mortgage Broking
Job Title: Broker
=============================

Question 01: Explain how you meet the disclosure requirements.

Objective: Confirm disclosure obligations are understood.

Hint: Consider timing, documents, and client understanding.

Assessor summary: Alex described providing disclosure documents and checking client understanding.

Overall assessment: SATISFACTORY.

-----------------------------
QUESTION TRANSCRIPT
AI Interviewer: Explain how you meet the disclosure requirements.

Alex (Attempt 1):
I give the client the credit guide and explain the fees before advice is provided.

AI Interviewer:
Thank you for your responses, Alex. Please press the Next Question button to continue.
Submitted: 3/06/2026, 9:05:00 am

-----------------------------
Q24: Explain how you handle complaints.

Objective: Confirm complaint handling and escalation obligations are understood.

Hint: Include internal process, timeframes, and external dispute resolution.

Assessor summary: Alex only mentioned listening to the client.

Overall assessment: ADDITIONAL EVIDENCE MAY BE NEEDED.

-----------------------------
QUESTION TRANSCRIPT
AI Interviewer: Explain how you handle complaints.

Alex (Attempt 1):
I listen carefully and try to fix it. <script>alert("x")</script> & keep notes.

AI Interviewer:
Please provide more detail about the complaint process and escalation if needed. You can move to the next question if you cannot add more.
Submitted: 3/06/2026, 9:12:00 am

-----------------------------
Question 25 - Extra transcript-only question

Objective: Confirm additional evidence handling.

Overall assessment: NEEDS MORE INFO.

-----------------------------
QUESTION TRANSCRIPT
Alex (Attempt 1):
This was an extra response.
`;

test("normalises expected source statuses and supported legacy transition values", () => {
  assert.equal(review.normaliseTranscriptOverallAssessment("LIKELY SUFFICIENT."), "LIKELY SUFFICIENT");
  assert.equal(review.normaliseTranscriptOverallAssessment("additional evidence may be needed"), "ADDITIONAL EVIDENCE MAY BE NEEDED");
  assert.equal(review.normaliseTranscriptOverallAssessment("SATISFACTORY"), "LIKELY SUFFICIENT");
  assert.equal(review.normaliseTranscriptOverallAssessment("NEEDS MORE INFO."), "ADDITIONAL EVIDENCE MAY BE NEEDED");
  assert.equal(review.normaliseTranscriptOverallAssessment("UNSATISFACTORY"), undefined);
});

test("parses transcript metadata, question blocks over 24, attempts, AI messages, and source statuses", () => {
  const metadata = review.parseTranscriptMetadata(baseTranscript);
  assert.equal(metadata.candidateName, "Alex Candidate");
  assert.equal(metadata.contactId, "C-100");
  assert.equal(metadata.industry, "Mortgage Broking");

  const questions = review.parseTranscriptQuestions(baseTranscript);
  assert.equal(questions.length, 3);
  assert.deepEqual(questions.map((question) => question.questionNumber), [1, 24, 25]);
  assert.equal(questions[0].normalisedOverallAssessment, "LIKELY SUFFICIENT");
  assert.equal(questions[1].normalisedOverallAssessment, "ADDITIONAL EVIDENCE MAY BE NEEDED");
  assert.equal(questions[2].normalisedOverallAssessment, "ADDITIONAL EVIDENCE MAY BE NEEDED");
  assert.equal(questions[1].attempts[0].responseText.includes("<script>"), true);
  assert.equal(questions[1].assessorBotMessages.length, 2);
});

test("preserves transcript question block order instead of sorting by number", () => {
  const transcript = `Question 3: Third question
Candidate (Attempt 1):
Answer three.

Question 1: First question
Candidate (Attempt 1):
Answer one.`;
  const questions = review.parseTranscriptQuestions(transcript);
  assert.deepEqual(questions.map((question) => question.questionNumber), [3, 1]);
});

test("builds report list from official question bank plus unmapped transcript questions", () => {
  const officialQuestionBank = Array.from({ length: 24 }, (_, index) => ({
    questionNumber: index + 1,
    section: index < 12 ? "Compliance" : "Client service",
    questionText: `Official question ${index + 1}`,
    objective: `Objective ${index + 1}`,
    hints: `Hint ${index + 1}`,
  }));
  officialQuestionBank[0].questionText = "Explain how you meet the disclosure requirements.";
  officialQuestionBank[23].questionText = "Explain how you handle complaints.";

  const model = review.buildReportModel({
    fullTranscript: baseTranscript,
    candidateMetadata: { qualification: "Custom qualification" },
    officialQuestionBank,
    questionAnalyses: [
      {
        questionNumber: 1,
        shortStatus: "Likely sufficient",
        preliminaryStatus: "Likely sufficient (pending assessor verification)",
        aiPreliminaryObservation: "The candidate addressed disclosure obligations.",
      },
      {
        questionNumber: 24,
        shortStatus: "Additional evidence may be needed",
        preliminaryStatus: "Additional evidence may be needed (assessor follow-up suggested)",
        aiPreliminaryObservation: "The candidate did not fully explain complaint escalation.",
        assessorActionSuggested: "Seek evidence about complaint handling timeframes and escalation.",
      },
      {
        questionNumber: 25,
        shortStatus: "Additional evidence may be needed",
        preliminaryStatus: "Additional evidence may be needed (assessor follow-up suggested)",
        aiPreliminaryObservation: "The candidate supplied an extra response requiring assessor review.",
      },
    ],
  });

  assert.equal(model.questions.length, 25);
  assert.equal(model.metadata.questionCountReviewed, 25);
  assert.equal(model.metadata.transcriptQuestionCount, 3);
  assert.equal(model.metadata.questionBankCount, 24);
  assert.equal(model.questions[23].questionNumber, 24);
  assert.equal(model.questions[23].shortStatus, "Additional evidence may be needed");
  assert.equal(model.questions[24].questionNumber, 25);
  assert.equal(model.questions[24].section, "Additional transcript question");
  assert.equal(model.questions[1].shortStatus, "Not available in transcript");
  assert.ok(model.warnings.some((warning) => warning.includes("active question bank contains 24")));
});

test("reconciles duplicate transcript questions by text and avoids CT rule sections", () => {
  const transcript = `Question 21: Explain how you handle complaints.

Objective: Confirm complaint handling and escalation obligations are understood.

Overall assessment: ADDITIONAL EVIDENCE MAY BE NEEDED.

-----------------------------
QUESTION TRANSCRIPT
Alex (Attempt 1):
I listen and keep notes.`;
  const officialQuestionBank = [
    {
      questionNumber: 20,
      section: "If CT for FNSCRD401 then do not ask",
      questionText: "Explain how you handle complaints.",
      objective: "Confirm complaint handling and escalation obligations are understood.",
    },
  ];

  const model = review.buildReportModel({ fullTranscript: transcript, officialQuestionBank });

  assert.equal(model.questions.length, 1);
  assert.equal(model.questions[0].questionNumber, 20);
  assert.equal(model.questions[0].attempts.length, 1);
  assert.notEqual(model.questions[0].section, "If CT for FNSCRD401 then do not ask");
  assert.equal(model.questions[0].section, "Compliance");
});

test("does not infer missing intermediate questions without an official question bank", () => {
  const sparseTranscript = `Question 1: First question
Candidate (Attempt 1):
Answer one.

Question 3: Third question
Candidate (Attempt 1):
Answer three.`;
  const model = review.buildReportModel({ fullTranscript: sparseTranscript });
  assert.equal(model.questions.length, 2);
  assert.deepEqual(model.questions.map((question) => question.questionNumber), [1, 3]);
  assert.ok(model.warnings.some((warning) => warning.includes("non-contiguous")));
});

test("batches questions by content length unless an explicit question cap is supplied", () => {
  const manifest = Array.from({ length: 6 }, (_, index) => ({
    questionNumber: index + 1,
    officialQuestionSpec: { questionNumber: index + 1, questionText: `Question ${index + 1}` },
    parsedQuestionBlock: { questionNumber: index + 1, attempts: [{ responseText: "Short response" }] },
  }));

  assert.equal(review.buildQuestionAnalysisBatches(manifest, { maxBatchChars: 100000 }).length, 1);
  assert.equal(review.buildQuestionAnalysisBatches(manifest, { maxBatchChars: 100000, questionsPerBatch: 2 }).length, 3);
});

test("renders approved report labels, escaped verbatim responses, and one row/article per question", () => {
  const officialQuestionBank = [
    { questionNumber: 1, section: "Compliance", questionText: "Explain how you meet the disclosure requirements." },
    { questionNumber: 24, section: "Client service", questionText: "Explain how you handle complaints." },
  ];
  const model = review.buildReportModel({
    fullTranscript: baseTranscript,
    officialQuestionBank,
    questionAnalyses: [
      { questionNumber: 1, shortStatus: "Likely sufficient", aiPreliminaryObservation: "Evidence is likely sufficient." },
      { questionNumber: 24, shortStatus: "Additional evidence may be needed", aiPreliminaryObservation: "Further complaint handling evidence may be needed." },
      { questionNumber: 25, shortStatus: "Additional evidence may be needed", aiPreliminaryObservation: "Extra question requires assessor review." },
    ],
  });
  const html = review.renderReportHtml(model);
  const validation = review.validateReportHtmlCoverage(model, html);

  assert.equal(validation.valid, true);
  assert.equal(html.includes("@page { size: A4; margin: 0; }"), true);
  assert.equal(html.includes(".report { width: 210mm; max-width: 210mm; min-height: 297mm;"), true);
  assert.equal(html.includes(".summary, .question-review-section, .limitations { break-before: page; page-break-before: always; }"), true);
  assert.equal(html.includes("RPL Preliminary Interview Review"), true);
  assert.equal(html.includes("RPL Preliminary Assessment Review"), false);
  assert.equal(html.includes("<ul class=\"disclaimer-list\">"), true);
  assert.equal(html.includes("It does NOT constitute a competency decision."), true);
  assert.equal(html.includes("<ul class=\"summary-list\">"), true);
  assert.equal(html.includes("Question Count and Transcript Coverage"), false);
  assert.equal(html.includes("Transcript Coverage Warnings"), false);
  assert.equal(html.includes("Transcript question count"), false);
  assert.equal(html.includes("Question bank count"), false);
  assert.equal(html.includes("Assessment objective"), false);
  assert.equal(html.includes("Question objective"), true);
  assert.equal(html.includes("Assessor action suggested"), false);
  assert.equal(html.includes("AI follow-up exchange"), false);
  assert.equal(html.includes("AI INTERVIEW RESPONSE"), true);
  assert.equal(html.includes("Assessor Evaluation - Objective Met / Not Met"), true);
  assert.equal(html.includes("Assessor Notes"), true);
  assert.equal(html.includes("aria-label=\"Interview Outcome\""), true);
  assert.equal(html.includes("Final assessment outcome"), false);
  assert.equal(html.includes("Interview Outcome"), true);
  assert.equal(html.includes("LIKELY SUFFICIENT"), false);
  assert.equal(html.includes("ADDITIONAL EVIDENCE MAY BE NEEDED"), false);
  assert.equal(html.includes("NEEDS MORE INFO"), false);
  assert.equal(html.includes("Not classified by AI review"), false);
  assert.doesNotMatch(html, /\bassessment\b/i);
  assert.equal(html.includes("Likely sufficient (pending assessor verification)"), true);
  assert.equal(html.includes("Additional evidence may be needed (assessor follow-up suggested)"), true);
  assert.equal(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; keep notes."), true);
  const attemptIndex = html.indexOf("Alex response attempt 1");
  const responseIndex = html.indexOf("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; keep notes.");
  const aiResponseIndex = html.indexOf("AI INTERVIEW RESPONSE", responseIndex);
  const aiResponseTextIndex = html.indexOf("Please provide more detail about the complaint process", aiResponseIndex);
  const observationIndex = html.indexOf("AI preliminary observation", aiResponseIndex);
  assert.ok(attemptIndex >= 0);
  assert.ok(responseIndex > attemptIndex);
  assert.ok(aiResponseIndex > responseIndex);
  assert.ok(aiResponseTextIndex > aiResponseIndex);
  assert.ok(observationIndex > aiResponseTextIndex);
});