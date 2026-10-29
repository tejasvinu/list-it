import { todayYmd } from "./format";
export function seasonHints(d: { lat: number; lng: number; seasons?: string[]; tags?: string[]; hairpins?: number | null }, rainSum = 0, now: Date | number = Date.now()) {
  const month = Number(todayYmd(now).slice(5, 7));
  const current = month <= 2 || month === 12 ? "winter" : month <= 5 ? "summer" : month <= 9 ? "monsoon" : "postmonsoon";
  const seasons = d.seasons ?? [];
  const best = seasons.length ? seasons.includes("anytime") || seasons.includes(current) : null;
  const monsoon = (month >= 6 && month <= 9) || (month >= 10 && month <= 11 && d.lat < 13.5 && d.lng >= 77);
  const hills = (d.hairpins ?? 0) >= 5 || (d.tags ?? []).some(t => /ghat|hill|mountain|twist/i.test(t));
  return { best, warning: monsoon && (hills || rainSum > 10) };
}
