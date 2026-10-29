import { Cloud, CloudRain, CloudSnow, Sun, CloudLightning } from "lucide-react";
import { prettyDate } from "@/lib/format";
import { seasonHints } from "@/lib/season";
import type { WeatherDay } from "@/lib/weather-types";
import type { DestinationDetail } from "@/lib/data";
function WeatherIcon({ code }: { code: number }) {
  const Icon = code >= 95 ? CloudLightning : code >= 71 && code <= 77 || code >= 85 && code <= 86 ? CloudSnow : code >= 51 ? CloudRain : code <= 1 ? Sun : Cloud;
  return <Icon size={20} aria-hidden />;
}
export function WeatherBlock({ d, weather }: { d: DestinationDetail; weather: WeatherDay[] | null }) {
  const day = d.status === "planned" && d.statusDate ? weather?.find(w => w.date === d.statusDate) : null;
  const noDate = !d.statusDate;
  const hints = seasonHints(d, day?.rainSum ?? (noDate ? Math.max(0, ...(weather?.slice(0, 7).map(w => w.rainSum) ?? [])) : 0));
  return <section className="mt-8 rounded-panel bg-surface p-4"><h2 className="display text-[24px]">Weather and season</h2>
    {day ? <div className="mt-3 flex items-center gap-3"><WeatherIcon code={day.code} /><p className="num text-[15px]">{prettyDate(day.date)} · {Math.round(day.max)}° / {Math.round(day.min)}° · {day.rainChance}% rain · wind {Math.round(day.wind)} km/h</p></div> : noDate ? <details className="mt-3" ><summary className="cursor-pointer font-semibold">Next 7 days</summary>{weather ? <div className="mt-3 flex gap-4 overflow-x-auto">{weather.slice(0, 7).map(w => <div key={w.date} className="num min-w-16 text-[14px]"><p>{prettyDate(w.date, { weekday: "short" })}</p><div className="my-2"><WeatherIcon code={w.code} /></div><p>{Math.round(w.max)}° / {Math.round(w.min)}°</p><p className="text-muted">{w.rainChance}% rain</p></div>)}</div> : <p className="mt-2 text-muted">Forecast unavailable right now.</p>}</details> : <p className="mt-2 text-muted">{weather ? "Forecast is available up to 16 days ahead." : "Forecast unavailable right now."}</p>}
    {hints.best !== null && <p className="mt-3 text-[15px] text-muted">{hints.best ? "This is a good season for this ride." : "This is outside the best season for this ride."}</p>}
    {hints.warning && <p className="mt-3 text-[15px] font-semibold">Ghat roads in the monsoon: expect rain, fog and slippery hairpins.</p>}
  </section>;
}
