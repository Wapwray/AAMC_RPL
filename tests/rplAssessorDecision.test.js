const assert = require("node:assert/strict");
const test = require("node:test");

const assessor = require("../public/rpl-assessor-decision");

test("buildAssessmentPrompt requires combined-attempt consistency", () => {
  const prompt = assessor.buildAssessmentPrompt({
    candidateMetadata: { givenName: "Bel", industry: "Finance Broking" },
    question: {
      questionText: "Tell me about a recent regulatory change and how it affected your work.",
      objective: "Confirm the learner can identify a regulatory change and explain operational impact.",
      hint: "This hint must not be disclosed.",
    },
    attempts: ["We updated forms and client explanations after RG209 guidance changed."],
    maxAttempts: 3,
  });

  assert.match(prompt, /Treat all attempts as one combined response/);
  assert.match(prompt, /same overallAssessment whether it appears in one long answer or is split across multiple attempts/);
  assert.match(prompt, /Return valid JSON only/);
  assert.match(prompt, /Never quote, paraphrase, list, or reveal hint content/);
  assert.match(prompt, /Use it only to decide whether pressing Show Hint would help/);
  assert.match(prompt, /Privately compare the learner's attempts against the hint as a checklist/);
  assert.match(prompt, /Never copy hint facts, examples, terminology, suggested wording, or implied answers/);
});

test("buildAssessmentPrompt includes every learner attempt in order", () => {
  const prompt = assessor.buildAssessmentPrompt({
    candidateMetadata: { givenName: "Bel", industry: "Finance Broking" },
    question: {
      questionText: "Explain how you handled a compliance change.",
      objective: "Confirm the learner can combine process and impact evidence.",
      hint: "This hint must not be disclosed.",
    },
    attempts: [
      "First I identified the change and updated our process.",
      "Then I explained the impact to clients and documented the file notes.",
    ],
    attemptCount: 2,
    maxAttempts: 3,
  });

  assert.match(prompt, /"attemptNumber": 1/);
  assert.match(prompt, /"responseText": "First I identified the change and updated our process\."/);
  assert.match(prompt, /"attemptNumber": 2/);
  assert.match(prompt, /"responseText": "Then I explained the impact to clients and documented the file notes\."/);
  assert.match(prompt, /"currentAttempt": 2/);
});

test("buildDeepseekAssessmentPrompt calibrates partial evidence feedback", () => {
  const prompt = assessor.buildDeepseekAssessmentPrompt({
    candidateMetadata: { givenName: "MondayTest2", industry: "Finance Broking" },
    question: {
      questionText: "Tell me about a regulatory change and identify stakeholders affected by it.",
      objective: "Confirm the learner can identify internal and external stakeholders affected by change.",
      hint: "This hint must not be disclosed.",
    },
    attempts: ["They had to be given regular updates to demonstrate how the changes impacted the business"],
    maxAttempts: 3,
  });

  assert.match(prompt, /Deepseek calibration rules/);
  assert.match(prompt, /If the learner gives any relevant evidence, put it in covered/);
  assert.match(prompt, /some additional detail is required/);
  assert.match(prompt, /one internal stakeholder affected by the change/);
  assert.match(prompt, /one external stakeholder affected by the change/);
  assert.match(prompt, /mentions stakeholders received updates about impacts of the change/);
  assert.match(prompt, /Covered items must also be short neutral evidence points/);
  assert.match(prompt, /Warmth and answer-safety rules/);
  assert.match(prompt, /Do not provide example answers, suggested facts, model wording, or specific content the learner could copy/);
  assert.match(prompt, /never turn hint content into learner-facing missing detail/);
  assert.match(prompt, /Covered must acknowledge only evidence the learner has already said/);
  assert.match(prompt, /For product or service impact questions/);
  assert.match(prompt, /changed lender policy, risk appetite, pricing, servicing, borrowing capacity, product features, product availability, lender selection, or recommendation scope/);
  assert.match(prompt, /Do not require a separate explicit phrase such as "impact on products or services"/);
});

test("parseAssessmentResponse accepts fenced JSON and normalises legacy status words", () => {
  const parsed = assessor.parseAssessmentResponse(`Before\n\`\`\`json
{
  "status": "Satisfactory",
  "covered": ["identified the change"],
  "missing": ["ignored because status is sufficient"],
  "assessorRationale": "The learner identified the change and described changed work processes."
}
\`\`\``);
  const decision = assessor.normaliseDecision(parsed, { attemptCount: 1, maxAttempts: 3 });

  assert.equal(decision.overallAssessment, assessor.STATUS_LIKELY_SUFFICIENT);
  assert.deepEqual(decision.missing, []);
  assert.equal(decision.shouldContinue, true);
});

test("likely sufficient feedback displays only the continue sentence but stores transcript feedback", () => {
  const decision = assessor.normaliseDecision({
    overallAssessment: "LIKELY SUFFICIENT",
    covered: ["the regulatory change", "updated work processes", "practical client impact"],
    assessorRationale: "The learner identified the regulatory change and connected it to updated work practices.",
  }, { attemptCount: 1, maxAttempts: 3 });
  const feedback = assessor.buildFeedback(decision, {
    givenName: "Bel",
    continueMessage: "Thank you for your responses, Bel. Please press the Next Question button to continue.",
  });

  assert.equal(feedback.displayText, "Thank you for your responses, Bel. Please press the Next Question button to continue.");
  assert.match(feedback.transcriptAttemptText, /Preliminary Status: LIKELY SUFFICIENT/);
  assert.doesNotMatch(feedback.assessorSummary, /\byou\b|\byour\b/i);
  assert.match(feedback.assessorSummary, /^Bel,/);
});

test("additional evidence guidance is learner-facing and does not leak hint content", () => {
  const decision = assessor.normaliseDecision({
    overallAssessment: "ADDITIONAL EVIDENCE MAY BE NEEDED",
    covered: ["the change"],
    missing: ["how the work process changed"],
    hintWouldHelp: true,
    assessorRationale: "The learner identified the change but did not explain the operational impact.",
  }, { attemptCount: 1, maxAttempts: 3 });
  const feedback = assessor.buildFeedback(decision, {
    givenName: "Bel",
    continueMessage: "Thank you for your responses, Bel. Please press the Next Question button to continue.",
    hint: "Mention RG209 and responsible lending obligations.",
  });

  assert.equal(feedback.shouldContinue, false);
  assert.match(feedback.displayText, /^Bel, thanks for that\. You're on the right track, and a little more detail would help complete this response\./);
  assert.match(feedback.displayText, /So far, you've told us that:\n- You've identified the change/);
  assert.match(feedback.displayText, /It would help to add more context about how the work process changed\. Press the Show Hint button, compare it with what you've already said, then add any extra detail you can in your own words\./);
  assert.match(feedback.displayText, /Show Hint button/);
  assert.doesNotMatch(feedback.displayText, /Objective/i);
  assert.doesNotMatch(feedback.displayText, /RG209|responsible lending obligations/i);
  assert.doesNotMatch(feedback.transcriptAttemptText, /(?:Overall assessment|Preliminary Status):/);
});

test("additional evidence guidance formats multiple evidence points readably", () => {
  const decision = assessor.normaliseDecision({
    overallAssessment: "ADDITIONAL EVIDENCE MAY BE NEEDED",
    covered: [
      "Would recommend the more appropriate loan rather than a higher-commission product",
      "Would document recommendations and rationale in the statement of credit advice",
      "Would keep file notes, CRM records, and written confirmation of client discussions",
    ],
    missing: ["Who would be consulted if unsure about the appropriate course of action"],
    assessorRationale: "The learner addressed most requirements but did not identify who they would consult if unsure.",
  }, { attemptCount: 1, maxAttempts: 3 });
  const feedback = assessor.buildFeedback(decision, { givenName: "Richard" });

  assert.match(feedback.displayText, /^Richard, thanks for that\. You're on the right track, and a little more detail would help complete this response\./);
  assert.match(feedback.displayText, /So far, you've told us that:\n- You would recommend the more appropriate loan/);
  assert.match(feedback.displayText, /\n- You would document recommendations and rationale/);
  assert.match(feedback.displayText, /\n- You would keep file notes, CRM records/);
  assert.match(feedback.displayText, /It would help to add a little more detail about who you would consult or ask for help if you were unsure\./);
  assert.doesNotMatch(feedback.displayText, /appropriate course of action/);
  assert.doesNotMatch(feedback.displayText, /demonstrates a clear understanding/i);
  assert.doesNotMatch(feedback.displayText, /Richard, Your/);
  assert.doesNotMatch(feedback.displayText, /Objective/i);
});

test("additional evidence covered points are conversational student guidance", () => {
  const decision = assessor.normaliseDecision({
    overallAssessment: "ADDITIONAL EVIDENCE MAY BE NEEDED",
    covered: [
      "states no direct experience and outlines a hypothetical approach",
      "would seek professional guidance and consider workplace obligations when supporting a team member",
      "indicates intent to reduce stress and support wellbeing",
    ],
    missing: ["how they would practically support and manage a team member's mental health and wellbeing"],
    assessorRationale: "The learner provided some relevant evidence but needs more practical detail.",
  }, { attemptCount: 1, maxAttempts: 3 });

  const feedback = assessor.buildFeedback(decision, { givenName: "Bel" });

  assert.match(feedback.displayText, /- You've stated you have no direct experience and outlined a hypothetical approach/);
  assert.match(feedback.displayText, /- You would seek professional guidance and consider workplace obligations/);
  assert.match(feedback.displayText, /- You've indicated that you intend to reduce stress and support wellbeing/);
  assert.match(feedback.displayText, /how you would practically support and manage/);
  assert.doesNotMatch(feedback.displayText, /states no direct experience/);
  assert.doesNotMatch(feedback.displayText, /indicates intent/i);
});

test("low-evidence answers do not claim clear understanding", () => {
  const decision = assessor.normaliseDecision({
    overallAssessment: "ADDITIONAL EVIDENCE MAY BE NEEDED",
    covered: [],
    missing: [
      "one internal stakeholder affected by the regulatory change",
      "one external stakeholder affected by the regulatory change",
      "how the regulatory change impacted those stakeholders",
    ],
    assessorRationale: "The learner did not provide usable evidence against the objective.",
  }, { attemptCount: 1, maxAttempts: 3 });

  const feedback = assessor.buildFeedback(decision, { givenName: "Bel" });

  assert.match(feedback.displayText, /^Bel, thanks for your response\. I need a little more evidence before I can match it to this question\./);
  assert.match(feedback.displayText, /It would help to add a little more detail about/);
  assert.doesNotMatch(feedback.displayText, /demonstrates a clear understanding/i);
  assert.doesNotMatch(feedback.displayText, /So far, you've told us that:/);
});

test("additional evidence at maximum attempts continues with exact status", () => {
  const decision = assessor.normaliseDecision({
    overallAssessment: "NEEDS MORE INFO",
    covered: ["the change"],
    missing: ["day-to-day impact"],
    assessorRationale: "The learner identified the change but did not address the day-to-day impact.",
  }, { attemptCount: 3, maxAttempts: 3 });
  const feedback = assessor.buildFeedback(decision, {
    givenName: "Bel",
    continueMessage: "Thank you for your responses, Bel. Please press the Next Question button to continue.",
  });

  assert.equal(decision.overallAssessment, assessor.STATUS_ADDITIONAL_EVIDENCE);
  assert.equal(feedback.shouldContinue, true);
  assert.match(feedback.transcriptAttemptText, /Preliminary Status: ADDITIONAL EVIDENCE MAY BE NEEDED/);
  assert.equal(feedback.displayText, "Thank you for your responses, Bel. Please press the Next Question button to continue.");
});