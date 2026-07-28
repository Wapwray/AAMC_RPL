(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RplPreferredInterviewTimes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BUSINESS_OPEN_MINUTES = 9 * 60;
  const BUSINESS_CLOSE_MINUTES = 17 * 60;
  const FULL_BUSINESS_DAYS_NOTICE = 5;

  const isBusinessDay = (date) => {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  };

  const startOfLocalDay = (value) => {
    const parsed = new Date(value);
    const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const getEarliestPreferredDateTime = (completedAt) => {
    const cursor = startOfLocalDay(completedAt);
    let fullBusinessDays = 0;

    while (fullBusinessDays < FULL_BUSINESS_DAYS_NOTICE) {
      cursor.setDate(cursor.getDate() + 1);
      if (isBusinessDay(cursor)) {
        fullBusinessDays += 1;
      }
    }

    do {
      cursor.setDate(cursor.getDate() + 1);
    } while (!isBusinessDay(cursor));

    cursor.setHours(9, 0, 0, 0);
    return cursor;
  };

  const pad = (value) => String(value).padStart(2, "0");

  const toDateTimeLocalValue = (value) => {
    const date = new Date(value);
    return [
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    ].join("T");
  };

  const formatLocalDateTime = (value, locale = "en-AU") => {
    const date = new Date(value);
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  };

  const validatePreferredDateTime = (value, earliest) => {
    if (!value) return "Select a date and time.";
    const selected = new Date(value);
    if (!Number.isFinite(selected.getTime())) return "Select a valid date and time.";
    if (selected < new Date(earliest)) {
      return `Select a time on or after ${formatLocalDateTime(earliest)}.`;
    }
    if (!isBusinessDay(selected)) return "Select a Monday to Friday.";

    const minutes = (selected.getHours() * 60) + selected.getMinutes();
    if (minutes < BUSINESS_OPEN_MINUTES || minutes > BUSINESS_CLOSE_MINUTES) {
      return "Select a time between 9:00 am and 5:00 pm.";
    }
    return "";
  };

  const validatePreferredChoices = ({ firstChoice, secondChoice, earliest }) => {
    const firstError = validatePreferredDateTime(firstChoice, earliest);
    if (firstError) return { valid: false, field: "first", message: firstError };

    const secondError = validatePreferredDateTime(secondChoice, earliest);
    if (secondError) return { valid: false, field: "second", message: secondError };

    if (new Date(firstChoice).getTime() === new Date(secondChoice).getTime()) {
      return {
        valid: false,
        field: "second",
        message: "Select two different preferred times.",
      };
    }
    return { valid: true, field: "", message: "" };
  };

  return {
    BUSINESS_CLOSE_MINUTES,
    BUSINESS_OPEN_MINUTES,
    FULL_BUSINESS_DAYS_NOTICE,
    formatLocalDateTime,
    getEarliestPreferredDateTime,
    isBusinessDay,
    toDateTimeLocalValue,
    validatePreferredChoices,
    validatePreferredDateTime,
  };
});
