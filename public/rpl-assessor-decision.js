(function initRplAssessorDecision(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RplAssessorDecision = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRplAssessorDecisionModule() {
  "use strict";

  const STATUS_LIKELY_SUFFICIENT = "LIKELY SUFFICIENT";
  const STATUS_ADDITIONAL_EVIDENCE = "ADDITIONAL EVIDENCE MAY BE NEEDED";

  const normalizeWhitespace = (value) => String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const toArray = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeWhitespace(item))
        .filter(Boolean);
    }
    const text = normalizeWhitespace(value);
    return text ? [text] : [];
  };

  const formatList = (items, fallback = "the response") => {
    const values = toArray(items);
    if (!values.length) return fallback;
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
  };

  const formatEvidenceFragment = (value) => {
    const text = normalizeWhitespace(value)
      .replace(/[.!?]+$/g, "")
      .replace(/\bthey would\b/gi, "you would")
      .replace(/\bthey can\b/gi, "you can")
      .replace(/\btheir\b/gi, "your")
      .replace(/\bthe learner's\b/gi, "your")
      .replace(/\bthe learner\b/gi, "you");
    if (!text) return "";
    if (/^who would be consulted if unsure(?: about .*)?$/i.test(text)) {
      return "who you would consult or ask for help if you were unsure";
    }
    if (/^who you would(?:\/did)? consult if you were unsure(?: about .*)?$/i.test(text)) {
      return "who you would consult or ask for help if you were unsure";
    }
    if (/^[A-Z][a-z]/.test(text)) {
      return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    return text;
  };

  const sentenceCase = (value) => {
    const text = normalizeWhitespace(value);
    return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
  };

  const lowerFirst = (value) => {
    const text = normalizeWhitespace(value);
    return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : "";
  };

  const formatLearnerEvidenceFragment = (value) => {
    const text = formatEvidenceFragment(value);
    if (!text) return "";
    if (/^(you|you've|you have|you would|you can)\b/i.test(text)) {
      return sentenceCase(text);
    }

    const stated = text.match(/^states?\s+(.+)$/i);
    if (stated) {
      const detail = lowerFirst(stated[1])
        .replace(/\band outlines\b/gi, "and outlined")
        .replace(/\band indicates\b/gi, "and indicated")
        .replace(/\band describes\b/gi, "and described")
        .replace(/\band explains\b/gi, "and explained")
        .replace(/\band identifies\b/gi, "and identified");
      const learnerDetail = /^no\b/i.test(detail) ? `you have ${detail}` : detail;
      return `You've stated ${learnerDetail}`;
    }

    const indicatedIntent = text.match(/^indicates?\s+intent\s+to\s+(.+)$/i);
    if (indicatedIntent) {
      return `You've indicated that you intend to ${lowerFirst(indicatedIntent[1])}`;
    }

    const learnerVerbMap = [
      [/^outlines?\s+(.+)$/i, "outlined"],
      [/^identifies?\s+(.+)$/i, "identified"],
      [/^explains?\s+(.+)$/i, "explained"],
      [/^describes?\s+(.+)$/i, "described"],
      [/^mentions?\s+(.+)$/i, "mentioned"],
      [/^acknowledges?\s+(.+)$/i, "acknowledged"],
      [/^recognises?\s+(.+)$/i, "recognised"],
      [/^recognizes?\s+(.+)$/i, "recognised"],
      [/^notes?\s+(.+)$/i, "noted"],
      [/^provides?\s+(.+)$/i, "provided"],
    ];
    for (const [pattern, verb] of learnerVerbMap) {
      const match = text.match(pattern);
      if (match) return `You've ${verb} ${lowerFirst(match[1])}`;
    }

    const indicates = text.match(/^indicates?\s+(.+)$/i);
    if (indicates) {
      return `You've indicated ${lowerFirst(indicates[1])}`;
    }

    const would = text.match(/^would\s+(.+)$/i);
    if (would) {
      return `You would ${lowerFirst(would[1])}`;
    }

    if (/^(the|a|an|one)\s+/i.test(text)) {
      return `You've identified ${text}`;
    }

    return `You've mentioned ${text}`;
  };

  const formatEvidenceBullets = (items) => toArray(items)
    .map(formatLearnerEvidenceFragment)
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");

  const formatMissingRequirement = (items) => {
    const values = toArray(items).map(formatEvidenceFragment).filter(Boolean);
    return formatList(values, "the remaining question requirements");
  };

  const normaliseAssessmentStatus = (value) => {
    const text = normalizeWhitespace(value).toLowerCase();
    if (!text) return "";
    if (/likely\s+sufficient|satisfactory|sufficient/.test(text) && !/additional|needed|more info|not sufficient/.test(text)) {
      return STATUS_LIKELY_SUFFICIENT;
    }
    if (/additional\s+evidence|more\s+info|more\s+information|needs\s+more|not\s+yet|not\s+sufficient|insufficient|unsatisfactory/.test(text)) {
      return STATUS_ADDITIONAL_EVIDENCE;
    }
    if (text === "likely") return STATUS_LIKELY_SUFFICIENT;
    return "";
  };

  const parseAssessmentResponse = (text) => {
    const raw = String(text || "").trim();
    if (!raw) throw new Error("Empty assessor response.");
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenced ? fenced[1].trim() : raw;
    try {
      return JSON.parse(candidate);
    } catch (directError) {
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch {}
      }
      throw directError;
    }
  };

  const normaliseDecision = (rawDecision, context = {}) => {
    const covered = toArray(rawDecision?.covered);
    let missing = toArray(rawDecision?.missing);
    let status = normaliseAssessmentStatus(
      rawDecision?.overallAssessment ||
      rawDecision?.status ||
      rawDecision?.assessment ||
      rawDecision?.overall_assessment
    );

    if (!status) {
      status = missing.length ? STATUS_ADDITIONAL_EVIDENCE : STATUS_LIKELY_SUFFICIENT;
    }
    if (status === STATUS_LIKELY_SUFFICIENT) {
      missing = [];
    }

    const attemptCount = Number.isFinite(Number(context.attemptCount)) ? Number(context.attemptCount) : 0;
    const maxAttempts = Number.isFinite(Number(context.maxAttempts)) ? Number(context.maxAttempts) : 3;
    const assessorRationale = normalizeWhitespace(
      rawDecision?.assessorRationale ||
      rawDecision?.rationale ||
      rawDecision?.reasoning ||
      rawDecision?.evidenceSummary ||
      ""
    );

    return {
      overallAssessment: status,
      covered,
      missing,
      hintWouldHelp: Boolean(rawDecision?.hintWouldHelp),
      assessorRationale,
      confidence: normalizeWhitespace(rawDecision?.confidence || ""),
      shouldContinue: status === STATUS_LIKELY_SUFFICIENT || attemptCount >= maxAttempts,
      attemptCount,
      maxAttempts,
      raw: rawDecision,
    };
  };

  const buildAssessmentPrompt = ({ candidateMetadata = {}, question = {}, attempts = [], attemptCount, maxAttempts = 3 } = {}) => {
    const payload = {
      candidateMetadata,
      question: {
        questionText: question.questionText || "",
        objective: question.objective || "",
        hint: question.hint || "",
      },
      attempts: attempts.map((answer, index) => ({
        attemptNumber: index + 1,
        responseText: String(answer || ""),
      })),
      currentAttempt: attemptCount || attempts.length,
      maxAttempts,
    };

    return `You are an expert Australian financial services RPL evidence reviewer. Return valid JSON only. Do not return Markdown, commentary, or learner-facing prose.

Your only task is to assess the combined evidence in the learner attempts against the supplied question and objective.

Critical consistency rule:
- Treat all attempts as one combined response.
- The same evidence must receive the same overallAssessment whether it appears in one long answer or is split across multiple attempts.
- Do not ask for repetition or extra detail just because the response is a single long answer.

Assessment rules:
- Give primary weight to the question text and objective.
- Use the hint only as supplementary assessment context. Never quote, paraphrase, list, or reveal hint content in any returned field.
- Do not introduce requirements that are not present in the question, objective, or reasonably implied by them.
- Mark LIKELY SUFFICIENT when the combined response reasonably answers the question requirements, including where understanding is implied rather than expressed in ideal wording.
- Mark ADDITIONAL EVIDENCE MAY BE NEEDED only when a required part of the question is genuinely missing.
- For regulatory-change questions, day-to-day impact can be shown by changed work processes such as updated forms, added compliance checks, training, consultant review, client explanations, changed time allocation, or changed client conversations. Do not require a separate phrase such as "day-to-day" if the practical work impact is already clear.
- If the response is LIKELY SUFFICIENT, missing must be an empty array.

Return this exact JSON shape:
{
  "overallAssessment": "LIKELY SUFFICIENT | ADDITIONAL EVIDENCE MAY BE NEEDED",
  "covered": ["short neutral evidence point"],
  "missing": ["short neutral missing requirement"],
  "hintWouldHelp": false,
  "assessorRationale": "one concise assessor-facing reason for the status, about the learner in third person, not addressed to the learner",
  "confidence": "high | medium | low"
}

Input:
${JSON.stringify(payload, null, 2)}`;
  };

  const buildAssessorSummary = (decision, context = {}) => {
    const givenName = normalizeWhitespace(context.givenName) || "The learner";
    if (decision.assessorRationale) {
      const rationale = decision.assessorRationale
        .replace(/^the learner\s+/i, "")
        .replace(/^the student\s+/i, "")
        .replace(/^the candidate\s+/i, "")
        .replace(new RegExp(`^${givenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,?\\s*`, "i"), "")
        .replace(/\byou\b/gi, "the learner")
        .replace(/\byour\b/gi, "the learner's");
      return `${givenName}, ${rationale.charAt(0).toLowerCase()}${rationale.slice(1)}`.trim();
    }

    const covered = formatList(decision.covered, "relevant evidence");
    if (decision.overallAssessment === STATUS_LIKELY_SUFFICIENT) {
      return `${givenName}, provided evidence covering ${covered}. This addresses the question requirements.`;
    }
    const missing = formatList(decision.missing, "the remaining question requirements");
    return `${givenName}, provided evidence covering ${covered}. Additional evidence may be needed about ${missing}.`;
  };

  const buildLearnerGuidance = (decision, context = {}) => {
    const givenName = normalizeWhitespace(context.givenName) || "there";
    const coveredBullets = formatEvidenceBullets(decision.covered);
    const covered = coveredBullets
      ? `\n\nSo far, you've told us that:\n${coveredBullets}`
      : "";
    const opening = coveredBullets
      ? "thanks for that. Please add a little more detail for this question."
      : "I could not identify enough evidence yet to show the required understanding for this question.";
    const missing = formatMissingRequirement(decision.missing);
    const hintSentence = decision.hintWouldHelp
      ? "\n\nYou can press the Show Hint button for additional help."
      : "";
    const missingIntro = toArray(decision.missing).length > 1
      ? "The key areas that still need more detail are"
      : "The only area that still needs more detail is";
    return `${givenName}, ${opening}${covered}\n\n${missingIntro} ${missing}.${hintSentence}\n\nYou can add this by pressing the Start Transcription button or typing in the Your response box. If you cannot add any more, you can move to the next question.`;
  };

  const buildFeedback = (decision, context = {}) => {
    const summary = buildAssessorSummary(decision, context);
    const continueMessage = normalizeWhitespace(context.continueMessage) || "Please press the Next Question button to continue.";
    const guidance = buildLearnerGuidance(decision, context);
    const shouldContinue = Boolean(decision.shouldContinue);
    const transcriptAttemptText = shouldContinue
      ? `${summary}\n\nOverall assessment: ${decision.overallAssessment}\n\n${continueMessage}`
      : guidance;
    const displayText = shouldContinue ? continueMessage : guidance;

    return {
      assessorSummary: summary,
      learnerGuidance: guidance,
      displayText,
      transcriptAttemptText,
      overallAssessment: decision.overallAssessment,
      shouldContinue,
    };
  };

  return {
    STATUS_LIKELY_SUFFICIENT,
    STATUS_ADDITIONAL_EVIDENCE,
    buildAssessmentPrompt,
    parseAssessmentResponse,
    normaliseAssessmentStatus,
    normaliseDecision,
    buildAssessorSummary,
    buildLearnerGuidance,
    buildFeedback,
  };
});