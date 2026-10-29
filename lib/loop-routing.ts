import "server-only";
import { decodePolyline, kmBetween, simplify, UA } from "./geo";
import type { LoopLeg, LoopStop, StartPoint } from "./types";

/** Route every waypoint together so OSRM chooses consistent legs. */
export async function routeLoop(start: StartPoint, stops: LoopStop[]) {
  const points = [start, ...stops, start];
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=true`,
      {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(12000),
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) throw new Error("Routing unavailable");
    const json = (await res.json()) as {
      code: string;
      routes?: { geometry: string; legs: { distance: number; duration: number; steps: { geometry: string }[] }[] }[];
    };
    const result = json.routes?.[0];
    if (json.code !== "Ok" || !result || result.legs.length !== points.length - 1) throw new Error("Invalid route");
    const legs: LoopLeg[] = result.legs.map((leg, i) => {
      const pointsForLeg = leg.steps.flatMap((step) => decodePolyline(step.geometry));
      return {
        km: Math.round(leg.distance / 1000),
        min: Math.round(leg.duration / 60),
        approx: false,
        route:
          pointsForLeg.length >= 2
            ? simplify(pointsForLeg, 0.003)
            : [
                [points[i].lat, points[i].lng],
                [points[i + 1].lat, points[i + 1].lng],
              ],
      };
    });
    let route = simplify(decodePolyline(result.geometry), 0.003);
    if (route.length > 400) route = simplify(route, 0.01);
    return { legs, route, totalKm: legs.reduce((n, l) => n + l.km, 0), totalMin: legs.reduce((n, l) => n + l.min, 0) };
  } catch {
    const legs: LoopLeg[] = points.slice(1).map((point, i) => {
      const km = Math.round(kmBetween(points[i], point) * 1.3);
      return {
        km,
        min: Math.round((km / 50) * 60),
        approx: true,
        route: [
          [points[i].lat, points[i].lng],
          [point.lat, point.lng],
        ],
      };
    });
    return {
      legs,
      route: points.map((p): [number, number] => [p.lat, p.lng]),
      totalKm: legs.reduce((n, l) => n + l.km, 0),
      totalMin: legs.reduce((n, l) => n + l.min, 0),
    };
  }
}
