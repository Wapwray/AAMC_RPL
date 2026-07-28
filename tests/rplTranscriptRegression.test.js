const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const promptPack = require("../public/rpl-prompt-pack-v3");

const transcriptPath = process.env.RPL_TRANSCRIPT_FIXTURE_PATH || "";

if (!transcriptPath) {
  test.skip("local transcript regression requires RPL_TRANSCRIPT_FIXTURE_PATH", () => {});
} else {
  test("local transcript produces privacy-minimised assessment payloads", () => {
    const transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf8"));
    assert.ok(Array.isArray(transcript.questions));
    assert.ok(transcript.questions.length > 0);

    const payloads = transcript.questions.map((question) => promptPack.normaliseAssessmentPayload({
      candidateMetadata: transcript.candidate || {},
      question,
      attempts: question.attempts || [],
    }));

    const inputAttemptCount = transcript.questions.reduce(
      (total, question) => total + (Array.isArray(question.attempts) ? question.attempts.length : 0),
      0
    );
    const outputAttemptCount = payloads.reduce((total, payload) => total + payload.attempts.length, 0);
    assert.equal(outputAttemptCount, inputAttemptCount);

    payloads.forEach((payload, index) => {
      assert.equal(String(payload.question.questionNumber), String(transcript.questions[index].questionNumber));
      assert.doesNotThrow(() => JSON.parse(promptPack.buildAssessmentInput(payload)));
    });

    const serialized = JSON.stringify(payloads);
    [
      "fullName",
      "givenName",
      "contactId",
      "candidateName",
      "submittedAt",
      "currentAttempt",
      "maxAttempts",
    ].forEach((field) => assert.doesNotMatch(serialized, new RegExp(field, "i")));
  });
}
