import { notFound, redirect } from "next/navigation";
import { getDestination, getGroupContext } from "@/lib/data";
import { cols } from "@/lib/db";
import { HOME, type Category } from "@/lib/config";
import { sealRoute } from "@/lib/seal";
import { readRide } from "@/lib/ride-store";
import { rideHref, rideRef } from "@/lib/ride-model";
import type { LoopStop } from "@/lib/types";
import { previewRideItinerary } from "@/app/g/[slug]/itinerary-actions";
import { DestinationForm } from "./destination-form";

async function selectedPlace(groupId: string, key: unknown, index: unknown): Promise<LoopStop | undefined> {
  if (typeof key !== "string" || !rideRef(key)) return;
  const source = await readRide(groupId, key);
  if (!source) return;
  if (source.itinerary) {
    if (typeof index !== "string" || !/^\d+$/.test(index)) return;
    const stop = source.itinerary.stops[Number(index)];
    if (!stop) return;
    const linked = stop.destinationId ? await readRide(groupId, stop.destinationId) : null;
    return { ...stop, destinationId: linked && linked.lat === stop.lat && linked.lng === stop.lng ? stop.destinationId : null, nightHere: false };
  }
  return { destinationId: source.id, name: source.name, lat: source.lat, lng: source.lng, nightHere: false };
}

export async function RideEditorPage({ slug, editKey, query }: { slug: string; editKey?: string; query: Record<string, string | string[] | undefined> }) {
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const allowNewItineraries = process.env.DISABLE_NEW_ITINERARIES !== "1";
  const c = await cols();
  const rows = await c.destinations.find({ groupId: ctx.group.id, deletedAt: null, itinerary: null }, { projection: { name: 1, area: 1, lat: 1, lng: 1 } }).toArray();
  const rides = rows.map(row => ({ id: row._id, name: row.name, area: row.area, lat: row.lat, lng: row.lng }));
  const appendStop = await selectedPlace(ctx.group.id, query.add, query.place);
  if (editKey) {
    const d = await getDestination(ctx, editKey);
    if (!d) notFound();
    if (!d.canEdit) redirect(rideHref(slug, editKey));
    const liveIds = d.itinerary ? new Set((await c.destinations.find({ groupId: ctx.group.id, deletedAt: null, _id: { $in: d.itinerary.stops.flatMap(s => s.destinationId ? [s.destinationId] : []) } }, { projection: { _id: 1 } }).toArray()).map(row => row._id)) : new Set<string>();
    const itinerary = d.itinerary ? { ...d.itinerary, stops: d.itinerary.stops.map(stop => stop.destinationId && !liveIds.has(stop.destinationId) ? { ...stop, destinationId: null } : stop) } : null;
    const routed = { lat: d.lat, lng: d.lng, mapsUrl: d.mapsUrl, distanceKm: d.distanceKm, durationMin: d.durationMin, approx: d.approx, route: d.route, roadSplit: d.roadSplit, itinerary };
    return <DestinationForm allowNewItineraries={allowNewItineraries} slug={slug} editId={editKey} hasRidden={d.iRode} backToRide={query.from === "ride"} rides={rides} start={itinerary?.start ?? ctx.viewer.start ?? HOME} appendStop={allowNewItineraries || itinerary ? appendStop : undefined} initial={{
      name: d.name, expectedUpdatedAt: d.updatedAt.toISOString(),
      preview: { ...routed, name: d.name, area: d.area, photos: d.photos, photosFailed: false, nearby: [], suggested: d.category as Category, seal: sealRoute(routed) },
      details: { category: d.category as Category, tags: d.tags, seasons: d.seasons, hairpins: d.hairpins, notes: d.notes ?? "", status: d.status, statusDate: d.statusDate, rideReport: d.rideReport ?? "" },
    }} />;
  }
  const seed = await selectedPlace(ctx.group.id, query.ride, query.place);
  if (seed) {
    const result = await previewRideItinerary(slug, [seed]);
    if (result.ok) return <DestinationForm allowNewItineraries={allowNewItineraries} slug={slug} rides={rides} start={ctx.viewer.start ?? HOME} initial={{ name: seed.name, preview: result.preview, details: {
      category: result.preview.suggested, tags: [], seasons: [], hairpins: null, notes: "", status: "wishlist", statusDate: null, rideReport: "",
    } }} />;
  }
  return <DestinationForm allowNewItineraries={allowNewItineraries} slug={slug} rides={rides} start={ctx.viewer.start ?? HOME} />;
}
