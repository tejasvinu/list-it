import { CATEGORIES, ROAD_SPLIT_LABELS, type Category } from "./config";
import type { RoadSplit } from "./types";

export function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function km(n: number) {
  return `${Math.round(n).toLocaleString("en-IN")} km`;
}

export function timeAgo(date: Date | string | number, now = Date.now()) {
  const t = new Date(date).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.round(d / 7);
  if (d < 60) return `${w}w`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "Sat, 8 Nov" from YYYY-MM-DD, without timezone surprises. */
export function prettyDate(ymd: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });
}

/**
 * Today as YYYY-MM-DD in India. Servers run on UTC, so the local date would be yesterday until 5:30 am IST,
 * and the server and the phone would disagree while rendering the same page.
 */
export function todayYmd(now: Date | number = Date.now()) {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export function daysUntil(ymd: string, now: Date | number = Date.now()) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [ty, tmo, td] = todayYmd(now).split("-").map(Number);
  return Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(ty, tmo - 1, td)) / 86400000);
}

export function categoryOf(c: string) {
  return CATEGORIES[(c in CATEGORIES ? c : "day") as Category];
}

/** One-line feel of the route, e.g. "Mostly country roads". */
export function splitSummary(split: RoadSplit | null) {
  if (!split) return null;
  const outside = split.nh + split.sh + split.other;
  if (!outside) return "City ride";
  const hwy = (split.nh + split.sh) / outside;
  if (hwy >= 0.7) return "Mostly highway";
  if (hwy <= 0.3) return "Mostly country roads";
  return "Highway + country roads";
}

/** The road class a ride mostly runs on, which colours its milestone's cap. Unknown splits get the NH yellow. */
export function mainRoad(split: RoadSplit | null): keyof RoadSplit {
  if (!split) return "nh";
  if (!(split.nh + split.sh + split.other)) return "city";
  return (["sh", "other"] as const).reduce<keyof RoadSplit>((best, k) => (split[k] > split[best] ? k : best), "nh");
}

export function splitParts(split: RoadSplit) {
  const total = split.city + split.nh + split.sh + split.other || 1;
  return (Object.keys(ROAD_SPLIT_LABELS) as (keyof RoadSplit)[])
    .map((k) => ({ key: k, ...ROAD_SPLIT_LABELS[k], km: split[k], pct: (split[k] / total) * 100 }))
    .filter((p) => p.km > 0);
}

export function googleMapsPlace(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function googleMapsRoute(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&origin=Bengaluru&destination=${lat},${lng}&travelmode=driving`;
}

/** The current or coming Saturday and Sunday in India. */
export function weekendDates(now: Date | number = Date.now()) {
  const [year, month, day] = todayYmd(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -1 : 6 - weekday;
  date.setUTCDate(date.getUTCDate() + offset);
  const saturday = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 1);
  return [saturday, date.toISOString().slice(0, 10)];
}
