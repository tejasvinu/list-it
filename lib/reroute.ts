import "server-only";
import { cols, type Destination, type Loop } from "./db";
import { routeFromHome } from "./geo";
import { routeLoop } from "./loop-routing";
import { loopKey } from "./ride-model";

/** Keep manually entered hairpins and never replace a route with an OSRM fallback. */
export async function refreshRoute(row: Omit<Destination, "id"> & { _id: string }) {
  if (row.itinerary) {
    const routed = await routeLoop(row.itinerary.start, row.itinerary.stops);
    if (routed.legs.some(leg => leg.approx)) return false;
    const c = await cols();
    const result = await c.destinations.updateOne({ _id: row._id, groupId: row.groupId, deletedAt: null, updatedAt: row.updatedAt }, { $set: {
      itinerary: { ...row.itinerary, legs: routed.legs }, route: routed.route, distanceKm: routed.totalKm,
      durationMin: routed.totalMin, approx: false, roadSplit: null, updatedAt: new Date(),
    } });
    if (result.modifiedCount) await c.stopSuggestions.deleteOne({ destinationId: row._id });
    return result.modifiedCount === 1;
  }
  const routed = await routeFromHome(row);
  if (routed.approx) return false;
  const c = await cols();
  const result = await c.destinations.updateOne(
    { _id: row._id, groupId: row.groupId, deletedAt: null, lat: row.lat, lng: row.lng, updatedAt: row.updatedAt },
    { $set: { distanceKm: routed.distanceKm, durationMin: routed.durationMin, approx: false, route: routed.route, roadSplit: routed.roadSplit, updatedAt: new Date() } },
  );
  if (result.modifiedCount) await c.stopSuggestions.deleteOne({ destinationId: row._id });
  return result.modifiedCount === 1;
}

/** The same refresh for a legacy loop, which lives in its own collection. */
export async function refreshLoop(loop: Omit<Loop, "id"> & { _id: string }) {
  const routed = await routeLoop(loop.start, loop.stops);
  if (routed.legs.some((leg) => leg.approx)) return false;
  const c = await cols();
  const result = await c.loops.updateOne(
    { _id: loop._id, groupId: loop.groupId, deletedAt: null, updatedAt: loop.updatedAt },
    {
      $set: {
        legs: routed.legs,
        route: routed.route,
        totalKm: routed.totalKm,
        totalMin: routed.totalMin,
        updatedAt: new Date(),
      },
    },
  );
  if (result.modifiedCount) await c.stopSuggestions.deleteOne({ destinationId: loopKey(loop._id) });
  return result.modifiedCount === 1;
}
