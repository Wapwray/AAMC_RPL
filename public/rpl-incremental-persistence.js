(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RplIncrementalPersistence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;

  const asText = (value) => value === undefined || value === null ? "" : String(value);

  const asPositiveInteger = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const sanitizeFilePart = (value, fallback) => {
    const cleaned = asText(value)
      .replace(/[\u0000-\u001f"*:<>?/\\|#%]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[.\s]+$/g, "")
      .trim();
    return cleaned || fallback;
  };

  const makeAttemptFileName = ({ fullName, contactId, questionNumber, attemptNumber }) => {
    const safeName = sanitizeFilePart(fullName, "Student");
    const safeContactId = sanitizeFilePart(contactId, "Unknown");
    const safeQuestion = sanitizeFilePart(questionNumber, "0");
    const safeAttempt = sanitizeFilePart(attemptNumber, "0");
    return `${safeName} - ${safeContactId} - ${safeQuestion} - ${safeAttempt}.json`;
  };

  const normalizeAttemptRecords = (value) => {
    if (!value) return [];
    let parsed = value;
    if (typeof value === "string") {
      try {
        parsed = JSON.parse(value);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) {
      parsed = Array.isArray(parsed?.records)
        ? parsed.records
        : Array.isArray(parsed?.AttemptRecords)
          ? parsed.AttemptRecords
          : [];
    }
    return parsed.flatMap((record) => {
      if (!record) return [];
      if (typeof record === "string") {
        try {
          return [JSON.parse(record)];
        } catch {
          return [];
        }
      }
      if (record.$content) {
        try {
          const decoded = typeof atob === "function"
            ? atob(record.$content)
            : Buffer.from(record.$content, "base64").toString("utf8");
          return [JSON.parse(decoded)];
        } catch {
          return [];
        }
      }
      return typeof record === "object" ? [record] : [];
    }).filter((record) => Number(record.version || VERSION) === VERSION);
  };

  const buildAttemptEnvelope = ({
    candidate,
    question,
    attempt,
    state,
    aiPerformanceEntries,
    savedAtUtc,
  }) => ({
    version: VERSION,
    savedAtUtc: savedAtUtc || new Date().toISOString(),
    candidate: {
      fullName: asText(candidate?.fullName),
      givenName: asText(candidate?.givenName),
      contactId: asText(candidate?.contactId),
      industry: asText(candidate?.industry),
      jobTitle: asText(candidate?.jobTitle),
      assessmentName: asText(candidate?.assessmentName || "RPL"),
      qualification: asText(candidate?.qualification),
      interviewDate: asText(candidate?.interviewDate),
      initialStartDate: asText(candidate?.initialStartDate),
      initialStartAtUtc: asText(candidate?.initialStartAtUtc),
    },
    question: {
      questionIndex: Math.max(0, Number.parseInt(question?.questionIndex, 10) || 0),
      questionNumber: asText(question?.questionNumber),
      questionText: asText(question?.questionText),
      objective: asText(question?.objective),
      hint: asText(question?.hint),
      section: asText(question?.section),
      aiInterviewerSummary: asText(question?.aiInterviewerSummary),
      preliminaryStatus: asText(question?.preliminaryStatus),
    },
    attempt: {
      attemptNumber: asPositiveInteger(attempt?.attemptNumber, 1),
      candidateName: asText(attempt?.candidateName),
      answer: asText(attempt?.answer),
      feedback: asText(attempt?.feedback),
      submittedAt: asText(attempt?.submittedAt),
    },
    state: {
      currentQuestion: asText(state?.currentQuestion),
      currentAttempt: asText(state?.currentAttempt),
      guidanceWindow: state?.guidanceWindow ?? "",
    },
    aiPerformanceEntries: Array.isArray(aiPerformanceEntries) ? aiPerformanceEntries : [],
  });

  const getRecordOrder = (record, originalIndex) => ({
    questionIndex: Math.max(0, Number.parseInt(record?.question?.questionIndex, 10) || 0),
    questionNumber: asPositiveInteger(record?.question?.questionNumber, Number.MAX_SAFE_INTEGER),
    attemptNumber: asPositiveInteger(record?.attempt?.attemptNumber, 1),
    savedAt: Date.parse(record?.savedAtUtc || "") || 0,
    originalIndex,
  });

  const mergeAttemptRecords = (input) => {
    const records = normalizeAttemptRecords(input)
      .map((record, originalIndex) => ({ record, order: getRecordOrder(record, originalIndex) }))
      .sort((left, right) => (
        left.order.questionIndex - right.order.questionIndex
        || left.order.questionNumber - right.order.questionNumber
        || left.order.attemptNumber - right.order.attemptNumber
        || left.order.savedAt - right.order.savedAt
        || left.order.originalIndex - right.order.originalIndex
      ));

    const transcriptQuestions = [];
    const logEntries = [];
    const logKeys = new Set();
    let candidate = {};
    let latestState = {};
    let latestSavedAt = -1;

    records.forEach(({ record, order }) => {
      if (record.candidate && typeof record.candidate === "object") {
        candidate = { ...candidate, ...record.candidate };
      }

      const question = record.question || {};
      const questionIndex = order.questionIndex;
      const existing = transcriptQuestions[questionIndex] || {
        questionNumber: asText(question.questionNumber),
        questionText: "",
        objective: "",
        hint: "",
        section: "",
        attempts: [],
        summary: "",
        overallAssessment: "",
        systemResponses: [],
      };
      existing.questionNumber = asText(question.questionNumber || existing.questionNumber);
      existing.questionText = asText(question.questionText || existing.questionText);
      existing.objective = asText(question.objective || existing.objective);
      existing.hint = asText(question.hint || existing.hint);
      existing.section = asText(question.section || existing.section);
      existing.summary = asText(question.aiInterviewerSummary || existing.summary);
      existing.overallAssessment = asText(question.preliminaryStatus || existing.overallAssessment);

      const attemptNumber = order.attemptNumber;
      existing.attempts[attemptNumber - 1] = {
        answer: asText(record.attempt?.answer),
        feedback: asText(record.attempt?.feedback),
        submittedAt: asText(record.attempt?.submittedAt),
      };
      transcriptQuestions[questionIndex] = existing;

      (Array.isArray(record.aiPerformanceEntries) ? record.aiPerformanceEntries : []).forEach((entry) => {
        const key = JSON.stringify([
          entry?.timestampUtc || "",
          entry?.title || "",
          entry?.questionNumber || "",
          entry?.attempt || "",
          entry?.fields || {},
        ]);
        if (logKeys.has(key)) return;
        logKeys.add(key);
        logEntries.push(entry);
      });

      if (order.savedAt >= latestSavedAt) {
        latestSavedAt = order.savedAt;
        latestState = { ...(record.state || {}) };
      }
    });

    transcriptQuestions.forEach((entry) => {
      if (!entry) return;
      entry.attempts = entry.attempts.filter(Boolean);
    });

    return {
      version: VERSION,
      candidate,
      transcriptQuestions,
      aiPerformanceEntries: logEntries,
      currentQuestion: asText(latestState.currentQuestion),
      currentAttempt: asText(latestState.currentAttempt),
      guidanceWindow: latestState.guidanceWindow ?? "",
      recordCount: records.length,
    };
  };

  return {
    VERSION,
    buildAttemptEnvelope,
    makeAttemptFileName,
    mergeAttemptRecords,
    normalizeAttemptRecords,
    sanitizeFilePart,
  };
});
