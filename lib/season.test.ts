import { test } from "node:test";
import { strict as assert } from "node:assert";
import { seasonHints } from "./season";
const d = { lat: 12, lng: 78, seasons: ["winter"], tags: ["ghat"], hairpins: 0 };
test("compares the IST season and detects both monsoons", () => {
  assert.deepEqual(seasonHints(d, 0, new Date("2026-01-01T00:00:00Z")), { best: true, warning: false });
  assert.equal(seasonHints(d, 0, new Date("2026-07-01T00:00:00Z")).warning, true);
  assert.equal(seasonHints(d, 0, new Date("2026-11-01T00:00:00Z")).warning, true);
  assert.equal(seasonHints({ ...d, lat: 15 }, 0, new Date("2026-11-01T00:00:00Z")).warning, false);
  assert.equal(seasonHints({ ...d, tags: [] }, 11, new Date("2026-07-01T00:00:00Z")).warning, true);
});
