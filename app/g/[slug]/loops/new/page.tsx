import { getGroupContext } from "@/lib/data";
import { cols } from "@/lib/db";
import { HOME } from "@/lib/config";
import { LoopBuilder } from "@/components/loop-builder";
export const metadata = { title: "New loop" };
export default async function NewLoopPage({ params, searchParams }: PageProps<"/g/[slug]/loops/new">) {
  const { slug } = await params;
  const { ride } = await searchParams;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const rows = await (
    await cols()
  ).destinations
    .find({ groupId: ctx.group.id, deletedAt: null })
    .sort({ name: 1 })
    .toArray();
  const rides = rows.map((d) => ({ id: d._id, name: d.name, area: d.area, lat: d.lat, lng: d.lng }));
  const selected = typeof ride === "string" ? rides.find((d) => d.id === ride) : null;
  const initialStop = selected
    ? { destinationId: selected.id, name: selected.name, lat: selected.lat, lng: selected.lng, nightHere: false }
    : undefined;
  return <LoopBuilder slug={slug} rides={rides} start={ctx.viewer.start ?? HOME} initialStop={initialStop} />;
}
