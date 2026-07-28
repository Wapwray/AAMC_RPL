const test = require("node:test");
const assert = require("node:assert/strict");
const persistence = require("../public/rpl-incremental-persistence.js");

test("uses the required student-contact-question-attempt file naming contract", () => {
  assert.equal(
    persistence.makeAttemptFileName({
      fullName: "Christian Dignan",
      contactId: "15606163",
      questionNumber: 6,
      attemptNumber: 2,
    }),
    "Christian Dignan - 15606163 - 6 - 2.json"
  );
});

test("sanitises characters SharePoint does not allow in file names", () => {
  assert.equal(
    persistence.makeAttemptFileName({
      fullName: "Test / Student",
      contactId: "12#34",
      questionNumber: 1,
      attemptNumber: 1,
    }),
    "Test - Student - 12-34 - 1 - 1.json"
  );
});

test("merges independently saved attempts and AI log deltas deterministically", () => {
  const records = [
    persistence.buildAttemptEnvelope({
      savedAtUtc: "2026-07-28T01:01:00.000Z",
      candidate: { fullName: "Test Student", givenName: "Test", contactId: "123456" },
      question: {
        questionIndex: 0,
        questionNumber: "1",
        questionText: "Question one?",
        objective: "Objective one",
        hint: "Hint one",
        section: "Compliance",
        aiInterviewerSummary: "Test provided partial evidence.",
        preliminaryStatus: "ADDITIONAL EVIDENCE MAY BE NEEDED",
      },
      attempt: {
        attemptNumber: 1,
        answer: "First answer",
        feedback: "Please add the missing impact.",
        submittedAt: "28/07/2026, 11:01:00 am",
      },
      state: { currentQuestion: "1", currentAttempt: "1", guidanceWindow: "{\"entries\":[]}" },
      aiPerformanceEntries: [{ timestampUtc: "2026-07-28T01:00:30.000Z", title: "request" }],
    }),
    persistence.buildAttemptEnvelope({
      savedAtUtc: "2026-07-28T01:03:00.000Z",
      candidate: { fullName: "Test Student", givenName: "Test", contactId: "123456" },
      question: {
        questionIndex: 0,
        questionNumber: "1",
        questionText: "Question one?",
        objective: "Objective one",
        hint: "Hint one",
        section: "Compliance",
        aiInterviewerSummary: "Test provided the required impact.",
        preliminaryStatus: "LIKELY SUFFICIENT",
      },
      attempt: {
        attemptNumber: 2,
        answer: "Second answer",
        feedback: "Thank you.",
        submittedAt: "28/07/2026, 11:03:00 am",
      },
      state: { currentQuestion: "1", currentAttempt: "2", guidanceWindow: "{\"entries\":[]}" },
      aiPerformanceEntries: [{ timestampUtc: "2026-07-28T01:02:30.000Z", title: "response" }],
    }),
  ];

  const merged = persistence.mergeAttemptRecords(records.reverse());
  assert.equal(merged.recordCount, 2);
  assert.equal(merged.transcriptQuestions[0].attempts.length, 2);
  assert.equal(merged.transcriptQuestions[0].attempts[0].answer, "First answer");
  assert.equal(merged.transcriptQuestions[0].attempts[1].answer, "Second answer");
  assert.equal(merged.transcriptQuestions[0].summary, "Test provided the required impact.");
  assert.equal(merged.transcriptQuestions[0].overallAssessment, "LIKELY SUFFICIENT");
  assert.equal(merged.aiPerformanceEntries.length, 2);
  assert.equal(merged.currentAttempt, "2");
});

test("normalises JSON strings returned by Power Automate", () => {
  const record = persistence.buildAttemptEnvelope({
    candidate: {},
    question: { questionIndex: 0, questionNumber: "1" },
    attempt: { attemptNumber: 1 },
    state: {},
  });
  assert.equal(persistence.normalizeAttemptRecords([JSON.stringify(record)]).length, 1);
});

test("treats new-student baseline markers as having no resume evidence", () => {
  assert.equal(persistence.hasMeaningfulResumeEvidence({
    recordCount: 0,
    transcriptText: "No Transcript\r\n",
    currentQuestion: "1",
    currentAttempt: "1",
  }), false);
});

test("does not treat blank guidance-independent state as resume evidence", () => {
  assert.equal(persistence.hasMeaningfulResumeEvidence({
    transcriptText: "",
    currentQuestion: "1",
    currentAttempt: "1",
  }), false);
});

test("recognises each supported form of genuine resume evidence", () => {
  assert.equal(persistence.hasMeaningfulResumeEvidence({
    recordCount: 1,
    transcriptText: "No Transcript",
    currentQuestion: "1",
    currentAttempt: "1",
  }), true);
  assert.equal(persistence.hasMeaningfulResumeEvidence({
    recordCount: 0,
    transcriptText: "Question 1\nStudent: A real answer",
    currentQuestion: "1",
    currentAttempt: "1",
  }), true);
  assert.equal(persistence.hasMeaningfulResumeEvidence({
    transcriptText: "No Transcript",
    currentQuestion: "2",
    currentAttempt: "1",
  }), true);
  assert.equal(persistence.hasMeaningfulResumeEvidence({
    transcriptText: "No Transcript",
    currentQuestion: "1",
    currentAttempt: "2",
  }), true);
  assert.equal(persistence.hasMeaningfulResumeEvidence({
    transcriptText: "No Transcript",
    currentQuestion: "xxx",
    currentAttempt: "1",
  }), true);
});
