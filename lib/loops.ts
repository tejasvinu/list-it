import type { LoopLeg, LoopStop, StartPoint } from "./types";

export type LoopDay = {
  names: string[];
  km: number;
  min: number;
  approx: boolean;
  night: LoopStop | null;
  firstLeg: number;
  lastLeg: number;
};

/** A night ends the day at that stop; the final leg always returns home. */
export function loopDays(start: StartPoint, stops: LoopStop[], legs: LoopLeg[]): LoopDay[] {
  if (!stops.length || legs.length !== stops.length + 1) return [];
  const days: LoopDay[] = [];
  let names = [start.name];
  let firstLeg = 0;
  let km = 0;
  let min = 0;
  let approx = false;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const stop = stops[i];
    names.push(stop?.name ?? start.name);
    km += leg.km;
    min += leg.min;
    approx ||= leg.approx;
    if (stop?.nightHere || i === legs.length - 1) {
      days.push({ names, km, min, approx, night: stop?.nightHere ? stop : null, firstLeg, lastLeg: i });
      names = [stop?.name ?? start.name];
      firstLeg = i + 1;
      km = 0;
      min = 0;
      approx = false;
    }
  }
  return days;
}

export function loopDate(start: string, day: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day);
  return date.toISOString().slice(0, 10);
}

type Point = { lat: number; lng: number };

function kmApart(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** A route's first or last stop this close to the loop's start is just home ("Bengaluru" for a rider in Hebbal). */
const HOME_KM = 25;
/** An imported stop this close to a crew ride becomes that ride. */
const RIDE_KM = 1.5;

/** Turns the places of an imported Maps route into loop stops. */
export function importStops(
  places: (Point & { name: string })[],
  start: StartPoint,
  rides: (Point & { id: string; name: string })[],
) {
  const dropped: string[] = [];
  const kept = places.filter((p, i) => {
    const end = i === 0 || i === places.length - 1;
    if (end && kmApart(p, start) <= HOME_KM) {
      dropped.push(p.name);
      return false;
    }
    return true;
  });
  const stops = kept.map((p): LoopStop => {
    const ride = rides
      .map((r) => ({ r, km: kmApart(p, r) }))
      .filter((x) => x.km <= RIDE_KM)
      .sort((a, b) => a.km - b.km)[0]?.r;
    return ride
      ? { destinationId: ride.id, name: ride.name, lat: ride.lat, lng: ride.lng, nightHere: false }
      : { destinationId: null, name: p.name, lat: p.lat, lng: p.lng, nightHere: false };
  });
  return { stops, dropped };
}
