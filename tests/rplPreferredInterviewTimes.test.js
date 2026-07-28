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

test("accepts only weekdays between 9 am and 5 pm after the minimum", () => {
  const earliest = new Date(2026, 7, 4, 9, 0);

  assert.match(
    preferredTimes.validatePreferredDateTime("2026-08-03T10:00", earliest),
    /on or after/
  );
  assert.match(
    preferredTimes.validatePreferredDateTime("2026-08-08T10:00", earliest),
    /Monday to Friday/
  );
  assert.match(
    preferredTimes.validatePreferredDateTime("2026-08-05T08:30", earliest),
    /9:00 am and 5:00 pm/
  );
  assert.equal(
    preferredTimes.validatePreferredDateTime("2026-08-04T09:00", earliest),
    ""
  );
  assert.equal(
    preferredTimes.validatePreferredDateTime("2026-08-04T17:00", earliest),
    ""
  );
});

test("requires two different valid preferred choices", () => {
  const earliest = new Date(2026, 7, 4, 9, 0);
  const duplicate = preferredTimes.validatePreferredChoices({
    firstChoice: "2026-08-04T10:00",
    secondChoice: "2026-08-04T10:00",
    earliest,
  });
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.field, "second");

  const valid = preferredTimes.validatePreferredChoices({
    firstChoice: "2026-08-04T10:00",
    secondChoice: "2026-08-05T14:30",
    earliest,
  });
  assert.equal(valid.valid, true);
});

test("formats datetime-local values without applying a UTC conversion", () => {
  const local = new Date(2026, 7, 4, 9, 30);
  assert.equal(preferredTimes.toDateTimeLocalValue(local), "2026-08-04T09:30");
});
