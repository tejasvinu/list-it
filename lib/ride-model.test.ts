import { test } from "node:test";
import assert from "node:assert/strict";
import type { Loop, Itinerary } from "./types";
import { normalizeLoop, rideRef, loopKey, rideHref, rideDays, rideEndDate, overlapsDates, rideRouteKey, rideMaps, rideAnchor } from "./ride-model";
import { validateDestination, validateItinerary } from "./validate";
import { sealRoute, routeSealOk } from "./seal";

const loop: Loop = {
  id: "saved1", groupId: "crew1", riderId: "owner1", name: "Yercaud and Mettur", notes: "Keep this note",
  start: { name: "Hebbal", lat: 13.04, lng: 77.59 },
  stops: [
    { destinationId: "ride1", name: "Yercaud", lat: 11.77, lng: 78.20, nightHere: true },
    { destinationId: null, name: "Mettur", lat: 11.79, lng: 77.80, nightHere: false },
  ],
  legs: [
    { km: 210, min: 250, approx: false, route: [[13.04, 77.59], [11.77, 78.20]] },
    { km: 75, min: 90, approx: true, route: [[11.77, 78.20], [11.79, 77.80]] },
    { km: 190, min: 220, approx: false, route: [[11.79, 77.80], [13.04, 77.59]] },
  ],
  totalKm: 475, totalMin: 560, route: [[13.04, 77.59], [11.77, 78.20], [11.79, 77.80], [13.04, 77.59]],
  startDate: "2026-11-06", createdAt: new Date("2026-10-01"), updatedAt: new Date("2026-10-02"), deletedAt: null,
};

test("ride references separate the same bare ID without changing old URLs", () => {
  assert.deepEqual(rideRef("saved1"), { source: "destination", id: "saved1" });
  assert.deepEqual(rideRef(loopKey("saved1")), { source: "loop", id: "saved1" });
  assert.equal(rideHref("crew", "saved1"), "/g/crew/d/saved1");
  assert.equal(rideHref("crew", loopKey("saved1")), "/g/crew/loops/saved1");
  for (const bad of [null, {}, "loop:", "loop:loop:id", "../id", "id:other", "a".repeat(81)]) assert.equal(rideRef(bad), null);
});

test("reading a legacy loop preserves snapshots, totals, ownership and timestamps", () => {
  const before = structuredClone(loop);
  const ride = normalizeLoop(loop);
  assert.equal(ride.id, "loop:saved1");
  assert.equal(ride.riderId, loop.riderId);
  assert.equal(ride.distanceKm, 475);
  assert.equal(ride.durationMin, 560);
  assert.deepEqual(ride.route, loop.route);
  assert.deepEqual(ride.itinerary?.stops, loop.stops);
  assert.equal(ride.createdAt, loop.createdAt);
  assert.equal(ride.updatedAt, loop.updatedAt);
  assert.equal(ride.status, "planned");
  assert.equal(ride.statusDate, loop.startDate);
  assert.equal(ride.roadSplit, null);
  assert.deepEqual(loop, before);
});

test("multi-stop rides only become multi-day when overnight flags split days", () => {
  const dayRide = normalizeLoop({ ...loop, stops: loop.stops.map(s => ({ ...s, nightHere: false })) });
  assert.equal(dayRide.category, "day");
  assert.equal(rideDays(dayRide), 1);
  assert.equal(rideDays(normalizeLoop(loop)), 2);
  const finalNight = normalizeLoop({ ...loop, stops: loop.stops.map(s => ({ ...s, nightHere: true })) });
  assert.equal(rideDays(finalNight), 3);
});

test("loop metadata overrides read defaults without changing the planned date authority", () => {
  const ride = normalizeLoop({ ...loop, category: "short", tags: ["scenic"], status: "hailmary", startDate: null, rideReport: "Old report" });
  assert.equal(ride.category, "short");
  assert.deepEqual(ride.tags, ["scenic"]);
  assert.equal(ride.status, "hailmary");
  assert.equal(ride.statusDate, null);
  assert.equal(ride.rideReport, "Old report");
});

test("weekend discovery includes a Friday trip that continues on Saturday", () => {
  const ride = normalizeLoop(loop);
  assert.equal(rideEndDate(ride), "2026-11-07");
  assert.equal(overlapsDates(ride, ["2026-11-07", "2026-11-08"]), true);
  assert.equal(overlapsDates({ ...ride, itinerary: null }, ["2026-11-07", "2026-11-08"]), false);
  assert.equal(overlapsDates({ ...ride, status: "wishlist" }, ["2026-11-07"]), false);
});

test("personal route cache identity changes when a later itinerary place moves or order changes", () => {
  const ride = normalizeLoop(loop);
  const trip = ride.itinerary!;
  const moved = { ...ride, itinerary: { ...trip, stops: [trip.stops[0], { ...trip.stops[1], lng: 77.9 }] } };
  const reversed = { ...ride, itinerary: { ...trip, stops: [...trip.stops].reverse() } };
  assert.notEqual(rideRouteKey(ride), rideRouteKey(moved));
  assert.notEqual(rideRouteKey(ride), rideRouteKey(reversed));
  assert.notEqual(rideRouteKey(ride), rideRouteKey({ ...ride, itinerary: null }));
});

test("directions retain the saved start, all places and the return home", () => {
  const url = new URL(rideMaps(normalizeLoop(loop)));
  assert.equal(url.searchParams.get("origin"), "13.04,77.59");
  assert.equal(url.searchParams.get("destination"), "13.04,77.59");
  assert.equal(url.searchParams.get("waypoints"), "11.77,78.2|11.79,77.8");
});

test("itinerary validation rejects missing legs and invalid coordinates", () => {
  const trip = normalizeLoop(loop).itinerary!;
  assert.deepEqual(validateItinerary(trip), trip);
  assert.equal(validateItinerary({ ...trip, legs: trip.legs.slice(1) }), null);
  assert.equal(validateItinerary({ ...trip, stops: [{ ...trip.stops[0], lat: 90 }] }), null);
  assert.equal(validateItinerary({ ...trip, legs: [null, ...trip.legs.slice(1)] }), null);
});

test("route signatures protect the entire itinerary, including nights and start", () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "ride-unification-test-only-secret";
  try {
    const ride = normalizeLoop(loop);
    const signature = sealRoute(ride);
    assert.equal(routeSealOk(ride, signature), true);
    for (const trip of [
      { ...ride.itinerary!, stops: [...ride.itinerary!.stops].reverse() },
      { ...ride.itinerary!, start: { ...ride.itinerary!.start, lat: 13.1 } },
      { ...ride.itinerary!, stops: ride.itinerary!.stops.map(s => ({ ...s, nightHere: false })) },
    ] satisfies Itinerary[]) assert.equal(routeSealOk({ ...ride, itinerary: trip }, signature), false);
    const { itinerary: _, ...single } = ride;
    void _;
    assert.equal(routeSealOk({ ...single, itinerary: null }, sealRoute(single)), true);
  } finally { if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous; }
});

test("saving ride details retains reports independently of planning status", () => {
  const ride = normalizeLoop(loop);
  const valid = validateDestination({ ...ride, rideReport: "Keep the original report", status: "planned" });
  assert.ok(valid);
  assert.equal(valid.rideReport, "Keep the original report");
  assert.deepEqual(valid.itinerary, ride.itinerary);
});

test("editing an existing loop does not truncate its previously supported 80-character name", () => {
  const name = "A".repeat(80);
  assert.equal(validateDestination({ ...normalizeLoop(loop), name })?.name, name);
});

test("adding and reordering itinerary places preserves the anchor, but removing it updates the anchor", () => {
  const ride = normalizeLoop(loop);
  assert.equal(rideAnchor(ride, [...loop.stops].reverse()), ride);
  assert.deepEqual(rideAnchor(ride, [loop.stops[1]]), loop.stops[1]);
  assert.deepEqual(rideAnchor(null, loop.stops), loop.stops[0]);
});
