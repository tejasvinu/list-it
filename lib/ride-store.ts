import "server-only";
import { cols, fromDoc, type Destination, type Loop } from "./db";
import { normalizeLoop, rideRef } from "./ride-model";
import type { Itinerary } from "./types";

/** A route signature is not permission to reference a place in another crew. */
export async function validRidePlaces(groupId: string, trip: Itinerary | null | undefined, previous?: Itinerary | null) {
  if (!trip) return true;
  const ids = trip.stops.flatMap(stop => stop.destinationId ? [stop.destinationId] : []);
  if (!ids.length) return true;
  const live = await (await cols()).destinations.find({ _id: { $in: ids }, groupId, deletedAt: null }, { projection: { _id: 1 } }).toArray();
  const allowed = new Set(live.map(row => row._id));
  return trip.stops.every(stop => !stop.destinationId || allowed.has(stop.destinationId) || previous?.stops.some(old => old.destinationId === stop.destinationId && old.lat === stop.lat && old.lng === stop.lng));
}

/** Explicit source dispatch: never look up a bare ID in the other collection. */
export async function readRide(groupId: string, key: string): Promise<Destination | null> {
  const ref = rideRef(key);
  if (!ref) return null;
  const c = await cols();
  const filter = { _id: ref.id, groupId, deletedAt: null };
  if (ref.source === "destination") return fromDoc<Destination>(await c.destinations.findOne(filter));
  const loop = fromDoc<Loop>(await c.loops.findOne(filter));
  return loop ? normalizeLoop(loop) : null;
}

export async function writeRide(groupId: string, key: string, changes: Partial<Destination>, expected?: Date) {
  const ref = rideRef(key);
  if (!ref) throw new Error("Ride not found");
  const c = await cols();
  const filter = { _id: ref.id, groupId, deletedAt: null, ...(expected ? { updatedAt: expected } : {}) };
  if (ref.source === "destination") return c.destinations.updateOne(filter, { $set: changes });
  const { distanceKm, durationMin, itinerary, statusDate, ...fields } = changes;
  // Only persisted loop fields; synthetic IDs and destination anchors never reach MongoDB.
  const allowed = ["name", "notes", "category", "tags", "seasons", "roadSplit", "photos", "hairpins", "rideReport", "status", "route", "updatedAt", "deletedAt"] as const;
  const update: Record<string, unknown> = {};
  for (const name of allowed) if (name in fields) update[name] = fields[name];
  if (distanceKm !== undefined) update.totalKm = distanceKm;
  if (durationMin !== undefined) update.totalMin = durationMin;
  if (statusDate !== undefined) update.startDate = statusDate;
  if (itinerary) Object.assign(update, { start: itinerary.start, stops: itinerary.stops, legs: itinerary.legs });
  return c.loops.updateOne(filter, { $set: update });
}
