(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RplQuestionNumbering = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const extractTitleNumber = (question, listIndex = 0) => {
    const titleValue = question?.Title ?? question?.title;
    const titleText = String(titleValue ?? "").trim();
    const match = titleText.match(/(\d{1,3})/);
    const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;

    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new Error(
        `Question list item ${Number(listIndex) + 1} must have a numeric Title value.`
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
    extractTitleNumber,
    withTitleQuestionNumbers,
    getQuestionNumber,
  };
});
