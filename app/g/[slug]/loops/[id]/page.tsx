import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cols } from "@/lib/db";
import { getGroupContext } from "@/lib/data";
import { getLoop } from "@/lib/loop-data";
import { loopDate, loopDays } from "@/lib/loops";
import { daysUntil } from "@/lib/format";
import { forecast } from "@/lib/weather";
import { LoopView } from "@/components/loop-view";
export async function generateMetadata({ params }: PageProps<"/g/[slug]/loops/[id]">) {
  const { slug, id } = await params;
  const { group } = await getGroupContext(slug);
  const loop = await (await cols()).loops.findOne({ _id: id, groupId: group.id, deletedAt: null });
  return loop ? { title: loop.name } : {};
}

export default async function LoopPage({ params }: PageProps<"/g/[slug]/loops/[id]">) {
  const { slug, id } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const loop = await getLoop(ctx, id);
  if (!loop) notFound();
  const ids = loop.stops.flatMap((stop) => (stop.destinationId ? [stop.destinationId] : []));
  const destinations = await (
    await cols()
  ).destinations
    .find({ _id: { $in: ids }, groupId: ctx.group.id, deletedAt: null }, { projection: { _id: 1 } })
    .toArray();
  const liveIds = destinations.map((d) => d._id);
  const days = loopDays(loop.start, loop.stops, loop.legs);
  const weather = days.map((day, i) => {
    if (!day.night || !loop.startDate) return null;
    const date = loopDate(loop.startDate, i);
    if (daysUntil(date) < 0 || daysUntil(date) >= 16) return null;
    return <Suspense key={i} fallback={<p className="mt-2 text-muted">Loading forecast…</p>}>
      <NightForecast weather={forecast(day.night).catch(() => null)} date={date} />
    </Suspense>;
  });
  return <LoopView slug={slug} loop={loop} meId={ctx.viewer.id} weather={weather} liveIds={liveIds} />;
}

async function NightForecast({ weather, date }: { weather: ReturnType<typeof forecast>; date: string }) {
  const day = (await weather)?.find((item) => item.date === date);
  if (!day) return <p className="mt-2 text-muted">Forecast unavailable.</p>;
  return <p className="num mt-2 text-muted">{day.max}° / {day.min}° · {day.rainChance}% rain · wind {day.wind} km/h</p>;
}
