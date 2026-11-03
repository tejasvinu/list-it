import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cols } from "@/lib/db";
import { getDestination, getGroupContext, lite } from "@/lib/data";
import { originRoute } from "@/lib/origin-routes";
import { forecast } from "@/lib/weather";
import { loopDate, loopDays } from "@/lib/loops";
import { daysUntil, duration, km } from "@/lib/format";
import { loopKey } from "@/lib/ride-model";
import { WeatherBlock } from "./weather-block";
import { DestinationView } from "./destination-view";

export async function RideDetailPage({ slug, rideKey }: { slug: string; rideKey: string }) {
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const c = await cols();
  const [d, ownDestinations, ownLoops] = await Promise.all([
    getDestination(ctx, rideKey),
    c.destinations.find({ groupId: ctx.group.id, riderId: ctx.viewer.id, deletedAt: null }, { projection: { name: 1 } }).toArray(),
    c.loops.find({ groupId: ctx.group.id, riderId: ctx.viewer.id, deletedAt: null }, { projection: { name: 1 } }).toArray(),
  ]);
  if (!d) notFound();
  const places = d.itinerary?.stops.flatMap(stop => stop.destinationId ? [stop.destinationId] : []) ?? [];
  const live = places.length ? await c.destinations.find({ _id: { $in: places }, groupId: ctx.group.id, deletedAt: null }, { projection: { _id: 1 } }).toArray() : [];
  const days = d.itinerary ? loopDays(d.itinerary.start, d.itinerary.stops, d.itinerary.legs) : [];
  const origin = ctx.viewer.start ? originRoute(d, ctx.viewer.start).catch(() => null) : Promise.resolve(null);
  const nightWeather = days.map((day, index) => {
    if (!day.night || !d.statusDate) return null;
    const date = loopDate(d.statusDate, index);
    if (daysUntil(date) < 0 || daysUntil(date) >= 16) return null;
    return <Suspense key={index} fallback={<p className="mt-2 text-muted">Loading forecast…</p>}><NightForecast weather={forecast(day.night).catch(() => null)} date={date} /></Suspense>;
  });
  return <DestinationView d={d} slug={slug} me={lite(ctx.viewer)} riders={ctx.riders}
    originSlot={<Suspense fallback={null}><OriginFact origin={origin} name={ctx.viewer.start?.name} /></Suspense>}
    weatherSlot={days.length > 1 ? null : <Suspense fallback={<p className="mt-6 text-muted">Loading forecast…</p>}><Forecast d={d} /></Suspense>}
    itineraryWeather={nightWeather} livePlaceIds={live.map(row => row._id)}
    loops={[...ownDestinations.map(row => ({ id: row._id, name: row.name })), ...ownLoops.map(row => ({ id: loopKey(row._id), name: row.name }))].filter(row => row.id !== d.id)}
  />;
}

async function OriginFact({ origin, name }: { origin: Promise<Awaited<ReturnType<typeof originRoute>> | null>; name?: string }) {
  const route = await origin;
  return route && name ? <p className="num mt-2 text-[15px] text-muted">From {name}: {route.approx ? "about " : ""}{km(route.distanceKm)} round trip, {duration(route.durationMin)}</p> : null;
}
async function Forecast({ d }: { d: NonNullable<Awaited<ReturnType<typeof getDestination>>> }) {
  return <WeatherBlock d={d} weather={await forecast(d).catch(() => null)} />;
}
async function NightForecast({ weather, date }: { weather: ReturnType<typeof forecast>; date: string }) {
  const day = (await weather)?.find(item => item.date === date);
  return <p className="num mt-2 text-[14px] text-muted">{day ? `${Math.round(day.max)}° / ${Math.round(day.min)}° · ${day.rainChance}% rain · wind ${day.wind} km/h` : "Forecast unavailable."}</p>;
}
