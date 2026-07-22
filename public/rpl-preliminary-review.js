(function initRplPreliminaryReview(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RplPreliminaryReview = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRplPreliminaryReviewModule() {
  "use strict";

  const SOURCE_LIKELY_SUFFICIENT = "LIKELY SUFFICIENT";
  const SOURCE_ADDITIONAL_EVIDENCE = "ADDITIONAL EVIDENCE MAY BE NEEDED";
  const SHORT_LIKELY_SUFFICIENT = SOURCE_LIKELY_SUFFICIENT;
  const SHORT_ADDITIONAL_EVIDENCE = SOURCE_ADDITIONAL_EVIDENCE;
  const SHORT_NOT_AVAILABLE = "Not available in transcript";
  const SHORT_QUESTION_NOT_ASKED = "Question Not Asked";
  const FULL_LIKELY_SUFFICIENT = SOURCE_LIKELY_SUFFICIENT;
  const FULL_ADDITIONAL_EVIDENCE = SOURCE_ADDITIONAL_EVIDENCE;
  const FULL_NOT_AVAILABLE = "Not available in transcript";
  const FULL_QUESTION_NOT_ASKED = "Question Not Asked";
  const REPORT_TYPE = "AI-generated preliminary interview review (not a final competency decision)";
  const DEFAULT_QUALIFICATION = "FNS50322 Diploma of Finance and Mortgage Broking Management";
  const LEGACY_QUALIFICATION_PATTERNS = [
    /FNS40821\s*-?\s*Certificate\s*IV\s*in\s*Finance\s*and\s*Mortgage\s*Broking/i,
    /Certificate\s*IV\s*in\s*Finance\s*and\s*Mortgage\s*Broking/i,
  ];
  const MISSING_VALUE = "Not stated in transcript";
  const ACTIVE_DATA_MISSING = "Not available in active question data";
  const DISCLAIMER_INTRO = "This report was prepared by an AI-based assistant as a preliminary analysis of the student's responses during an RPL interview.";
  const DISCLAIMER_BULLETS = [
    "It does NOT constitute a competency decision.",
    "All findings are preliminary and subject to validation by a qualified human RPL assessor.",
    "Final determination of competency for the qualification and its units of competency rests solely with the qualified assessor, consistent with the Standards for RTOs 2025 and ASQA guidance on AI-assisted evidence review.",
  ];
  const DISCLAIMER_TEXT = `IMPORTANT — PRELIMINARY AI REVIEW ONLY\n${DISCLAIMER_INTRO}\n${DISCLAIMER_BULLETS.map((item) => `- ${item}`).join("\n")}`;
  const SUMMARY_FINAL_SENTENCE = "The summary above reflects the AI's preliminary observations only. All findings remain subject to confirmation by a qualified human RPL assessor.";
  const LIMITATIONS_TEXT = "This report is an automated preliminary analysis and may not capture all nuances of the student's competence. It does not account for non-verbal cues, workplace context, third-party evidence, or any documentation provided outside the recorded interview transcript. The AI cannot confirm authenticity or currency of evidence; those Rules of Evidence must be verified through human assessor processes.";
  const ASSESSOR_CONFIRMATION_TEXT = `A qualified RPL assessor must review the full transcript and any additional evidence, and make the final judgement on each unit's competency. The assessor should confirm that all critical evidence meets the requirements of ${DEFAULT_QUALIFICATION} and its constituent units, applying the Principles of Assessment (fair, flexible, valid, reliable) and the Rules of Evidence (valid, sufficient, authentic, current). No outcome described in this preliminary report should be treated as final until signed off by the qualified assessor.`;
  const TRANSCRIPT_SUMMARY_LABELS = ["AI Interviewer Summary", "AI Interview Summary", "Assessor summary", "Summary"];
  const TRANSCRIPT_FIELD_LABELS = ["Objective", "Hint", ...TRANSCRIPT_SUMMARY_LABELS, "Preliminary Status", "Overall assessment"];

  const escapeHtml = (value) => String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const escapeAttribute = (value) => escapeHtml(value).replace(/`/g, "&#96;");

  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const normalizeWhitespace = (value) => String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cleanMetadataValue = (value) => {
    const text = String(value === undefined || value === null ? "" : value).trim();
    if (!text || /^(?:n\/?a|not stated|not supplied|null|undefined)$/i.test(text)) return "";
    return text;
  };

  const normalizeQualificationValue = (value) => {
    const text = cleanMetadataValue(value);
    if (!text) return "";
    if (LEGACY_QUALIFICATION_PATTERNS.some((pattern) => pattern.test(text))) {
      return DEFAULT_QUALIFICATION;
    }
    return text;
  };

  const valueOrMissing = (value) => cleanMetadataValue(value) || MISSING_VALUE;

  const normalizeQuestionNumberForKey = (value) => {
    if (value === undefined || value === null || value === "") return "";
    const text = String(value).trim();
    const numericMatch = text.match(/^0*(\d+)$/);
    if (numericMatch) return `n:${parseInt(numericMatch[1], 10)}`;
    const qNumericMatch = text.match(/^q\s*0*(\d+)$/i);
    if (qNumericMatch) return `n:${parseInt(qNumericMatch[1], 10)}`;
    return `s:${normalizeWhitespace(text).toLowerCase()}`;
  };

  const normalizeQuestionTextForMatch = (value) => normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const looksLikeCtRule = (value) => {
    const text = normalizeWhitespace(value).toLowerCase();
    if (!text) return false;
    return [
      "if ct",
      "exempt if",
      "do not ask",
      "always asked",
      "no ct",
      "credit transfer",
      "unit-mapping",
      "skip rule",
    ].some((signal) => text.includes(signal));
  };

  const pickField = (object, keys) => {
    if (!object || typeof object !== "object") return "";
    for (const key of keys) {
      const value = object[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  const inferSectionFromQuestion = (question = {}) => {
    const source = normalizeWhitespace([
      question.questionText,
      question.QuestionText,
      question.title,
      question.Title,
      question.objective,
      question.Objective,
    ].filter(Boolean).join(" ")).toLowerCase();
    if (!source) return "";
    if (/complian|regulat|rg\s*209|best interest|bid|disclos|privacy|complaint|afca|asic|responsible lending/.test(source)) return "Compliance";
    if (/ethic|conflict|client'?s? best interest|commission|integrity|professional conduct/.test(source)) return "Ethics";
    if (/customer|client service|communication|stakeholder|complain|dispute|relationship/.test(source)) return "Customer Service";
    if (/complex|trust|company|self[-\s]?employed|construction|bridging|smsf|commercial/.test(source)) return "Complex Lending";
    if (/risk|fraud|red flag|mitigat|vulnerab|hardship/.test(source)) return "Risk";
    if (/referr|third party|aggregator|business partner/.test(source)) return "Referral Relationships";
    if (/professional development|cpd|training|competenc|currency|industry update/.test(source)) return "Professional Development";
    return "";
  };

  const getDisplaySection = (question = {}) => {
    const value = pickField(question, [
      "section",
      "Section",
      "category",
      "Category",
      "reportSection",
      "ReportSection",
      "assessmentArea",
      "AssessmentArea",
    ]);
    if (value && !looksLikeCtRule(value)) return value;
    return inferSectionFromQuestion(question) || "General";
  };

  const getDisplayOrder = (question = {}, fallbackIndex = 0) => {
    const candidates = [
      question.displayOrder,
      question.DisplayOrder,
      question.sortOrder,
      question.SortOrder,
      question.order,
      question.Order,
      question.sequence,
      question.Sequence,
    ];
    const numeric = candidates.map(Number).find((value) => Number.isFinite(value));
    return Number.isFinite(numeric) ? numeric : fallbackIndex + 1;
  };

  const tokenise = (value) => normalizeQuestionTextForMatch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  const textSimilarity = (left, right) => {
    const leftText = normalizeQuestionTextForMatch(left);
    const rightText = normalizeQuestionTextForMatch(right);
    if (!leftText || !rightText) return 0;
    if (leftText === rightText) return 1;
    if (leftText.includes(rightText) || rightText.includes(leftText)) {
      return Math.min(leftText.length, rightText.length) / Math.max(leftText.length, rightText.length);
    }
    const leftTokens = new Set(tokenise(leftText));
    const rightTokens = new Set(tokenise(rightText));
    if (!leftTokens.size || !rightTokens.size) return 0;
    let intersection = 0;
    leftTokens.forEach((token) => {
      if (rightTokens.has(token)) intersection += 1;
    });
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union ? intersection / union : 0;
  };

  const normaliseTranscriptOverallAssessment = (value) => {
    if (!value) return undefined;
    const cleaned = String(value)
      .trim()
      .replace(/[.]+$/g, "")
      .replace(/\s+/g, " ")
      .toUpperCase();

    if (cleaned === SOURCE_LIKELY_SUFFICIENT) return SOURCE_LIKELY_SUFFICIENT;
    if (cleaned === SOURCE_ADDITIONAL_EVIDENCE) return SOURCE_ADDITIONAL_EVIDENCE;
    if (cleaned === "SATISFACTORY") return SOURCE_LIKELY_SUFFICIENT;
    if (cleaned === "NEEDS MORE INFO") return SOURCE_ADDITIONAL_EVIDENCE;
    return undefined;
  };

  const shortStatusFromAnyValue = (value) => {
    const text = normalizeWhitespace(value).toLowerCase();
    if (!text) return "";
    if (text.includes("question not asked")) return SHORT_QUESTION_NOT_ASKED;
    if (text.includes("not available in transcript")) return SHORT_NOT_AVAILABLE;
    if (text.includes("additional evidence") || text.includes("needs more info") || text.includes("needs more information")) {
      return SHORT_ADDITIONAL_EVIDENCE;
    }
    if (text.includes("likely sufficient") || text === "satisfactory") return SHORT_LIKELY_SUFFICIENT;
    return "";
  };

  const fullStatusFromShortStatus = (shortStatus) => {
    if (shortStatus === SHORT_LIKELY_SUFFICIENT) return FULL_LIKELY_SUFFICIENT;
    if (shortStatus === SHORT_ADDITIONAL_EVIDENCE) return FULL_ADDITIONAL_EVIDENCE;
    if (shortStatus === SHORT_QUESTION_NOT_ASKED) return FULL_QUESTION_NOT_ASKED;
    return FULL_NOT_AVAILABLE;
  };

  const statusClassName = (shortStatus) => {
    if (shortStatus === SHORT_LIKELY_SUFFICIENT) return "status-likely";
    if (shortStatus === SHORT_ADDITIONAL_EVIDENCE) return "status-gap";
    return "status-missing";
  };

  const statusSortOrder = (shortStatus) => {
    if (shortStatus === SHORT_ADDITIONAL_EVIDENCE) return 1;
    if (shortStatus === SHORT_NOT_AVAILABLE || shortStatus === SHORT_QUESTION_NOT_ASKED) return 2;
    return 0;
  };

  const isMissingTranscriptStatus = (shortStatus) => shortStatus === SHORT_NOT_AVAILABLE || shortStatus === SHORT_QUESTION_NOT_ASKED;

  const stripStructuralNewlines = (value) => String(value || "")
    .replace(/^\r?\n/, "")
    .replace(/\r?\n[ \t]*$/g, "")
    .replace(/\r$/g, "");

  const parseTranscriptMetadata = (transcriptText) => {
    const text = String(transcriptText || "");
    const metadata = {};
    const labelMap = [
      ["Name", "candidateName"],
      ["Contact ID", "contactId"],
      ["Assessment", "assessmentName"],
      ["Date", "interviewDate"],
      ["Initial Start Date", "initialStartDate"],
      ["Industry", "industry"],
      ["Job Title", "jobTitle"],
    ];

    labelMap.forEach(([label, key]) => {
      const regex = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*(.+?)\\s*$`, "im");
      const match = text.match(regex);
      if (match) metadata[key] = cleanMetadataValue(match[1]);
    });

    return metadata;
  };

  const questionHeadingRegex = /^((?:Question|Q)\s*([A-Za-z0-9][\w.-]*))\s*(?::|-)\s*([^\r\n]*)/gim;

  const parseQuestionNumber = (identifier) => {
    const text = String(identifier || "").trim();
    if (/^\d+$/.test(text)) return parseInt(text, 10);
    return text;
  };

  const getLabelValue = (blockText, labels, stopLabels) => {
    const labelPattern = labels.map(escapeRegExp).join("|");
    const stopPattern = (stopLabels || TRANSCRIPT_FIELD_LABELS)
      .map(escapeRegExp)
      .join("|");
    const regex = new RegExp(
      `^\\s*(?:${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=^\\s*(?:${stopPattern})\\s*:|^\\s*-{3,}\\s*$|^\\s*QUESTION TRANSCRIPT\\b|^\\s*(?:(?:Question|Q)\\s*[A-Za-z0-9][\\w.-]*\\s*(?::|-)\\s*)|(?![\\s\\S]))`,
      "im"
    );
    const match = blockText.match(regex);
    return match ? match[1].trim() : "";
  };

  const getQuestionTextFromBlock = (rawBlockText, headingText, headingTrailingText) => {
    const bodyAfterHeading = rawBlockText.slice(headingText.length);
    const fieldLabelPattern = TRANSCRIPT_FIELD_LABELS.map(escapeRegExp).join("|");
    const textBeforeLabelsMatch = bodyAfterHeading.match(new RegExp(`[\\s\\S]*?(?=^\\s*(?:${fieldLabelPattern})\\s*:|^\\s*-{3,}\\s*$|^\\s*QUESTION TRANSCRIPT\\b|(?![\\s\\S]))`, "im"));
    const continuation = textBeforeLabelsMatch ? textBeforeLabelsMatch[0].trim() : "";
    return [headingTrailingText, continuation]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  };

  const parseAttempts = (rawBlockText) => {
    const attempts = [];
    const attemptHeaderRegex = /^([^\r\n:]+?)\s*\(Attempt\s+(\d+)\)\s*:\s*$/gim;
    const headers = [];
    let match;
    while ((match = attemptHeaderRegex.exec(rawBlockText))) {
      headers.push({
        index: match.index,
        endIndex: attemptHeaderRegex.lastIndex,
        speakerLabel: match[1].trim(),
        attemptNumber: parseInt(match[2], 10),
      });
    }

    headers.forEach((header, index) => {
      const nextHeader = headers[index + 1];
      const attemptSlice = rawBlockText.slice(header.endIndex, nextHeader ? nextHeader.index : rawBlockText.length);
      const responseMatch = attemptSlice.match(/[\s\S]*?(?=^\s*(?:AI Interviewer|AssessorBot)\s*:|^\s*Submitted\s*:|^\s*-{3,}\s*$|(?![\s\S]))/im);
      const submittedMatch = attemptSlice.match(/^\s*Submitted\s*:\s*([^\r\n]+)/im);
      attempts.push({
        speakerLabel: header.speakerLabel,
        attemptNumber: header.attemptNumber,
        responseText: stripStructuralNewlines(responseMatch ? responseMatch[0] : ""),
        submittedAt: submittedMatch ? submittedMatch[1].trim() : "",
        _position: header.index,
      });
    });

    return attempts;
  };

  const parseAssessorBotMessages = (rawBlockText, attemptsWithPositions) => {
    const messages = [];
    const messageRegex = /^\s*(AI Interviewer|AssessorBot)\s*:\s*(?:\r?\n)?([\s\S]*?)(?=^\s*(?:[^\r\n:]+?\s*\(Attempt\s+\d+\)\s*:|AI Interviewer\s*:|AssessorBot\s*:|Submitted\s*:|-{3,}\s*$|(?:Question|Q)\s*[A-Za-z0-9][\w.-]*\s*(?::|-)\s*)|(?![\s\S]))/gim;
    let match;
    while ((match = messageRegex.exec(rawBlockText))) {
      const messageText = stripStructuralNewlines(match[2] || "").trim();
      if (!messageText) continue;
      const priorAttempt = attemptsWithPositions
        .filter((attempt) => attempt._position < match.index)
        .slice(-1)[0];
      messages.push({
        messageText,
        submittedAt: "",
        followsAttemptNumber: priorAttempt ? priorAttempt.attemptNumber : undefined,
      });
    }
    return messages;
  };

  const stripInternalPositions = (attempts) => attempts.map((attempt) => ({
    speakerLabel: attempt.speakerLabel,
    attemptNumber: attempt.attemptNumber,
    responseText: attempt.responseText,
    submittedAt: attempt.submittedAt,
  }));

  const parseTranscriptQuestions = (transcriptText) => {
    const text = String(transcriptText || "");
    const headings = [];
    let match;
    while ((match = questionHeadingRegex.exec(text))) {
      headings.push({
        index: match.index,
        endIndex: questionHeadingRegex.lastIndex,
        headingText: match[0],
        rawIdentifier: match[2],
        questionNumber: parseQuestionNumber(match[2]),
        trailingText: match[3] || "",
      });
    }

    const parsed = headings.map((heading, index) => {
      const nextHeading = headings[index + 1];
      const rawBlockText = text.slice(heading.index, nextHeading ? nextHeading.index : text.length).trim();
      const rawOverallAssessment = (rawBlockText.match(/^\s*(?:Preliminary Status|Overall assessment)\s*:\s*([^\r\n]+)/im) || [])[1] || "";
      const attemptsWithPositions = parseAttempts(rawBlockText);
      const assessorBotMessages = parseAssessorBotMessages(rawBlockText, attemptsWithPositions);
      const transcriptQuestionText = getQuestionTextFromBlock(rawBlockText, heading.headingText, heading.trailingText);
      const aiInterviewSummary = getLabelValue(rawBlockText, TRANSCRIPT_SUMMARY_LABELS, ["Preliminary Status", "Overall assessment"]);

      return {
        questionNumber: heading.questionNumber,
        originalQuestionIdentifier: heading.rawIdentifier,
        transcriptQuestionText,
        transcriptObjective: getLabelValue(rawBlockText, ["Objective"], ["Hint", ...TRANSCRIPT_SUMMARY_LABELS, "Preliminary Status", "Overall assessment"]),
        transcriptHint: getLabelValue(rawBlockText, ["Hint"], [...TRANSCRIPT_SUMMARY_LABELS, "Preliminary Status", "Overall assessment"]),
        aiInterviewSummary,
        assessorSummary: aiInterviewSummary,
        rawOverallAssessment: rawOverallAssessment.trim(),
        normalisedOverallAssessment: normaliseTranscriptOverallAssessment(rawOverallAssessment),
        attempts: stripInternalPositions(attemptsWithPositions),
        assessorBotMessages,
        rawBlockText,
        _sourceOrder: index,
      };
    });

    return parsed.map((block) => {
      const { _sourceOrder, ...publicBlock } = block;
      return publicBlock;
    });
  };

  const isQuestionNumberContiguous = (blocks) => {
    const numericNumbers = blocks
      .map((block) => block.questionNumber)
      .filter((number) => typeof number === "number")
      .sort((left, right) => left - right);
    if (numericNumbers.length <= 1) return true;
    for (let index = 1; index < numericNumbers.length; index += 1) {
      if (numericNumbers[index] !== numericNumbers[index - 1] + 1) return false;
    }
    return true;
  };

  const buildQuestionManifest = (officialQuestionBank, parsedQuestionBlocks) => {
    const officialQuestions = (Array.isArray(officialQuestionBank) ? officialQuestionBank : [])
      .map((question, index) => ({
        ...question,
        _bankIndex: index,
        _displayOrder: getDisplayOrder(question, index),
      }))
      .sort((left, right) => {
        if (left._displayOrder !== right._displayOrder) return left._displayOrder - right._displayOrder;
        return left._bankIndex - right._bankIndex;
      });
    const parsedBlocks = Array.isArray(parsedQuestionBlocks) ? parsedQuestionBlocks : [];
    const usedTranscriptIndexes = new Set();
    const manifest = [];
    const transcriptByText = new Map();
    const transcriptNumberCounts = new Map();

    parsedBlocks.forEach((block, index) => {
      const textKey = normalizeQuestionTextForMatch(block.transcriptQuestionText || "");
      if (textKey && !transcriptByText.has(textKey)) transcriptByText.set(textKey, index);
      const numberKey = normalizeQuestionNumberForKey(block.questionNumber);
      if (numberKey) transcriptNumberCounts.set(numberKey, (transcriptNumberCounts.get(numberKey) || 0) + 1);
    });

    const findUnusedTranscript = (predicate) => {
      for (let index = 0; index < parsedBlocks.length; index += 1) {
        if (usedTranscriptIndexes.has(index)) continue;
        if (predicate(parsedBlocks[index], index)) return index;
      }
      return -1;
    };

    officialQuestions.forEach((spec, index) => {
      const specNumber = spec && spec.questionNumber !== undefined && spec.questionNumber !== null && spec.questionNumber !== ""
        ? spec.questionNumber
        : index + 1;
      const specKey = normalizeQuestionNumberForKey(specNumber);
      const specText = spec?.questionText || "";
      const specTextKey = normalizeQuestionTextForMatch(specText);
      let matchedIndex = -1;

      if (specTextKey && transcriptByText.has(specTextKey) && !usedTranscriptIndexes.has(transcriptByText.get(specTextKey))) {
        matchedIndex = transcriptByText.get(specTextKey);
      }

      if (matchedIndex < 0 && specKey && transcriptNumberCounts.get(specKey) === 1) {
        const numberMatch = findUnusedTranscript((block) => normalizeQuestionNumberForKey(block.questionNumber) === specKey);
        if (numberMatch >= 0) {
          const blockText = parsedBlocks[numberMatch]?.transcriptQuestionText || "";
          const score = textSimilarity(specText, blockText);
          if (!specText || !blockText || score >= 0.5 || officialQuestions.length === parsedBlocks.length) matchedIndex = numberMatch;
        }
      }

      if (matchedIndex < 0) {
        let bestMatchIndex = -1;
        let bestScore = 0;
        parsedBlocks.forEach((block, blockIndex) => {
          if (usedTranscriptIndexes.has(blockIndex)) return;
          const score = textSimilarity(spec?.questionText || "", block.transcriptQuestionText || "");
          if (score > bestScore) {
            bestScore = score;
            bestMatchIndex = blockIndex;
          }
        });
        if (bestScore >= 0.72) matchedIndex = bestMatchIndex;
      }

      if (matchedIndex < 0 && officialQuestions.length === parsedBlocks.length) {
        const candidate = parsedBlocks[index];
        if (candidate && !usedTranscriptIndexes.has(index)) {
          const score = textSimilarity(specText, candidate.transcriptQuestionText || "");
          if (!specText || score >= 0.45) matchedIndex = index;
        }
      }

      if (matchedIndex >= 0) usedTranscriptIndexes.add(matchedIndex);
      const parsedBlock = matchedIndex >= 0 ? parsedBlocks[matchedIndex] : null;
      manifest.push({
        canonicalKey: spec?.id || spec?.questionId || spec?.QuestionID || specTextKey || specKey || `bank:${index}`,
        questionNumber: specNumber,
        displayOrder: spec._displayOrder,
        officialQuestionSpec: { ...spec, questionNumber: specNumber, section: getDisplaySection(spec) },
        parsedQuestionBlock: parsedBlock,
        section: getDisplaySection(spec),
        isUnmappedTranscriptQuestion: false,
        source: parsedBlock ? "questionBankAndTranscript" : "questionBankOnly",
      });
    });

    parsedBlocks.forEach((block, index) => {
      if (usedTranscriptIndexes.has(index)) return;
      const blockTextKey = normalizeQuestionTextForMatch(block.transcriptQuestionText || "");
      const duplicateOfficial = manifest.some((item) => normalizeQuestionTextForMatch(item.officialQuestionSpec?.questionText || "") === blockTextKey);
      if (blockTextKey && duplicateOfficial) return;
      manifest.push({
        canonicalKey: blockTextKey || `transcript:${index}`,
        questionNumber: block.questionNumber,
        displayOrder: officialQuestions.length + index + 1,
        officialQuestionSpec: null,
        parsedQuestionBlock: block,
        section: officialQuestions.length ? "Additional transcript question" : inferSectionFromQuestion({ questionText: block.transcriptQuestionText, objective: block.transcriptObjective }) || "General",
        isUnmappedTranscriptQuestion: Boolean(officialQuestions.length),
        source: "transcriptOnly",
      });
    });

    return manifest.sort((left, right) => {
      const leftOrder = Number.isFinite(Number(left.displayOrder)) ? Number(left.displayOrder) : Number.POSITIVE_INFINITY;
      const rightOrder = Number.isFinite(Number(right.displayOrder)) ? Number(right.displayOrder) : Number.POSITIVE_INFINITY;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return 0;
    });
  };

  const estimateQuestionPayloadLength = (item) => JSON.stringify({
    spec: item.officialQuestionSpec,
    block: item.parsedQuestionBlock,
  }).length;

  const buildQuestionAnalysisBatches = (manifest, options = {}) => {
    const maxBatchChars = Number.isFinite(Number(options.maxBatchChars)) ? Number(options.maxBatchChars) : 16000;
    const questionsPerBatch = Number.isFinite(Number(options.questionsPerBatch)) && Number(options.questionsPerBatch) > 0
      ? Number(options.questionsPerBatch)
      : Number.POSITIVE_INFINITY;
    const batches = [];
    let currentBatch = [];
    let currentLength = 0;

    (Array.isArray(manifest) ? manifest : []).forEach((item) => {
      const itemLength = estimateQuestionPayloadLength(item);
      const shouldStartNewBatch = currentBatch.length > 0 && (
        currentLength + itemLength > maxBatchChars || currentBatch.length >= questionsPerBatch
      );
      if (shouldStartNewBatch) {
        batches.push(currentBatch);
        currentBatch = [];
        currentLength = 0;
      }
      currentBatch.push(item);
      currentLength += itemLength;
    });

    if (currentBatch.length) batches.push(currentBatch);
    return batches;
  };

  const buildQuestionAnalysisPrompt = ({ candidateMetadata, questionSpecs, parsedQuestionBlocks }) => `SYSTEM:
You are an expert in Australian financial services RPL evidence review. You prepare preliminary assessor-facing evidence analysis only. You do not make final assessment decisions.

USER:
Analyse the following RPL transcript question block(s) and return valid JSON only. Do not return Markdown or HTML.

Student metadata:
${JSON.stringify(candidateMetadata || {}, null, 2)}

Official question specification(s):
${JSON.stringify(questionSpecs || [], null, 2)}

Parsed transcript question block(s):
${JSON.stringify(parsedQuestionBlocks || [], null, 2)}

For each question, review all student attempts together against the official objective. Use only the allowed preliminary status labels. Preserve student attempts exactly as supplied; do not rewrite them.

Return JSON with this shape:
{
  "questions": [
    {
      "questionNumber": "",
      "section": "",
      "unitCode": "",
      "unitTitle": "",
      "questionAsked": "",
      "hintsProvided": "",
      "assessmentObjective": "",
      "preliminaryStatus": "Likely sufficient (pending assessor verification) | Additional evidence may be needed (assessor follow-up suggested) | Not available in transcript",
      "shortStatus": "Likely sufficient | Additional evidence may be needed | Not available in transcript",
      "aiFollowUpExchange": "",
      "aiPreliminaryObservation": "",
      "assessorActionSuggested": ""
    }
  ]
}

Rules:
- Return one JSON object for every supplied question specification or parsed question block.
- Use rawOverallAssessment/normalisedOverallAssessment as transcript source metadata only, not as final report wording.
- The expected source status values are LIKELY SUFFICIENT and ADDITIONAL EVIDENCE MAY BE NEEDED.
- If legacy source values appear in older transcripts, rely on the parser's normalisedOverallAssessment rather than the raw value.
- Do not use legacy terms such as satisfactory or needs more info as status labels.
- Do not use the words competent, not competent, pass, fail, or not classified as status labels.
- Do not write to the learner.
- Remove learner-facing directions such as "move to the next question".
- If student evidence exists, do not return "Not available in transcript".
- If the transcript lacks a student response, return "Not available in transcript" and specify assessor follow-up.
- If additional evidence may be needed, identify the specific missing evidence.`;

  const parseQuestionAnalysisResponse = (responseText) => {
    const text = String(responseText || "").trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    try {
      const parsed = JSON.parse(text);
      return { questions: Array.isArray(parsed?.questions) ? parsed.questions : [] };
    } catch (error) {
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (!objectMatch) throw error;
      const parsed = JSON.parse(objectMatch[0]);
      return { questions: Array.isArray(parsed?.questions) ? parsed.questions : [] };
    }
  };

  const removeLearnerDirections = (value) => String(value || "")
    .replace(/\b(?:please\s+)?press the Next Question button to continue\.?/gi, "")
    .replace(/\bmove to the next question\.?/gi, "")
    .replace(/\bgo to the next question\.?/gi, "")
    .replace(/\bcontinue to the next question\.?/gi, "")
    .replace(/\bthank you for your responses?,?\s*[^.]*\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const isGenericAnalysisText = (value) => {
    const text = normalizeWhitespace(value).toLowerCase();
    if (!text) return true;
    return [
      "the transcript source material indicates",
      "classified from transcript source signals only",
      "could not be analysed by the model",
      "model failed",
      "not classified by ai review",
      "source signals only",
      "ai analysis warning",
    ].some((signal) => text.includes(signal));
  };

  const sanitiseAssessorFacingText = (value) => removeLearnerDirections(value)
    .replace(/\bassessment decision\b/gi, "competency decision")
    .replace(/\bassessment judgement\b/gi, "competency judgement")
    .replace(/\bassessment judgment\b/gi, "competency judgement")
    .replace(/\bassessment requirements\b/gi, "question requirements")
    .replace(/\bassessment\b/gi, "interview")
    .replace(/\bSATISFACTORY\b/gi, "likely sufficient")
    .replace(/\bNEEDS MORE INFO\b/gi, "additional evidence may be needed")
    .replace(/\bLIKELY SUFFICIENT\b/g, "likely sufficient")
    .replace(/\bADDITIONAL EVIDENCE MAY BE NEEDED\b/g, "additional evidence may be needed")
    .replace(/\bnot classified by AI review\b/gi, "not available in transcript")
    .replace(/\bmodel failed\b/gi, "")
    .replace(/\bsource signals only\b/gi, "")
    .replace(/\bcompetent\b|\bnot competent\b|\bpass\b|\bfail\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const rewriteAssessorSummaryForReport = (summary) => {
    const cleaned = sanitiseAssessorFacingText(summary)
      .replace(/^\s*[^,]{1,80},\s*/i, "")
      .replace(/\byou\b/gi, "the student")
      .replace(/\byour\b/gi, "the student's")
      .replace(/\bprovided evidence covering\b/gi, "provided evidence covering")
      .trim();
    if (!cleaned) return "";
    const sentence = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return /^The student\b/i.test(sentence) ? sentence : `The student ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
  };

  const summariseCandidateEvidence = (block) => {
    const attempts = Array.isArray(block?.attempts) ? block.attempts : [];
    const text = normalizeWhitespace(attempts.map((attempt) => attempt.responseText).filter(Boolean).join(" "));
    if (!text) return "";
    const preview = text.length > 180 ? `${text.slice(0, 177)}...` : text;
    return preview;
  };

  const isRealFollowUpRequest = (value) => {
    const text = normalizeWhitespace(value).toLowerCase();
    if (!text) return false;
    return [
      "please add",
      "please provide",
      "more detail",
      "however, you have not",
      "you have not yet",
      "missing",
      "not fully addressed",
      "if you cannot add any more",
      "additional evidence",
    ].some((signal) => text.includes(signal));
  };

  const buildFallbackFollowUpExchange = (item) => {
    const block = item.parsedQuestionBlock;
    if (!block || !Array.isArray(block.assessorBotMessages) || !block.assessorBotMessages.length) return "";
    const meaningfulMessages = block.assessorBotMessages
      .map((message) => removeLearnerDirections(message.messageText))
      .filter(Boolean)
      .filter(isRealFollowUpRequest)
      .filter((message) => normalizeQuestionTextForMatch(message) !== normalizeQuestionTextForMatch(block.transcriptQuestionText));
    if (!meaningfulMessages.length) return "";
    const firstRequest = meaningfulMessages[0];
    const laterAttempt = Array.isArray(block.attempts)
      ? block.attempts.find((attempt) => Number(attempt.attemptNumber) > Number(block.assessorBotMessages[0]?.followsAttemptNumber || 0))
      : null;
    const laterText = laterAttempt?.responseText
      ? " A later student attempt was recorded and should be reviewed against that request."
      : " No later student attempt was located after this follow-up request.";
    return `The AI requested further information: ${firstRequest}${laterText}`;
  };

  const sourceStatusSuggestsGap = (block) => block?.normalisedOverallAssessment === SOURCE_ADDITIONAL_EVIDENCE;
  const sourceStatusSuggestsLikely = (block) => block?.normalisedOverallAssessment === SOURCE_LIKELY_SUFFICIENT;

  const finalNarrativeSuggestsGap = (block) => {
    const narrative = normalizeWhitespace([
      block?.assessorSummary || "",
      ...(Array.isArray(block?.assessorBotMessages) ? block.assessorBotMessages.map((message) => message.messageText) : []),
    ].join(" ")).toLowerCase();
    if (!narrative) return false;
    return [
      "additional evidence",
      "more detail",
      "further detail",
      "not yet",
      "does not",
      "did not",
      "has not",
      "please provide",
      "please add",
      "missing",
      "cannot confirm",
    ].some((signal) => narrative.includes(signal));
  };

  const inferFallbackShortStatus = (item) => {
    const block = item.parsedQuestionBlock;
    const hasCandidateEvidence = Boolean(block && Array.isArray(block.attempts) && block.attempts.some((attempt) => cleanMetadataValue(attempt.responseText)));
    if (!hasCandidateEvidence) return SHORT_NOT_AVAILABLE;
    if (finalNarrativeSuggestsGap(block)) return SHORT_ADDITIONAL_EVIDENCE;
    if (sourceStatusSuggestsLikely(block)) return SHORT_LIKELY_SUFFICIENT;
    if (sourceStatusSuggestsGap(block)) return SHORT_ADDITIONAL_EVIDENCE;
    return SHORT_ADDITIONAL_EVIDENCE;
  };

  const buildFallbackObservation = (item, shortStatus) => {
    const questionNumber = item.questionNumber;
    const block = item.parsedQuestionBlock;
    const objective = cleanMetadataValue(item.officialQuestionSpec?.objective || block?.transcriptObjective);
    const summary = rewriteAssessorSummaryForReport(block?.assessorSummary || "");
    if (summary) return summary;
    if (shortStatus === SHORT_QUESTION_NOT_ASKED) {
      return `Question ${questionNumber} was not asked in the transcript. Assessor review is required before any competency judgement can be made.`;
    }
    if (shortStatus === SHORT_NOT_AVAILABLE) {
      return `No student response for Question ${questionNumber} was located in the transcript. Assessor review is required before any competency judgement can be made.`;
    }
    const evidence = summariseCandidateEvidence(block);
    if (shortStatus === SHORT_LIKELY_SUFFICIENT) {
      return objective
        ? `The student provided evidence relevant to the objective: ${objective}. The assessor should verify sufficiency against the active question requirements.`
        : "The student provided evidence that appears relevant to the question. The assessor should verify sufficiency against the active question requirements.";
    }
    if (evidence) {
      return objective
        ? `The student provided some evidence, but the response should be checked against the objective: ${objective}. Available evidence begins: ${evidence}`
        : `The student provided some evidence, but assessor review is needed to confirm whether it addresses all question requirements. Available evidence begins: ${evidence}`;
    }
    return `The student response for Question ${questionNumber} was not located. Assessor review is required before any preliminary finding can be confirmed.`;
  };

  const buildAiInterviewSummaryForReport = (item, analysisObservation, shortStatus) => {
    const block = item.parsedQuestionBlock;
    const transcriptSummary = rewriteAssessorSummaryForReport(block?.aiInterviewSummary || block?.assessorSummary || "");
    if (transcriptSummary) return transcriptSummary;
    if (!isGenericAnalysisText(analysisObservation)) {
      const rewrittenObservation = rewriteAssessorSummaryForReport(analysisObservation);
      if (rewrittenObservation) return rewrittenObservation;
    }
    return buildFallbackObservation(item, shortStatus);
  };

  const buildDefaultAssessorAction = (item, shortStatus) => {
    if (shortStatus === SHORT_QUESTION_NOT_ASKED) {
      return "Confirm whether this question should have been asked or whether it was intentionally skipped before making a final determination.";
    }
    if (shortStatus === SHORT_NOT_AVAILABLE) {
      return "Locate the missing transcript evidence or seek a student response for this question before making a final determination.";
    }
    if (shortStatus === SHORT_ADDITIONAL_EVIDENCE) {
      return "Review this question against the Rules of Evidence (valid, sufficient, authentic, current) and seek additional evidence about the relevant question requirements if required before making a final determination.";
    }
    return "";
  };

  const buildAiInterviewResponses = (item, analysisFollowUp, shortStatus) => {
    if (shortStatus !== SHORT_ADDITIONAL_EVIDENCE) return [];
    const block = item.parsedQuestionBlock;
    const attempts = Array.isArray(block?.attempts) ? block.attempts : [];
    const lastAttemptNumber = attempts.length ? attempts[attempts.length - 1].attemptNumber : undefined;
    const messages = Array.isArray(block?.assessorBotMessages)
      ? block.assessorBotMessages
        .filter((message) => Number.isFinite(Number(message.followsAttemptNumber)))
        .filter((message) => isRealFollowUpRequest(message.messageText))
        .filter((message) => normalizeQuestionTextForMatch(message.messageText) !== normalizeQuestionTextForMatch(block.transcriptQuestionText))
        .map((message) => ({
          messageText: message.messageText,
          followsAttemptNumber: Number(message.followsAttemptNumber),
        }))
      : [];
    if (messages.length) return messages;
    if (isRealFollowUpRequest(analysisFollowUp)) {
      return [{
        messageText: analysisFollowUp,
        followsAttemptNumber: Number(lastAttemptNumber) || 1,
      }];
    }
    return [];
  };

  const mapAnalysisByQuestion = (analyses) => {
    const map = new Map();
    (Array.isArray(analyses) ? analyses : []).forEach((analysis, index) => {
      const key = normalizeQuestionNumberForKey(analysis?.questionNumber);
      if (key && !map.has(key)) map.set(key, analysis);
      if (!key) map.set(`index:${index}`, analysis);
    });
    return map;
  };

  const createQuestionReview = (item, analysis, index) => {
    const spec = item.officialQuestionSpec || {};
    const block = item.parsedQuestionBlock || null;
    const hasBlock = Boolean(block);
    const attempts = block && Array.isArray(block.attempts) ? block.attempts : [];
    const transcriptStatus = shortStatusFromAnyValue(block?.normalisedOverallAssessment || block?.rawOverallAssessment || "");
    const analysisStatus = shortStatusFromAnyValue(analysis?.shortStatus || analysis?.preliminaryStatus || "");
    const shortStatus = hasBlock
      ? (transcriptStatus || analysisStatus || SHORT_NOT_AVAILABLE)
      : (analysisStatus || SHORT_QUESTION_NOT_ASKED);

    const section = getDisplaySection({ ...spec, section: spec.section || analysis?.section || item.section });
    const questionNumber = item.questionNumber !== undefined && item.questionNumber !== null && item.questionNumber !== ""
      ? item.questionNumber
      : index + 1;
    const questionAsked = cleanMetadataValue(spec.questionText || analysis?.questionAsked || block?.transcriptQuestionText) || MISSING_VALUE;
    const hintsProvided = cleanMetadataValue(spec.hints || spec.hint || block?.transcriptHint || analysis?.hintsProvided) || ACTIVE_DATA_MISSING;
    const assessmentObjective = cleanMetadataValue(spec.objective || block?.transcriptObjective || analysis?.assessmentObjective) || ACTIVE_DATA_MISSING;
    const analysisFollowUp = cleanMetadataValue(analysis?.aiFollowUpExchange);
    const aiFollowUpExchange = isRealFollowUpRequest(analysisFollowUp) ? analysisFollowUp : buildFallbackFollowUpExchange(item);
    const aiInterviewResponses = buildAiInterviewResponses(item, aiFollowUpExchange, shortStatus);
    const analysisObservation = cleanMetadataValue(analysis?.aiPreliminaryObservation);
    const aiInterviewSummary = buildAiInterviewSummaryForReport(item, analysisObservation, shortStatus);
    const actionText = sanitiseAssessorFacingText(analysis?.assessorActionSuggested);
    const assessorActionSuggested = shortStatus === SHORT_LIKELY_SUFFICIENT
      ? ""
      : cleanMetadataValue(actionText) || buildDefaultAssessorAction(item, shortStatus);

    return {
      questionNumber,
      canonicalKey: item.canonicalKey || normalizeQuestionTextForMatch(questionAsked) || `question:${questionNumber}`,
      displayOrder: item.displayOrder || index + 1,
      section,
      unitCode: cleanMetadataValue(spec.unitCode || analysis?.unitCode),
      unitTitle: cleanMetadataValue(spec.unitTitle || analysis?.unitTitle),
      questionAsked,
      hintsProvided,
      assessmentObjective,
      preliminaryStatus: fullStatusFromShortStatus(shortStatus),
      shortStatus,
      attempts,
      assessorBotMessages: Array.isArray(block?.assessorBotMessages) ? block.assessorBotMessages : [],
      aiFollowUpExchange,
      aiInterviewResponses,
      aiInterviewSummary,
      aiPreliminaryObservation: aiInterviewSummary,
      assessorActionSuggested,
    };
  };

  const buildWarnings = ({ manifest, officialQuestionBank, parsedQuestionBlocks, includeTranscriptWarnings }) => {
    if (includeTranscriptWarnings === false) return [];
    const warnings = [];
    const questionBankCount = Array.isArray(officialQuestionBank) ? officialQuestionBank.length : 0;
    const transcriptQuestionCount = Array.isArray(parsedQuestionBlocks) ? parsedQuestionBlocks.length : 0;
    if (questionBankCount && questionBankCount !== transcriptQuestionCount) {
      warnings.push(`Transcript coverage warning: the active question bank contains ${questionBankCount} question(s), while the transcript contains ${transcriptQuestionCount} detected question block(s).`);
    }
    if (!questionBankCount && transcriptQuestionCount && !isQuestionNumberContiguous(parsedQuestionBlocks)) {
      warnings.push("Transcript coverage warning: detected question numbering is non-contiguous and no official question bank was supplied to confirm whether this is expected.");
    }
    const unmappedCount = manifest.filter((item) => item.isUnmappedTranscriptQuestion).length;
    if (unmappedCount) {
      warnings.push(`${unmappedCount} transcript question(s) could not be matched to the active question bank and were included after the official question list.`);
    }
    const missingCount = manifest.filter((item) => item.source === "questionBankOnly").length;
    if (missingCount) {
      warnings.push(`${missingCount} question bank question(s) did not have a matching transcript block.`);
    }
    return warnings;
  };

  const buildExecutiveSummaryItems = (questions) => {
    const questionList = Array.isArray(questions) ? questions : [];
    const sections = Array.from(new Set(questionList.map((question) => cleanMetadataValue(question.section)).filter(Boolean)));
    const gaps = questionList.filter((question) => question.shortStatus === SHORT_ADDITIONAL_EVIDENCE);
    const missing = questionList.filter((question) => isMissingTranscriptStatus(question.shortStatus));
    const sectionText = sections.length
      ? ` across ${sections.join(", ")}`
      : "";
    const sentences = [`The preliminary review considered ${questionList.length} question(s)${sectionText}.`];

    if (gaps.length) {
      const gapText = gaps
        .slice(0, 8)
        .map((question) => `Question ${question.questionNumber}`)
        .join(", ");
      const themes = Array.from(new Set(gaps.map((question) => {
        const text = normalizeWhitespace(question.assessorActionSuggested || question.aiInterviewSummary || question.aiPreliminaryObservation || question.assessmentObjective);
        return text ? truncateForTable(text, 80) : "missing or incomplete evidence";
      }))).slice(0, 3);
      sentences.push(`Additional evidence may be needed for ${gapText}${gaps.length > 8 ? ` and ${gaps.length - 8} other question(s)` : ""}${themes.length ? `, primarily because ${themes.join("; ").toLowerCase()}` : ""}.`);
    }
    if (missing.length) {
      sentences.push(`No transcript evidence was available for ${missing.map((question) => `Question ${question.questionNumber}`).join(", ")}.`);
    }
    if (!gaps.length && !missing.length) {
      sentences.push("All included questions were identified as likely sufficient, pending verification by a qualified assessor.");
    }
    sentences.push(SUMMARY_FINAL_SENTENCE);
    return sentences;
  };

  const buildExecutiveSummary = (questions) => buildExecutiveSummaryItems(questions).join(" ");

  const splitExecutiveSummary = (summary) => {
    const text = normalizeWhitespace(summary);
    if (!text) return [SUMMARY_FINAL_SENTENCE];
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean);
  };

  const buildReportModel = ({
    fullTranscript,
    candidateMetadata,
    officialQuestionBank,
    reportOptions,
    questionAnalyses,
  } = {}) => {
    const parsedMetadata = parseTranscriptMetadata(fullTranscript || "");
    const suppliedMetadata = candidateMetadata || {};
    const parsedQuestionBlocks = parseTranscriptQuestions(fullTranscript || "");
    const questionBank = Array.isArray(officialQuestionBank) ? officialQuestionBank : [];
    const manifest = buildQuestionManifest(questionBank, parsedQuestionBlocks);
    const analysisByQuestion = mapAnalysisByQuestion(questionAnalyses || []);
    const questions = manifest.map((item, index) => {
      const key = normalizeQuestionNumberForKey(item.questionNumber);
      const analysis = analysisByQuestion.get(key) || analysisByQuestion.get(`index:${index}`) || null;
      return createQuestionReview(item, analysis, index);
    });

    const metadata = {
      candidateName: cleanMetadataValue(suppliedMetadata.candidateName || suppliedMetadata.fullName || parsedMetadata.candidateName) || MISSING_VALUE,
      contactId: cleanMetadataValue(suppliedMetadata.contactId || parsedMetadata.contactId) || MISSING_VALUE,
      qualification: normalizeQualificationValue(suppliedMetadata.qualification || reportOptions?.qualificationDefault) || DEFAULT_QUALIFICATION,
      interviewDate: cleanMetadataValue(suppliedMetadata.interviewDate || parsedMetadata.interviewDate || parsedMetadata.initialStartDate) || MISSING_VALUE,
      industry: cleanMetadataValue(suppliedMetadata.industry || parsedMetadata.industry) || MISSING_VALUE,
      jobTitle: cleanMetadataValue(suppliedMetadata.jobTitle || parsedMetadata.jobTitle) || MISSING_VALUE,
      assessmentName: cleanMetadataValue(suppliedMetadata.assessmentName || parsedMetadata.assessmentName),
      questionCountReviewed: questions.length,
      transcriptQuestionCount: parsedQuestionBlocks.length,
      questionBankCount: questionBank.length || undefined,
      reportType: REPORT_TYPE,
    };

    const warnings = buildWarnings({
      manifest,
      officialQuestionBank: questionBank,
      parsedQuestionBlocks,
      includeTranscriptWarnings: reportOptions?.includeTranscriptWarnings,
    });

    return {
      metadata,
      warnings,
      executiveSummary: buildExecutiveSummary(questions),
      executiveSummaryItems: buildExecutiveSummaryItems(questions),
      questions,
      parsedQuestionBlocks,
      questionManifest: manifest,
    };
  };

  const truncateForTable = (value, maxLength = 160) => {
    const text = normalizeWhitespace(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
  };

  const renderMetadataRows = (metadata, studentPhoto = "") => {
    const studentIdentity = `<div class="student-identity"><span class="student-name">${escapeHtml(valueOrMissing(metadata.candidateName))}</span>${studentPhoto ? `<img class="student-photo student-photo-inline" src="${escapeAttribute(studentPhoto)}" alt="Student photo for ${escapeAttribute(metadata.candidateName || "student")}">` : ""}</div>`;
    const rows = [
      ["Student", studentIdentity, true],
      ["Contact ID", metadata.contactId],
      ["Qualification", metadata.qualification],
      ["Interview date", metadata.interviewDate],
      ["Industry", metadata.industry],
      ["Job title", metadata.jobTitle],
      ["Report type", metadata.reportType],
      ["Questions reviewed", metadata.questionCountReviewed],
    ].filter(Boolean);
    return rows
      .map(([label, value, isHtml]) => `<tr><th scope="row">${escapeHtml(label)}</th><td${isHtml ? ' class="student-photo-cell"' : ""}>${isHtml ? value : escapeHtml(valueOrMissing(value))}</td></tr>`)
      .join("\n");
  };

  const renderStatusTableRows = (questions) => questions.map((question) => `
              <tr data-status-question-number="${escapeAttribute(question.questionNumber)}">
                <td>${escapeHtml(question.questionNumber)}</td>
                <td>${escapeHtml(valueOrMissing(question.section))}</td>
                <td>${escapeHtml(truncateForTable(question.questionAsked))}</td>
                <td><span class="status-badge ${statusClassName(question.shortStatus)}">${escapeHtml(question.shortStatus)}</span></td>
                <td id="status-assessor-eval-${escapeAttribute(question.questionNumber)}"><span class="status-badge status-missing">Not Reviewed</span></td>
              </tr>`).join("");

  const buildConversationTranscriptText = (question) => {
    const turns = [];
    const questionAsked = cleanMetadataValue(question.questionAsked);
    const attempts = Array.isArray(question.attempts) ? question.attempts : [];
    const messages = Array.isArray(question.assessorBotMessages) ? question.assessorBotMessages : [];
    const usedMessageIndexes = new Set();

    if (questionAsked) {
      turns.push(`AI Interviewer: ${questionAsked}`);
    }

    messages.forEach((message, messageIndex) => {
      const followsAttempt = Number(message.followsAttemptNumber);
      if (Number.isFinite(followsAttempt) && followsAttempt > 0) return;
      const text = cleanMetadataValue(message.messageText);
      if (!text) return;
      if (questionAsked && normalizeQuestionTextForMatch(text) === normalizeQuestionTextForMatch(questionAsked)) {
        usedMessageIndexes.add(messageIndex);
        return;
      }
      turns.push(`AI Interviewer: ${text}`);
      usedMessageIndexes.add(messageIndex);
    });

    attempts.forEach((attempt, index) => {
      const attemptNumber = Number.isFinite(Number(attempt.attemptNumber)) ? Number(attempt.attemptNumber) : index + 1;
      const speaker = cleanMetadataValue(attempt.speakerLabel) || "Student";
      const responseText = cleanMetadataValue(attempt.responseText);
      const submittedAt = cleanMetadataValue(attempt.submittedAt);

      if (responseText) {
        turns.push(`${speaker} (Attempt ${attemptNumber}): ${responseText}`);
      } else {
        turns.push(`${speaker} (Attempt ${attemptNumber}):`);
      }
      if (submittedAt) {
        turns.push(`Submitted: ${submittedAt}`);
      }

      messages.forEach((message, messageIndex) => {
        if (usedMessageIndexes.has(messageIndex)) return;
        if (Number(message.followsAttemptNumber) !== attemptNumber) return;
        const text = cleanMetadataValue(message.messageText);
        if (!text) return;
        turns.push(`AI Interviewer: ${text}`);
        usedMessageIndexes.add(messageIndex);
      });
    });

    messages.forEach((message, messageIndex) => {
      if (usedMessageIndexes.has(messageIndex)) return;
      const text = cleanMetadataValue(message.messageText);
      if (!text) return;
      turns.push(`AI Interviewer: ${text}`);
      usedMessageIndexes.add(messageIndex);
    });

    return turns.join("\n\n");
  };

  const renderConversation = (question) => {
    const transcriptText = buildConversationTranscriptText(question);
    if (!transcriptText) {
      return "<p>No Student/AI Interview conversation located in transcript.</p>";
    }
    return renderResponseBox(transcriptText);
  };

  const renderExecutiveSummary = (reportModel) => {
    const items = Array.isArray(reportModel?.executiveSummaryItems) && reportModel.executiveSummaryItems.length
      ? reportModel.executiveSummaryItems
      : splitExecutiveSummary(reportModel?.executiveSummary || SUMMARY_FINAL_SENTENCE);
    return `<ul class="summary-list">
          ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n          ")}
        </ul>`;
  };

  const renderStaticFieldValue = (value = "", className = "") => {
    const extraClass = className ? ` ${escapeAttribute(className)}` : "";
    const text = String(value || "").trim();
    return `<div class="field-value${extraClass}">${text ? escapeHtml(text) : "&nbsp;"}</div>`;
  };

  const renderResponseBox = (value = "", className = "") => {
    const extraClass = className ? ` ${escapeAttribute(className)}` : "";
    return `<div class="response-box${extraClass}">${escapeHtml(value || "")}</div>`;
  };

  const renderAssessorStaticSection = (question) => `
            <section class="assessor-evaluation">
              <h4>Assessor Evaluation - Status</h4>
              ${renderResponseBox("", "assessor-evaluation-box")}
              <h4>Assessor Comments</h4>
              ${renderResponseBox("", "assessor-notes")}
            </section>`;

  const renderQuestionArticles = (questions) => questions.map((question) => {
    return `
          <!-- BEGIN QUESTION_REVIEW q="${escapeAttribute(question.questionNumber)}" -->
          <article class="question-card" data-question-number="${escapeAttribute(question.questionNumber)}">
            <h3>Question ${escapeHtml(question.questionNumber)} - ${escapeHtml(valueOrMissing(question.section))}</h3>
            <p><span class="status-badge ${statusClassName(question.shortStatus)}">${escapeHtml(question.preliminaryStatus)}</span></p>
            <section>
              <h4>Question asked</h4>
              <p>${escapeHtml(valueOrMissing(question.questionAsked))}</p>
            </section>
            <section>
              <h4>Hints provided to student</h4>
              <p>${escapeHtml(valueOrMissing(question.hintsProvided))}</p>
            </section>
            <section>
              <h4>Objective</h4>
              <p>${escapeHtml(valueOrMissing(question.assessmentObjective))}</p>
            </section>
            <section>
              <h4>AI Interview Summary</h4>
              <p>${escapeHtml(valueOrMissing(question.aiInterviewSummary))}</p>
            </section>
            <section>
              <h4>Student and AI Interview conversation</h4>
              ${renderConversation(question)}
            </section>
            ${renderAssessorStaticSection(question)}
          </article>
          <!-- END QUESTION_REVIEW q="${escapeAttribute(question.questionNumber)}" -->`;
  }).join("\n");

  const renderReportHtml = (reportModel) => {
    const questions = Array.isArray(reportModel?.questions) ? reportModel.questions : [];
    const metadata = reportModel?.metadata || {};
    const hasFollowUp = questions.some((question) => question.shortStatus !== SHORT_LIKELY_SUFFICIENT);
    const executiveHeading = hasFollowUp
      ? "Executive Summary - Preliminary Findings (assessor follow-up suggested)"
      : "Executive Summary - Preliminary Findings";

    return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>RPL Preliminary Interview Review</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; background: #ffffff; color: #000000; font-family: Calibri, Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.35; }
      @page { size: A4; margin: 12mm; }
      .report { width: 100%; max-width: 186mm; margin: 0 auto; box-sizing: border-box; }
      h1, h2, h3, h4 { color: #0f172a; line-height: 1.25; }
      h1 { margin: 0; font-size: 30px; }
      h2 { margin-top: 32px; border-bottom: 2px solid #d8dee9; padding-bottom: 8px; font-size: 20px; }
      h3 { margin-top: 0; font-size: 18px; }
      h4 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .02em; color: #334155; }
      .subtitle, .muted { color: #64748b; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { word-wrap: break-word; overflow-wrap: break-word; word-break: normal; vertical-align: top; }
      .metadata-table, .status-table, .signoff-table { background: #fff; }
      .metadata-table th, .metadata-table td, .status-table th, .status-table td, .signoff-table th, .signoff-table td { border: 1px solid #cbd5e1; padding: 10px 12px; vertical-align: top; text-align: left; }
      .metadata-table th { width: 30%; background: #eef2f7; }
      .student-identity { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
      .student-name { display: block; flex: 1 1 auto; min-height: 24px; padding-top: 2px; }
      .student-photo-cell { background: #f8fafc; }
      .student-photo { display: block; max-width: 140px; max-height: 160px; width: auto; height: auto; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; object-fit: contain; }
      .student-photo-inline { flex: 0 0 auto; margin-left: 12px; }
      .status-table { font-size: 9pt; line-height: 1.25; }
      .status-table th { background: #e8eef6; }
      .warning-box, .coverage-warning, .summary, .question-card, .limitations, .confirmation, .signoff { background: #fff; border: 1px solid #d8dee9; border-radius: 8px; padding: 18px; margin-top: 18px; }
      .warning-box { border-left: 6px solid #9a3412; background: #fff7ed; }
      .coverage-warning { border-left: 6px solid #b45309; background: #fffbeb; }
      .disclaimer-list, .summary-list { margin: 10px 0 0 20px; padding: 0; }
      .disclaimer-list li, .summary-list li { margin: 6px 0; }
      .status-badge { display: inline-block; max-width: 100%; border-radius: 999px; padding: 3px 8px; font-size: 8.5pt; line-height: 1.2; font-weight: 700; white-space: normal; overflow-wrap: anywhere; box-sizing: border-box; }
      .status-likely { background: #dcfce7; color: #166534; }
      .status-gap { background: #fef3c7; color: #92400e; }
      .status-missing { background: #fee2e2; color: #991b1b; }
      .summary, .question-review-section, .limitations { break-before: page; page-break-before: always; }
      .question-card { page-break-inside: avoid; break-inside: avoid; }
      .question-card section { margin-top: 12px; }
      .candidate-attempt { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin: 10px 0; background: #f8fafc; }
      .ai-interview-response { border: 1px solid #c7d2fe; border-left: 4px solid #4338ca; border-radius: 6px; padding: 12px; margin: 10px 0 14px; background: #eef2ff; }
      .verbatim, .response-box { white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; margin: 0; padding: 8px; border: 1px solid #999; border-radius: 4px; background: #fff; font-family: Calibri, Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.35; box-sizing: border-box; }
      .response-box { min-height: 80px; }
      .assessor-evaluation-box { min-height: 42px; }
      .assessor-evaluation { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #fff; }
      .field-value { min-height: 30px; border: 1px solid #999; border-radius: 4px; padding: 7px 9px; box-sizing: border-box; background: #fff; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; }
      .checkbox-static { display: inline-block; min-width: 1.2em; font-family: "Segoe UI Symbol", Arial, Helvetica, sans-serif; }
      @media print {
        body { background: #fff; }
        .report { width: 100%; max-width: 186mm; }
        .question-card, .summary, .warning-box, .coverage-warning, .limitations, .confirmation, .signoff { border-color: #999; }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <header>
        <h1>RPL Preliminary Interview Review</h1>
        <p class="subtitle">AI-generated preliminary review for assessor validation.</p>
      </header>

      <section aria-labelledby="candidateMetadataTitle">
        <h2 id="candidateMetadataTitle">Student Details</h2>
        <table class="metadata-table">
          <tbody>
            ${renderMetadataRows(metadata)}
          </tbody>
        </table>
      </section>

      <section class="warning-box" aria-labelledby="preliminaryDisclaimerTitle">
        <h2 id="preliminaryDisclaimerTitle">IMPORTANT — PRELIMINARY AI REVIEW ONLY</h2>
        <p>${escapeHtml(DISCLAIMER_INTRO)}</p>
        <ul class="disclaimer-list">
          ${DISCLAIMER_BULLETS.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n          ")}
        </ul>
      </section>

      <section class="summary" aria-labelledby="executiveSummaryTitle">
        <h2 id="executiveSummaryTitle">${escapeHtml(executiveHeading)}</h2>
        ${renderExecutiveSummary(reportModel)}
      </section>

      <section class="status-summary-section" aria-labelledby="statusTableTitle">
        <h2 id="statusTableTitle">Status by Question</h2>
        <table class="status-table">
          <colgroup>
            <col style="width: 10mm;">
            <col style="width: 28mm;">
            <col>
            <col style="width: 38mm;">
            <col style="width: 34mm;">
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Q#</th>
              <th scope="col">Section</th>
              <th scope="col">Question (short)</th>
              <th scope="col">Preliminary status</th>
              <th scope="col">Assessor Evaluation</th>
            </tr>
          </thead>
          <tbody>${renderStatusTableRows(questions)}
          </tbody>
        </table>
      </section>

      <section class="question-review-section" aria-labelledby="questionReviewTitle">
        <h2 id="questionReviewTitle">Question-by-Question Review</h2>
        ${renderQuestionArticles(questions)}
      </section>

      <section class="limitations" aria-labelledby="limitationsTitle">
        <h2 id="limitationsTitle">Limitations of this AI preliminary review</h2>
        <p>${escapeHtml(LIMITATIONS_TEXT)}</p>
      </section>

      <section class="confirmation" aria-labelledby="confirmationTitle">
        <h2 id="confirmationTitle">Assessor confirmation required</h2>
        <p>${escapeHtml(ASSESSOR_CONFIRMATION_TEXT)}</p>
      </section>

      <section class="signoff" aria-labelledby="signoffTitle">
        <h2 id="signoffTitle">Assessor sign-off</h2>
        <table class="signoff-table">
          <tbody>
            <tr><th scope="row">Assessor name</th><td>${renderStaticFieldValue()}</td></tr>
            <tr><th scope="row">Assessor credential / TAE qualification</th><td>${renderStaticFieldValue()}</td></tr>
            <tr><th scope="row">Interview Outcome</th><td>${renderStaticFieldValue("to be completed by assessor")}</td></tr>
            <tr><th scope="row">Signature &amp; date</th><td>${renderStaticFieldValue()}</td></tr>
          </tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
  };

  const validateReportHtmlCoverage = (reportModel, html) => {
    const questionCount = Array.isArray(reportModel?.questions) ? reportModel.questions.length : 0;
    const statusRows = (String(html || "").match(/<tr\s+data-status-question-number=/g) || []).length;
    const articleCount = (String(html || "").match(/<article\s+class="question-card"\s+data-question-number=/g) || []).length;
    const doctypeCount = (String(html || "").match(/<!doctype html>/gi) || []).length;
    const htmlOpenCount = (String(html || "").match(/<html\b/gi) || []).length;
    return {
      valid: statusRows === questionCount && articleCount === questionCount && doctypeCount === 1 && htmlOpenCount === 1,
      questionCount,
      statusRows,
      articleCount,
      doctypeCount,
      htmlOpenCount,
    };
  };

  const buildReportModelFromJsonTranscript = (jsonTranscript, questionBank = []) => {
    const parsed = typeof jsonTranscript === "string" ? JSON.parse(jsonTranscript) : jsonTranscript;
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON transcript");
    const candidate = parsed.candidate || {};
    const transcriptQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const bankQuestions = Array.isArray(questionBank) ? questionBank : [];
    const transcriptByNumber = new Map();
    const transcriptByText = new Map();
    transcriptQuestions.forEach((question, index) => {
      const numberKey = normalizeQuestionNumberForKey(question?.questionNumber);
      if (numberKey && !transcriptByNumber.has(numberKey)) transcriptByNumber.set(numberKey, { question, index });
      const textKey = normalizeQuestionTextForMatch(question?.questionText || question?.transcriptQuestionText || "");
      if (textKey && !transcriptByText.has(textKey)) transcriptByText.set(textKey, { question, index });
    });
    const usedTranscriptIndexes = new Set();

    const resolveTranscriptQuestion = (bankEntry, index) => {
      const questionNumber = bankEntry?.questionNumber !== undefined && bankEntry?.questionNumber !== null && bankEntry?.questionNumber !== ""
        ? bankEntry.questionNumber
        : index + 1;
      const numberKey = normalizeQuestionNumberForKey(questionNumber);
      const bankTextKey = normalizeQuestionTextForMatch(bankEntry?.questionText || "");
      let matched = numberKey ? transcriptByNumber.get(numberKey) || null : null;
      if (!matched && bankTextKey) {
        const byText = transcriptByText.get(bankTextKey) || null;
        if (byText && !usedTranscriptIndexes.has(byText.index)) matched = byText;
      }
      if (!matched && transcriptQuestions.length === bankQuestions.length) {
        const candidateQuestion = transcriptQuestions[index];
        if (candidateQuestion && !usedTranscriptIndexes.has(index)) matched = { question: candidateQuestion, index };
      }
      if (matched) usedTranscriptIndexes.add(matched.index);
      return { questionNumber, transcriptQuestion: matched ? matched.question : null };
    };

    const reportQuestions = bankQuestions.map((bankEntry, index) => {
      const { questionNumber, transcriptQuestion } = resolveTranscriptQuestion(bankEntry, index);
      const hasTranscript = Boolean(transcriptQuestion);
      const attempts = Array.isArray(transcriptQuestion?.attempts) ? transcriptQuestion.attempts : [];
      const shortStatusSource = cleanMetadataValue(transcriptQuestion?.preliminaryStatus || transcriptQuestion?.overallAssessment || transcriptQuestion?.rawOverallAssessment || "");
      const shortStatus = hasTranscript
        ? (shortStatusFromAnyValue(shortStatusSource) || SHORT_NOT_AVAILABLE)
        : SHORT_QUESTION_NOT_ASKED;
      const section = cleanMetadataValue(bankEntry?.section || transcriptQuestion?.section) || MISSING_VALUE;
      const unitCode = cleanMetadataValue(bankEntry?.unitCode || transcriptQuestion?.unitCode) || "";
      const unitTitle = cleanMetadataValue(bankEntry?.unitTitle || transcriptQuestion?.unitTitle) || "";
      const questionAsked = cleanMetadataValue(bankEntry?.questionText || transcriptQuestion?.questionText || transcriptQuestion?.transcriptQuestionText) || MISSING_VALUE;
      const hintsProvided = cleanMetadataValue(bankEntry?.hints || transcriptQuestion?.hint || transcriptQuestion?.transcriptHint) || ACTIVE_DATA_MISSING;
      const assessmentObjective = cleanMetadataValue(bankEntry?.objective || transcriptQuestion?.objective || transcriptQuestion?.transcriptObjective) || ACTIVE_DATA_MISSING;
      const aiInterviewSummary = cleanMetadataValue(transcriptQuestion?.aiInterviewerSummary || transcriptQuestion?.summary || transcriptQuestion?.assessorSummary) || "";
      const assessorBotMessages = Array.isArray(transcriptQuestion?.assessorBotMessages) ? transcriptQuestion.assessorBotMessages : attempts
        .filter((attempt) => cleanMetadataValue(attempt.feedback))
        .map((attempt) => ({
          messageText: cleanMetadataValue(attempt.feedback),
          followsAttemptNumber: Number(attempt.attemptNumber) || 0,
        }));

      return {
        questionNumber,
        section,
        unitCode,
        unitTitle,
        questionAsked,
        hintsProvided,
        assessmentObjective,
        preliminaryStatus: hasTranscript ? fullStatusFromShortStatus(shortStatus) : FULL_QUESTION_NOT_ASKED,
        shortStatus,
        aiInterviewSummary,
        aiFollowUpExchange: hasTranscript ? "" : `Question ${questionNumber} was not asked in the transcript.`,
        aiPreliminaryObservation: hasTranscript
          ? aiInterviewSummary
          : buildFallbackObservation({ questionNumber, officialQuestionSpec: bankEntry, parsedQuestionBlock: null }, shortStatus),
        assessorActionSuggested: hasTranscript
          ? ""
          : buildDefaultAssessorAction({ questionNumber, officialQuestionSpec: bankEntry, parsedQuestionBlock: null }, shortStatus),
        attempts: attempts.map((attempt, attemptIndex) => ({
          attemptNumber: Number.isFinite(Number(attempt.attemptNumber)) ? Number(attempt.attemptNumber) : attemptIndex + 1,
          speakerLabel: cleanMetadataValue(attempt.speakerLabel || attempt.candidateName) || "Student",
          responseText: cleanMetadataValue(attempt.responseText || attempt.answer) || "",
          submittedAt: cleanMetadataValue(attempt.submittedAt) || "",
        })),
        assessorBotMessages,
        rawBlockText: cleanMetadataValue(transcriptQuestion?.rawBlockText) || "",
      };
    });

    transcriptQuestions.forEach((question, index) => {
      if (usedTranscriptIndexes.has(index)) return;
      const questionText = cleanMetadataValue(question?.questionText || question?.transcriptQuestionText);
      const duplicateOfficial = reportQuestions.some((item) => normalizeQuestionTextForMatch(item.questionAsked || "") === normalizeQuestionTextForMatch(questionText));
      if (duplicateOfficial) return;
      const questionNumber = question?.questionNumber !== undefined && question?.questionNumber !== null && question?.questionNumber !== ""
        ? question.questionNumber
        : bankQuestions.length + index + 1;
      const attempts = Array.isArray(question?.attempts) ? question.attempts : [];
      const shortStatus = shortStatusFromAnyValue(question?.preliminaryStatus || question?.overallAssessment || question?.rawOverallAssessment || "") || SHORT_NOT_AVAILABLE;
      reportQuestions.push({
        questionNumber,
        section: cleanMetadataValue(question?.section) || inferSectionFromQuestion({ questionText, objective: question?.objective || question?.transcriptObjective }) || "Additional transcript question",
        unitCode: cleanMetadataValue(question?.unitCode) || "",
        unitTitle: cleanMetadataValue(question?.unitTitle) || "",
        questionAsked: questionText || MISSING_VALUE,
        hintsProvided: cleanMetadataValue(question?.hint || question?.transcriptHint) || ACTIVE_DATA_MISSING,
        assessmentObjective: cleanMetadataValue(question?.objective || question?.transcriptObjective) || ACTIVE_DATA_MISSING,
        preliminaryStatus: fullStatusFromShortStatus(shortStatus),
        shortStatus,
        aiInterviewSummary: cleanMetadataValue(question?.aiInterviewerSummary || question?.summary || question?.assessorSummary) || "",
        aiFollowUpExchange: "",
        aiPreliminaryObservation: buildFallbackObservation({ questionNumber, officialQuestionSpec: null, parsedQuestionBlock: question }, shortStatus),
        assessorActionSuggested: buildDefaultAssessorAction({ questionNumber, officialQuestionSpec: null, parsedQuestionBlock: question }, shortStatus),
        attempts: attempts.map((attempt, attemptIndex) => ({
          attemptNumber: Number.isFinite(Number(attempt.attemptNumber)) ? Number(attempt.attemptNumber) : attemptIndex + 1,
          speakerLabel: cleanMetadataValue(attempt.candidateName || attempt.speakerLabel) || "Student",
          responseText: cleanMetadataValue(attempt.answer || attempt.responseText) || "",
          submittedAt: cleanMetadataValue(attempt.submittedAt) || "",
        })),
        assessorBotMessages: attempts
          .filter((attempt) => cleanMetadataValue(attempt.feedback))
          .map((attempt) => ({
            messageText: cleanMetadataValue(attempt.feedback),
            followsAttemptNumber: Number(attempt.attemptNumber) || 0,
          })),
        rawBlockText: cleanMetadataValue(question?.rawBlockText) || "",
      });
    });

    const metadata = {
      candidateName: cleanMetadataValue(candidate.fullName) || MISSING_VALUE,
      contactId: cleanMetadataValue(candidate.contactId) || MISSING_VALUE,
      qualification: normalizeQualificationValue(candidate.qualification) || DEFAULT_QUALIFICATION,
      interviewDate: cleanMetadataValue(candidate.interviewDate) || MISSING_VALUE,
      industry: cleanMetadataValue(candidate.industry) || MISSING_VALUE,
      jobTitle: cleanMetadataValue(candidate.jobTitle) || MISSING_VALUE,
      assessmentName: cleanMetadataValue(candidate.assessmentName) || "RPL",
      questionCountReviewed: reportQuestions.length,
      transcriptQuestionCount: transcriptQuestions.length,
      questionBankCount: bankQuestions.length || undefined,
      reportType: REPORT_TYPE,
    };

    return {
      metadata,
      warnings: [],
      executiveSummary: SUMMARY_FINAL_SENTENCE,
      executiveSummaryItems: buildExecutiveSummaryItems(reportQuestions),
      questions: reportQuestions,
      parsedQuestionBlocks: [],
      questionManifest: [],
    };
  };

  const renderInteractiveReportHtml = (reportModel, options = {}) => {
    const submitUrl = options.submitUrl || "";
    const givenNameFromOptions = cleanMetadataValue(options.givenName || "");
    const assessorNameFromOptions = cleanMetadataValue(options.assessorName || "");
    const assessorEmailFromOptions = cleanMetadataValue(options.assessorEmail || "");
    const assessorMode = options.assessorMode === true;
    const notifyParentOnSubmit = options.notifyParentOnSubmit === true;
    const assessorPrefillFromOptions = options.assessorPrefill || null;
    const studentPhoto = cleanMetadataValue(options.studentPhoto || "");
    const questions = Array.isArray(reportModel?.questions) ? reportModel.questions : [];
    const metadata = reportModel?.metadata || {};
    const hasFollowUp = questions.some((question) => question.shortStatus !== SHORT_LIKELY_SUFFICIENT);
    const executiveHeading = hasFollowUp
      ? "Executive Summary - Preliminary Findings (assessor follow-up suggested)"
      : "Executive Summary - Preliminary Findings";

    const renderEditableField = (id, label, placeholder = "", minHeight = "80px") => {
      return `<textarea id="${escapeAttribute(id)}" name="${escapeAttribute(id)}" class="assessor-input" placeholder="${escapeAttribute(placeholder)}" style="width:100%;min-height:${minHeight};border:1px solid #999;border-radius:4px;padding:7px 9px;box-sizing:border-box;font-family:Calibri,Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.35;background:#fff;"></textarea>`;
    };

    const renderEditableSignoff = (id, placeholder = "") => {
      return `<input type="text" id="${escapeAttribute(id)}" name="${escapeAttribute(id)}" class="assessor-signoff-input" placeholder="${escapeAttribute(placeholder)}" style="width:100%;min-height:30px;border:1px solid #999;border-radius:4px;padding:7px 9px;box-sizing:border-box;font-family:Calibri,Arial,Helvetica,sans-serif;font-size:11pt;background:#fff;" />`;
    };

    const renderReadOnlySignoff = (id, value) => {
      return `<input type="text" id="${escapeAttribute(id)}" name="${escapeAttribute(id)}" class="assessor-signoff-input" value="${escapeAttribute(value)}" readonly aria-readonly="true" style="width:100%;min-height:30px;border:1px solid #999;border-radius:4px;padding:7px 9px;box-sizing:border-box;font-family:Calibri,Arial,Helvetica,sans-serif;font-size:11pt;background:#f1f5f9;color:#334155;" />`;
    };

    const renderAssessorEvaluationOptions = (questionNumber) => {
      const name = `assessor-eval-${questionNumber}`;
      return `
      <fieldset class="assessor-eval-options" style="margin:0;padding:0;border:0;display:flex;gap:24px;align-items:center;flex-wrap:wrap;">
        <label style="display:inline-flex;align-items:center;gap:7px;font-weight:700;"><input type="radio" name="${escapeAttribute(name)}" value="SATISFACTORY"> Satisfactory</label>
        <label style="display:inline-flex;align-items:center;gap:7px;font-weight:700;"><input type="radio" name="${escapeAttribute(name)}" value="NOT SATISFACTORY"> Not Satisfactory</label>
      </fieldset>`;
    };

    const renderInterviewOutcome = () => `
      <fieldset class="interview-outcome" style="margin:0;padding:0;border:0;display:flex;gap:24px;align-items:center;flex-wrap:wrap;">
        <label style="display:inline-flex;align-items:center;gap:7px;font-weight:700;"><input type="radio" name="interview-outcome" value="SATISFACTORY"> Satisfactory</label>
        <label style="display:inline-flex;align-items:center;gap:7px;font-weight:700;"><input type="radio" name="interview-outcome" value="NOT SATISFACTORY"> Not Satisfactory</label>
      </fieldset>`;

    const renderSignoffRows = () => assessorMode ? `
            <tr><th scope="row">Assessor name</th><td>${renderReadOnlySignoff("assessor-name", assessorNameFromOptions)}</td></tr>
            <tr><th scope="row">Assessor Email</th><td>${renderReadOnlySignoff("assessor-email", assessorEmailFromOptions)}</td></tr>
            <tr><th scope="row">Interview Outcome</th><td>${renderInterviewOutcome()}</td></tr>
            <tr><th scope="row">Assessor Comments</th><td>${renderEditableField("assessor-comments", "Assessor Comments", "Enter assessor comments", "110px")}</td></tr>
            <tr><th scope="row">Signature - Please type your name</th><td>${renderEditableSignoff("assessor-signature", "Enter signature")}</td></tr>
            <tr><th scope="row">Date</th><td>${renderReadOnlySignoff("assessor-date-time", "")}</td></tr>` : `
            <tr><th scope="row">Assessor name</th><td>${renderEditableSignoff("assessor-name", "Enter assessor name")}</td></tr>
            <tr><th scope="row">Assessor Email</th><td>${renderEditableSignoff("assessor-email", "Enter assessor email")}</td></tr>
            <tr><th scope="row">Interview Outcome</th><td>${renderEditableSignoff("interview-outcome", "to be completed by assessor")}</td></tr>
            <tr><th scope="row">Signature &amp; date</th><td>${renderEditableSignoff("assessor-signature", "Enter signature & date")}</td></tr>`;

    const renderQuestionArticlesInteractive = (questions) => questions.map((question) => {
      return `
          <!-- BEGIN QUESTION_REVIEW q="${escapeAttribute(question.questionNumber)}" -->
          <article class="question-card" data-question-number="${escapeAttribute(question.questionNumber)}">
            <h3>Question ${escapeHtml(question.questionNumber)} - ${escapeHtml(valueOrMissing(question.section))}</h3>
            <p><span class="status-badge ${statusClassName(question.shortStatus)}">${escapeHtml(question.preliminaryStatus)}</span></p>
            <section>
              <h4>Question asked</h4>
              <p>${escapeHtml(valueOrMissing(question.questionAsked))}</p>
            </section>
            <section>
              <h4>Hints provided to student</h4>
              <p>${escapeHtml(valueOrMissing(question.hintsProvided))}</p>
            </section>
            <section>
              <h4>Objective</h4>
              <p>${escapeHtml(valueOrMissing(question.assessmentObjective))}</p>
            </section>
            <section>
              <h4>AI Interview Summary</h4>
              <p>${escapeHtml(valueOrMissing(question.aiInterviewSummary))}</p>
            </section>
            <section>
              <h4>Student and AI Interview conversation</h4>
              ${renderConversation(question)}
            </section>
            <section class="assessor-evaluation">
              <h4>Assessor Evaluation - Status</h4>
              ${renderAssessorEvaluationOptions(question.questionNumber)}
              <h4>Assessor Comments</h4>
              ${renderEditableField(`assessor-notes-${question.questionNumber}`, "Assessor comments", "Enter your comments here...", "80px")}
              <button type="button" class="question-submit-btn" data-question-number="${escapeAttribute(question.questionNumber)}" style="margin-top:10px;background:#0b6ea9;color:#fff;border:none;border-radius:999px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;">Submit</button>
              <span class="submit-status" id="submit-status-${question.questionNumber}" style="margin-left:10px;font-size:12px;color:#64748b;"></span>
            </section>
          </article>
          <!-- END QUESTION_REVIEW q="${escapeAttribute(question.questionNumber)}" -->`;
    }).join("\n");

    return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>RPL Preliminary Interview Review - Assessor</title>
    <style>
      :root { color-scheme: light; }
      @page { size: A4 portrait; margin: 12mm; }
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; background: #f4f6f9; color: #000000; font-family: Calibri, Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.35; }
      .report { width: 100%; max-width: 186mm; margin: 0 auto; padding: 20px; }
      h1, h2, h3, h4 { color: #0f172a; line-height: 1.25; }
      h1 { margin: 0; font-size: 30px; }
      h2 { margin-top: 32px; border-bottom: 2px solid #d8dee9; padding-bottom: 8px; font-size: 20px; }
      h3 { margin-top: 0; font-size: 18px; }
      h4 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .02em; color: #334155; }
      .subtitle, .muted { color: #64748b; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { word-wrap: break-word; overflow-wrap: anywhere; word-break: normal; vertical-align: top; }
      .metadata-table, .status-table, .signoff-table { background: #fff; }
      .metadata-table th, .metadata-table td, .status-table th, .status-table td, .signoff-table th, .signoff-table td { border: 1px solid #cbd5e1; padding: 10px 12px; vertical-align: top; text-align: left; }
      .metadata-table th { width: 30%; background: #eef2f7; }
      .student-identity { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
      .student-name { display: block; flex: 1 1 auto; min-height: 24px; padding-top: 2px; }
      .student-photo-cell { background: #f8fafc; }
      .student-photo { display: block; max-width: 140px; max-height: 160px; width: auto; height: auto; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; object-fit: contain; }
      .student-photo-inline { flex: 0 0 auto; margin-left: 12px; }
      .status-table { font-size: 9pt; line-height: 1.25; }
      .status-table th { background: #e8eef6; }
      .warning-box, .coverage-warning, .summary, .question-card, .limitations, .confirmation, .signoff { background: #fff; border: 1px solid #d8dee9; border-radius: 8px; padding: 18px; margin-top: 18px; }
      .warning-box { border-left: 6px solid #9a3412; background: #fff7ed; }
      .coverage-warning { border-left: 6px solid #b45309; background: #fffbeb; }
      .disclaimer-list, .summary-list { margin: 10px 0 0 20px; padding: 0; }
      .disclaimer-list li, .summary-list li { margin: 6px 0; }
      .status-badge { display: inline-block; max-width: 100%; border-radius: 999px; padding: 3px 8px; font-size: 8.5pt; line-height: 1.2; font-weight: 700; white-space: normal; overflow-wrap: anywhere; box-sizing: border-box; }
      .status-likely { background: #dcfce7; color: #166534; }
      .status-gap { background: #fef3c7; color: #92400e; }
      .status-missing { background: #fee2e2; color: #991b1b; }
      .question-card { page-break-inside: avoid; break-inside: avoid; }
      .question-card section { margin-top: 12px; }
      .candidate-attempt { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin: 10px 0; background: #f8fafc; }
      .ai-interview-response { border: 1px solid #c7d2fe; border-left: 4px solid #4338ca; border-radius: 6px; padding: 12px; margin: 10px 0 14px; background: #eef2ff; }
      .verbatim, .response-box { white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; margin: 0; padding: 8px; border: 1px solid #999; border-radius: 4px; background: #fff; font-family: Calibri, Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.35; box-sizing: border-box; }
      .response-box { min-height: 80px; }
      .assessor-evaluation { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc; margin-top: 12px; }
      .assessor-input:focus, .assessor-signoff-input:focus { outline: 2px solid #0b6ea9; border-color: #0b6ea9; }
      .question-submit-btn:hover { background: #095c8b !important; }
      .question-submit-btn.is-disabled { background: #94a3b8 !important; color: #e2e8f0 !important; cursor: not-allowed !important; }
      .question-submit-btn.is-disabled:hover { background: #94a3b8 !important; }
      .submit-status.success { color: #166534; }
      .submit-status.error { color: #991b1b; }
      .submit-status.locked { color: #92400e; }
      .signoff-actions { margin-top: 12px; display: flex; justify-content: flex-end; gap: 12px; align-items: center; flex-wrap: wrap; }
      .global-submit-btn { background: #0b6ea9; color: #fff; border: none; border-radius: 999px; padding: 12px 24px; font-size: 15px; font-weight: 700; cursor: pointer; }
      .global-submit-btn:hover { background: #095c8b; }
      .global-submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      .send-pdf-btn { background: #1f2937; color: #fff; border: none; border-radius: 999px; padding: 12px 24px; font-size: 15px; font-weight: 700; cursor: pointer; }
      .send-pdf-btn:hover { background: #111827; }
      .global-status { font-size: 13px; color: #64748b; }
      .global-status.success { color: #166534; }
      .global-status.error { color: #991b1b; }
      .confirm-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1000; }
      .confirm-backdrop[hidden] { display: none !important; }
      .confirm-dialog { width: min(420px, 100%); background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; box-shadow: 0 16px 36px rgba(15, 23, 42, 0.22); }
      .confirm-message { margin: 0; color: #0f172a; white-space: pre-line; }
      .confirm-actions { margin-top: 16px; display: flex; justify-content: flex-end; gap: 10px; }
      .confirm-no-btn, .confirm-yes-btn { border: none; border-radius: 999px; padding: 9px 16px; font-size: 14px; font-weight: 700; cursor: pointer; }
      .confirm-no-btn { background: #e2e8f0; color: #0f172a; }
      .confirm-no-btn:hover { background: #cbd5e1; }
      .confirm-yes-btn { background: #0b6ea9; color: #fff; }
      .confirm-yes-btn:hover { background: #095c8b; }
      @media print {
        body { background: #fff; }
        .report { width: 100%; max-width: 186mm; padding: 0; }
        .summary, .status-summary-section, .question-review-section, .assessor-questions-section, .limitations, .signoff { break-before: page; page-break-before: always; }
        .question-review-section > .question-card:first-of-type, .assessor-questions-section > .question-card:first-of-type { break-inside: auto; page-break-inside: auto; }
        .question-review-section > h2, .assessor-questions-section > h2 { break-after: avoid; page-break-after: avoid; }
        .question-card, .summary, .warning-box, .coverage-warning, .limitations, .confirmation, .signoff { border-color: #999; }
        .signoff-actions { display: none; }
        .question-submit-btn { display: none; }
        .confirm-backdrop { display: none !important; }
        .assessor-input, .assessor-signoff-input { border: 1px solid #999; }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <header>
        <h1>RPL Preliminary Interview Review</h1>
        <p class="subtitle">AI-generated preliminary review for assessor validation.</p>
      </header>

      <section aria-labelledby="candidateMetadataTitle">
        <h2 id="candidateMetadataTitle">Student Details</h2>
        <table class="metadata-table">
          <tbody>
            ${renderMetadataRows(metadata, studentPhoto)}
          </tbody>
        </table>
      </section>

      <section class="warning-box" aria-labelledby="preliminaryDisclaimerTitle">
        <h2 id="preliminaryDisclaimerTitle">IMPORTANT — PRELIMINARY AI REVIEW ONLY</h2>
        <p>${escapeHtml(DISCLAIMER_INTRO)}</p>
        <ul class="disclaimer-list">
          ${DISCLAIMER_BULLETS.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n          ")}
        </ul>
      </section>

      <section class="summary" aria-labelledby="executiveSummaryTitle">
        <h2 id="executiveSummaryTitle">${escapeHtml(executiveHeading)}</h2>
        ${renderExecutiveSummary(reportModel)}
      </section>

      <section class="status-summary-section" aria-labelledby="statusTableTitle">
        <h2 id="statusTableTitle">Status by Question</h2>
        <table class="status-table">
          <colgroup>
            <col style="width: 10mm;">
            <col style="width: 28mm;">
            <col>
            <col style="width: 38mm;">
            <col style="width: 34mm;">
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Q#</th>
              <th scope="col">Section</th>
              <th scope="col">Question (short)</th>
              <th scope="col">Preliminary status</th>
              <th scope="col">Assessor Evaluation</th>
            </tr>
          </thead>
          <tbody>${renderStatusTableRows(questions)}
          </tbody>
        </table>
      </section>

      <section class="question-review-section" aria-labelledby="questionReviewTitle">
        <h2 id="questionReviewTitle">Question-by-Question Review</h2>
        ${renderQuestionArticlesInteractive(questions)}
      </section>

      <section class="limitations" aria-labelledby="limitationsTitle">
        <h2 id="limitationsTitle">Limitations of this AI preliminary review</h2>
        <p>${escapeHtml(LIMITATIONS_TEXT)}</p>
      </section>

      <section class="confirmation" aria-labelledby="confirmationTitle">
        <h2 id="confirmationTitle">Assessor confirmation required</h2>
        <p>${escapeHtml(ASSESSOR_CONFIRMATION_TEXT)}</p>
      </section>

      <section class="signoff" aria-labelledby="signoffTitle">
        <h2 id="signoffTitle">Assessor sign-off</h2>
        <table class="signoff-table">
          <tbody>
            ${renderSignoffRows()}
          </tbody>
        </table>
        <div class="signoff-actions">
          <span class="global-status" id="globalSubmitStatus"></span>
          <button type="button" class="global-submit-btn" id="globalSubmitBtn">Finalise</button>
          <button type="button" class="send-pdf-btn" id="sendPdfBtn">Send PDF</button>
        </div>
      </section>

      <div class="confirm-backdrop" id="finaliseConfirmBackdrop" hidden>
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="finaliseConfirmMessage">
          <p class="confirm-message" id="finaliseConfirmMessage">No further changes can be made to the report if you proceed
Do you want to proceed?</p>
          <div class="confirm-actions">
            <button type="button" class="confirm-no-btn" id="finaliseConfirmNo">No</button>
            <button type="button" class="confirm-yes-btn" id="finaliseConfirmYes">Yes</button>
          </div>
        </div>
      </div>

      <div class="confirm-backdrop" id="assessorPopupBackdrop" hidden>
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="assessorPopupMessage">
          <p class="confirm-message" id="assessorPopupMessage"></p>
          <div class="confirm-actions">
            <button type="button" class="confirm-yes-btn" id="assessorPopupClose">Close</button>
          </div>
        </div>
      </div>
    </main>

    <script>
      (function() {
        var SUBMIT_URL = ${submitUrl ? JSON.stringify(submitUrl) : '""'};
        var candidateName = ${JSON.stringify(metadata.candidateName || "")};
        var contactId = ${JSON.stringify(metadata.contactId || "")};
        var givenName = ${JSON.stringify(givenNameFromOptions || "")};
        var ASSESSOR_MODE = ${assessorMode ? "true" : "false"};
        var NOTIFY_PARENT_ON_SUBMIT = ${notifyParentOnSubmit ? "true" : "false"};
        var ASSESSOR_PREFILL = ${assessorPrefillFromOptions ? JSON.stringify(assessorPrefillFromOptions) : "null"};
        var questionSubmissionState = Object.create(null);
        var questionLastSavedState = Object.create(null);
        var assessorFinalised = false;
        var assessorFinalisedAt = "";

        function deriveGivenName() {
          if (givenName && String(givenName).trim()) return String(givenName).trim();
          var full = String(candidateName || "").trim();
          if (!full) return "";
          return full.split(/\s+/)[0] || "";
        }

        function setQuestionStatus(qNum, text, className) {
          var el = document.getElementById("submit-status-" + qNum);
          if (el) {
            el.textContent = text;
            el.className = "submit-status " + (className || "");
          }
        }

        function getQuestionNumberOrder() {
          return getQuestionArticles().map(function(article) {
            return String(article.getAttribute("data-question-number") || "").trim();
          }).filter(Boolean);
        }

        function getPreviousQuestionNumber(qNum) {
          var order = getQuestionNumberOrder();
          var target = String(qNum || "").trim();
          var index = order.indexOf(target);
          if (index <= 0) return "";
          return order[index - 1] || "";
        }

        function isQuestionSubmitted(qNum) {
          var key = String(qNum || "").trim();
          return Boolean(key && questionSubmissionState[key] === true);
        }

        function areAllQuestionsSubmitted() {
          var order = getQuestionNumberOrder();
          if (!order.length) return false;
          return order.every(function(qNum) {
            return isQuestionSubmitted(qNum);
          });
        }

        function isPreviousQuestionSubmitted(qNum) {
          var previous = getPreviousQuestionNumber(qNum);
          if (!previous) return true;
          return isQuestionSubmitted(previous);
        }

        function isQuestionReadyToSubmit(qNum) {
          var evalEl = document.querySelector('input[name="assessor-eval-' + qNum + '"]:checked');
          var notesEl = document.getElementById("assessor-notes-" + qNum);
          var hasNotes = Boolean(notesEl && String(notesEl.value || "").trim());
          return Boolean(evalEl && hasNotes);
        }

        function buildQuestionStateSnapshot(qNum) {
          var data = collectQuestionData(qNum);
          return {
            assessorEvaluation: normalizeEvaluationValue(data.assessorEvaluation || ""),
            assessorNotes: String(data.assessorNotes || "").trim(),
          };
        }

        function isQuestionDirtySinceLastSave(qNum) {
          var key = String(qNum || "").trim();
          if (!key || !isQuestionSubmitted(key)) return false;
          var current = buildQuestionStateSnapshot(key);
          var previous = questionLastSavedState[key] || { assessorEvaluation: "", assessorNotes: "" };
          return current.assessorEvaluation !== previous.assessorEvaluation || current.assessorNotes !== previous.assessorNotes;
        }

        function getLatestActiveQuestionNumber() {
          var order = getQuestionNumberOrder();
          for (var i = 0; i < order.length; i += 1) {
            var qNum = order[i];
            if (!isQuestionSubmitted(qNum) && isPreviousQuestionSubmitted(qNum)) {
              return qNum;
            }
          }
          return "";
        }

        function getEvaluationDisplayText(value) {
          var normalized = normalizeEvaluationValue(value);
          if (normalized === "SATISFACTORY") return "Satisfactory";
          if (normalized === "NOT SATISFACTORY") return "Not Satisfactory";
          return "Not Reviewed";
        }

        function setStatusTableAssessorEvaluation(qNum, value) {
          var cell = document.getElementById("status-assessor-eval-" + qNum);
          if (!cell) return;
          var normalized = normalizeEvaluationValue(value);
          if (normalized === "SATISFACTORY") {
            cell.innerHTML = '<span class="status-badge status-likely">Satisfactory</span>';
            return;
          }
          if (normalized === "NOT SATISFACTORY") {
            cell.innerHTML = '<span class="status-badge status-gap">Not Satisfactory</span>';
            return;
          }
          cell.innerHTML = '<span class="status-badge status-missing">Not Reviewed</span>';
        }

        function collectQuestionData(qNum) {
          var evalEl = document.querySelector('input[name="assessor-eval-' + qNum + '"]:checked');
          var notesEl = document.getElementById("assessor-notes-" + qNum);
          return {
            questionNumber: qNum,
            assessorEvaluation: evalEl ? String(evalEl.value || "") : "",
            assessorNotes: notesEl ? notesEl.value : ""
          };
        }

        function collectSignoffData() {
          var outcomeEl = document.querySelector('input[name="interview-outcome"]:checked');
          var dateTimeEl = document.getElementById("assessor-date-time");
          if (dateTimeEl) dateTimeEl.value = new Date().toLocaleString();
          var signoff = {
            assessorName: (document.getElementById("assessor-name") || {}).value || "",
            assessorEmail: (document.getElementById("assessor-email") || {}).value || "",
            interviewOutcome: outcomeEl ? outcomeEl.value : (document.getElementById("interview-outcome") || {}).value || "",
            assessorSignature: (document.getElementById("assessor-signature") || {}).value || "",
          };
          if (ASSESSOR_MODE) {
            signoff.assessorComments = (document.getElementById("assessor-comments") || {}).value || "";
            signoff.assessorDateTime = dateTimeEl ? dateTimeEl.value : "";
            signoff.assessorFinalised = assessorFinalised;
            signoff.assessorFinalisedAt = assessorFinalisedAt || "";
          }
          return signoff;
        }

        function collectReportJson() {
          var articles = document.querySelectorAll("article.question-card[data-question-number]");
          var questions = [];
          articles.forEach(function(article) {
            var qNum = article.getAttribute("data-question-number");
            questions.push(collectQuestionData(qNum));
          });
          return {
            candidate: {
              fullName: candidateName,
              contactId: contactId
            },
            questions: questions,
            signoff: collectSignoffData()
          };
        }

        function normalizeAssessorPrefill() {
          var raw = ASSESSOR_PREFILL;
          if (!raw) return null;

          if (typeof raw === "string") {
            try {
              raw = JSON.parse(raw);
            } catch {
              return null;
            }
          }

          if (!raw || typeof raw !== "object") return null;
          if (raw.report && typeof raw.report === "object") return raw.report;
          return raw;
        }

        function setFieldValue(id, value) {
          var el = document.getElementById(id);
          if (!el) return;
          el.value = value === undefined || value === null ? "" : String(value);
        }

        function normalizeEvaluationValue(value) {
          var normalized = String(value || "").trim().toUpperCase();
          if (!normalized) return "";
          if (normalized === "SATISFACTORY" || normalized === "MET" || normalized === "APPROVED" || normalized === "OBJECTIVE MET") return "SATISFACTORY";
          if (normalized === "NOT SATISFACTORY" || normalized === "NOT APPROVED" || normalized === "NOT MET" || normalized === "OBJECTIVE NOT MET") return "NOT SATISFACTORY";
          return "";
        }

        function setQuestionEvaluation(qNum, value) {
          var normalized = normalizeEvaluationValue(value);
          if (!normalized) return;
          var input = document.querySelector('input[name="assessor-eval-' + qNum + '"][value="' + normalized + '"]');
          if (input) input.checked = true;
        }

        function setInterviewOutcome(value) {
          var normalized = normalizeEvaluationValue(value);
          var target = normalized || "NOT SATISFACTORY";
          var input = document.querySelector('input[name="interview-outcome"][value="' + target + '"]');
          if (input) input.checked = true;
        }

        function setDisabledForElements(elements, disabled) {
          if (!elements) return;
          elements.forEach(function(element) {
            if (!element) return;
            element.disabled = Boolean(disabled);
          });
        }

        function getQuestionArticles() {
          return Array.from(document.querySelectorAll("article.question-card[data-question-number]"));
        }

        function areQuestionStatusesComplete() {
          var questions = getQuestionArticles();
          if (!questions.length) return false;
          return questions.every(function(article) {
            var qNum = String(article.getAttribute("data-question-number") || "").trim();
            if (!qNum) return false;
            return Boolean(document.querySelector('input[name="assessor-eval-' + qNum + '"]:checked'));
          });
        }

        function areQuestionNotesComplete() {
          var questions = getQuestionArticles();
          if (!questions.length) return false;
          return questions.every(function(article) {
            var qNum = String(article.getAttribute("data-question-number") || "").trim();
            if (!qNum) return false;
            var notesEl = document.getElementById("assessor-notes-" + qNum);
            return Boolean(notesEl && String(notesEl.value || "").trim());
          });
        }

        function hasInterviewOutcomeSelection() {
          return Boolean(document.querySelector('input[name="interview-outcome"]:checked'));
        }

        function hasAssessorCommentsEntry() {
          var commentsEl = document.getElementById("assessor-comments");
          return Boolean(commentsEl && String(commentsEl.value || "").trim());
        }

        function hasAssessorSignatureEntry() {
          var signatureEl = document.getElementById("assessor-signature");
          return Boolean(signatureEl && String(signatureEl.value || "").trim());
        }

        function updateAssessorWorkflowState() {
          if (!ASSESSOR_MODE) return;

          var questionArticles = getQuestionArticles();
          var activeQuestionNumber = getLatestActiveQuestionNumber();
          questionArticles.forEach(function(article) {
            var qNum = String(article.getAttribute("data-question-number") || "").trim();
            if (!qNum) return;

            var isSubmitted = isQuestionSubmitted(qNum);
            var previousSubmitted = isPreviousQuestionSubmitted(qNum);
            var lockedBySequence = !previousSubmitted;
            var isActiveQuestion = Boolean(activeQuestionNumber && qNum === activeQuestionNumber);
            var isDirty = isQuestionDirtySinceLastSave(qNum);
            var radios = Array.from(article.querySelectorAll('input[name="assessor-eval-' + qNum + '"]'));
            var notesEl = document.getElementById("assessor-notes-" + qNum);
            var submitBtn = article.querySelector('.question-submit-btn[data-question-number="' + qNum + '"]');

            setDisabledForElements(radios, assessorFinalised || lockedBySequence);
            if (notesEl) notesEl.disabled = assessorFinalised || lockedBySequence;

            if (submitBtn) {
              var canSubmit = !assessorFinalised
                && !lockedBySequence
                && isQuestionReadyToSubmit(qNum)
                && (isActiveQuestion || isDirty);
              submitBtn.disabled = assessorFinalised;
              submitBtn.classList.toggle("is-disabled", !canSubmit);
              submitBtn.setAttribute("aria-disabled", canSubmit ? "false" : "true");
            }

            if (assessorFinalised) {
              setQuestionStatus(qNum, "Finalised", "success");
            } else if (lockedBySequence) {
              var previous = getPreviousQuestionNumber(qNum);
              setQuestionStatus(qNum, previous ? ("Locked until Question " + previous + " is submitted") : "Locked", "locked");
            } else if (isSubmitted && isDirty) {
              setQuestionStatus(qNum, "Edited after save - submit to update", "");
            } else if (isSubmitted) {
              setQuestionStatus(qNum, "Saved", "success");
            } else {
              setQuestionStatus(qNum, "", "");
            }
          });

          var signoffReady = areAllQuestionsSubmitted();
          var interviewOutcomeInputs = Array.from(document.querySelectorAll('input[name="interview-outcome"]'));
          var assessorCommentsEl = document.getElementById("assessor-comments");
          var assessorSignatureEl = document.getElementById("assessor-signature");
          var finaliseBtn = document.getElementById("globalSubmitBtn");
          var sendPdfBtn = document.getElementById("sendPdfBtn");

          setDisabledForElements(interviewOutcomeInputs, assessorFinalised || !signoffReady);

          var interviewComplete = signoffReady && hasInterviewOutcomeSelection();
          if (assessorCommentsEl) assessorCommentsEl.disabled = assessorFinalised || !interviewComplete;

          var commentsComplete = interviewComplete && hasAssessorCommentsEntry();
          if (assessorSignatureEl) assessorSignatureEl.disabled = assessorFinalised || !commentsComplete;

          var signatureComplete = commentsComplete && hasAssessorSignatureEntry();
          if (finaliseBtn) finaliseBtn.disabled = assessorFinalised || !signatureComplete;
          if (sendPdfBtn) sendPdfBtn.disabled = assessorFinalised ? false : !signatureComplete;
        }

        function applyAssessorPrefill() {
          var prefill = normalizeAssessorPrefill();
          if (!prefill) {
            updateAssessorWorkflowState();
            return;
          }

          var questions = Array.isArray(prefill.questions) ? prefill.questions : [];
          questions.forEach(function(item) {
            var qNum = String(item && item.questionNumber !== undefined ? item.questionNumber : "").trim();
            if (!qNum) return;
            setQuestionEvaluation(qNum, item.assessorEvaluation || "");
            setFieldValue("assessor-notes-" + qNum, item.assessorNotes || "");
            if (normalizeEvaluationValue(item.assessorEvaluation || "") && String(item.assessorNotes || "").trim()) {
              questionSubmissionState[qNum] = true;
              questionLastSavedState[qNum] = buildQuestionStateSnapshot(qNum);
              setStatusTableAssessorEvaluation(qNum, item.assessorEvaluation || "");
            } else {
              setStatusTableAssessorEvaluation(qNum, "");
            }
          });

          var signoff = prefill.signoff && typeof prefill.signoff === "object" ? prefill.signoff : {};
          if (!ASSESSOR_MODE) {
            setFieldValue("assessor-name", signoff.assessorName || "");
            setFieldValue("assessor-email", signoff.assessorEmail || "");
            setFieldValue("interview-outcome", signoff.interviewOutcome || "");
          } else {
            setInterviewOutcome(signoff.interviewOutcome || "NOT SATISFACTORY");
            setFieldValue("assessor-comments", signoff.assessorComments || "");
          }
          setFieldValue("assessor-signature", signoff.assessorSignature || "");
          assessorFinalised = Boolean(signoff.assessorFinalised || signoff.assessorFinalisedAt);
          assessorFinalisedAt = signoff.assessorFinalisedAt ? String(signoff.assessorFinalisedAt) : "";
          updateAssessorWorkflowState();
        }

        function buildSubmitPayload(submitType, triggerQuestionNumber) {
          var assessorInput = {
            submitType: submitType,
            submittedAt: new Date().toISOString(),
            report: collectReportJson()
          };

          if (triggerQuestionNumber) {
            assessorInput.triggerQuestionNumber = String(triggerQuestionNumber);
          }

          return {
            FullName: String(candidateName || ""),
            ContactID: String(contactId || ""),
            GivenName: deriveGivenName(),
            AssessorInput: JSON.stringify(assessorInput)
          };
        }

        function serializeCurrentReportHtml(removeButtons) {
          var clone = document.documentElement.cloneNode(true);
          var liveFields = document.querySelectorAll("input, textarea");
          var clonedFields = clone.querySelectorAll("input, textarea");
          liveFields.forEach(function(field, index) {
            var clonedField = clonedFields[index];
            if (!clonedField) return;
            if (field.tagName === "TEXTAREA") {
              clonedField.textContent = field.value;
              return;
            }
            clonedField.setAttribute("value", field.value || "");
            if (field.type === "radio" || field.type === "checkbox") {
              if (field.checked) clonedField.setAttribute("checked", "checked");
              else clonedField.removeAttribute("checked");
            }
          });
          if (removeButtons) {
            clone.querySelectorAll("button").forEach(function(button) {
              button.remove();
            });
          }
          return "<" + "!doctype html>\\n" + clone.outerHTML;
        }

        function notifyParentOfSavedSubmission(submitType, questionNumber) {
          if (!NOTIFY_PARENT_ON_SUBMIT || window.parent === window) return;
          window.parent.postMessage({
            type: "rpl-assessor-submission-saved",
            submitType: submitType,
            questionNumber: questionNumber ? String(questionNumber) : "",
            html: serializeCurrentReportHtml(false)
          }, "*");
        }

        function submitQuestion(qNum) {
          if (!SUBMIT_URL) { setQuestionStatus(qNum, "No submit URL configured", "error"); return; }
          if (assessorFinalised) {
            setQuestionStatus(qNum, "Report has been finalised and is now read-only.", "locked");
            return;
          }
          var activeQuestion = getLatestActiveQuestionNumber();
          var isDirty = isQuestionDirtySinceLastSave(qNum);
          if (!isDirty && activeQuestion && String(qNum) !== String(activeQuestion)) {
            setQuestionStatus(qNum, "Only the latest active question can be submitted.", "locked");
            setAssessorPopupOpen(true, "This question is not currently active. Please complete and submit Question " + activeQuestion + " first.");
            return;
          }
          if (!isPreviousQuestionSubmitted(qNum)) {
            var previous = getPreviousQuestionNumber(qNum);
            setQuestionStatus(qNum, previous ? ("Complete Question " + previous + " first.") : "Complete previous question first.", "error");
            return;
          }
          if (!isQuestionReadyToSubmit(qNum)) {
            setQuestionStatus(qNum, "Select status and enter assessor comments before submitting.", "error");
            setAssessorPopupOpen(true, "Please select Satisfactory or Not Satisfactory and enter Assessor Comments before submitting.");
            return;
          }
          setQuestionStatus(qNum, "Submitting...", "");
          var data = buildSubmitPayload("question", qNum);
          fetch(SUBMIT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          }).then(function(resp) {
            if (resp.ok) {
              var key = String(qNum);
              questionSubmissionState[key] = true;
              var submittedData = collectQuestionData(qNum);
              questionLastSavedState[key] = {
                assessorEvaluation: normalizeEvaluationValue(submittedData.assessorEvaluation || ""),
                assessorNotes: String(submittedData.assessorNotes || "").trim(),
              };
              setStatusTableAssessorEvaluation(qNum, submittedData.assessorEvaluation || "");
              setQuestionStatus(qNum, "Saved", "success");
              updateAssessorWorkflowState();
              notifyParentOfSavedSubmission("question", qNum);
            } else {
              setQuestionStatus(qNum, "Error " + resp.status, "error");
            }
          }).catch(function(err) {
            setQuestionStatus(qNum, "Error: " + (err.message || "failed"), "error");
          });
        }

        function submitAll() {
          var statusEl = document.getElementById("globalSubmitStatus");
          var btn = document.getElementById("globalSubmitBtn");
          if (!SUBMIT_URL) {
            if (statusEl) { statusEl.textContent = "No submit URL configured"; statusEl.className = "global-status error"; }
            return;
          }
          if (btn) btn.disabled = true;
          if (statusEl) { statusEl.textContent = "Submitting all comments..."; statusEl.className = "global-status"; }
          var finalisedStamp = new Date().toISOString();
          assessorFinalised = true;
          assessorFinalisedAt = finalisedStamp;
          var data = buildSubmitPayload("all");
          fetch(SUBMIT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          }).then(function(resp) {
            if (resp.ok) {
              if (statusEl) { statusEl.textContent = "All comments submitted successfully."; statusEl.className = "global-status success"; }
              updateAssessorWorkflowState();
              notifyParentOfSavedSubmission("all", "");
            } else {
              assessorFinalised = false;
              assessorFinalisedAt = "";
              if (btn) btn.disabled = false;
              updateAssessorWorkflowState();
              if (statusEl) { statusEl.textContent = "Error " + resp.status; statusEl.className = "global-status error"; }
            }
          }).catch(function(err) {
            assessorFinalised = false;
            assessorFinalisedAt = "";
            if (btn) btn.disabled = false;
            updateAssessorWorkflowState();
            if (statusEl) { statusEl.textContent = "Error: " + (err.message || "failed"); statusEl.className = "global-status error"; }
          });
        }

        function setFinaliseDialogOpen(open) {
          var backdrop = document.getElementById("finaliseConfirmBackdrop");
          if (!backdrop) return;
          if (open) {
            backdrop.removeAttribute("hidden");
          } else {
            backdrop.setAttribute("hidden", "hidden");
          }
        }

        function setAssessorPopupOpen(open, message) {
          var backdrop = document.getElementById("assessorPopupBackdrop");
          var messageEl = document.getElementById("assessorPopupMessage");
          if (!backdrop || !messageEl) return;
          if (open) {
            messageEl.textContent = String(message || "Please complete the required fields before submitting.");
            backdrop.removeAttribute("hidden");
          } else {
            backdrop.setAttribute("hidden", "hidden");
          }
        }

        function sendPdf() {
          var statusEl = document.getElementById("globalSubmitStatus");
          var btn = document.getElementById("sendPdfBtn");
          if (btn) btn.disabled = true;
          if (statusEl) { statusEl.textContent = "Sending PDF..."; statusEl.className = "global-status"; }
          if (window.parent === window) {
            if (btn) btn.disabled = false;
            if (statusEl) { statusEl.textContent = "The PDF webhook is only available in the assessor page."; statusEl.className = "global-status error"; }
            return;
          }
          window.parent.postMessage({
            type: "rpl-assessor-send-pdf",
            html: serializeCurrentReportHtml(true)
          }, "*");
        }

        document.querySelectorAll(".question-submit-btn").forEach(function(btn) {
          btn.addEventListener("click", function() {
            var qNum = btn.getAttribute("data-question-number");
            submitQuestion(qNum);
          });
        });

        document.querySelectorAll('input[name^="assessor-eval-"]').forEach(function(input) {
          input.addEventListener("change", updateAssessorWorkflowState);
        });

        document.querySelectorAll('textarea[id^="assessor-notes-"]').forEach(function(textarea) {
          textarea.addEventListener("input", updateAssessorWorkflowState);
        });

        document.querySelectorAll('input[name="interview-outcome"]').forEach(function(input) {
          input.addEventListener("change", updateAssessorWorkflowState);
        });

        var assessorCommentsEl = document.getElementById("assessor-comments");
        if (assessorCommentsEl) assessorCommentsEl.addEventListener("input", updateAssessorWorkflowState);

        var assessorSignatureEl = document.getElementById("assessor-signature");
        if (assessorSignatureEl) assessorSignatureEl.addEventListener("input", updateAssessorWorkflowState);

        var globalBtn = document.getElementById("globalSubmitBtn");
        if (globalBtn) {
          globalBtn.addEventListener("click", function() {
            setFinaliseDialogOpen(true);
          });
        }

        var finaliseNoBtn = document.getElementById("finaliseConfirmNo");
        if (finaliseNoBtn) {
          finaliseNoBtn.addEventListener("click", function() {
            setFinaliseDialogOpen(false);
          });
        }

        var finaliseYesBtn = document.getElementById("finaliseConfirmYes");
        if (finaliseYesBtn) {
          finaliseYesBtn.addEventListener("click", function() {
            setFinaliseDialogOpen(false);
            submitAll();
          });
        }

        var finaliseBackdrop = document.getElementById("finaliseConfirmBackdrop");
        if (finaliseBackdrop) {
          finaliseBackdrop.addEventListener("click", function(event) {
            if (event.target === finaliseBackdrop) {
              setFinaliseDialogOpen(false);
            }
          });
        }

        var assessorPopupCloseBtn = document.getElementById("assessorPopupClose");
        if (assessorPopupCloseBtn) {
          assessorPopupCloseBtn.addEventListener("click", function() {
            setAssessorPopupOpen(false);
          });
        }

        var assessorPopupBackdrop = document.getElementById("assessorPopupBackdrop");
        if (assessorPopupBackdrop) {
          assessorPopupBackdrop.addEventListener("click", function(event) {
            if (event.target === assessorPopupBackdrop) {
              setAssessorPopupOpen(false);
            }
          });
        }

        document.addEventListener("keydown", function(event) {
          if (event.key === "Escape") {
            setFinaliseDialogOpen(false);
            setAssessorPopupOpen(false);
          }
        });

        window.addEventListener("message", function(event) {
          if (event.source !== window.parent || event.data?.type !== "rpl-assessor-send-pdf-result") return;
          var statusEl = document.getElementById("globalSubmitStatus");
          var btn = document.getElementById("sendPdfBtn");
          if (btn) btn.disabled = false;
          if (statusEl) {
            statusEl.textContent = event.data.ok ? "PDF sent successfully." : (event.data.message || "Unable to send PDF.");
            statusEl.className = "global-status " + (event.data.ok ? "success" : "error");
          }
        });

        var sendPdfBtn = document.getElementById("sendPdfBtn");
        if (sendPdfBtn) sendPdfBtn.addEventListener("click", sendPdf);

        var assessorDateTimeEl = document.getElementById("assessor-date-time");
        if (assessorDateTimeEl) assessorDateTimeEl.value = new Date().toLocaleString();
        getQuestionNumberOrder().forEach(function(qNum) {
          if (!isQuestionSubmitted(qNum)) {
            setStatusTableAssessorEvaluation(qNum, "");
          }
        });
        applyAssessorPrefill();
        updateAssessorWorkflowState();
      })();
    </script>
  </body>
</html>`;
  };

  return {
    constants: {
      SOURCE_LIKELY_SUFFICIENT,
      SOURCE_ADDITIONAL_EVIDENCE,
      SHORT_LIKELY_SUFFICIENT,
      SHORT_ADDITIONAL_EVIDENCE,
      SHORT_NOT_AVAILABLE,
      SHORT_QUESTION_NOT_ASKED,
      FULL_LIKELY_SUFFICIENT,
      FULL_ADDITIONAL_EVIDENCE,
      FULL_NOT_AVAILABLE,
      FULL_QUESTION_NOT_ASKED,
      REPORT_TYPE,
      DEFAULT_QUALIFICATION,
      DISCLAIMER_TEXT,
      SUMMARY_FINAL_SENTENCE,
    },
    escapeHtml,
    normaliseTranscriptOverallAssessment,
    parseTranscriptMetadata,
    parseTranscriptQuestions,
    buildQuestionManifest,
    buildQuestionAnalysisBatches,
    buildQuestionAnalysisPrompt,
    parseQuestionAnalysisResponse,
    buildReportModel,
    buildReportModelFromJsonTranscript,
    renderReportHtml,
    renderInteractiveReportHtml,
    validateReportHtmlCoverage,
  };
});
