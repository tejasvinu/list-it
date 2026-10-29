import "server-only";
import { cols, fromDoc, toDoc, type Notification } from "./db";
import { rid } from "./ids";
import type { GroupContext } from "./data";

export async function notify(
  groupId: string,
  actorId: string,
  kind: string,
  destinationId: string | null,
  loopId: string | null,
  detail: string | null = null,
  extra: string[] = [],
) {
  const c = await cols();
  const recipients = new Set(extra);
  if (destinationId) {
    const destination = await c.destinations.findOne({ _id: destinationId, groupId, deletedAt: null });
    if (!destination) return;
    if (["in", "commented", "reacted", "rode", "done", "stop"].includes(kind)) recipients.add(destination.riderId);
    if (kind === "commented") {
      const commenters = await c.comments.distinct("riderId", { destinationId, deletedAt: null });
      commenters.forEach((id) => recipients.add(id));
    }
    if (kind === "planned" && detail) {
      const interested = await c.interests.distinct("riderId", { destinationId });
      interested.forEach((id) => recipients.add(id));
    }
  }
  if (loopId) {
    const loop = await c.loops.findOne({ _id: loopId, groupId, deletedAt: null });
    if (!loop) return;
    if (["loop-in", "loop-commented"].includes(kind)) recipients.add(loop.riderId);
    if (kind === "loop-commented") {
      const commenters = await c.loopComments.distinct("riderId", { loopId, deletedAt: null });
      commenters.forEach((id) => recipients.add(id));
    }
  }
  recipients.delete(actorId);
  const members = await c.riders
    .find({ _id: { $in: [...recipients] }, groupId, removedAt: null }, { projection: { _id: 1 } })
    .toArray();
  if (!members.length) return;
  const now = new Date();
  await c.notifications.insertMany(
    members.map((member) =>
      toDoc<Notification>({
        id: rid(),
        groupId,
        riderId: member._id,
        actorId,
        kind,
        destinationId,
        loopId,
        detail,
        createdAt: now,
        readAt: null,
      }),
    ),
  );
}

export async function getNotifications(ctx: GroupContext) {
  if (!ctx.viewer) return [];
  const c = await cols();
  const rows = await c.notifications
    .find({ groupId: ctx.group.id, riderId: ctx.viewer.id })
    .sort({ createdAt: -1 })
    .limit(120)
    .toArray();
  const destIds = rows.flatMap((row) => (row.destinationId ? [row.destinationId] : []));
  const loopIds = rows.flatMap((row) => (row.loopId ? [row.loopId] : []));
  const [destinations, loops] = await Promise.all([
    c.destinations.find({ _id: { $in: destIds }, groupId: ctx.group.id, deletedAt: null }).toArray(),
    c.loops.find({ _id: { $in: loopIds }, groupId: ctx.group.id, deletedAt: null }).toArray(),
  ]);
  const destById = new Map(destinations.map((d) => [d._id, d.name]));
  const loopById = new Map(loops.map((l) => [l._id, l.name]));
  return rows
    .filter(
      (row) => (!row.destinationId || destById.has(row.destinationId)) && (!row.loopId || loopById.has(row.loopId)),
    )
    .map((row) => ({
      ...fromDoc<Notification>(row),
      actor: ctx.riders.find((rider) => rider.id === row.actorId)?.name ?? "Former rider",
      name: row.destinationId ? destById.get(row.destinationId) : row.loopId ? loopById.get(row.loopId) : "",
    }));
}
