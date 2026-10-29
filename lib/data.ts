import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { cols, fromDoc, toDoc, type Activity, type Comment, type Destination, type Group, type Rider, type Stop } from "./db";
import { getGroupBySlug, getViewer, registrationOpen } from "./auth";
import { rid } from "./ids";
import type { RiderLite } from "./types";
import { forecast } from "./weather";
import { daysUntil } from "./format";
import { originKey } from "./origin-routes";
import { HOME } from "./config";
import type { WeatherDay } from "./weather-types";
export type { RiderLite };

export const lite = (r: Rider): RiderLite => ({ id: r.id, name: r.name, emoji: r.emoji, color: r.color, start: r.start ?? null });

const ghost: RiderLite = { id: "", name: "Former rider", emoji: "👻", color: "#52525b" };

export type GroupContext = {
  group: Group;
  viewer: Rider | null;
  riders: RiderLite[];
  registrationOpen: boolean;
};

/** Group, signed-in rider and roster for a share link. 404s on an unknown slug. */
export const getGroupContext = cache(async (slug: string): Promise<GroupContext> => {
  const group = await getGroupBySlug(slug);
  if (!group) notFound();
  const c = await cols();
  const [viewer, roster] = await Promise.all([
    getViewer(group.id),
    c.riders.find({ groupId: group.id, removedAt: null }).sort({ createdAt: 1 }).toArray(),
  ]);
  return {
    group,
    viewer,
    riders: roster.map((r) => lite(fromDoc<Rider>(r))),
    registrationOpen: registrationOpen(group),
  };
});

export type FeedItem = Destination & {
  owner: RiderLite;
  reactions: { emoji: string; rider: RiderLite }[];
  myReaction: string | null;
  interested: RiderLite[];
  imIn: boolean;
  /** Riders who have ridden it, most recent first */
  riddenBy: { rider: RiderLite; date: string | null; note: string | null; loggedBy: string | null }[];
  fromYou: { name: string; distanceKm: number; durationMin: number; approx: boolean } | null;
  forecastDay: WeatherDay | null;
  iRode: boolean;
  /** The rider who added it has been removed, so anyone in the crew can look after it */
  ownerGone: boolean;
  commentCount: number;
  stopCount: number;
};

async function hydrate(rows: Destination[], groupRiders: RiderLite[], viewerId: string | null) {
  if (!rows.length) return [];
  const ids = rows.map((d) => d.id);
  const byId = new Map(groupRiders.map((r) => [r.id, r]));
  const who = (id: string) => byId.get(id) ?? ghost;
  const c = await cols();

  const start = groupRiders.find(r => r.id === viewerId)?.start;
  const [rx, ins, rd, cc, sc, origins, weather] = await Promise.all([
    c.reactions.find({ destinationId: { $in: ids } }, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray(),
    c.interests.find({ destinationId: { $in: ids } }, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray(),
    c.rides.find({ destinationId: { $in: ids } }, { projection: { _id: 0 } }).sort({ date: -1, createdAt: -1 }).toArray(),
    c.comments
      .aggregate<{ _id: string; n: number }>([
        { $match: { destinationId: { $in: ids }, deletedAt: null } },
        { $group: { _id: "$destinationId", n: { $sum: 1 } } },
      ])
      .toArray(),
    c.stops
      .aggregate<{ _id: string; n: number }>([
        { $match: { destinationId: { $in: ids } } },
        { $group: { _id: "$destinationId", n: { $sum: 1 } } },
      ])
      .toArray(),
    start ? c.originRoutes.find({ destinationId: { $in: ids }, ...originKey(start) }).toArray() : Promise.resolve([]),
    c.weather.find({ $or: rows.map(d => ({ lat: Number(d.lat.toFixed(2)), lng: Number(d.lng.toFixed(2)) })) }).toArray(),
  ]);
  const commentCounts = new Map(cc.map((x) => [x._id, x.n]));
  const stopCounts = new Map(sc.map((x) => [x._id, x.n]));

  return rows.map<FeedItem>((d) => {
    const myRx = rx.filter((r) => r.destinationId === d.id);
    const myIns = ins.filter((i) => i.destinationId === d.id);
    const myRides = rd.filter((r) => r.destinationId === d.id);
    return {
      ...d,
      owner: who(d.riderId),
      ownerGone: !byId.has(d.riderId),
      reactions: myRx.map((r) => ({ emoji: r.emoji, rider: who(r.riderId) })),
      myReaction: myRx.find((r) => r.riderId === viewerId)?.emoji ?? null,
      interested: myIns.map((i) => who(i.riderId)),
      imIn: myIns.some((i) => i.riderId === viewerId),
      riddenBy: myRides.map((r) => ({ rider: who(r.riderId), date: r.date, note: r.note ?? null, loggedBy: r.loggedBy ?? null })),
      fromYou: (() => { const route = origins.find(o => o.destinationId === d.id && o.destinationLat === d.lat && o.destinationLng === d.lng); return start && route && (start.lat !== HOME.lat || start.lng !== HOME.lng) ? { name: start.name, distanceKm: route.distanceKm, durationMin: route.durationMin, approx: route.approx } : null; })(),
      forecastDay: (() => { const w = weather.find(w => w.lat === Number(d.lat.toFixed(2)) && w.lng === Number(d.lng.toFixed(2)) && Date.now() - w.updatedAt.getTime() < 3600000); return d.status === "planned" && d.statusDate ? w?.days.find(day => day.date === d.statusDate) ?? null : null; })(),
      iRode: myRides.some((r) => r.riderId === viewerId),
      commentCount: commentCounts.get(d.id) ?? 0,
      stopCount: stopCounts.get(d.id) ?? 0,
    };
  });
}

export async function getFeed(ctx: GroupContext) {
  const rows = await (await cols()).destinations
    .find({ groupId: ctx.group.id, deletedAt: null })
    .sort({ createdAt: -1 })
    .toArray();
  await Promise.all(rows.filter(d => d.status === "planned" && d.statusDate && daysUntil(d.statusDate) >= 0 && daysUntil(d.statusDate) < 16).map(d => forecast(d)));
  return hydrate(rows.map((r) => fromDoc<Destination>(r)), ctx.riders, ctx.viewer?.id ?? null);
}

/** Rides added and ridden per rider, without loading every route. */
export async function getRiderCounts(ctx: GroupContext) {
  const c = await cols();
  const live = await c.destinations.find({ groupId: ctx.group.id, deletedAt: null }, { projection: { riderId: 1 } }).toArray();
  const ridden = await c.rides
    .aggregate<{ _id: string; n: number }>([
      { $match: { destinationId: { $in: live.map((d) => d._id) } } },
      { $group: { _id: "$riderId", n: { $sum: 1 } } },
    ])
    .toArray();
  const added = new Map<string, number>();
  for (const d of live) added.set(d.riderId, (added.get(d.riderId) ?? 0) + 1);
  const rode = new Map(ridden.map((r) => [r._id, r.n]));
  return (riderId: string) => ({ added: added.get(riderId) ?? 0, ridden: rode.get(riderId) ?? 0 });
}

export async function getDestination(ctx: GroupContext, id: string) {
  const c = await cols();
  const row = await c.destinations.findOne({ _id: id, groupId: ctx.group.id, deletedAt: null });
  if (!row) return null;
  const [item] = await hydrate([fromDoc<Destination>(row)], ctx.riders, ctx.viewer?.id ?? null);
  const byId = new Map(ctx.riders.map((r) => [r.id, r]));

  const [thread, stopRows] = await Promise.all([
    c.comments.find({ destinationId: id, deletedAt: null }).sort({ createdAt: 1 }).toArray(),
    c.stops.find({ destinationId: id }).sort({ createdAt: 1 }).toArray(),
  ]);
  return {
    ...item,
    comments: thread.map((x) => {
      const cm = fromDoc<Comment>(x);
      return { ...cm, rider: byId.get(cm.riderId) ?? ghost };
    }),
    stops: stopRows.map((x) => {
      const s = fromDoc<Stop>(x);
      return { ...s, rider: byId.get(s.riderId) ?? ghost };
    }),
  };
}
export type DestinationDetail = NonNullable<Awaited<ReturnType<typeof getDestination>>>;

export async function getActivity(ctx: GroupContext, limit = 120) {
  const c = await cols();
  const rows = (await c.activity.find({ groupId: ctx.group.id }).sort({ createdAt: -1 }).limit(limit).toArray()).map((r) =>
    fromDoc<Activity>(r),
  );
  const destIds = [...new Set(rows.map((r) => r.destinationId).filter((x): x is string => !!x))];
  const dests = await c.destinations
    .find({ _id: { $in: destIds } }, { projection: { name: 1, category: 1, route: 1, photos: 1, deletedAt: 1 } })
    .toArray();
  const destById = new Map(dests.map((d) => [d._id, d]));
  const loopIds = [...new Set(rows.flatMap((r) => r.loopId ? [r.loopId] : []))];
  const loops = await c.loops.find({ _id: { $in: loopIds }, groupId: ctx.group.id, deletedAt: null }).toArray();
  const loopById = new Map(loops.map((loop) => [loop._id, loop]));
  const byId = new Map(ctx.riders.map((r) => [r.id, r]));
  return rows
    .filter((r) => byId.has(r.riderId))
    .filter((r) => !r.destinationId || (destById.has(r.destinationId) && !destById.get(r.destinationId)!.deletedAt))
    .filter((r) => !r.loopId || loopById.has(r.loopId))
    .map((r) => {
      const d = r.destinationId ? destById.get(r.destinationId) : undefined;
      return {
        ...r,
        rider: byId.get(r.riderId)!,
        loopName: r.loopId ? loopById.get(r.loopId)?.name ?? null : null,
        destName: d?.name ?? null,
        destCategory: d?.category ?? null,
        destRoute: d?.route ?? null,
        destPhoto: d?.photos?.[0]?.thumb ?? null,
      };
    });
}
export type ActivityItem = Awaited<ReturnType<typeof getActivity>>[number];

/** Whether others have done something since the viewer last opened the activity tab. */
export async function hasUnread(ctx: GroupContext) {
  if (!ctx.viewer) return false;
  const since = ctx.viewer.activitySeenAt ?? ctx.viewer.createdAt;
  const hit = await (await cols()).activity.findOne(
    { groupId: ctx.group.id, riderId: { $ne: ctx.viewer.id }, createdAt: { $gt: since } },
    { projection: { _id: 1 } },
  );
  return !!hit;
}

export async function logActivity(
  ctx: { groupId: string; riderId: string },
  kind: string,
  destinationId: string | null,
  detail: string | null = null,
) {
  await (await cols()).activity.insertOne(
    toDoc<Activity>({ id: rid(), groupId: ctx.groupId, riderId: ctx.riderId, kind, destinationId, detail, createdAt: new Date() }),
  );
}
