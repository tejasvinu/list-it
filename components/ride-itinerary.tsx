import Link from "next/link";
import { loopDate, loopDays } from "@/lib/loops";
import { duration, km, prettyDate } from "@/lib/format";
import type { Itinerary } from "@/lib/types";
import { ITINERARY_COLORS } from "@/lib/config";

export function RideItinerary({ slug, itinerary, date, weather = [], liveIds = [] }: { slug: string; itinerary: Itinerary; date: string | null; weather?: React.ReactNode[]; liveIds?: string[] }) {
  const days = loopDays(itinerary.start, itinerary.stops, itinerary.legs);
  return <section className="mt-10" aria-label="Ride itinerary">
    <h2 className="display text-[26px]">The itinerary</h2>
    <p className="mt-1 text-[15px] text-muted">{itinerary.stops.length} {itinerary.stops.length === 1 ? "place" : "places"} · {days.length} {days.length === 1 ? "day" : "days"} · starts and ends in {itinerary.start.name}</p>
    <ol className="mt-4 space-y-4">{days.map((day, index) => <li key={index} className="border-l-2 pl-4" style={{ borderColor: ITINERARY_COLORS[index % ITINERARY_COLORS.length] }}>
      <h3 className="display text-[23px]">Day {index + 1}{date && <span className="num text-[15px] font-normal text-muted"> · {prettyDate(loopDate(date, index))}</span>}</h3>
      <p className="mt-1 text-[17px]">{day.names.join(" → ")}</p>
      <p className="num mt-1 text-[15px] text-muted">{day.approx ? "About " : ""}{km(day.km)} · {duration(day.min)} riding{day.night ? ` · Night in ${day.night.name}` : ""}</p>
      {(day.km > 500 || day.min > 480) && <p className="mt-1 text-[14px] text-danger">A long day in the saddle. Consider another overnight stop.</p>}
      {weather[index]}
    </li>)}</ol>
    {itinerary.stops.some(stop => stop.destinationId && liveIds.includes(stop.destinationId)) && <div className="mt-4 flex flex-wrap gap-2">{itinerary.stops.filter(stop => stop.destinationId && liveIds.includes(stop.destinationId)).map((stop, index) => <Link key={`${stop.destinationId}-${index}`} href={`/g/${slug}/d/${stop.destinationId}`} className="btn btn-quiet text-[14px]">{stop.name}</Link>)}</div>}
  </section>;
}
