import { notFound } from "next/navigation";
import { getGroupContext } from "@/lib/data";
import { getLoop } from "@/lib/loop-data";
import { cols } from "@/lib/db";
import { LoopBuilder } from "@/components/loop-builder";
export const metadata = { title: "Edit loop" };
export default async function EditLoopPage({ params }: PageProps<"/g/[slug]/loops/[id]/edit">) {
  const { slug, id } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const loop = await getLoop(ctx, id);
  if (!loop || loop.riderId !== ctx.viewer.id) notFound();
  const rows = await (
    await cols()
  ).destinations
    .find({ groupId: ctx.group.id, deletedAt: null })
    .sort({ name: 1 })
    .toArray();
  const rides = rows.map((d) => ({ id: d._id, name: d.name, area: d.area, lat: d.lat, lng: d.lng }));
  const liveIds = new Set(rides.map((ride) => ride.id));
  const editable = {
    ...loop,
    stops: loop.stops.map((stop) =>
      stop.destinationId && !liveIds.has(stop.destinationId) ? { ...stop, destinationId: null } : stop,
    ),
  };
  return <LoopBuilder slug={slug} rides={rides} start={loop.start} loop={editable} />;
}
