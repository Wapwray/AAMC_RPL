const test = require("node:test");
const assert = require("node:assert/strict");
const preferredTimes = require("../public/rpl-preferred-interview-times.js");

test("requires five full weekdays before the earliest meeting day", () => {
  const completedMonday = new Date(2026, 6, 27, 14, 30);
  const earliest = preferredTimes.getEarliestPreferredDateTime(completedMonday);

  assert.equal(earliest.getFullYear(), 2026);
  assert.equal(earliest.getMonth(), 7);
  assert.equal(earliest.getDate(), 4);
  assert.equal(earliest.getDay(), 2);
  assert.equal(earliest.getHours(), 9);
  assert.equal(earliest.getMinutes(), 0);
});

test("skips both weekends while counting full business days", () => {
  const completedFriday = new Date(2026, 6, 31, 16, 0);
  const earliest = preferredTimes.getEarliestPreferredDateTime(completedFriday);

  assert.equal(earliest.getFullYear(), 2026);
  assert.equal(earliest.getMonth(), 7);
  assert.equal(earliest.getDate(), 10);
  assert.equal(earliest.getDay(), 1);
  assert.equal(earliest.getHours(), 9);
});

test("offers half-hour start slots from 9am through 4:30pm", () => {
  const starts = preferredTimes.getStartTimeOptions();
  assert.equal(starts[0], "09:00");
  assert.equal(starts.at(-1), "16:30");
  assert.equal(starts.length, 16);
  assert.equal(starts.includes("16:45"), false);
  assert.equal(starts.includes("17:00"), false);
});

test("offers half-hour end slots no later than 5pm", () => {
  const ends = preferredTimes.getEndTimeOptions();
  assert.equal(ends[0], "09:30");
  assert.equal(ends.at(-1), "17:00");
  assert.equal(ends.includes("17:30"), false);
});

test("validates weekday business-hour ranges in half-hour increments", () => {
  const earliest = new Date(2026, 7, 4, 9, 0);

  assert.match(
    preferredTimes.validatePreferredRange(
      { date: "2026-08-03", startTime: "10:00", endTime: "11:00" },
      earliest
    ).message,
    /on or after/
  );
  assert.match(
    preferredTimes.validatePreferredRange(
      { date: "2026-08-08", startTime: "10:00", endTime: "11:00" },
      earliest
    ).message,
    /Monday to Friday/
  );
  assert.match(
    preferredTimes.validatePreferredRange(
      { date: "2026-08-05", startTime: "16:45", endTime: "17:00" },
      earliest
    ).message,
    /half-hour/
  );
  assert.match(
    preferredTimes.validatePreferredRange(
      { date: "2026-08-05", startTime: "16:30", endTime: "17:30" },
      earliest
    ).message,
    /no later than 5pm/
  );
  assert.equal(
    preferredTimes.validatePreferredRange(
      { date: "2026-08-04", startTime: "09:00", endTime: "12:30" },
      earliest
    ).message,
    ""
  );
});

test("requires choices on two different days", () => {
  const earliest = new Date(2026, 7, 4, 9, 0);
  const sameDay = preferredTimes.validatePreferredChoices({
    firstChoice: { date: "2026-08-04", startTime: "10:00", endTime: "12:00" },
    secondChoice: { date: "2026-08-04", startTime: "14:00", endTime: "16:00" },
    earliest,
  });
  assert.equal(sameDay.valid, false);
  assert.equal(sameDay.field, "secondDate");

  const valid = preferredTimes.validatePreferredChoices({
    firstChoice: { date: "2026-08-04", startTime: "10:00", endTime: "12:00" },
    secondChoice: { date: "2026-08-05", startTime: "14:30", endTime: "16:30" },
    earliest,
  });
  assert.equal(valid.valid, true);
});

test("formats a preferred choice as a readable local date and time range", () => {
  assert.equal(
    preferredTimes.formatPreferredTimeRange({
      date: "2026-08-05",
      startTime: "13:00",
      endTime: "16:00",
    }),
    "Wednesday 5th of August 1pm to 4pm"
  );
});

test("formats local date values without applying a UTC conversion", () => {
  const local = new Date(2026, 7, 4, 9, 30);
  assert.equal(preferredTimes.toDateInputValue(local), "2026-08-04");
  assert.equal(preferredTimes.toDateTimeLocalValue(local), "2026-08-04T09:30");
});
