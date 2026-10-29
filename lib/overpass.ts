import "server-only";
import { cols, type Destination, type SuggestedStop } from "./db";
import { UA } from "./geo";
import { buildStopQuery, rankStops } from "./stop-ranking";

export async function suggestStops(destination: Destination): Promise<SuggestedStop[] | null> {
  const c = await cols();
  const routeKey = JSON.stringify([destination.lat, destination.lng, destination.route]);
  const cached = await c.stopSuggestions.findOne({ destinationId: destination.id });
  if (cached && cached.routeKey === routeKey) {
    const age = Date.now() - cached.updatedAt.getTime();
    if (cached.failed && age < 10 * 60000) return null;
    if (!cached.failed && age < 7 * 86400000) return cached.stops;
  }
  const { query, samples } = buildStopQuery(destination.route ?? [], destination);
  if (!samples.length) return [];
  const outboundKm = samples.at(-1)?.km ?? 0;
  const deadline = Date.now() + 40000;
  type Element = { id: number; lat: number; lon: number; tags?: Record<string, string> };
  for (const host of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const response = await fetch(host, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(Math.min(13000, remaining)),
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
      const ranked = rankStops(stops, outboundKm);
      await c.stopSuggestions.updateOne(
        { destinationId: destination.id },
        { $set: { routeKey, stops: ranked, failed: false, updatedAt: new Date() } },
        { upsert: true },
      );
      return ranked;
    } catch {
      // Try the mirror; a missing service never prevents the ride from loading.
    }
  }
  await c.stopSuggestions.updateOne(
    { destinationId: destination.id },
    { $set: { routeKey, stops: [], failed: true, updatedAt: new Date() } },
    { upsert: true },
  );
  return null;
}
