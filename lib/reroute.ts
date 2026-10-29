import "server-only";
import { cols, type Destination } from "./db";
import { routeFromHome } from "./geo";

/** Keep manually entered hairpins and never replace a route with an OSRM fallback. */
export async function refreshRoute(row: Omit<Destination, "id"> & { _id: string }) {
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
