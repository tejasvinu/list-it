import "server-only";
import { cols, type Destination, type SuggestedStop } from "./db";
import { UA } from "./geo";
import { sampleRoute, rankStops } from "./stop-ranking";

export async function suggestStops(destination: Destination): Promise<SuggestedStop[] | null> {
  const c = await cols();
  const routeKey = JSON.stringify([destination.lat, destination.lng, destination.route]);
  const cached = await c.stopSuggestions.findOne({ destinationId: destination.id });
  if (cached && cached.routeKey === routeKey && Date.now() - cached.updatedAt.getTime() < 7 * 86400000)
    return cached.stops;
  const samples = sampleRoute(destination.route ?? []);
  if (!samples.length) return [];
  const nearestDest = samples.reduce((best, sample) => {
    const dist = (sample.lat - destination.lat) ** 2 + (sample.lng - destination.lng) ** 2;
    const bestDist = (best.lat - destination.lat) ** 2 + (best.lng - destination.lng) ** 2;
    return dist < bestDist ? sample : best;
  });
  const around = samples.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join(",");
  const query = [
    "[out:json][timeout:23];(",
    `node(around:400,${around})["name"]["amenity"~"^(restaurant|cafe|fast_food|fuel)$"];`,
    `node(around:400,${around})["tourism"~"^(viewpoint|attraction)$"];`,
    `node(around:400,${around})["natural"="peak"];`,
    `node(around:400,${around})["waterway"="waterfall"];`,
    `node(around:400,${around})["historic"];`,
    ");out body;",
  ].join("");
  type Element = { id: number; lat: number; lon: number; tags?: Record<string, string> };
  for (const host of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const response = await fetch(host, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(25000),
        cache: "no-store",
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { elements: Element[] };
      const stops: SuggestedStop[] = [];
      for (const item of data.elements ?? []) {
        if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) continue;
        const tags = item.tags ?? {};
        const kind =
          tags.amenity === "fuel"
            ? "fuel"
            : tags.amenity
              ? "breakfast"
              : tags.tourism === "viewpoint"
                ? "viewpoint"
                : "photo";
        const name = (tags.name ?? (kind === "viewpoint" ? "Viewpoint" : kind === "photo" ? "Photo spot" : ""))
          .trim()
          .slice(0, 60);
        if (!name) continue;
        const nearest = samples.reduce((best, sample) => {
          const d =
            (sample.lat - item.lat) ** 2 + ((sample.lng - item.lon) * Math.cos((item.lat * Math.PI) / 180)) ** 2;
          const b = (best.lat - item.lat) ** 2 + ((best.lng - item.lon) * Math.cos((item.lat * Math.PI) / 180)) ** 2;
          return d < b ? sample : best;
        });
        stops.push({ id: String(item.id), kind, name, lat: item.lat, lng: item.lon, km: Math.round(nearest.km) });
      }
      const ranked = rankStops(stops, nearestDest.km);
      await c.stopSuggestions.updateOne(
        { destinationId: destination.id },
        { $set: { routeKey, stops: ranked, updatedAt: new Date() } },
        { upsert: true },
      );
      return ranked;
    } catch {
      // Try the mirror; a missing service never prevents the ride from loading.
    }
  }
  return null;
}
