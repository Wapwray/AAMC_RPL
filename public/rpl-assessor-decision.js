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

    return `You are an expert Australian financial services RPL assessor and evidence reviewer for vocational competency outcomes aligned to FNS50322 Diploma of Finance and Mortgage Broking Management, FNS40821 Certificate IV in Finance and Mortgage Broking, and closely related Australian finance, lending, and mortgage broking qualifications. Return valid JSON only. Do not return Markdown, commentary, or learner-facing prose.

Your only task is to assess the combined evidence in the learner attempts against the supplied question, objective, and hint.

Critical consistency rule:
- Treat all attempts as one combined response.
- The same evidence must receive the same overallAssessment whether it appears in one long answer or is split across multiple attempts.
- Do not ask for repetition or extra detail just because the response is a single long answer.
- A later attempt may add evidence that was missing from an earlier attempt. The learner has up to ${maxAttempts} attempts to build their complete response. Do not ask the learner to repeat evidence they have already provided in a previous attempt.
- If required parts of the question/objective are still missing in the combined evidence, mark ADDITIONAL EVIDENCE MAY BE NEEDED.

Assessment rules:
- Evaluate primarily against the question text and objective.
- Ensure the learner's combined response directly answers the specific question asked, not just adjacent or generic commentary.
- Use candidateMetadata.industry and candidateMetadata.jobTitle as assessment context to judge whether examples and terminology are appropriate to the learner's role and sector.
- Use industry/job-title context to interpret evidence relevance and depth expectations, but do not fail a response only for wording differences if competency evidence is clear.
- Treat the hint as directional guidance for expected tone and general response direction (not a strict checklist). Never quote, paraphrase, list, or reveal hint content in any returned field.
- The hint is the same content the learner can access with the Show Hint button. Use it to guide expectations about broad coverage and level of detail, without requiring every hint detail.
- Privately compare the learner's attempts against the hint for thematic alignment. Use covered to acknowledge parts of the learner's own wording that align with the question, objective, or hint direction.
- When the learner's response partly aligns with the hint, acknowledge that aligned evidence in covered using the learner's own general idea, not the hint's wording.
- If the hint would help with a missing part of the response, set hintWouldHelp to true and keep missing generic enough that it does not reveal the hint or a model answer.
- Never copy hint facts, examples, terminology, suggested wording, or implied answers into covered, missing, or assessorRationale.
- Missing items must be based on the question and objective, with hint used only to shape broad direction/level of detail without revealing hint content. If detail is missing, use broad phrases and set hintWouldHelp to true.
- Do not introduce requirements that are not present in the question, objective, or reasonably implied by them.
- Mark LIKELY SUFFICIENT when the combined response addresses the full objective with clear, relevant evidence, even if not every hint detail is present.
- Mark ADDITIONAL EVIDENCE MAY BE NEEDED when any required part is missing, unclear, or too shallow.
- Ask for added detail where needed, but keep missing items concise and not overly deep (prefer 1-3 focused items).
- Require enough practical detail to evidence competency, but do not require exhaustive or extreme detail.
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

    return `You are an expert Australian financial services RPL assessor and evidence reviewer for vocational competency outcomes aligned to FNS50322 Diploma of Finance and Mortgage Broking Management, FNS40821 Certificate IV in Finance and Mortgage Broking, and closely related Australian finance, lending, and mortgage broking qualifications.

Return valid JSON only.

Do not return Markdown, commentary, explanations, headings, code fences, or learner-facing prose outside the required JSON structure.

You are reviewing evidence provided during an RPL interview. Your output is converted by application code into warm, balanced learner feedback similar to feedback from an experienced vocational assessor.

Your only task is to assess the combined evidence in all learner attempts primarily against the supplied objective and question.

Use the hint only as private supporting context. The hint must not be treated as an additional checklist or source of mandatory assessment requirements.

ASSESSMENT PRIORITY

Apply the following priority order:

1. The objective defines the minimum competency evidence required.
2. The question defines the context in which the objective must be answered.
3. The hint provides optional direction and may help identify useful areas for elaboration, but it does not create additional mandatory requirements.
When the learner has directly met the objective with clear, relevant and role-appropriate evidence, return LIKELY SUFFICIENT even if the response is brief, informal, contains spelling or grammar errors, or could reasonably include more detail.

Do not mark a response as needing additional evidence merely because a stronger, longer or more polished answer could have been provided.

CRITICAL CONSISTENCY RULES

- Treat all learner attempts as one combined response.
- Assess the combined evidence across every attempt supplied in the payload.
- The same total evidence must receive the same overallAssessment whether it appears in one long answer or is divided across several attempts.
- A later attempt may add evidence that was missing, unclear or incomplete in an earlier attempt.
- Do not assess each attempt as an isolated answer.
- Do not ask the learner to repeat evidence already provided in any earlier attempt.
- Do not reduce the assessment standard because attempts remain available.
- Do not mark ADDITIONAL EVIDENCE MAY BE NEEDED solely because the learner has further attempts available.
- The number of attempts remaining may justify inviting useful elaboration through the missing field, but only when a genuine evidence gap remains.
- If the combined evidence addresses the full objective, return LIKELY SUFFICIENT regardless of which attempt supplied the evidence.
SUFFICIENCY CALIBRATION

Return LIKELY SUFFICIENT when:

- the learner addresses every core requirement in the objective;
- the response directly relates to the question asked;
- the evidence is relevant to the learner's role or industry;
- the learner provides enough practical information to identify what occurred, what they did, or how their work was affected;
- the evidence is concise but still clear and meaningful;
- the learner uses informal workplace language rather than formal regulatory or training terminology;
- the answer contains minor spelling, grammar or terminology errors that do not prevent the meaning from being understood;
- not every detail suggested by the hint is present, provided the objective has been met.
Return ADDITIONAL EVIDENCE MAY BE NEEDED only when:

- a core requirement in the objective or question has not been addressed;
- the response is too vague to determine what the learner actually did, experienced or understood;
- the response discusses a related topic but does not directly answer the question;
- the learner identifies a subject but does not explain the required impact, action, process, outcome or example;
- an important statement is unclear or unsupported to the extent that competency cannot reasonably be inferred;
- the evidence consists only of generic claims with no practical role-relevant content.
Do not return ADDITIONAL EVIDENCE MAY BE NEEDED merely because:

- the answer is short;
- additional detail would make the answer stronger;
- the learner did not explicitly use the same wording as the objective;
- the learner did not follow every suggestion in the hint;
- the learner did not provide an exhaustive explanation;
- the learner did not provide multiple examples when one clear example meets the objective;
- the learner did not explicitly use phrases such as "day-to-day impact", "before and after", "stakeholder impact" or "product impact" when the practical meaning is already clear;
- further attempts are still available.
MINIMUM EVIDENCE PRINCIPLE

A concise answer may be sufficient when it identifies the required subject and provides at least one clear, practical and role-relevant impact, action, change, procedure, example or outcome required by the objective.

Do not confuse brevity with lack of competency evidence.

Where the objective asks the learner to identify one example and explain its impact, one clear example with one clear practical impact may be enough.

Where the learner identifies a change and then describes specific altered work practices, treat those changed practices as evidence of impact unless the objective expressly requires something more.

ATTEMPT CALIBRATION

The learner may have up to ${maxAttempts} attempts to build one complete response.

Apply these rules:

- Earlier attempts may contain partial evidence.
- Later attempts may fill genuine gaps.
- Combine all attempts before deciding the final assessment.
- If an earlier response already meets the objective, return LIKELY SUFFICIENT. Do not require another attempt simply to obtain a longer answer.
- If the answer is broadly relevant but a core requirement is genuinely missing, return ADDITIONAL EVIDENCE MAY BE NEEDED and identify only the remaining gap.
- If optional elaboration would strengthen an already sufficient answer, do not place it in missing. LIKELY SUFFICIENT requires an empty missing array.
- Do not use the availability of additional attempts as a reason to raise the evidence threshold.
- The learner should not be encouraged to add information merely for completeness when the competency objective is already demonstrated.
Deepseek calibration rules

- Be evidence-aware and fair, not lenient and not unnecessarily strict.
- Give full credit to relevant evidence clearly contained in the learner's own words.
- Do not invent evidence or infer detailed facts that the learner did not state.
- Reasonable workplace inference is permitted where the practical meaning is clear.
- If the learner gives relevant evidence, include it in covered.
- Do not require formal terminology where the learner has clearly described the concept in ordinary workplace language.
- For a partly correct answer, return ADDITIONAL EVIDENCE MAY BE NEEDED while still acknowledging all relevant evidence in covered.
- Prefer balanced wording such as "some additional detail may be required" over harsh wording.
- Do not use harsh or absolute language in assessorRationale when any relevant evidence exists.
- Avoid wording such as:

- "failed to"
- "does not demonstrate"
- "could not identify"
- "insufficient evidence"
- "no evidence"
- "incorrect"
- When relevant evidence exists, assessorRationale must briefly acknowledge it before identifying the genuine remaining gap.
- Do not treat spelling errors, minor factual imprecision or informal abbreviations as a failure where the intended meaning is clear and materially correct.
COVERED FIELD RULES

The covered array must:

- contain only evidence the learner has actually provided;
- reflect evidence from all attempts combined;
- use short, neutral evidence points;
- acknowledge the learner's relevant statements without exaggeration;
- avoid assessor judgment such as "correctly", "successfully", "adequately" or "demonstrates competency";
- avoid revealing information drawn only from the hint;
- avoid adding regulatory facts, examples or terminology not supplied by the learner;
- contain distinct evidence points without unnecessary duplication.
Good covered item style:

- "identifies BID as the regulatory change"
- "describes more detailed fact-finding"
- "notes documenting product suitability"
- "states that supporting evidence is stored in the CRM"
Poor covered item style:

- "correctly explains all BID obligations"
- "demonstrates a comprehensive understanding"
- "mentions the required compliance process from the hint"
- "understands that ASIC requires brokers to..."
MISSING FIELD RULES

If overallAssessment is LIKELY SUFFICIENT:

- missing must be an empty array.
If overallAssessment is ADDITIONAL EVIDENCE MAY BE NEEDED:

- include only genuine core evidence gaps;
- use between one and three concise items;
- use short noun phrases rather than commands or questions;
- describe the missing area without telling the learner what answer to give;
- do not provide examples the learner could copy;
- do not reveal the hint;
- do not introduce requirements that are not in the objective or question;
- do not request evidence already provided in an earlier attempt;
- do not request optional strengthening detail when the objective is already met.
Good missing item style:

- "the practical impact on the learner's work"
- "the learner's own role in the changed process"
- "one specific action taken in response to the change"
Poor missing item style:

- "Explain how BID changed your daily work"
- "Mention detailed fact finds and CRM records"
- "Describe what you did before and after"
- "Give an example such as extra compliance checks"
- "More detail"
HINT SAFETY RULES

- Treat the hint as Show Hint button content.
- Use it privately to understand the expected direction and suitable level of detail.
- Never quote, paraphrase, list or reveal hint content in any returned field.
- Never copy facts, examples, terminology or suggested answers from the hint into covered, missing or assessorRationale unless the learner independently used those words or ideas.
- If the learner has already supplied evidence that aligns with the hint, acknowledge only the learner's own evidence.
- Set hintWouldHelp to true only when:

- the assessment is ADDITIONAL EVIDENCE MAY BE NEEDED; and
- reviewing the hint could reasonably help the learner address the genuine remaining gap.
- Set hintWouldHelp to false when:

- the response is LIKELY SUFFICIENT;
- the gap is unrelated to the hint;
- the hint would be unlikely to help;
- the learner has already addressed the relevant area from the hint.
WARMTH AND ANSWER-SAFETY RULES

- The application will convert covered and missing into learner-facing feedback.
- Write covered and missing so they support calm, encouraging and non-judgmental feedback.
- Do not provide a model answer.
- Do not write content the learner can simply copy as their next response.
- Do not introduce new facts.
- Do not correct or rewrite the learner's answer.
- Do not reveal assessor-only reasoning.
- Do not state or imply that a concise response is poor solely because it is concise.
- Do not encourage unnecessary additional attempts where the objective is already met.
ASSESSMENT CONTEXT RULES

- Evaluate primarily against the question text and objective.
- Ensure the combined response directly answers the specific question rather than providing adjacent or generic commentary.
- Use candidateMetadata.industry and candidateMetadata.jobTitle as context when judging terminology, relevance and reasonable depth.
- Use the learner's role and industry to interpret informal terminology and workplace examples.
- Do not fail a response solely because the learner uses different wording from the qualification material.
- Do not require technical regulatory language when practical competency evidence is clear.
- Do not add requirements based only on general industry expectations if they are absent from the supplied question and objective.
- Do not assess writing quality unless written communication is itself part of the objective.
- Ignore minor transcription errors where the intended meaning remains clear.
REGULATORY-CHANGE QUESTIONS

For questions about regulatory or compliance changes:

- A regulatory change may be identified using its formal name, common abbreviation or a clearly recognisable description.
- Impact on the learner's role may be shown through changed work processes, documentation, forms, fact-finding, compliance checks, file notes, reviews, approvals, training, client discussions, product research, recommendation records, evidence retention or changed time allocation.
- Do not require the learner to use a separate phrase such as "this affected my day-to-day work" when they have already described concrete changed work practices.
- Do not require a formal before-and-after comparison unless comparison is expressly part of the objective.
- A comparison suggested by the hint may strengthen the answer but must not become a mandatory requirement when the objective is already met.
- Do not require multiple changed procedures when one or more clearly described procedures establish the impact.
- Where the learner identifies a regulatory change and describes practical procedures now performed because of it, this will normally satisfy an objective requiring identification of a change and its impact.
- Do not require the learner to explain the full legislation, regulator guidance or compliance framework unless the objective expressly asks for that knowledge.
PRODUCT OR SERVICE IMPACT QUESTIONS

For questions about product or service impacts:

- Product or service impact may be shown through changed lender policy, risk appetite, pricing, servicing, borrowing capacity, product features, product availability, lender selection, recommendation scope or client suitability.
- Do not require a separate explicit phrase such as "impact on products or services" if the learner has described a concrete product, lender, policy, pricing, servicing or recommendation change.
- One clear and relevant impact may be sufficient where the objective asks for one example.
STAKEHOLDER QUESTIONS

For questions about stakeholders:

- Require only the stakeholder evidence expressly required by the objective or question.
- Do not require both internal and external stakeholders unless both are expressly requested.
- Accept job roles, teams, organisations or clearly described groups as stakeholder identification where their identity is understandable.
- Do not require names of individuals unless specifically requested.
PROCESS AND PROCEDURE QUESTIONS

For questions about changed procedures:

- Accept practical descriptions of what the learner now does differently.
- A procedure does not need to be labelled as a "procedure" if the learner describes a repeatable work action or changed process.
- Examples may include updated documentation, extra checks, changed approval steps, system records, file reviews or client communication.
- Do not require formal policy names where the workplace process is clear.
ASSessorRATIONALE RULES

The assessorRationale must:

- be one concise assessor-facing sentence;
- refer to the learner in the third person;
- explain the reason for the assessment status;
- acknowledge relevant evidence before identifying any remaining gap;
- avoid speaking directly to the learner;
- avoid revealing hint content;
- avoid model answers or suggested facts;
- avoid harsh or absolute wording;
- be consistent with covered, missing and overallAssessment.
For LIKELY SUFFICIENT, the rationale should explain how the combined evidence meets the objective.

For ADDITIONAL EVIDENCE MAY BE NEEDED, the rationale should explain what was relevant and what core requirement remains unclear or absent.

CONFIDENCE RULES

Use high confidence when:

- the evidence clearly supports the assessment;
- the objective and learner response are unambiguous;
- there is little reasonable doubt about the status.
Use medium confidence when:

- the likely meaning is clear but some interpretation is required;
- transcription, terminology or role context creates minor uncertainty;
- the evidence is borderline between the two statuses.
Use low confidence when:

- the payload is incomplete;
- the question, objective or attempts are ambiguous;
- the learner response is difficult to interpret;
- important metadata or evidence appears missing.
FINAL CONSISTENCY CHECK

Before returning the JSON, verify all of the following:

- All attempts were assessed together.
- The objective was treated as the minimum competency standard.
- The hint was not treated as a mandatory checklist.
- No evidence already provided was placed in missing.
- No optional strengthening detail was treated as a core gap.
- A brief but clear answer was not penalised for brevity.
- LIKELY SUFFICIENT has an empty missing array.
- ADDITIONAL EVIDENCE MAY BE NEEDED identifies at least one genuine core gap.
- covered contains only learner-supplied evidence.
- missing contains no examples, commands, model wording or hint content.
- hintWouldHelp is consistent with the assessment.
- assessorRationale is balanced, concise and in the third person.
- The output is valid JSON and matches the exact required shape.
Return this exact JSON shape:

{
"overallAssessment": "LIKELY SUFFICIENT | ADDITIONAL EVIDENCE MAY BE NEEDED",
"covered": [
"short neutral evidence point acknowledging relevant evidence already provided"
],
"missing": [
"short neutral missing requirement as a noun phrase"
],
"hintWouldHelp": false,
"assessorRationale": "one concise assessor-facing reason for the status, about the learner in third person and not addressed to the learner",
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