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

  const buildAssessmentPayload = ({ candidateMetadata = {}, question = {}, attempts = [], attemptCount, maxAttempts = 3 } = {}) => ({
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
  });

  const buildAssessmentPrompt = ({ candidateMetadata = {}, question = {}, attempts = [], attemptCount, maxAttempts = 3 } = {}) => {
    const payload = buildAssessmentPayload({ candidateMetadata, question, attempts, attemptCount, maxAttempts });

    return `You are an expert Australian financial services RPL evidence reviewer. Return valid JSON only. Do not return Markdown, commentary, or learner-facing prose.

Your only task is to assess the combined evidence in the learner attempts against the supplied question and objective.

Critical consistency rule:
- Treat all attempts as one combined response.
- The same evidence must receive the same overallAssessment whether it appears in one long answer or is split across multiple attempts.
- Do not ask for repetition or extra detail just because the response is a single long answer.
- A later attempt may add evidence that was missing from an earlier attempt. The learner has up to ${maxAttempts} attempts to build their complete response. If the combined evidence across all attempts answers the question requirements, mark LIKELY SUFFICIENT even if earlier attempts only partially addressed the objective. Do not ask the learner to repeat evidence they have already provided in a previous attempt.

Assessment rules:
- Give primary weight to the question text and objective.
- Use the hint only as supplementary assessment context. Never quote, paraphrase, list, or reveal hint content in any returned field.
- The hint is the same content the learner can access with the Show Hint button. Use it only to decide whether pressing Show Hint would help the learner complete their own response.
- Privately compare the learner's attempts against the hint as a checklist. Use covered to acknowledge only the parts of the learner's own wording that align with the question, objective, or hint.
- When the learner's response partly aligns with the hint, acknowledge that aligned evidence in covered using the learner's own general idea, not the hint's wording.
- If the hint would help with a missing part of the response, set hintWouldHelp to true and keep missing generic enough that it does not reveal the hint or a model answer.
- Never copy hint facts, examples, terminology, suggested wording, or implied answers into covered, missing, or assessorRationale.
- Missing items must be based on the visible question and objective only. If a missing item would require hint-only detail, use a broad phrase such as "the part of the question not yet covered" and set hintWouldHelp to true.
- Do not introduce requirements that are not present in the question, objective, or reasonably implied by them.
- Mark LIKELY SUFFICIENT when the combined response reasonably answers the question requirements, including where understanding is implied rather than expressed in ideal wording.
- Mark ADDITIONAL EVIDENCE MAY BE NEEDED only when a required part of the question is genuinely missing.
- For regulatory-change questions, day-to-day impact can be shown by changed work processes such as updated forms, added compliance checks, training, consultant review, client explanations, changed time allocation, or changed client conversations. Do not require a separate phrase such as "day-to-day" if the practical work impact is already clear.
- For product or service impact questions, product/service impact can be shown by changed lender policy, risk appetite, pricing, servicing, borrowing capacity, product features, product availability, lender selection, or recommendation scope. Do not require a separate explicit phrase such as "impact on products or services" if a concrete product, lender, policy, pricing, servicing, or recommendation change is already clear.
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

  const buildDeepseekAssessmentPrompt = ({ candidateMetadata = {}, question = {}, attempts = [], attemptCount, maxAttempts = 3 } = {}) => {
    const payload = buildAssessmentPayload({ candidateMetadata, question, attempts, attemptCount, maxAttempts });

    /*
    Legacy prompt kept for reference before Deepseek-specific tuning:

    You are an expert Australian financial services RPL evidence reviewer. Return valid JSON only. Do not return Markdown, commentary, or learner-facing prose.

    Your only task is to assess the combined evidence in the learner attempts against the supplied question and objective.

    Critical consistency rule:
    - Treat all attempts as one combined response.
    - The same evidence must receive the same overallAssessment whether it appears in one long answer or is split across multiple attempts.
    - Do not ask for repetition or extra detail just because the response is a single long answer.
    - A later attempt may add evidence that was missing from an earlier attempt. The learner has up to ${maxAttempts} attempts to build their complete response. If the combined evidence across all attempts answers the question requirements, mark LIKELY SUFFICIENT even if earlier attempts only partially addressed the objective. Do not ask the learner to repeat evidence they have already provided in a previous attempt.

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
    ${JSON.stringify(payload, null, 2)}
    */

    return `You are an expert Australian financial services RPL evidence reviewer. Return valid JSON only. Do not return Markdown, commentary, or learner-facing prose.

You are reviewing evidence for an RPL interview. Your output is converted by application code into learner feedback, so the JSON fields must support warm, balanced feedback similar to an experienced assessor.

Your only task is to assess the combined evidence in the learner attempts against the supplied question and objective.

Critical consistency rules:
- Treat all attempts as one combined response.
- The same evidence must receive the same overallAssessment whether it appears in one long answer or is split across multiple attempts.
- A later attempt may add evidence that was missing from an earlier attempt. The learner has up to ${maxAttempts} attempts to build their complete response.
- If the combined evidence across all attempts answers the question requirements, mark LIKELY SUFFICIENT even if the wording is informal, brief, or not phrased like an assessor would write it.
- Do not ask the learner to repeat evidence they have already provided in a previous attempt.

Deepseek calibration rules:
- Be evidence-aware and generous with partial answers. If the learner gives any relevant evidence, put it in covered. Do not leave covered empty unless the response is completely unrelated or blank.
- For a partly correct answer, return ADDITIONAL EVIDENCE MAY BE NEEDED, but still acknowledge what was covered.
- Prefer "some additional detail is required" style outcomes over "not enough evidence" style outcomes when any relevant evidence exists.
- Do not use harsh or absolute wording in assessorRationale such as "could not identify enough evidence", "failed to", "does not demonstrate", or "insufficient evidence" when covered contains any item.
- Missing items must be short noun phrases, not commands. Use phrases like "one internal stakeholder affected by the change" and "one external stakeholder affected by the change". Do not write "names an internal stakeholder" or "explain an external stakeholder".
- Covered items must also be short neutral evidence points. Use phrases like "mentions stakeholders received updates about impacts of the change" rather than judgmental phrases.

Warmth and answer-safety rules:
- The application will turn covered and missing into learner feedback. Write covered and missing so they support a calm, encouraging assessor voice.
- Missing items must describe only the area where more evidence is needed. Do not provide example answers, suggested facts, model wording, or specific content the learner could copy.
- Do not reveal the correct answer, the hint, or assessor-only reasoning in covered, missing, or assessorRationale.
- Treat the hint as Show Hint button content. Use it to decide whether hintWouldHelp should be true, but never turn hint content into learner-facing missing detail.
- Privately map the learner's attempts against the hint. Covered must acknowledge only evidence the learner has already said, including learner-supplied ideas that align with the hint.
- If the learner has said something relevant to the hint, describe that alignment in broad terms based on the learner's wording. Do not add hint-only facts.
- When any relevant evidence exists, make assessorRationale balanced: briefly acknowledge the useful evidence before noting the remaining gap.

Assessment rules:
- Give primary weight to the question text and objective.
- Use the hint only as supplementary assessment context. Never quote, paraphrase, list, or reveal hint content in any returned field.
- Compare the learner's own response against the hint privately, then use covered to reflect the parts of the learner's response that already align.
- If the hint would help with a missing part of the response, set hintWouldHelp to true and keep missing generic enough that it does not reveal the hint or a model answer.
- Never copy hint facts, examples, terminology, suggested wording, or implied answers into covered, missing, or assessorRationale.
- Missing items must be based on the visible question and objective only. If a missing item would require hint-only detail, use a broad phrase such as "the part of the question not yet covered" and set hintWouldHelp to true.
- Do not introduce requirements that are not present in the question, objective, or reasonably implied by them.
- Mark LIKELY SUFFICIENT when the combined response reasonably answers the question requirements, including where understanding is implied rather than expressed in ideal wording.
- Mark ADDITIONAL EVIDENCE MAY BE NEEDED only when a required part of the question is genuinely missing.
- For regulatory-change questions, day-to-day impact can be shown by changed work processes such as updated forms, added compliance checks, training, consultant review, client explanations, changed time allocation, or changed client conversations. Do not require a separate phrase such as "day-to-day" if the practical work impact is already clear.
- For product or service impact questions, product/service impact can be shown by changed lender policy, risk appetite, pricing, servicing, borrowing capacity, product features, product availability, lender selection, or recommendation scope. Do not require a separate explicit phrase such as "impact on products or services" if a concrete product, lender, policy, pricing, servicing, or recommendation change is already clear.
- If the response is LIKELY SUFFICIENT, missing must be an empty array.

Return this exact JSON shape:
{
  "overallAssessment": "LIKELY SUFFICIENT | ADDITIONAL EVIDENCE MAY BE NEEDED",
  "covered": ["short neutral evidence point acknowledging relevant evidence already provided"],
  "missing": ["short neutral missing requirement as a noun phrase"],
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
      ? "thanks for that. You're on the right track, and a little more detail would help complete this response."
      : "thanks for your response. I need a little more evidence before I can match it to this question.";
    const missing = formatMissingRequirement(decision.missing);
    const missingGuidance = decision.hintWouldHelp
      ? `It would help to add more context about ${missing}. Press the Show Hint button, compare it with what you've already said, then add any extra detail you can in your own words.`
      : `It would help to add a little more detail about ${missing}.`;
    return `${givenName}, ${opening}${covered}\n\n${missingGuidance}\n\nTry adding this in your own words by pressing the Start Transcription button or typing in the Your response box. If you cannot add any more, you can move to the next question.`;
  };

  const buildFeedback = (decision, context = {}) => {
    const summary = buildAssessorSummary(decision, context);
    const continueMessage = normalizeWhitespace(context.continueMessage) || "Please press the Next Question button to continue.";
    const guidance = buildLearnerGuidance(decision, context);
    const shouldContinue = Boolean(decision.shouldContinue);
    const transcriptAttemptText = shouldContinue
      ? `${summary}\n\nPreliminary Status: ${decision.overallAssessment}\n\n${continueMessage}`
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
    buildDeepseekAssessmentPrompt,
    parseAssessmentResponse,
    normaliseAssessmentStatus,
    normaliseDecision,
    buildAssessorSummary,
    buildLearnerGuidance,
    buildFeedback,
  };
});