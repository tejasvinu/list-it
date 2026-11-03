import { cols } from "@/lib/db";
import { getGroupContext } from "@/lib/data";
import { loopKey } from "@/lib/ride-model";
import { RideDetailPage } from "@/components/ride-detail-page";

export async function generateMetadata({ params }: PageProps<"/g/[slug]/loops/[id]">) {
  const { slug, id } = await params;
  const { group } = await getGroupContext(slug);
  const loop = await (await cols()).loops.findOne({ _id: id, groupId: group.id, deletedAt: null });
  return loop ? { title: loop.name } : {};
}
export default async function LoopPage({ params }: PageProps<"/g/[slug]/loops/[id]">) {
  const { slug, id } = await params;
  return <RideDetailPage slug={slug} rideKey={loopKey(id)} />;
}
