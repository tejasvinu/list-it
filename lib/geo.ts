import "server-only";
import { HOME, suggestCategory, type Category } from "./config";
import type { Photo, RoadSplit } from "./types";

// Wikimedia and Nominatim want a UA that says who we are and how to reach us.
const UA = "list-it/1.0 (https://list-it-kappa.vercel.app; private ride planner for a riding group)";
const timeout = (ms: number) => AbortSignal.timeout(ms);

export type Place = {
  name: string;
  area: string | null;
  lat: number;
  lng: number;
  mapsUrl: string | null;
};

export type RoutedPlace = Place & {
  distanceKm: number;
  durationMin: number;
  approx: boolean;
  route: [number, number][];
  roadSplit: RoadSplit | null;
  suggested: Category;
};

// ---------- Plus codes (Open Location Code) ----------

const OLC = "23456789CFGHJMPQRVWX";
const PAIR_RES = [20, 1, 0.05, 0.0025, 0.000125];

function olcDecode(code: string) {
  const clean = code.toUpperCase().replace("+", "").replace(/0+$/, "");
  let lat = -90;
  let lng = -180;
  let latRes = 20;
  let lngRes = 20;
  for (let i = 0; i < Math.min(clean.length, 10); i += 2) {
    latRes = PAIR_RES[i / 2];
    lngRes = PAIR_RES[i / 2];
    lat += OLC.indexOf(clean[i]) * latRes;
    if (i + 1 < clean.length) lng += OLC.indexOf(clean[i + 1]) * lngRes;
  }
  for (let i = 10; i < clean.length; i++) {
    latRes /= 5;
    lngRes /= 4;
    const v = OLC.indexOf(clean[i]);
    lat += Math.floor(v / 4) * latRes;
    lng += (v % 4) * lngRes;
  }
  return { lat: lat + latRes / 2, lng: lng + lngRes / 2 };
}

function olcPrefix(lat: number, lng: number, digits: number) {
  let la = lat + 90;
  let ln = lng + 180;
  let out = "";
  for (let i = 0; i < digits / 2; i++) {
    const res = PAIR_RES[i];
    const a = Math.floor(la / res);
    const b = Math.floor(ln / res);
    out += OLC[a] + OLC[b];
    la -= a * res;
    ln -= b * res;
  }
  return out;
}

/** Turns a short code like "26X6+737" into coordinates using a nearby reference point. */
function olcRecover(short: string, refLat: number, refLng: number) {
  const sep = short.indexOf("+");
  if (sep >= 8) return olcDecode(short);
  const padding = 8 - sep;
  const resolution = Math.pow(20, 2 - padding / 2);
  const half = resolution / 2;
  const area = olcDecode(olcPrefix(refLat, refLng, padding) + short);
  let { lat, lng } = area;
  if (refLat + half < lat && lat - resolution >= -90) lat -= resolution;
  else if (refLat - half > lat && lat + resolution <= 90) lat += resolution;
  if (refLng + half < lng) lng -= resolution;
  else if (refLng - half > lng) lng += resolution;
  return { lat, lng };
}

const PLUS_CODE = /^([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3})\s*,?\s*(.*)$/i;

// ---------- Geocoding (Photon / OpenStreetMap) ----------

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
};

function photonArea(p: PhotonFeature["properties"]) {
  const parts = [p.city ?? p.county ?? p.district, p.state].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(", ") : null;
}

async function photon(q: string, limit = 5): Promise<PhotonFeature[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${HOME.lat}&lon=${HOME.lng}&limit=${limit}&lang=en`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: timeout(7000) });
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: PhotonFeature[] };
  // Keep to India, and push streets named after a place ("Nandi Hills Road") below the place itself.
  return (json.features ?? [])
    .filter((f) => !f.properties.countrycode || f.properties.countrycode === "IN")
    .sort((a, b) => Number(a.properties.osm_key === "highway") - Number(b.properties.osm_key === "highway"));
}

async function reverseArea(lat: number, lng: number) {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`, {
      headers: { "User-Agent": UA },
      signal: timeout(6000),
    });
    const json = (await res.json()) as { features?: PhotonFeature[] };
    const f = json.features?.[0];
    return f ? { area: photonArea(f.properties), name: f.properties.name ?? null } : null;
  } catch {
    return null;
  }
}

export async function searchPlaces(q: string): Promise<Place[]> {
  if (q.trim().length < 2) return [];
  const features = await photon(q.trim(), 6);
  const seen = new Set<string>();
  return features
    .map((f) => ({
      name: f.properties.name ?? q,
      area: photonArea(f.properties),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      mapsUrl: null,
    }))
    .filter((p) => {
      const key = `${p.name}|${p.area}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function geocodePostcode(pin: string) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${pin}&countrycodes=in&format=jsonv2&limit=1`,
      { headers: { "User-Agent": UA }, signal: timeout(7000) },
    );
    const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}

/**
 * Geocodes Google's "Name, Locality, State 123456" text. Tries the most specific parts first,
 * then the PIN code, and only falls back to the bare state as a last resort.
 */
async function geocodeText(text: string, { preferPostcode = false } = {}) {
  const pin = text.match(/\b(\d{6})\b/)?.[1];
  const parts = text
    .split(",")
    .map((s) => s.replace(/\b\d{6}\b/, "").trim())
    .filter(Boolean);
  const hitAt = (hit: PhotonFeature) => ({
    lat: hit.geometry.coordinates[1],
    lng: hit.geometry.coordinates[0],
    area: photonArea(hit.properties),
  });
  // Fire every candidate at once, then take the most specific answer.
  const [byPostcode, ...byName] = await Promise.all([
    pin ? geocodePostcode(pin) : Promise.resolve(null),
    ...parts.map((_, i) => photon(parts.slice(i).join(", "), 1).catch(() => [])),
  ]);
  const postcode = byPostcode ? { ...byPostcode, area: null } : null;
  if (preferPostcode && postcode) return postcode;
  for (const [hit] of byName.slice(0, -1)) {
    if (hit && hit.properties.type !== "state") return hitAt(hit);
  }
  if (postcode) return postcode;
  const [last] = byName.at(-1) ?? [];
  return last ? hitAt(last) : null;
}

// ---------- Google Maps links ----------

const COORD = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;

async function expandShortLink(url: string) {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const host = new URL(current).hostname;
    if (!/(^|\.)goo\.gl$|^g\.co$/.test(host)) return current;
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: timeout(7000),
    });
    const next = res.headers.get("location");
    if (!next) return current;
    current = new URL(next, current).toString();
  }
  return current;
}

function decodeSegment(s: string) {
  try {
    return decodeURIComponent(s.replace(/\+/g, " ")).trim();
  } catch {
    return s.replace(/\+/g, " ").trim();
  }
}

/** Pulls out a name and/or coordinates from a long Google Maps URL. */
function parseMapsUrl(raw: string) {
  const url = new URL(raw);
  const path = url.pathname;
  let lat: number | undefined;
  let lng: number | undefined;
  let text: string | undefined;

  // Exact place pin: ...!3d11.77!4d78.20 (take the last one, it's the destination)
  const pins = [...raw.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)];
  if (pins.length) {
    lat = Number(pins.at(-1)![1]);
    lng = Number(pins.at(-1)![2]);
  }

  const place = path.match(/\/maps\/(?:place|search)\/([^/]+)/);
  if (place) text = decodeSegment(place[1]);

  const dir = path.match(/\/maps\/dir\/(.+?)(?:\/@|\/data=|$)/);
  if (dir) {
    const stops = dir[1].split("/").filter(Boolean).map(decodeSegment);
    text = stops.at(-1);
  }

  for (const key of ["q", "query", "destination", "daddr", "ll"]) {
    const v = url.searchParams.get(key);
    if (v && !text) text = v.trim();
  }

  if (lat === undefined && text) {
    const m = text.match(COORD);
    if (m && text.replace(COORD, "").trim().length < 3) {
      lat = Number(m[1]);
      lng = Number(m[2]);
      text = undefined;
    }
  }

  // Viewport centre as a last resort
  if (lat === undefined && !text) {
    const at = path.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) {
      lat = Number(at[1]);
      lng = Number(at[2]);
    }
  }
  return { lat, lng, text };
}

/** Accepts a Google Maps link (short or long), a WhatsApp message containing one, or "lat, lng". */
export async function resolvePlace(input: string): Promise<Place> {
  const trimmed = input.trim();
  const linkMatch = trimmed.match(/https?:\/\/\S+/);

  if (!linkMatch) {
    const m = trimmed.match(COORD);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      const rev = await reverseArea(lat, lng);
      return { name: rev?.name ?? "Dropped pin", area: rev?.area ?? null, lat, lng, mapsUrl: null };
    }
    throw new Error("Paste a Google Maps link, or search by name instead.");
  }

  const original = linkMatch[0];
  const expanded = await expandShortLink(original);
  const host = new URL(expanded).hostname;
  if (!/google\.|goo\.gl/.test(host)) throw new Error("That doesn't look like a Google Maps link.");

  const parsed = parseMapsUrl(expanded);
  let name: string | null = null;
  let area: string | null = null;
  let { lat, lng } = parsed;

  if (parsed.text) {
    let text = parsed.text;
    const plus = text.match(PLUS_CODE);
    if (plus) text = plus[2];
    const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
    name = parts[0] ?? null;
    if (parts.length > 1) {
      area = parts
        .slice(1)
        .map((s) => s.replace(/\b\d{6}\b/, "").trim())
        .filter((s) => s && !/\bR\.?F\.?$/i.test(s))
        .slice(-2)
        .join(", ") || null;
    }

    if (lat === undefined || lng === undefined) {
      // A plus code only needs a reference point within ~50 km, and the PIN code is the safest one.
      const geo = await geocodeText(text, { preferPostcode: !!plus });
      if (plus) {
        if (!geo && plus[1].indexOf("+") < 8) throw new Error("Couldn't place that plus code. Try searching by name.");
        const exact = olcRecover(plus[1], geo?.lat ?? HOME.lat, geo?.lng ?? HOME.lng);
        lat = exact.lat;
        lng = exact.lng;
      } else if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
      area = area ?? geo?.area ?? null;
    }
  }

  if (lat === undefined || lng === undefined) {
    throw new Error("Couldn't find a location in that link. Try searching by name instead.");
  }

  if (!name || !area) {
    const rev = await reverseArea(lat, lng);
    name = name ?? rev?.name ?? "Dropped pin";
    area = area ?? rev?.area ?? null;
  }

  return { name, area, lat, lng, mapsUrl: original };
}

// ---------- Routing (OSRM) ----------

function decodePolyline(str: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    for (const which of [0, 1]) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** Ramer–Douglas–Peucker, in degrees. Good enough at these scales. */
function simplify(points: [number, number][], epsilon: number): [number, number][] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const [ay, ax] = points[start];
    const [by, bx] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let maxD = 0;
    let idx = -1;
    for (let i = start + 1; i < end; i++) {
      const [py, px] = points[i];
      // Round trips start and end at the same point, so fall back to plain distance.
      const d = len < 1e-9 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsilon && idx > 0) {
      keep[idx] = 1;
      stack.push([start, idx], [idx, end]);
    }
  }
  return points.filter((_, i) => keep[i]).map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return haversineKm(a, b);
}

const CITY_RADIUS_KM = 22;

type OsrmStep = { distance: number; ref?: string; maneuver: { location: [number, number] } };

/** Buckets each routing step by road class, so riders see "mostly NH" vs "country roads". */
function roadSplitOf(steps: OsrmStep[]): RoadSplit {
  const split: RoadSplit = { city: 0, nh: 0, sh: 0, other: 0 };
  for (const step of steps) {
    const [lng, lat] = step.maneuver.location;
    const ref = (step.ref ?? "").split(";")[0].trim().toUpperCase();
    const key: keyof RoadSplit =
      haversineKm(HOME, { lat, lng }) < CITY_RADIUS_KM
        ? "city"
        : /^(NH|AH|NE)/.test(ref)
          ? "nh"
          : /^SH/.test(ref)
            ? "sh"
            : "other";
    split[key] += step.distance / 1000;
  }
  for (const k of Object.keys(split) as (keyof RoadSplit)[]) split[k] = Math.round(split[k]);
  return split;
}

/** Bengaluru -> place -> Bengaluru. Falls back to a straight-line estimate if routing is down. */
export async function routeFromHome(place: Place): Promise<RoutedPlace> {
  const coords = `${HOME.lng},${HOME.lat};${place.lng},${place.lat};${HOME.lng},${HOME.lat}`;
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=true`,
      { headers: { "User-Agent": UA }, signal: timeout(12000) },
    );
    const json = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: string; legs: { steps: OsrmStep[] }[] }[];
    };
    const r = json.routes?.[0];
    if (json.code !== "Ok" || !r) throw new Error(json.code);
    const distanceKm = Math.round(r.distance / 1000);
    let route = simplify(decodePolyline(r.geometry), 0.003);
    if (route.length > 400) route = simplify(route, 0.01);
    return {
      ...place,
      distanceKm,
      durationMin: Math.round(r.duration / 60),
      approx: false,
      route,
      roadSplit: roadSplitOf(r.legs.flatMap((l) => l.steps)),
      suggested: suggestCategory(distanceKm),
    };
  } catch {
    const distanceKm = Math.round(haversineKm(HOME, place) * 2 * 1.3);
    return {
      ...place,
      distanceKm,
      durationMin: Math.round((distanceKm / 50) * 60),
      approx: true,
      route: [
        [HOME.lat, HOME.lng],
        [place.lat, place.lng],
        [HOME.lat, HOME.lng],
      ],
      roadSplit: null,
      suggested: suggestCategory(distanceKm),
    };
  }
}

// ---------- Photos (Wikimedia Commons, free and openly licensed) ----------

const SCENIC = /view|hill|lake|fall|road|temple|sunset|sunrise|ghat|dam|valley|peak|fort|river|forest|point|beach|mist|tea|coffee|estate|top|trek|scenery|landscape|panorama/i;
// iNaturalist uploads ("Vespa tropica 259628575.jpg") are bugs and plants, not ride photos.
const SPECIES = /^File:[A-Z][a-z]+ [a-z]+(?: [a-z]+)? \d{5,}\./;

type CommonsPage = {
  title: string;
  index?: number;
  imageinfo?: {
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
};

const stripHtml = (s?: string) => (s ? s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null : null);

/** Finds up to six photos taken near a place, preferring scenery that mentions the place name. */
export async function photosNear(place: { name: string; lat: number; lng: number }): Promise<Photo[]> {
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=geosearch" +
      `&ggscoord=${place.lat}%7C${place.lng}&ggsradius=10000&ggslimit=40&ggsnamespace=6` +
      "&prop=imageinfo&iiprop=url%7Cmime%7Cextmetadata%7Csize&iiurlwidth=900";
    type Resp = { error?: { code?: string; info?: string }; query?: { pages?: Record<string, CommonsPage> } };
    const get = async () => {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA }, signal: timeout(8000) });
      if (!res.ok) return { error: { code: `http-${res.status}`, info: (await res.text()).slice(0, 200) } } as Resp;
      return (await res.json()) as Resp;
    };
    let json = await get();
    // Commons search sometimes answers "too busy"; one retry usually clears it.
    if (json.error) {
      await new Promise((r) => setTimeout(r, 1200));
      json = await get();
    }
    if (json.error) console.warn("[photos] Commons said no:", json.error.code, json.error.info);
    const words = place.name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3);
    return Object.values(json.query?.pages ?? {})
      .filter((p) => {
        const info = p.imageinfo?.[0];
        return info?.thumburl && info.mime === "image/jpeg" && !SPECIES.test(p.title);
      })
      .map((p) => {
        const info = p.imageinfo![0];
        const title = p.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "").replace(/_/g, " ");
        let score = -(p.index ?? 0) / 100;
        if (words.some((w) => title.toLowerCase().includes(w))) score += 3;
        if (SCENIC.test(title)) score += 2;
        if ((info.thumbwidth ?? 0) > (info.thumbheight ?? 0)) score += 1;
        if (/^[A-Z][a-z]+ [a-z]+/.test(title) && !SCENIC.test(title)) score -= 3; // likely a plant or insect
        return {
          score,
          photo: {
            thumb: info.thumburl!,
            page: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
            title,
            credit: stripHtml(info.extmetadata?.Artist?.value)?.slice(0, 60) ?? null,
            license: stripHtml(info.extmetadata?.LicenseShortName?.value),
          },
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.photo);
  } catch (e) {
    console.warn("[photos] lookup failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
