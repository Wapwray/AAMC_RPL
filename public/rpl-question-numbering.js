(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RplQuestionNumbering = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const getSourceNumberValue = (question) => {
    const candidates = [
      question?.Title,
      question?.title,
      question?.["Question Number"],
      question?.QuestionNumber,
      question?.["Question No"],
      question?.QuestionNo,
    ];
    return candidates.find(
      (value) => value !== undefined && value !== null && String(value).trim()
    );
  };

  const extractTitleNumber = (question, listIndex = 0) => {
    const sourceValue = getSourceNumberValue(question);
    const sourceText = String(sourceValue ?? "").trim();
    const match = sourceText.match(/(\d{1,3})/);
    const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;

    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new Error(
        `Question list item ${Number(listIndex) + 1} must have a numeric Title or Question Number value.`
      );
    }

    return parsed;
  };

  const withTitleQuestionNumbers = (questionList) => {
    if (!Array.isArray(questionList)) return [];
    return questionList.map((question, index) => ({
      ...(question || {}),
      __originalQuestionNumber: extractTitleNumber(question, index),
    }));
  };

  const getQuestionNumber = (question, listIndex = 0) => {
    const storedNumber = Number(question?.__originalQuestionNumber);
    if (Number.isFinite(storedNumber) && storedNumber > 0) {
      return Math.floor(storedNumber);
    }
    return extractTitleNumber(question, listIndex);
  };

  return {
    getSourceNumberValue,
    extractTitleNumber,
    withTitleQuestionNumbers,
    getQuestionNumber,
  };
});
