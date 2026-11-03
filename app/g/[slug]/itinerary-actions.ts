"use server";

import { getGroupContext } from "@/lib/data";
import { cols } from "@/lib/db";
import { HOME } from "@/lib/config";
import { validateLoop } from "@/lib/validate";
import { readRide } from "@/lib/ride-store";
import { rideAnchor } from "@/lib/ride-model";
import { routeLoop } from "@/lib/loop-routing";
import { loopDays } from "@/lib/loops";
import { sealRoute } from "@/lib/seal";
import type { Preview } from "./actions";

export async function previewRideItinerary(slug: string, stops: unknown, editKey?: string): Promise<{ ok: true; preview: Preview } | { ok: false; error: string }> {
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return { ok: false, error: "Sign in first." };
  const checked = validateLoop({ name: "Ride", stops, startDate: null });
  if (!checked) return { ok: false, error: "Add between 1 and 20 valid places." };
  const old = editKey ? await readRide(ctx.group.id, editKey) : null;
  if (editKey && (!old || (old.riderId !== ctx.viewer.id && (editKey.startsWith("loop:") || ctx.riders.some(r => r.id === old.riderId))))) return { ok: false, error: "You cannot edit this ride." };
  if (process.env.DISABLE_NEW_ITINERARIES === "1" && !old?.itinerary) return { ok: false, error: "New itineraries are temporarily unavailable. Existing rides can still be edited." };
  const c = await cols();
  const linked = await c.destinations.find({ _id: { $in: checked.stops.flatMap(s => s.destinationId ? [s.destinationId] : []) }, groupId: ctx.group.id, deletedAt: null }).toArray();
  for (const stop of checked.stops) {
    if (!stop.destinationId) continue;
    const saved = linked.find(d => d._id === stop.destinationId);
    const snapshot = old?.itinerary?.stops.some(s => s.destinationId === stop.destinationId && s.lat === stop.lat && s.lng === stop.lng);
    if (saved) {
      if (!snapshot) Object.assign(stop, { name: saved.name, lat: saved.lat, lng: saved.lng });
      continue;
    }
    if (!old?.itinerary?.stops.some(s => s.destinationId === stop.destinationId && s.lat === stop.lat && s.lng === stop.lng)) return { ok: false, error: "A saved place is no longer available. Remove it and try again." };
    stop.destinationId = null;
  }
  const start = old?.itinerary?.start ?? ctx.viewer.start ?? HOME;
  const sameGeometry = old?.itinerary && JSON.stringify(old.itinerary.stops.map(s => [s.lat, s.lng])) === JSON.stringify(checked.stops.map(s => [s.lat, s.lng]));
  const routed = sameGeometry ? { legs: old.itinerary!.legs, route: old.route, totalKm: old.distanceKm, totalMin: old.durationMin } : await routeLoop(start, checked.stops);
  const itinerary = { version: 1 as const, start, stops: checked.stops, legs: routed.legs };
  const anchor = rideAnchor(old, checked.stops);
  const keepAnchor = old && anchor.lat === old.lat && anchor.lng === old.lng;
  const data = {
    lat: anchor.lat, lng: anchor.lng, mapsUrl: keepAnchor ? old.mapsUrl : null,
    distanceKm: routed.totalKm, durationMin: routed.totalMin, route: routed.route,
    approx: routed.legs.some(leg => leg.approx), roadSplit: sameGeometry ? old.roadSplit : null, itinerary,
  };
  return { ok: true, preview: {
    ...data, name: old?.name ?? checked.stops.map(s => s.name).join(" → ").slice(0, 60),
    area: keepAnchor ? old.area : null, photos: old?.photos ?? [], photosFailed: false, nearby: [],
    suggested: loopDays(start, checked.stops, routed.legs).length > 1 ? "multi" : routed.totalKm <= 300 ? "short" : "day",
    seal: sealRoute(data),
  } };
}
