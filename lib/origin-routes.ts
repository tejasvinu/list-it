import "server-only";
import { cols } from "./db";
import { kmBetween } from "./geo";
import type { StartPoint } from "./types";

const UA = "list-it/1.0 (https://list-it-kappa.vercel.app; private ride planner for a riding group)";
export const originKey = (start: StartPoint) => ({ lat: Number(start.lat.toFixed(3)), lng: Number(start.lng.toFixed(3)) });
export async function originRoute(destination: { id: string; lat: number; lng: number }, start: StartPoint) {
  const c = await cols();
  const key = { destinationId: destination.id, ...originKey(start) };
  const cached = await c.originRoutes.findOne(key);
  if (cached && cached.destinationLat === destination.lat && cached.destinationLng === destination.lng && (!cached.approx || Date.now() - cached.updatedAt.getTime() < 3600000)) return cached;
  let distanceKm: number, durationMin: number, approx = false;
  try {
    const coords = `${start.lng},${start.lat};${destination.lng},${destination.lat};${start.lng},${start.lat}`;
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!res.ok) throw new Error("Routing unavailable");
    const json = await res.json() as { code: string; routes?: { distance: number; duration: number }[] };
    const route = json.routes?.[0];
    if (json.code !== "Ok" || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) throw new Error("No route");
    distanceKm = Math.round(route.distance / 1000); durationMin = Math.round(route.duration / 60);
  } catch {
    distanceKm = Math.round(kmBetween(start, destination) * 2);
    durationMin = Math.round(distanceKm / 50 * 60); approx = true;
  }
  const value = { ...key, distanceKm, durationMin, approx, destinationLat: destination.lat, destinationLng: destination.lng, updatedAt: new Date() };
  await c.originRoutes.updateOne(key, { $set: value }, { upsert: true });
  return value;
}
