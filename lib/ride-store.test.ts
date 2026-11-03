import { test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { readRide, writeRide, validRidePlaces } from "./ride-store";
import type { Itinerary } from "./types";

test("storage dispatch stays crew-scoped and never converts an existing parent", async () => {
  const requests: { collection: string; method: string; filter: object; update?: object }[] = [];
  const original = (globalThis as { mongo?: Promise<Db> }).mongo;
  const fake = { collection: (name: string) => ({
    findOne: async (filter: object) => { requests.push({ collection: name, method: "findOne", filter }); return null; },
    updateOne: async (filter: object, update: object) => { requests.push({ collection: name, method: "updateOne", filter, update }); return { matchedCount: 1 }; },
    find: (filter: object) => ({ toArray: async () => { requests.push({ collection: name, method: "find", filter }); return []; } }),
  }) };
  (globalThis as { mongo?: Promise<Db> }).mongo = Promise.resolve(fake as unknown as Db);
  try {
    assert.equal(await readRide("crew1", "loop:sameID"), null);
    assert.deepEqual(requests.pop(), { collection: "loops", method: "findOne", filter: { _id: "sameID", groupId: "crew1", deletedAt: null } });
    assert.equal(await readRide("crew1", "sameID"), null);
    assert.equal(requests.pop()?.collection, "destinations");
    assert.equal(await readRide("crew1", "loop:"), null);
    assert.equal(requests.length, 0);
    const revision = new Date("2026-11-01");
    await writeRide("crew1", "loop:sameID", { notes: "Edited note", statusDate: "2026-11-09" }, revision);
    assert.deepEqual(requests.pop(), { collection: "loops", method: "updateOne", filter: { _id: "sameID", groupId: "crew1", deletedAt: null, updatedAt: revision }, update: { $set: { notes: "Edited note", startDate: "2026-11-09" } } });
    await writeRide("crew1", "sameID", { notes: "Destination note" }, revision);
    assert.deepEqual(requests.pop()?.update, { $set: { notes: "Destination note" } });
    const trip: Itinerary = { version: 1, start: { name: "Home", lat: 13, lng: 77 }, stops: [{ destinationId: "otherCrewPlace", name: "Place", lat: 12, lng: 78, nightHere: false }], legs: [] };
    assert.equal(await validRidePlaces("crew1", trip), false);
    assert.deepEqual(requests.pop()?.filter, { _id: { $in: ["otherCrewPlace"] }, groupId: "crew1", deletedAt: null });
    assert.equal(await validRidePlaces("crew1", trip, trip), true);
    assert.equal(await validRidePlaces("crew1", { ...trip, stops: [{ ...trip.stops[0], lat: 11 }] }, trip), false);
  } finally { (globalThis as { mongo?: Promise<Db> }).mongo = original; }
});
