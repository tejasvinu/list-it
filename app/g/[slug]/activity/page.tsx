import { getActivity, getGroupContext } from "@/lib/data";
import { ActivityView } from "@/components/activity-view";

export const metadata = { title: "Activity" };

export default async function ActivityPage({ params }: PageProps<"/g/[slug]/activity">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const items = await getActivity(ctx);
  const seenAt = (ctx.viewer.activitySeenAt ?? ctx.viewer.createdAt).getTime();
  return <ActivityView slug={slug} items={items} meId={ctx.viewer.id} seenAt={seenAt} />;
}
