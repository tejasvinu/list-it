import { notFound } from "next/navigation";
import { cols } from "@/lib/db";
import { getGroupContext } from "@/lib/data";
import { getLoop } from "@/lib/loop-data";
import { loopDate, loopDays } from "@/lib/loops";
import { daysUntil } from "@/lib/format";
import { forecast } from "@/lib/weather";
import { LoopView } from "@/components/loop-view";
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
  const weather = await Promise.all(
    days.map(async (day, i) => {
      if (!day.night || !loop.startDate) return undefined;
      const date = loopDate(loop.startDate, i);
      if (daysUntil(date) < 0 || daysUntil(date) >= 16) return undefined;
      const days = await forecast(day.night);
      return days?.find((d) => d.date === date) ?? null;
    }),
  );
  return <LoopView slug={slug} loop={loop} meId={ctx.viewer.id} weather={weather} liveIds={liveIds} />;
}
