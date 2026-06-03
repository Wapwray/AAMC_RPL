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
  assert.match(feedback.transcriptAttemptText, /Overall assessment: LIKELY SUFFICIENT/);
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
  assert.match(feedback.displayText, /^Bel, Your response has covered the change\./);
  assert.match(feedback.displayText, /Show Hint button/);
  assert.doesNotMatch(feedback.displayText, /Objective/i);
  assert.doesNotMatch(feedback.displayText, /RG209|responsible lending obligations/i);
  assert.doesNotMatch(feedback.transcriptAttemptText, /Overall assessment:/);
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
  assert.match(feedback.transcriptAttemptText, /Overall assessment: ADDITIONAL EVIDENCE MAY BE NEEDED/);
  assert.equal(feedback.displayText, "Thank you for your responses, Bel. Please press the Next Question button to continue.");
});