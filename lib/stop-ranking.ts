import type { SuggestedStop } from "./db";

type Point = [number, number];
export type RouteSample = { lat: number; lng: number; km: number };

function distance(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const x = (b[1] - a[1]) * rad * Math.cos(((a[0] + b[0]) * rad) / 2);
  const y = (b[0] - a[0]) * rad;
  return Math.hypot(x, y) * 6371;
}

/** Interpolate along the polyline rather than relying on its simplified vertices. */
export function sampleRoute(route: Point[], step = 2): RouteSample[] {
  if (!route.length || step <= 0) return [];
  const samples: RouteSample[] = [{ lat: route[0][0], lng: route[0][1], km: 0 }];
  let travelled = 0;
  let next = step;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const length = distance(a, b);
    while (length > 0 && next <= travelled + length) {
      const t = (next - travelled) / length;
      samples.push({ lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t, km: next });
      next += step;
    }
    travelled += length;
  }
  return samples;
}

export function rankStops(stops: SuggestedStop[], outboundKm: number): SuggestedStop[] {
  const result: SuggestedStop[] = [];
  for (const kind of ["breakfast", "viewpoint", "fuel", "photo"]) {
    const seen = new Set<string>();
    const candidates = stops
      .filter((stop) => stop.kind === kind)
      .sort((a, b) => a.km - b.km)
      .filter((stop) => {
        const key = `${stop.name.toLowerCase()}|${stop.lat.toFixed(3)}|${stop.lng.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const chosen: SuggestedStop[] = [];
    if (kind === "breakfast") {
      const breakfast = candidates.find((stop) => stop.km >= 30 && stop.km <= Math.min(120, outboundKm));
      if (breakfast) chosen.push(breakfast);
    }
    while (chosen.length < 8 && chosen.length < candidates.length) {
      const remaining = candidates.filter((stop) => !chosen.includes(stop));
      const pick =
        chosen.length === 0
          ? remaining[0]
          : remaining.reduce((best, stop) => {
              const gap = Math.min(...chosen.map((item) => Math.abs(item.km - stop.km)));
              const bestGap = Math.min(...chosen.map((item) => Math.abs(item.km - best.km)));
              return gap > bestGap ? stop : best;
            });
      chosen.push(pick);
    }
    chosen.sort((a, b) => {
      if (kind === "breakfast") {
        const preferred = (stop: SuggestedStop) => stop.km >= 30 && stop.km <= Math.min(120, outboundKm);
        if (preferred(a) !== preferred(b)) return preferred(a) ? -1 : 1;
      }
      return a.km - b.km;
    });
    result.push(...chosen);
  }
  return result;
}

/** Build a bounded query for the outbound leg only. */
export function buildStopQuery(route: Point[], destination: { lat: number; lng: number }) {
  if (!route.length) return { query: "", samples: [] as RouteSample[] };
  let end = 0;
  let closest = Infinity;
  route.forEach((point, index) => {
    const dist = distance(point, [destination.lat, destination.lng]);
    if (dist < closest) {
      closest = dist;
      end = index;
    }
  });
  const outbound = route.slice(0, end + 1);
  const length = outbound.reduce((sum, point, i) => i ? sum + distance(outbound[i - 1], point) : 0, 0);
  const samples = sampleRoute(outbound, Math.max(5, length / 39 + 0.001));
  const around = samples.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join(",");
  const query = [
    "[out:json][timeout:20];",
    `node(around:400,${around})->.near;`,
    "(node.near[\"name\"][\"amenity\"~\"^(restaurant|cafe|fast_food|fuel)$\"];",
    "node.near[\"tourism\"~\"^(viewpoint|attraction)$\"];",
    "node.near[\"natural\"=\"peak\"];",
    "node.near[\"waterway\"=\"waterfall\"];",
    "node.near[\"historic\"];);out body qt;",
  ].join("");
  return { query, samples };
}
