import { CATEGORY_KEYS, ROAD_TAG_KEYS, SEASON_KEYS, STATUS_KEYS } from "./config";
import { todayYmd } from "./format";
import type { Photo, RoadSplit } from "./types";

// Ride input arrives from the browser as arbitrary JSON, so nothing here trusts a type annotation.

export const clean = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
export const cleanMultiline = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "";

const num = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Roughly India plus its neighbours. Rides start in Bengaluru, so anything outside is a bad pin. */
export function inRange(lat: unknown, lng: unknown) {
  return num(lat) && num(lng) && lat >= 5 && lat <= 37 && lng >= 66 && lng <= 98;
}

/** google.com, google.co.in and the other Google country domains, plus the share-link shorteners. */
export function isGoogleMapsHost(host: string) {
  return /^(?:[a-z0-9-]+\.)*google\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/i.test(host) || /^(?:maps\.app\.)?goo\.gl$|^g\.co$/i.test(host);
}

export function mapsUrlOk(u: unknown): u is string {
  if (typeof u !== "string" || u.length > 600) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && isGoogleMapsHost(url.hostname);
  } catch {
    return false;
  }
}

// Commons serves thumbnails from more than one host (upload., thumb.), so allow any wikimedia.org one.
function fromWikimedia(u: unknown) {
  try {
    const url = new URL(String(u));
    return url.protocol === "https:" && url.hostname.endsWith(".wikimedia.org");
  } catch {
    return false;
  }
}

export function cleanPhotos(v: unknown): Photo[] {
  return list(v)
    .filter((p): p is Photo => !!p && typeof p === "object" && fromWikimedia((p as Photo).thumb) && fromWikimedia((p as Photo).page))
    .slice(0, 6)
    .map((p) => ({
      thumb: p.thumb,
      page: p.page,
      title: clean(p.title, 120),
      credit: p.credit ? clean(p.credit, 60) || null : null,
      license: p.license ? clean(p.license, 30) || null : null,
    }));
}

export function cleanRoadSplit(v: unknown): RoadSplit | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  const ok = (k: string) => num(s[k]) && (s[k] as number) >= 0;
  if (!["city", "nh", "sh", "other"].every(ok)) return null;
  return { city: s.city as number, nh: s.nh as number, sh: s.sh as number, other: s.other as number };
}

export function cleanRoute(v: unknown): [number, number][] | null {
  if (!Array.isArray(v) || v.length < 2 || v.length > 1500) return null;
  if (!v.every((p) => Array.isArray(p) && p.length === 2 && inRange(p[0], p[1]))) return null;
  return v as [number, number][];
}

export type DestinationInput = {
  name: string;
  area: string | null;
  mapsUrl: string | null;
  lat: number;
  lng: number;
  distanceKm: number;
  durationMin: number;
  approx: boolean;
  route: [number, number][];
  roadSplit: RoadSplit | null;
  /** From the preview: proves the route numbers above came from the server */
  seal: string;
  photos: Photo[];
  category: string;
  tags: string[];
  seasons: string[];
  hairpins: number | null;
  notes: string;
  status: string;
  statusDate: string | null;
  rideReport: string;
};

/** Cleans a ride from the form. Returns null when the place itself doesn't hold together. */
export function validateDestination(raw: unknown, now: Date | number = Date.now()) {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<Record<keyof DestinationInput, unknown>>;
  if (!inRange(input.lat, input.lng)) return null;
  const distanceKm = input.distanceKm;
  const durationMin = input.durationMin;
  if (!num(distanceKm) || !num(durationMin) || distanceKm <= 0 || durationMin <= 0) return null;
  const route = cleanRoute(input.route);
  if (!route) return null;
  const name = clean(input.name, 60);
  if (!name) return null;

  const known = new Set<string>(ROAD_TAG_KEYS);
  const tags = [
    ...new Set(
      list(input.tags)
        .map((t) =>
          typeof t === "string" && known.has(t) ? t : clean(t, 24).toLowerCase().replace(/^#/, "").replace(/[^\p{L}\p{N} -]/gu, "").trim(),
        )
        .filter(Boolean),
    ),
  ].slice(0, 12);
  const status = typeof input.status === "string" && STATUS_KEYS.includes(input.status as never) ? input.status : "wishlist";
  const date = typeof input.statusDate === "string" && YMD.test(input.statusDate) ? input.statusDate : null;
  const hairpins = input.hairpins;

  return {
    name,
    area: clean(input.area, 80) || null,
    mapsUrl: mapsUrlOk(input.mapsUrl) ? input.mapsUrl : null,
    lat: input.lat as number,
    lng: input.lng as number,
    distanceKm: Math.round(distanceKm),
    durationMin: Math.round(durationMin),
    approx: input.approx === true,
    route,
    roadSplit: cleanRoadSplit(input.roadSplit),
    photos: cleanPhotos(input.photos),
    category: typeof input.category === "string" && CATEGORY_KEYS.includes(input.category as never) ? input.category : "day",
    tags,
    seasons: [...new Set(list(input.seasons).filter((s): s is string => typeof s === "string" && SEASON_KEYS.includes(s as never)))],
    hairpins: num(hairpins) && hairpins >= 0 ? Math.min(999, Math.round(hairpins)) : null,
    notes: cleanMultiline(input.notes, 2000) || null,
    // "Ridden" in the form means the person saving it has ridden it; that's kept per rider in `rides`.
    status: status === "done" ? "wishlist" : status,
    statusDate: status === "planned" ? date : null,
    rideReport: status === "done" ? cleanMultiline(input.rideReport, 3000) || null : null,
    riddenOn: status === "done" ? (validRideDate(date, now) ? date : todayYmd(now)) : null,
  };
}

export function validRideDate(value: unknown, now: Date | number = Date.now()): value is string {
  if (typeof value !== "string" || !YMD.test(value) || value > todayYmd(now)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validStart(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const name = clean(v.name, 80);
  return name && inRange(v.lat, v.lng) ? { name, lat: v.lat as number, lng: v.lng as number } : null;
}

/** Validate loop inputs independently of any route supplied by the browser. */
export function validateLoop(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const name = clean(v.name, 80);
  if (!name || !Array.isArray(v.stops) || v.stops.length < 1 || v.stops.length > 20) return null;
  const stops = v.stops.map((item: unknown) => {
    if (!item || typeof item !== "object") return null;
    const s = item as Record<string, unknown>;
    const name = clean(s.name, 80);
    if (!name || !inRange(s.lat, s.lng) || typeof s.nightHere !== "boolean") return null;
    if (s.destinationId !== null && (typeof s.destinationId !== "string" || !s.destinationId || s.destinationId.length > 80)) return null;
    return { destinationId: s.destinationId as string | null, name, lat: s.lat as number, lng: s.lng as number, nightHere: s.nightHere };
  });
  if (stops.some((s) => !s)) return null;
  let startDate: string | null = null;
  if (v.startDate !== null && v.startDate !== undefined && v.startDate !== "") {
    if (typeof v.startDate !== "string" || !YMD.test(v.startDate) || v.startDate < "1900-01-01" || v.startDate > "9998-12-31") return null;
    const date = new Date(`${v.startDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v.startDate) return null;
    startDate = v.startDate;
  }
  return { name, notes: cleanMultiline(v.notes, 2000) || null, stops: stops as import("./types").LoopStop[], startDate };
}
