import { test } from "node:test";
import assert from "node:assert/strict";
import { weekendDates } from "./format";

test("weekend uses the current weekend and the date in India", () => {
  assert.deepEqual(weekendDates(new Date("2026-10-30T20:00:00Z")), ["2026-10-31", "2026-11-01"]);
  assert.deepEqual(weekendDates(new Date("2026-11-01T06:00:00Z")), ["2026-10-31", "2026-11-01"]);
  assert.deepEqual(weekendDates(new Date("2026-11-02T06:00:00Z")), ["2026-11-07", "2026-11-08"]);
});
