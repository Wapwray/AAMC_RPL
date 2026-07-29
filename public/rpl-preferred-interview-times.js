(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RplPreferredInterviewTimes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BUSINESS_OPEN_MINUTES = 9 * 60;
  const LATEST_START_MINUTES = (16 * 60) + 30;
  const BUSINESS_CLOSE_MINUTES = 17 * 60;
  const SLOT_MINUTES = 30;
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

  const toDateInputValue = (value) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const toDateTimeLocalValue = (value) => {
    const date = new Date(value);
    return `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

  const minutesToTimeValue = (minutes) =>
    `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

  const getTimeValues = (firstMinutes, lastMinutes) => {
    const values = [];
    for (let minutes = firstMinutes; minutes <= lastMinutes; minutes += SLOT_MINUTES) {
      values.push(minutesToTimeValue(minutes));
    }
    return values;
  };

  const getStartTimeOptions = () =>
    getTimeValues(BUSINESS_OPEN_MINUTES, LATEST_START_MINUTES);

  const getEndTimeOptions = () =>
    getTimeValues(BUSINESS_OPEN_MINUTES + SLOT_MINUTES, BUSINESS_CLOSE_MINUTES);

  const parseTimeValue = (value) => {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return NaN;
    return (Number(match[1]) * 60) + Number(match[2]);
  };

  const parseDateValue = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (
      date.getFullYear() !== Number(match[1])
      || date.getMonth() !== Number(match[2]) - 1
      || date.getDate() !== Number(match[3])
    ) {
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const formatTimeValue = (value) => {
    const minutes = parseTimeValue(value);
    if (!Number.isFinite(minutes)) return "";
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour24 >= 12 ? "pm" : "am";
    const hour12 = (hour24 % 12) || 12;
    return `${hour12}${minute ? `:${pad(minute)}` : ""}${suffix}`;
  };

  const ordinal = (day) => {
    const remainder100 = day % 100;
    if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;
    if (day % 10 === 1) return `${day}st`;
    if (day % 10 === 2) return `${day}nd`;
    if (day % 10 === 3) return `${day}rd`;
    return `${day}th`;
  };

  const formatPreferredTimeRange = (choice, locale = "en-AU") => {
    const date = parseDateValue(choice?.date);
    if (!date) return "";
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
    const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
    return `${weekday} ${ordinal(date.getDate())} of ${month} `
      + `${formatTimeValue(choice.startTime)} to ${formatTimeValue(choice.endTime)}`;
  };

  const validatePreferredRange = (choice, earliest) => {
    const date = parseDateValue(choice?.date);
    if (!choice?.date) return { message: "Select a date.", part: "date" };
    if (!date) return { message: "Select a valid date.", part: "date" };
    if (date < startOfLocalDay(earliest)) {
      return {
        message: `Select a date on or after ${toDateInputValue(earliest)}.`,
        part: "date",
      };
    }
    if (!isBusinessDay(date)) {
      return { message: "Select a Monday to Friday.", part: "date" };
    }

    const startMinutes = parseTimeValue(choice?.startTime);
    if (!choice?.startTime) return { message: "Select a start time.", part: "start" };
    if (
      !Number.isFinite(startMinutes)
      || startMinutes % SLOT_MINUTES !== 0
      || startMinutes < BUSINESS_OPEN_MINUTES
      || startMinutes > LATEST_START_MINUTES
    ) {
      return {
        message: "Select a start time from 9am to 4:30pm in half-hour increments.",
        part: "start",
      };
    }

    const endMinutes = parseTimeValue(choice?.endTime);
    if (!choice?.endTime) return { message: "Select an end time.", part: "end" };
    if (
      !Number.isFinite(endMinutes)
      || endMinutes % SLOT_MINUTES !== 0
      || endMinutes <= startMinutes
      || endMinutes > BUSINESS_CLOSE_MINUTES
    ) {
      return {
        message: "Select an end time after the start time and no later than 5pm.",
        part: "end",
      };
    }

    return { message: "", part: "" };
  };

  const validatePreferredChoices = ({ firstChoice, secondChoice, earliest }) => {
    const firstError = validatePreferredRange(firstChoice, earliest);
    if (firstError.message) {
      return {
        valid: false,
        field: `first${firstError.part[0].toUpperCase()}${firstError.part.slice(1)}`,
        message: firstError.message,
      };
    }

    const secondError = validatePreferredRange(secondChoice, earliest);
    if (secondError.message) {
      return {
        valid: false,
        field: `second${secondError.part[0].toUpperCase()}${secondError.part.slice(1)}`,
        message: secondError.message,
      };
    }

    if (firstChoice.date === secondChoice.date) {
      return {
        valid: false,
        field: "secondDate",
        message: "Select two different days.",
      };
    }

    return { valid: true, field: "", message: "" };
  };

  return {
    BUSINESS_CLOSE_MINUTES,
    BUSINESS_OPEN_MINUTES,
    FULL_BUSINESS_DAYS_NOTICE,
    LATEST_START_MINUTES,
    SLOT_MINUTES,
    formatLocalDateTime,
    formatPreferredTimeRange,
    formatTimeValue,
    getEarliestPreferredDateTime,
    getEndTimeOptions,
    getStartTimeOptions,
    isBusinessDay,
    parseTimeValue,
    toDateInputValue,
    toDateTimeLocalValue,
    validatePreferredChoices,
    validatePreferredRange,
  };
});
