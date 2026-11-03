import type { Destination } from "./db";
import type { Loop, LoopStop } from "./types";
import { loopDate, loopDays } from "./loops";
import { googleMapsRoute } from "./format";

export type RideRef = { source: "destination" | "loop"; id: string };
const ID = /^[A-Za-z0-9_-]{1,80}$/;

/** A colon cannot occur in generated IDs. Loop relationships occupy a separate namespace. */
export function rideRef(key: unknown): RideRef | null {
  if (typeof key !== "string") return null;
  if (key.startsWith("loop:")) return ID.test(key.slice(5)) ? { source: "loop", id: key.slice(5) } : null;
  return ID.test(key) ? { source: "destination", id: key } : null;
}
export const loopKey = (id: string) => `loop:${id}`;
/** Adding/reordering places retains the anchor; explicitly removing it selects the first remaining place. */
export function rideAnchor(previous: Pick<Destination, "lat" | "lng"> | null, stops: LoopStop[]) {
  return previous && stops.some(stop => stop.lat === previous.lat && stop.lng === previous.lng) ? previous : stops[0];
}
export function rideHref(slug: string, key: string) {
  const ref = rideRef(key);
  if (!ref) throw new Error("Invalid ride reference");
  return `/g/${slug}/${ref.source === "loop" ? "loops" : "d"}/${ref.id}`;
}

export function normalizeLoop(loop: Loop): Destination {
  const anchor = loop.stops[0] ?? loop.start;
  const days = loopDays(loop.start, loop.stops, loop.legs).length;
  return {
    id: loopKey(loop.id), groupId: loop.groupId, riderId: loop.riderId,
    name: loop.name, notes: loop.notes, lat: anchor.lat, lng: anchor.lng,
    area: null, mapsUrl: null, distanceKm: loop.totalKm, durationMin: loop.totalMin,
    approx: loop.legs.some(leg => leg.approx), route: loop.route,
    itinerary: { version: 1, start: loop.start, stops: loop.stops, legs: loop.legs },
    category: loop.category ?? (days > 1 ? "multi" : loop.totalKm <= 300 ? "short" : "day"),
    tags: loop.tags ?? [], seasons: loop.seasons ?? [], roadSplit: loop.roadSplit ?? null,
    photos: loop.photos ?? [], hairpins: loop.hairpins ?? null, rideReport: loop.rideReport ?? null,
    status: loop.status ?? (loop.startDate ? "planned" : "wishlist"), statusDate: loop.startDate,
    createdAt: loop.createdAt, updatedAt: loop.updatedAt, deletedAt: loop.deletedAt,
  };
}

export function rideDays(ride: Pick<Destination, "itinerary">) {
  const trip = ride.itinerary;
  return trip ? Math.max(1, loopDays(trip.start, trip.stops, trip.legs).length) : 1;
}
export function rideEndDate(ride: Pick<Destination, "itinerary" | "statusDate">) {
  return ride.statusDate ? loopDate(ride.statusDate, rideDays(ride) - 1) : null;
}
export function overlapsDates(ride: Pick<Destination, "itinerary" | "statusDate" | "status">, dates: string[]) {
  if (ride.status !== "planned" || !ride.statusDate) return false;
  const end = rideEndDate(ride)!;
  return dates.some(date => date >= ride.statusDate! && date <= end);
}
export function rideRouteKey(ride: Pick<Destination, "lat" | "lng" | "itinerary">) {
  return JSON.stringify([ride.lat, ride.lng, ride.itinerary?.stops.map(stop => [stop.lat, stop.lng]) ?? null]);
}
export function rideMaps(ride: Pick<Destination, "lat" | "lng" | "itinerary">) {
  if (!ride.itinerary) return googleMapsRoute(ride.lat, ride.lng);
  const { start, stops } = ride.itinerary;
  const point = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1"); url.searchParams.set("origin", point(start));
  url.searchParams.set("destination", point(start));
  url.searchParams.set("waypoints", stops.map(point).join("|"));
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}
