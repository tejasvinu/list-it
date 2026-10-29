import { getActivity, getGroupContext } from "@/lib/data";
import { getNotifications } from "@/lib/notifications";
import { cols } from "@/lib/db";
import { validDate } from "@/lib/validate";
import { ActivityViews } from "@/components/activity-views";

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 86400000);
}

export const metadata = { title: "Activity" };

export default async function ActivityPage({ params }: PageProps<"/g/[slug]/activity">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const c = await cols();
  const since = sevenDaysAgo();
  const [items, notifications, destinations, loops] = await Promise.all([
    getActivity(ctx, 1000),
    getNotifications(ctx),
    c.destinations
      .find({
        groupId: ctx.group.id,
        deletedAt: null,
        $or: [{ createdAt: { $gte: since } }, { status: "planned", statusDate: { $ne: null } }],
      })
      .toArray(),
    c.loops.find({ groupId: ctx.group.id, deletedAt: null, createdAt: { $gte: since } }).toArray(),
  ]);
  const interests = await c.interests.find({ destinationId: { $in: destinations.map((d) => d._id) } }).toArray();
  const digest = {
    added: destinations.filter((d) => d.createdAt >= since).map((d) => ({ id: d._id, name: d.name })),
    planned: destinations
      .filter(
        (d) =>
          d.status === "planned" &&
          validDate(d.statusDate) &&
          (d.createdAt >= since ||
            items.some((a) => a.destinationId === d._id && a.kind === "planned" && new Date(a.createdAt) >= since)),
      )
      .map((d) => ({
        id: d._id,
        name: d.name,
        date: d.statusDate!,
        riders: interests
          .filter((i) => i.destinationId === d._id)
          .map((i) => ctx.riders.find((r) => r.id === i.riderId)?.name)
          .filter(Boolean)
          .join(", "),
      })),
    ridden: items
      .filter((a) => ["rode", "done"].includes(a.kind) && new Date(a.createdAt) >= since && a.destinationId)
      .map((a) => ({ id: a.destinationId!, name: a.destName ?? "Ride", detail: a.detail ?? "" })),
    loops: loops.map((l) => ({ id: l._id, name: l.name })),
  };
  return (
    <ActivityViews
      slug={slug}
      items={items}
      notifications={notifications}
      meId={ctx.viewer.id}
      seenAt={(ctx.viewer.activitySeenAt ?? ctx.viewer.createdAt).getTime()}
      digest={digest}
    />
  );
}
