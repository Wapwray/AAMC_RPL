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

AI Interviewer Summary: Alex described providing disclosure documents and checking client understanding.

Preliminary Status: SATISFACTORY.

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

AI Interviewer Summary: Alex only mentioned listening to the client.

Preliminary Status: ADDITIONAL EVIDENCE MAY BE NEEDED.

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

Preliminary Status: NEEDS MORE INFO.

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
  assert.equal(questions[0].aiInterviewSummary, "Alex described providing disclosure documents and checking client understanding.");
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
        preliminaryStatus: "LIKELY SUFFICIENT",
        aiPreliminaryObservation: "The candidate addressed disclosure obligations.",
      },
      {
        questionNumber: 24,
        shortStatus: "Additional evidence may be needed",
        preliminaryStatus: "ADDITIONAL EVIDENCE MAY BE NEEDED",
        aiPreliminaryObservation: "The candidate did not fully explain complaint escalation.",
        assessorActionSuggested: "Seek evidence about complaint handling timeframes and escalation.",
      },
      {
        questionNumber: 25,
        shortStatus: "Additional evidence may be needed",
        preliminaryStatus: "ADDITIONAL EVIDENCE MAY BE NEEDED",
        aiPreliminaryObservation: "The candidate supplied an extra response requiring assessor review.",
      },
    ],
  });

  assert.equal(model.questions.length, 25);
  assert.equal(model.metadata.questionCountReviewed, 25);
  assert.equal(model.metadata.transcriptQuestionCount, 3);
  assert.equal(model.metadata.questionBankCount, 24);
  assert.equal(model.questions[23].questionNumber, 24);
  assert.equal(model.questions[23].shortStatus, "ADDITIONAL EVIDENCE MAY BE NEEDED");
  assert.equal(model.questions[24].questionNumber, 25);
  assert.equal(model.questions[24].section, "Additional transcript question");
  assert.equal(model.questions[1].shortStatus, "Not available in transcript");
  assert.ok(model.warnings.some((warning) => warning.includes("active question bank contains 24")));
});

test("reconciles duplicate transcript questions by text and avoids CT rule sections", () => {
  const transcript = `Question 21: Explain how you handle complaints.

Objective: Confirm complaint handling and escalation obligations are understood.

Preliminary Status: ADDITIONAL EVIDENCE MAY BE NEEDED.

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

test("uses transcript objective and hint when active question data is unavailable", () => {
  const transcript = `Question 1: Describe a recent regulatory change that impacted your role?
What new procedures were introduced and how did these changes affect the way you manage your day-to-day work?

Objective: Student identifies one recent regulatory change and its impact on their role

Hint: Think of BID, DDO, AML/CTF. What did your compliance team, or licensing body change to meet these requirements?
Compare before vs. after - what you do differently now?

AI Interviewer Summary: The candidate identified a regulatory change and described changed work practices.

Preliminary Status: LIKELY SUFFICIENT.

-----------------------------
QUESTION TRANSCRIPT
AI Interviewer: Describe a recent regulatory change that impacted your role?
What new procedures were introduced and how did these changes affect the way you manage your day-to-day work?

Richard (Attempt 1):
The introduction of best interests duty changed the procedures I follow and the documentation I keep.
`;

  const model = review.buildReportModel({ fullTranscript: transcript, officialQuestionBank: [] });
  const question = model.questions[0];

  assert.equal(question.questionAsked.includes("What new procedures were introduced"), true);
  assert.equal(question.assessmentObjective, "Student identifies one recent regulatory change and its impact on their role");
  assert.equal(question.hintsProvided.includes("Think of BID, DDO, AML/CTF"), true);
  assert.equal(question.hintsProvided.includes("Compare before vs. after"), true);
  assert.notEqual(question.assessmentObjective, "Not available in active question data");
  assert.notEqual(question.hintsProvided, "Not available in active question data");

  const html = review.renderReportHtml(model);
  assert.equal(html.includes("Student identifies one recent regulatory change and its impact on their role"), true);
  assert.equal(html.includes("Think of BID, DDO, AML/CTF"), true);
  assert.equal(html.includes("Not available in active question data"), false);
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
  assert.equal(html.includes("@page { size: A4; margin: 12mm; }"), true);
  assert.equal(html.includes(".report { width: 100%; max-width: 180mm;"), true);
  assert.equal(html.includes(".summary, .question-review-section, .limitations { break-before: page; page-break-before: always; }"), true);
  assert.equal(html.includes("RPL Preliminary Interview Review"), true);
  assert.equal(html.includes("RPL Preliminary Assessment Review"), false);
  assert.doesNotMatch(html, /<(?:textarea|button|select|input)\b/i);
  assert.doesNotMatch(html, /\son(?:click|change)\s*=/i);
  assert.equal(html.includes("data-pdf-form-field"), false);
  assert.equal(html.includes("data-acroform-field"), false);
  assert.equal(html.includes("data-ms-pdf-field"), false);
  assert.equal(html.includes("<div class=\"response-box"), true);
  assert.equal(html.includes("<div class=\"field-value"), true);
  assert.equal(html.includes("<ul class=\"disclaimer-list\">"), true);
  assert.equal(html.includes("It does NOT constitute a competency decision."), true);
  assert.equal(html.includes("<ul class=\"summary-list\">"), true);
  assert.equal(html.includes("Question Count and Transcript Coverage"), false);
  assert.equal(html.includes("Transcript Coverage Warnings"), false);
  assert.equal(html.includes("Transcript question count"), false);
  assert.equal(html.includes("Question bank count"), false);
  assert.equal(html.includes("Assessment objective"), false);
  assert.equal(html.includes("Question objective"), false);
  assert.equal(html.includes("<h4>Objective</h4>"), true);
  assert.equal(html.includes("<h4>AI Interview Summary</h4>"), true);
  assert.equal(html.includes("AI preliminary observation"), false);
  assert.equal(html.includes("Assessor action suggested"), false);
  assert.equal(html.includes("AI follow-up exchange"), false);
  assert.equal(html.includes("AI INTERVIEW RESPONSE"), false);
  assert.equal(html.includes("Assessor Evaluation - Objective Met / Not Met"), true);
  assert.equal(html.includes("Assessor Notes"), true);
  assert.equal(html.includes("to be completed by assessor"), true);
  assert.equal(html.includes("Final assessment outcome"), false);
  assert.equal(html.includes("Interview Outcome"), true);
  assert.equal(html.includes("LIKELY SUFFICIENT"), true);
  assert.equal(html.includes("ADDITIONAL EVIDENCE MAY BE NEEDED"), true);
  assert.equal(html.includes("NEEDS MORE INFO"), false);
  assert.equal(html.includes("Not classified by AI review"), false);
  assert.doesNotMatch(html, /\bassessment\b/i);
  assert.equal(html.includes("Likely sufficient (pending assessor verification)"), false);
  assert.equal(html.includes("Additional evidence may be needed (assessor follow-up suggested)"), false);
  assert.equal(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; keep notes."), true);
  const question24Index = html.indexOf('data-question-number="24"');
  const objectiveIndex = html.indexOf("<h4>Objective</h4>", question24Index);
  const summaryIndex = html.indexOf("<h4>AI Interview Summary</h4>", objectiveIndex);
  const conversationIndex = html.indexOf("<h4>Student and AI Interview conversation</h4>", summaryIndex);
  const attemptIndex = html.indexOf("Alex (Attempt 1):", conversationIndex);
  const responseIndex = html.indexOf("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; keep notes.", attemptIndex);
  const aiResponseIndex = html.indexOf("AI Interviewer: Please provide more detail about the complaint process", responseIndex);
  assert.ok(question24Index >= 0);
  assert.ok(objectiveIndex > question24Index);
  assert.ok(summaryIndex > objectiveIndex);
  assert.ok(conversationIndex > summaryIndex);
  assert.ok(attemptIndex >= 0);
  assert.ok(responseIndex > attemptIndex);
  assert.ok(aiResponseIndex > responseIndex);
});