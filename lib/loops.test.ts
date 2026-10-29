import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loopDate, loopDays } from "./loops";
import { validateLoop } from "./validate";
import type { LoopLeg, LoopStop } from "./types";

const start = { name: "Bengaluru", lat: 12.97, lng: 77.59 };
const stops: LoopStop[] = [
  { destinationId: "a", name: "Yercaud", lat: 11.77, lng: 78.2, nightHere: true },
  { destinationId: null, name: "Mettur", lat: 11.8, lng: 77.8, nightHere: false },
];
const legs: LoopLeg[] = [100, 60, 120].map((km) => ({ km, min: km, approx: false, route: [] }));
test("nights split legs into days and leave the return for the last day", () => {
  const days = loopDays(start, stops, legs);
  assert.deepEqual(
    days.map((d) => [d.names, d.km, d.night?.name]),
    [
      [["Bengaluru", "Yercaud"], 100, "Yercaud"],
      [["Yercaud", "Mettur", "Bengaluru"], 180, undefined],
    ],
  );
  assert.deepEqual(loopDays(start, stops, legs.slice(0, 2)), []);
});
test("loop dates cross months and invalid dates are rejected", () => {
  assert.equal(loopDate("2028-02-28", 2), "2028-03-01");
  assert.equal(validateLoop({ name: "Test", stops, startDate: "2026-02-30" }), null);
  assert.ok(validateLoop({ name: "Test", stops, startDate: null }));
  assert.equal(validateLoop({ name: "Test", stops: [{ ...stops[0], lat: 999 }] }), null);
});
