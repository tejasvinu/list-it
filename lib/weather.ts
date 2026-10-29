import "server-only";
import { cols } from "./db";
import type { WeatherDay } from "./weather-types";
import { UA } from "./geo";
export async function forecast(point: { lat: number; lng: number }): Promise<WeatherDay[] | null> {
  const key = { lat: Number(point.lat.toFixed(2)), lng: Number(point.lng.toFixed(2)) };
  const c = await cols();
  const cached = await c.weather.findOne(key);
  if (cached && Date.now() - cached.updatedAt.getTime() < 3600000) return cached.days;
  try {
    const params = new URLSearchParams({ latitude: String(key.lat), longitude: String(key.lng), daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max", timezone: "Asia/Kolkata", forecast_days: "16" });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(7000), cache: "no-store" });
    if (!res.ok) throw new Error("Forecast unavailable");
    const { daily } = await res.json() as { daily: Record<string, (string | number | null)[]> };
    const fields = ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max", "precipitation_sum", "wind_speed_10m_max"];
    if (!Array.isArray(daily?.time) || !daily.time.length || !fields.every(k => Array.isArray(daily[k]) && daily[k].length === daily.time.length)) throw new Error("Invalid forecast");
    // Later days can come back with gaps; keep the days before the first one.
    const complete = daily.time.findIndex((_, i) => !fields.every(k => typeof daily[k][i] === "number" && Number.isFinite(daily[k][i])));
    const usable = complete === -1 ? daily.time : daily.time.slice(0, complete);
    if (!usable.length) throw new Error("Invalid forecast");
    const days = usable.map((date, i) => ({ date: String(date), code: Number(daily.weather_code[i]), max: Number(daily.temperature_2m_max[i]), min: Number(daily.temperature_2m_min[i]), rainChance: Number(daily.precipitation_probability_max[i]), rainSum: Number(daily.precipitation_sum[i]), wind: Number(daily.wind_speed_10m_max[i]) }));
    await c.weather.updateOne(key, { $set: { ...key, days, updatedAt: new Date() } }, { upsert: true });
    return days;
  } catch { return null; }
}
