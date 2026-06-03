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
  const SHORT_LIKELY_SUFFICIENT = "Likely sufficient";
  const SHORT_ADDITIONAL_EVIDENCE = "Additional evidence may be needed";
  const SHORT_NOT_AVAILABLE = "Not available in transcript";
  const FULL_LIKELY_SUFFICIENT = "Likely sufficient (pending assessor verification)";
  const FULL_ADDITIONAL_EVIDENCE = "Additional evidence may be needed (assessor follow-up suggested)";
  const FULL_NOT_AVAILABLE = "Not available in transcript";
  const REPORT_TYPE = "AI-generated preliminary review (not a final assessment)";
  const DEFAULT_QUALIFICATION = "FNS40821 - Certificate IV in Finance and Mortgage Broking";
  const MISSING_VALUE = "Not stated in transcript";
  const DISCLAIMER_TEXT = "IMPORTANT — PRELIMINARY AI REVIEW ONLY\nThis report was prepared by an AI-based assistant as a preliminary analysis of the candidate's responses during an RPL interview. It does NOT constitute an assessment decision. All findings are preliminary and subject to validation by a qualified human RPL assessor. Final determination of competency for the qualification and its units of competency rests solely with the qualified assessor, consistent with the Standards for RTOs 2025 and ASQA's guidance on AI-assisted assessment.";
  const SUMMARY_FINAL_SENTENCE = "The summary above reflects the AI's preliminary observations only. All findings remain subject to confirmation by a qualified human RPL assessor.";
  const LIMITATIONS_TEXT = "This report is an automated preliminary analysis and may not capture all nuances of the candidate's competence. It does not account for non-verbal cues, workplace context, third-party evidence, or any documentation provided outside the recorded interview transcript. The AI cannot confirm authenticity or currency of evidence; those Rules of Evidence must be verified through human assessor processes.";
  const ASSESSOR_CONFIRMATION_TEXT = "A qualified RPL assessor must review the full transcript and any additional evidence, and make the final judgement on each unit's competency. The assessor should confirm that all critical evidence meets the requirements of the relevant qualification and its constituent units, applying the Principles of Assessment (fair, flexible, valid, reliable) and the Rules of Evidence (valid, sufficient, authentic, current). No outcome described in this preliminary report should be treated as final until signed off by the qualified assessor.";

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
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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
    return FULL_NOT_AVAILABLE;
  };

  const statusClassName = (shortStatus) => {
    if (shortStatus === SHORT_LIKELY_SUFFICIENT) return "status-likely";
    if (shortStatus === SHORT_ADDITIONAL_EVIDENCE) return "status-gap";
    return "status-missing";
  };

  const statusSortOrder = (shortStatus) => {
    if (shortStatus === SHORT_ADDITIONAL_EVIDENCE) return 1;
    if (shortStatus === SHORT_NOT_AVAILABLE) return 2;
    return 0;
  };

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
    const stopPattern = (stopLabels || ["Objective", "Hint", "Assessor summary", "Summary", "Overall assessment"])
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
    const textBeforeLabelsMatch = bodyAfterHeading.match(/[\s\S]*?(?=^\s*(?:Objective|Hint|Assessor summary|Summary|Overall assessment)\s*:|^\s*-{3,}\s*$|^\s*QUESTION TRANSCRIPT\b|(?![\s\S]))/im);
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
      const rawOverallAssessment = (rawBlockText.match(/^\s*Overall assessment\s*:\s*([^\r\n]+)/im) || [])[1] || "";
      const attemptsWithPositions = parseAttempts(rawBlockText);
      const assessorBotMessages = parseAssessorBotMessages(rawBlockText, attemptsWithPositions);
      const transcriptQuestionText = getQuestionTextFromBlock(rawBlockText, heading.headingText, heading.trailingText);

      return {
        questionNumber: heading.questionNumber,
        originalQuestionIdentifier: heading.rawIdentifier,
        transcriptQuestionText,
        transcriptObjective: getLabelValue(rawBlockText, ["Objective"], ["Hint", "Assessor summary", "Summary", "Overall assessment"]),
        transcriptHint: getLabelValue(rawBlockText, ["Hint"], ["Assessor summary", "Summary", "Overall assessment"]),
        assessorSummary: getLabelValue(rawBlockText, ["Assessor summary", "Summary"], ["Overall assessment"]),
        rawOverallAssessment: rawOverallAssessment.trim(),
        normalisedOverallAssessment: normaliseTranscriptOverallAssessment(rawOverallAssessment),
        attempts: stripInternalPositions(attemptsWithPositions),
        assessorBotMessages,
        rawBlockText,
        _sourceOrder: index,
      };
    });

    return parsed.sort((left, right) => {
      const leftNumber = typeof left.questionNumber === "number" ? left.questionNumber : Number.POSITIVE_INFINITY;
      const rightNumber = typeof right.questionNumber === "number" ? right.questionNumber : Number.POSITIVE_INFINITY;
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;
      return left._sourceOrder - right._sourceOrder;
    }).map((block) => {
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
    const officialQuestions = Array.isArray(officialQuestionBank) ? officialQuestionBank : [];
    const parsedBlocks = Array.isArray(parsedQuestionBlocks) ? parsedQuestionBlocks : [];
    const usedTranscriptIndexes = new Set();
    const manifest = [];

    officialQuestions.forEach((spec, index) => {
      const specNumber = spec && spec.questionNumber !== undefined && spec.questionNumber !== null && spec.questionNumber !== ""
        ? spec.questionNumber
        : index + 1;
      const specKey = normalizeQuestionNumberForKey(specNumber);
      let matchedIndex = parsedBlocks.findIndex((block, blockIndex) => {
        if (usedTranscriptIndexes.has(blockIndex)) return false;
        return specKey && normalizeQuestionNumberForKey(block.questionNumber) === specKey;
      });

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

      if (matchedIndex >= 0) usedTranscriptIndexes.add(matchedIndex);
      const parsedBlock = matchedIndex >= 0 ? parsedBlocks[matchedIndex] : null;
      manifest.push({
        questionNumber: specNumber,
        officialQuestionSpec: { ...spec, questionNumber: specNumber },
        parsedQuestionBlock: parsedBlock,
        section: spec?.section || "Not supplied in question bank",
        isUnmappedTranscriptQuestion: false,
        source: parsedBlock ? "questionBankAndTranscript" : "questionBankOnly",
      });
    });

    parsedBlocks.forEach((block, index) => {
      if (usedTranscriptIndexes.has(index)) return;
      manifest.push({
        questionNumber: block.questionNumber,
        officialQuestionSpec: null,
        parsedQuestionBlock: block,
        section: officialQuestions.length ? "Unmapped transcript questions" : "Not supplied in question bank",
        isUnmappedTranscriptQuestion: Boolean(officialQuestions.length),
        source: "transcriptOnly",
      });
    });

    return manifest;
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

Candidate metadata:
${JSON.stringify(candidateMetadata || {}, null, 2)}

Official question specification(s):
${JSON.stringify(questionSpecs || [], null, 2)}

Parsed transcript question block(s):
${JSON.stringify(parsedQuestionBlocks || [], null, 2)}

For each question, review all candidate attempts together against the official objective. Use only the allowed preliminary status labels. Preserve candidate attempts exactly as supplied; do not rewrite them.

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
- If candidate evidence exists, do not return "Not available in transcript".
- If the transcript lacks a candidate response, return "Not available in transcript" and specify assessor follow-up.
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
    .replace(/\s{2,}/g, " ")
    .trim();

  const buildFallbackFollowUpExchange = (item) => {
    const block = item.parsedQuestionBlock;
    if (!block || !Array.isArray(block.assessorBotMessages) || !block.assessorBotMessages.length) return "";
    const meaningfulMessages = block.assessorBotMessages
      .map((message) => removeLearnerDirections(message.messageText))
      .filter(Boolean)
      .filter((message) => normalizeQuestionTextForMatch(message) !== normalizeQuestionTextForMatch(block.transcriptQuestionText));
    if (!meaningfulMessages.length) return "";
    return "The AI follow-up requested additional evidence or clarification relevant to this question.";
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
    if (shortStatus === SHORT_NOT_AVAILABLE) {
      return `No candidate response for Question ${questionNumber} was located in the transcript. Assessor review is required before any assessment judgement can be made.`;
    }
    if (shortStatus === SHORT_LIKELY_SUFFICIENT) {
      return `The transcript source material indicates that the candidate's evidence for Question ${questionNumber} is likely sufficient, pending assessor verification against the official requirements.`;
    }
    return `The transcript source material indicates that additional assessor review may be needed for Question ${questionNumber} because the available evidence may not fully address the question requirements.`;
  };

  const buildDefaultAssessorAction = (item, shortStatus) => {
    if (shortStatus === SHORT_NOT_AVAILABLE) {
      return "Locate the missing transcript evidence or seek a candidate response for this question before making a final determination.";
    }
    if (shortStatus === SHORT_ADDITIONAL_EVIDENCE) {
      return "Review this question against the Rules of Evidence (valid, sufficient, authentic, current) and seek additional evidence about the relevant question requirements if required before making a final determination.";
    }
    return "";
  };

  const mapAnalysisByQuestion = (analyses) => {
    const map = new Map();
    (Array.isArray(analyses) ? analyses : []).forEach((analysis, index) => {
      const key = normalizeQuestionNumberForKey(analysis?.questionNumber);
      if (key && !map.has(key)) map.set(key, analysis);
      map.set(`index:${index}`, analysis);
    });
    return map;
  };

  const createQuestionReview = (item, analysis, index) => {
    const spec = item.officialQuestionSpec || {};
    const block = item.parsedQuestionBlock || null;
    const attempts = block && Array.isArray(block.attempts) ? block.attempts : [];
    const hasCandidateEvidence = attempts.some((attempt) => cleanMetadataValue(attempt.responseText));
    let shortStatus = shortStatusFromAnyValue(analysis?.shortStatus || analysis?.preliminaryStatus) || inferFallbackShortStatus(item);
    if (!hasCandidateEvidence) shortStatus = SHORT_NOT_AVAILABLE;
    if (hasCandidateEvidence && shortStatus === SHORT_NOT_AVAILABLE) shortStatus = SHORT_ADDITIONAL_EVIDENCE;

    const section = cleanMetadataValue(spec.section || analysis?.section || item.section) || "Not supplied in question bank";
    const questionNumber = item.questionNumber !== undefined && item.questionNumber !== null && item.questionNumber !== ""
      ? item.questionNumber
      : index + 1;
    const questionAsked = cleanMetadataValue(spec.questionText || analysis?.questionAsked || block?.transcriptQuestionText) || MISSING_VALUE;
    const hintsProvided = cleanMetadataValue(spec.hints || analysis?.hintsProvided || block?.transcriptHint) || MISSING_VALUE;
    const assessmentObjective = cleanMetadataValue(spec.objective || analysis?.assessmentObjective || block?.transcriptObjective) || MISSING_VALUE;
    const aiFollowUpExchange = cleanMetadataValue(analysis?.aiFollowUpExchange) || buildFallbackFollowUpExchange(item);
    const aiPreliminaryObservation = cleanMetadataValue(analysis?.aiPreliminaryObservation) || buildFallbackObservation(item, shortStatus);
    const assessorActionSuggested = shortStatus === SHORT_LIKELY_SUFFICIENT
      ? ""
      : cleanMetadataValue(analysis?.assessorActionSuggested) || buildDefaultAssessorAction(item, shortStatus);

    return {
      questionNumber,
      section,
      unitCode: cleanMetadataValue(spec.unitCode || analysis?.unitCode),
      unitTitle: cleanMetadataValue(spec.unitTitle || analysis?.unitTitle),
      questionAsked,
      hintsProvided,
      assessmentObjective,
      preliminaryStatus: fullStatusFromShortStatus(shortStatus),
      shortStatus,
      attempts,
      aiFollowUpExchange,
      aiPreliminaryObservation,
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

  const buildExecutiveSummary = (questions) => {
    const questionList = Array.isArray(questions) ? questions : [];
    const sections = Array.from(new Set(questionList.map((question) => cleanMetadataValue(question.section)).filter(Boolean)));
    const gaps = questionList.filter((question) => question.shortStatus === SHORT_ADDITIONAL_EVIDENCE);
    const missing = questionList.filter((question) => question.shortStatus === SHORT_NOT_AVAILABLE);
    const sectionText = sections.length
      ? ` across ${sections.join(", ")}`
      : "";
    const sentences = [`The preliminary review considered ${questionList.length} question(s)${sectionText}.`];

    if (gaps.length) {
      const gapText = gaps
        .map((question) => `Question ${question.questionNumber}: ${question.assessorActionSuggested || question.aiPreliminaryObservation}`)
        .join(" ");
      sentences.push(`Additional evidence may be needed for ${gaps.map((question) => `Question ${question.questionNumber}`).join(", ")}. ${gapText}`);
    }
    if (missing.length) {
      sentences.push(`No transcript evidence was available for ${missing.map((question) => `Question ${question.questionNumber}`).join(", ")}.`);
    }
    if (!gaps.length && !missing.length) {
      sentences.push("All included questions were identified as likely sufficient, pending verification by a qualified assessor.");
    }
    sentences.push(SUMMARY_FINAL_SENTENCE);
    return sentences.join(" ");
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
      qualification: cleanMetadataValue(suppliedMetadata.qualification || reportOptions?.qualificationDefault) || DEFAULT_QUALIFICATION,
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

  const renderMetadataRows = (metadata) => {
    const rows = [
      ["Candidate name", metadata.candidateName],
      ["Contact ID", metadata.contactId],
      ["Qualification", metadata.qualification],
      ["Interview date", metadata.interviewDate],
      ["Industry", metadata.industry],
      ["Job title", metadata.jobTitle],
      ["Question count reviewed", metadata.questionCountReviewed],
      ["Transcript question count", metadata.transcriptQuestionCount],
    ];
    if (metadata.questionBankCount !== undefined) rows.push(["Question bank count", metadata.questionBankCount]);
    rows.push(["Report type", metadata.reportType]);
    return rows
      .map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(valueOrMissing(value))}</td></tr>`)
      .join("\n");
  };

  const renderStatusTableRows = (questions) => questions.map((question) => `
              <tr data-status-question-number="${escapeAttribute(question.questionNumber)}">
                <td>${escapeHtml(question.questionNumber)}</td>
                <td>${escapeHtml(valueOrMissing(question.section))}</td>
                <td>${escapeHtml(truncateForTable(question.questionAsked))}</td>
                <td><span class="status-badge ${statusClassName(question.shortStatus)}">${escapeHtml(question.shortStatus)}</span></td>
              </tr>`).join("");

  const renderAttempts = (question) => {
    if (!Array.isArray(question.attempts) || !question.attempts.length) {
      return "<p>No candidate response located in transcript.</p>";
    }
    return question.attempts.map((attempt, index) => {
      const attemptNumber = attempt.attemptNumber || index + 1;
      const submittedAt = cleanMetadataValue(attempt.submittedAt)
        ? `<p class="muted">Submitted: ${escapeHtml(attempt.submittedAt)}</p>`
        : "";
      return `<section class="candidate-attempt">
                <h4>${escapeHtml(attempt.speakerLabel || "Candidate")} response attempt ${escapeHtml(attemptNumber)}</h4>
                <pre class="verbatim">${escapeHtml(attempt.responseText || "")}</pre>
                ${submittedAt}
              </section>`;
    }).join("\n");
  };

  const renderQuestionArticles = (questions) => questions.map((question) => {
    const action = question.shortStatus === SHORT_LIKELY_SUFFICIENT || !question.assessorActionSuggested
      ? ""
      : `<section class="assessor-action"><h4>Assessor action suggested</h4><p>${escapeHtml(question.assessorActionSuggested)}</p></section>`;
    const followUp = cleanMetadataValue(question.aiFollowUpExchange)
      ? `<section><h4>AI follow-up exchange</h4><p>${escapeHtml(question.aiFollowUpExchange)}</p></section>`
      : "";
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
              <h4>Hints provided to candidate</h4>
              <p>${escapeHtml(valueOrMissing(question.hintsProvided))}</p>
            </section>
            <section>
              <h4>Assessment objective</h4>
              <p>${escapeHtml(valueOrMissing(question.assessmentObjective))}</p>
            </section>
            <section>
              <h4>Candidate response(s)</h4>
              ${renderAttempts(question)}
            </section>
            ${followUp}
            <section>
              <h4>AI preliminary observation</h4>
              <p>${escapeHtml(valueOrMissing(question.aiPreliminaryObservation))}</p>
            </section>
            ${action}
          </article>
          <!-- END QUESTION_REVIEW q="${escapeAttribute(question.questionNumber)}" -->`;
  }).join("\n");

  const renderWarnings = (warnings) => {
    if (!Array.isArray(warnings) || !warnings.length) return "";
    return `<section class="coverage-warning" aria-labelledby="coverageWarningsTitle">
          <h2 id="coverageWarningsTitle">Transcript Coverage Warnings</h2>
          <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
        </section>`;
  };

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
    <title>RPL Preliminary Assessment Review</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; background: #f4f6f8; color: #18212f; font-family: Arial, Helvetica, sans-serif; line-height: 1.5; }
      .report { width: min(1100px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
      h1, h2, h3, h4 { color: #0f172a; line-height: 1.25; }
      h1 { margin: 0; font-size: 30px; }
      h2 { margin-top: 32px; border-bottom: 2px solid #d8dee9; padding-bottom: 8px; font-size: 20px; }
      h3 { margin-top: 0; font-size: 18px; }
      h4 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .02em; color: #334155; }
      .subtitle, .muted { color: #64748b; }
      .metadata-table, .status-table, .signoff-table { width: 100%; border-collapse: collapse; background: #fff; }
      .metadata-table th, .metadata-table td, .status-table th, .status-table td, .signoff-table th, .signoff-table td { border: 1px solid #cbd5e1; padding: 10px 12px; vertical-align: top; text-align: left; }
      .metadata-table th { width: 30%; background: #eef2f7; }
      .status-table th { background: #e8eef6; }
      .warning-box, .coverage-warning, .summary, .question-card, .limitations, .confirmation, .signoff { background: #fff; border: 1px solid #d8dee9; border-radius: 8px; padding: 18px; margin-top: 18px; }
      .warning-box { border-left: 6px solid #9a3412; background: #fff7ed; }
      .coverage-warning { border-left: 6px solid #b45309; background: #fffbeb; }
      .status-badge { display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }
      .status-likely { background: #dcfce7; color: #166534; }
      .status-gap { background: #fef3c7; color: #92400e; }
      .status-missing { background: #fee2e2; color: #991b1b; }
      .question-card { page-break-inside: avoid; }
      .question-card section { margin-top: 12px; }
      .candidate-attempt { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin: 10px 0; background: #f8fafc; }
      .verbatim { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; font: 13px/1.45 Consolas, "Courier New", monospace; }
      .assessor-action { border-left: 4px solid #b45309; padding-left: 12px; background: #fffbeb; }
      @media print {
        body { background: #fff; }
        .report { width: 100%; padding: 0; }
        .question-card, .summary, .warning-box, .coverage-warning, .limitations, .confirmation, .signoff { border-color: #999; }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <header>
        <h1>RPL Preliminary Assessment Review</h1>
        <p class="subtitle">AI-generated preliminary review for assessor validation.</p>
      </header>

      <section aria-labelledby="candidateMetadataTitle">
        <h2 id="candidateMetadataTitle">Candidate Metadata</h2>
        <table class="metadata-table">
          <tbody>
            ${renderMetadataRows(metadata)}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="coverageDetailsTitle">
        <h2 id="coverageDetailsTitle">Question Count and Transcript Coverage</h2>
        <p>Question count reviewed: <strong>${escapeHtml(metadata.questionCountReviewed || 0)}</strong>. Transcript question count: <strong>${escapeHtml(metadata.transcriptQuestionCount || 0)}</strong>${metadata.questionBankCount !== undefined ? `. Question bank count: <strong>${escapeHtml(metadata.questionBankCount)}</strong>` : ""}.</p>
      </section>

      ${renderWarnings(reportModel?.warnings || [])}

      <section class="warning-box" aria-labelledby="preliminaryDisclaimerTitle">
        <h2 id="preliminaryDisclaimerTitle">IMPORTANT — PRELIMINARY AI REVIEW ONLY</h2>
        <p>This report was prepared by an AI-based assistant as a preliminary analysis of the candidate's responses during an RPL interview. It does NOT constitute an assessment decision. All findings are preliminary and subject to validation by a qualified human RPL assessor. Final determination of competency for the qualification and its units of competency rests solely with the qualified assessor, consistent with the Standards for RTOs 2025 and ASQA's guidance on AI-assisted assessment.</p>
      </section>

      <section class="summary" aria-labelledby="executiveSummaryTitle">
        <h2 id="executiveSummaryTitle">${escapeHtml(executiveHeading)}</h2>
        <p>${escapeHtml(reportModel?.executiveSummary || SUMMARY_FINAL_SENTENCE)}</p>
      </section>

      <section aria-labelledby="statusTableTitle">
        <h2 id="statusTableTitle">Preliminary Status by Question</h2>
        <table class="status-table">
          <thead>
            <tr>
              <th scope="col">Q#</th>
              <th scope="col">Section</th>
              <th scope="col">Question (short)</th>
              <th scope="col">Preliminary status</th>
            </tr>
          </thead>
          <tbody>${renderStatusTableRows(questions)}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="questionReviewTitle">
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
            <tr><th scope="row">Assessor name</th><td></td></tr>
            <tr><th scope="row">Assessor credential / TAE qualification</th><td></td></tr>
            <tr><th scope="row">Final assessment outcome</th><td>(to be completed by assessor)</td></tr>
            <tr><th scope="row">Signature &amp; date</th><td></td></tr>
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

  return {
    constants: {
      SOURCE_LIKELY_SUFFICIENT,
      SOURCE_ADDITIONAL_EVIDENCE,
      SHORT_LIKELY_SUFFICIENT,
      SHORT_ADDITIONAL_EVIDENCE,
      SHORT_NOT_AVAILABLE,
      FULL_LIKELY_SUFFICIENT,
      FULL_ADDITIONAL_EVIDENCE,
      FULL_NOT_AVAILABLE,
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
    renderReportHtml,
    validateReportHtmlCoverage,
  };
});