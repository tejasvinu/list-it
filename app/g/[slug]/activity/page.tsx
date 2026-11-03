import { getActivity, getFeed, getGroupContext } from "@/lib/data";
import { getNotifications } from "@/lib/notifications";
import { loopKey } from "@/lib/ride-model";
import { validDate } from "@/lib/validate";
import { ActivityViews } from "@/components/activity-views";

export const metadata = { title: "Activity" };
function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 86400000);
}
export default async function ActivityPage({ params }: PageProps<"/g/[slug]/activity">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const since = sevenDaysAgo();
  const [items, notifications, rides] = await Promise.all([getActivity(ctx, 1000), getNotifications(ctx), getFeed(ctx)]);
  const keyOf = (item: (typeof items)[number]) => item.loopId ? loopKey(item.loopId) : item.destinationId;
  const digest = {
    added: rides.filter(d => d.createdAt >= since).map(d => ({ id: d.id, name: d.name })),
    planned: rides.filter(d => d.status === "planned" && validDate(d.statusDate) && (d.createdAt >= since || items.some(a => keyOf(a) === d.id && a.kind === "planned" && a.createdAt >= since))).map(d => ({ id: d.id, name: d.name, date: d.statusDate!, riders: d.interested.map(r => r.name).join(", ") })),
    ridden: items.filter(a => ["rode", "done"].includes(a.kind) && a.createdAt >= since && keyOf(a)).map(a => ({ id: keyOf(a)!, name: a.destName ?? a.loopName ?? "Ride", detail: a.detail ?? "" })),
  };
  return <ActivityViews slug={slug} items={items} notifications={notifications} meId={ctx.viewer.id} seenAt={(ctx.viewer.activitySeenAt ?? ctx.viewer.createdAt).getTime()} digest={digest} />;
}
