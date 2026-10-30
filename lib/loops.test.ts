import { test } from "node:test";
import { strict as assert } from "node:assert";
import { importStops, loopDate, loopDays } from "./loops";
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
test("imported stops drop home at either end and snap to nearby crew rides", () => {
  const rides = [{ id: "y", name: "Yercaud viewpoint", lat: 11.78, lng: 78.205 }];
  const r = importStops(
    [
      { name: "Bengaluru", lat: 12.975, lng: 77.6 },
      { name: "Yercaud", lat: 11.7747, lng: 78.2093 },
      { name: "Mettur", lat: 11.8, lng: 77.8 },
      { name: "Home", lat: 12.96, lng: 77.58 },
    ],
    start,
    rides,
  );
  assert.deepEqual(r.stops, [
    { destinationId: "y", name: "Yercaud viewpoint", lat: 11.78, lng: 78.205, nightHere: false },
    { destinationId: null, name: "Mettur", lat: 11.8, lng: 77.8, nightHere: false },
  ]);
  assert.deepEqual(r.dropped, ["Bengaluru", "Home"]);
  // A stop in the middle that happens to be near home is kept.
  const mid = importStops([stops[0], { name: "Home", lat: 12.97, lng: 77.59 }, stops[1]], start, []);
  assert.equal(mid.stops.length, 3);
  // A route that starts at the city centre still means home for a rider on the edge of town.
  const hebbal = { name: "Hebbal", lat: 13.0358, lng: 77.597 };
  const city = importStops([{ name: "Bengaluru", lat: 12.9716, lng: 77.5946 }, stops[0]], hebbal, []);
  assert.deepEqual(city.dropped, ["Bengaluru"]);
});
