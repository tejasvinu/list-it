"use server";

import { revalidatePath } from "next/cache";
import { cols, fromDoc, toDoc, type Destination, type Rider } from "@/lib/db";
import {
  endSession,
  hashPin,
  isValidPin,
  startSession,
  verifyRiderPin,
} from "@/lib/auth";
import { getGroupContext, logActivity } from "@/lib/data";
import { rid } from "@/lib/ids";
import {
  kmBetween,
  photosNear,
  resolvePlace,
  routeFromHome,
  searchPlaces,
  type Place,
  type RoutedPlace,
} from "@/lib/geo";
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  CATEGORY_KEYS,
  REACTIONS,
  ROAD_TAG_KEYS,
  SEASON_KEYS,
  STATUS_KEYS,
  STOP_KIND_KEYS,
} from "@/lib/config";
import { todayYmd } from "@/lib/format";
import type { Photo, RoadSplit } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

async function requireRider(slug: string) {
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) throw new Error("Sign in first");
  return { ...ctx, viewer: ctx.viewer, log: { groupId: ctx.group.id, riderId: ctx.viewer.id } };
}

const refresh = (slug: string) => revalidatePath(`/g/${slug}`, "layout");

const clean = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
const cleanMultiline = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "";

// ---------- Joining & signing in ----------

export async function joinGroup(
  slug: string,
  input: { name: string; emoji: string; color: string; pin: string },
): Promise<Result> {
  const ctx = await getGroupContext(slug);
  if (!ctx.registrationOpen) return fail("Joining is closed for this crew. Ask the admin to add you.");
  const name = clean(input.name, 24);
  if (name.length < 2) return fail("Name needs at least 2 letters.");
  if (!isValidPin(input.pin)) return fail("PIN must be 4 digits.");
  if (!(AVATAR_EMOJIS as readonly string[]).includes(input.emoji)) return fail("Pick an avatar.");
  if (!(AVATAR_COLORS as readonly string[]).includes(input.color)) return fail("Pick a colour.");
  if (ctx.riders.length >= 60) return fail("This crew is full.");
  const nameKey = name.toLowerCase();
  const takenMsg = fail(`"${name}" is taken. If that's you, use "I'm already in".`);
  const c = await cols();
  if (await c.riders.findOne({ groupId: ctx.group.id, nameKey })) return takenMsg;

  const id = rid();
  const now = new Date();
  const rider: Rider = {
    id,
    groupId: ctx.group.id,
    name,
    nameKey,
    emoji: input.emoji,
    color: input.color,
    pinHash: hashPin(input.pin),
    sessionVersion: 1,
    failedAttempts: 0,
    lockedUntil: null,
    activitySeenAt: now,
    removedAt: null,
    createdAt: now,
  };
  try {
    await c.riders.insertOne(toDoc(rider));
  } catch (e) {
    // Two people grabbing the same name at once: the unique index wins.
    if ((e as { code?: number }).code === 11000) return takenMsg;
    throw e;
  }
  await startSession(rider);
  await logActivity({ groupId: ctx.group.id, riderId: id }, "joined", null);
  refresh(slug);
  return { ok: true };
}

export async function signIn(slug: string, riderId: string, pin: string): Promise<Result> {
  const ctx = await getGroupContext(slug);
  const rider = fromDoc<Rider>(await (await cols()).riders.findOne({ _id: riderId, groupId: ctx.group.id, removedAt: null }));
  if (!rider) return fail("Rider not found.");
  if (!isValidPin(pin)) return fail("PIN must be 4 digits.");
  const check = await verifyRiderPin(rider, pin);
  if (!check.ok) return check;
  await startSession(rider);
  refresh(slug);
  return { ok: true };
}

export async function signOut(slug: string) {
  const ctx = await getGroupContext(slug);
  await endSession(ctx.group.id);
  refresh(slug);
}

// ---------- Places ----------

export type Preview = RoutedPlace & {
  photos: Photo[];
  nearby: { id: string; name: string; owner: string }[];
};

async function preview(ctx: Awaited<ReturnType<typeof requireRider>>, place: Place): Promise<Preview> {
  const [routed, photos, existing] = await Promise.all([
    routeFromHome(place),
    photosNear(place),
    cols().then((c) =>
      c.destinations
        .find({ groupId: ctx.group.id, deletedAt: null }, { projection: { name: 1, lat: 1, lng: 1, riderId: 1 } })
        .toArray(),
    ),
  ]);
  const names = new Map(ctx.riders.map((r) => [r.id, r.name]));
  const nearby = existing
    .filter((d) => kmBetween(d, place) < 3)
    .map((d) => ({ id: d._id, name: d.name, owner: names.get(d.riderId) ?? "Someone" }));
  return { ...routed, photos, nearby };
}

export async function previewFromLink(slug: string, link: string): Promise<Result<{ preview: Preview }>> {
  const ctx = await requireRider(slug);
  try {
    return { ok: true, preview: await preview(ctx, await resolvePlace(link)) };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't read that link.");
  }
}

export async function previewFromPlace(slug: string, place: Place): Promise<Result<{ preview: Preview }>> {
  const ctx = await requireRider(slug);
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return fail("Bad location.");
  return {
    ok: true,
    preview: await preview(ctx, {
      name: clean(place.name, 80) || "Dropped pin",
      area: clean(place.area, 80) || null,
      lat: place.lat,
      lng: place.lng,
      mapsUrl: place.mapsUrl,
    }),
  };
}

export async function searchPlacesAction(slug: string, q: string): Promise<Place[]> {
  await requireRider(slug);
  try {
    return await searchPlaces(q.slice(0, 80));
  } catch {
    return [];
  }
}

// ---------- Destinations ----------

export type DestinationInput = {
  name: string;
  area: string | null;
  mapsUrl: string | null;
  lat: number;
  lng: number;
  distanceKm: number;
  durationMin: number;
  approx: boolean;
  route: [number, number][];
  roadSplit: RoadSplit | null;
  photos: Photo[];
  category: string;
  tags: string[];
  seasons: string[];
  hairpins: number | null;
  notes: string;
  status: string;
  statusDate: string | null;
  rideReport: string;
};

function validate(input: DestinationInput) {
  const num = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  if (!num(input.lat) || !num(input.lng) || !num(input.distanceKm) || !num(input.durationMin)) return null;
  if (!Array.isArray(input.route) || input.route.length < 2 || input.route.length > 1500) return null;
  if (!input.route.every((p) => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1]))) return null;
  const name = clean(input.name, 60);
  if (!name) return null;
  const known = new Set<string>(ROAD_TAG_KEYS);
  const tags = [
    ...new Set(
      (input.tags ?? [])
        .map((t) => (known.has(t) ? t : clean(t, 24).toLowerCase().replace(/^#/, "").replace(/[^\p{L}\p{N} -]/gu, "")))
        .filter(Boolean),
    ),
  ].slice(0, 12);
  // Commons serves thumbnails from more than one host (upload., thumb.), so allow any wikimedia.org one.
  const fromWikimedia = (u: unknown) => {
    try {
      const url = new URL(String(u));
      return url.protocol === "https:" && url.hostname.endsWith(".wikimedia.org");
    } catch {
      return false;
    }
  };
  const photos = (input.photos ?? [])
    .filter((p) => fromWikimedia(p.thumb) && fromWikimedia(p.page))
    .slice(0, 6)
    .map((p) => ({
      thumb: p.thumb,
      page: p.page,
      title: clean(p.title, 120),
      credit: p.credit ? clean(p.credit, 60) : null,
      license: p.license ? clean(p.license, 30) : null,
    }));
  const split = input.roadSplit;
  const status = STATUS_KEYS.includes(input.status as never) ? input.status : "wishlist";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.statusDate ?? "") ? input.statusDate : null;
  return {
    name,
    area: clean(input.area, 80) || null,
    mapsUrl: typeof input.mapsUrl === "string" && /^https:\/\//.test(input.mapsUrl) ? input.mapsUrl.slice(0, 600) : null,
    lat: input.lat,
    lng: input.lng,
    distanceKm: Math.round(input.distanceKm),
    durationMin: Math.round(input.durationMin),
    approx: !!input.approx,
    route: input.route,
    roadSplit:
      split && ["city", "nh", "sh", "other"].every((k) => num(split[k as keyof RoadSplit])) ? split : null,
    photos,
    category: CATEGORY_KEYS.includes(input.category as never) ? input.category : "day",
    tags,
    seasons: (input.seasons ?? []).filter((s) => SEASON_KEYS.includes(s as never)),
    hairpins: num(input.hairpins) && input.hairpins! >= 0 ? Math.min(999, Math.round(input.hairpins!)) : null,
    notes: cleanMultiline(input.notes, 2000) || null,
    // "Ridden" in the form means the person saving it has ridden it; that's kept per rider in `rides`.
    status: status === "done" ? "wishlist" : status,
    statusDate: status === "planned" ? date : null,
    rideReport: status === "done" ? cleanMultiline(input.rideReport, 3000) || null : null,
    riddenOn: status === "done" ? (date ?? todayYmd()) : null,
  };
}

/** Marks (date) or unmarks (null) a ride as ridden by the viewer, keeping the activity feed in step. */
async function setRidden(ctx: Awaited<ReturnType<typeof requireRider>>, id: string, date: string | null) {
  const c = await cols();
  const key = { destinationId: id, riderId: ctx.viewer.id };
  if (date === null) {
    if ((await c.rides.deleteOne(key)).deletedCount) await dropActivity(ctx, "done", id);
    return;
  }
  const res = await c.rides.updateOne(key, { $set: { date }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  if (res.upsertedCount) await logActivity(ctx.log, "done", id, date);
}

export async function createDestination(slug: string, input: DestinationInput): Promise<Result<{ id: string }>> {
  const ctx = await requireRider(slug);
  const valid = validate(input);
  if (!valid) return fail("Something's off with that place. Try finding it again.");
  const { riddenOn, ...data } = valid;
  const id = rid(10);
  const now = new Date();
  await (await cols()).destinations.insertOne(
    toDoc<Destination>({ id, groupId: ctx.group.id, riderId: ctx.viewer.id, ...data, createdAt: now, updatedAt: now, deletedAt: null }),
  );
  await logActivity(ctx.log, "added", id, riddenOn ? "done" : data.status);
  if (riddenOn) await (await cols()).rides.insertOne({ destinationId: id, riderId: ctx.viewer.id, date: riddenOn, createdAt: now });
  refresh(slug);
  return { ok: true, id };
}

async function ownDestination(ctx: Awaited<ReturnType<typeof requireRider>>, id: string) {
  const row = fromDoc<Destination>(await (await cols()).destinations.findOne({ _id: id, groupId: ctx.group.id, deletedAt: null }));
  if (!row) throw new Error("Not found");
  if (row.riderId !== ctx.viewer.id) throw new Error("Only the rider who added this can change it");
  return row;
}

export async function updateDestination(slug: string, id: string, input: DestinationInput): Promise<Result> {
  const ctx = await requireRider(slug);
  const before = await ownDestination(ctx, id);
  const valid = validate(input);
  if (!valid) return fail("Something's off with that place.");
  const { riddenOn, ...data } = valid;
  await (await cols()).destinations.updateOne({ _id: id }, { $set: { ...data, updatedAt: new Date() } });
  if (data.status !== before.status && data.status === "planned") {
    await logActivity(ctx.log, "planned", id, data.statusDate);
  }
  await setRidden(ctx, id, riddenOn);
  refresh(slug);
  return { ok: true };
}

export async function setStatus(slug: string, id: string, status: string, date: string | null): Promise<Result> {
  const ctx = await requireRider(slug);
  const before = await ownDestination(ctx, id);
  if (!STATUS_KEYS.includes(status as never) || status === "done") return fail("Unknown status.");
  const statusDate = status === "planned" && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  await (await cols()).destinations.updateOne({ _id: id }, { $set: { status, statusDate, updatedAt: new Date() } });
  if (status !== before.status && status === "planned") {
    await logActivity(ctx.log, status, id, statusDate);
  }
  refresh(slug);
  return { ok: true };
}

export async function deleteDestination(slug: string, id: string): Promise<Result> {
  const ctx = await requireRider(slug);
  await ownDestination(ctx, id);
  await (await cols()).destinations.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
  refresh(slug);
  return { ok: true };
}

export async function refreshPhotos(slug: string, id: string): Promise<Result<{ count: number }>> {
  const ctx = await requireRider(slug);
  const row = await ownDestination(ctx, id);
  const photos = await photosNear(row);
  await (await cols()).destinations.updateOne({ _id: id }, { $set: { photos } });
  refresh(slug);
  return { ok: true, count: photos.length };
}

// ---------- Social ----------

async function visibleDestination(ctx: Awaited<ReturnType<typeof requireRider>>, id: string) {
  const row = await (await cols()).destinations.findOne(
    { _id: id, groupId: ctx.group.id, deletedAt: null },
    { projection: { riderId: 1 } },
  );
  if (!row) throw new Error("Not found");
  return { id: row._id, riderId: row.riderId };
}

async function dropActivity(ctx: Awaited<ReturnType<typeof requireRider>>, kind: string, destinationId: string) {
  await (await cols()).activity.deleteMany({ riderId: ctx.viewer.id, kind, destinationId });
}

/** Sets, changes or clears (emoji = null) the viewer's single reaction. */
export async function react(slug: string, id: string, emoji: string | null): Promise<Result> {
  const ctx = await requireRider(slug);
  await visibleDestination(ctx, id);
  const c = await cols();
  const key = { destinationId: id, riderId: ctx.viewer.id };
  await dropActivity(ctx, "reacted", id);
  if (emoji && (REACTIONS as readonly string[]).includes(emoji)) {
    await c.reactions.updateOne(key, { $set: { emoji, createdAt: new Date() } }, { upsert: true });
    await logActivity(ctx.log, "reacted", id, emoji);
  } else {
    await c.reactions.deleteOne(key);
  }
  refresh(slug);
  return { ok: true };
}

export async function toggleIn(slug: string, id: string): Promise<Result<{ in: boolean }>> {
  const ctx = await requireRider(slug);
  await visibleDestination(ctx, id);
  const c = await cols();
  const key = { destinationId: id, riderId: ctx.viewer.id };
  const existing = (await c.interests.deleteOne(key)).deletedCount > 0;
  if (existing) {
    await dropActivity(ctx, "in", id);
  } else {
    await c.interests.updateOne(key, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    await logActivity(ctx.log, "in", id);
  }
  refresh(slug);
  return { ok: true, in: !existing };
}

/** "I've ridden this" for any rider, on any ride. Pass a date to mark it, null to unmark. */
export async function markRidden(slug: string, id: string, date: string | null): Promise<Result> {
  const ctx = await requireRider(slug);
  await visibleDestination(ctx, id);
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a date.");
  await setRidden(ctx, id, date);
  refresh(slug);
  return { ok: true };
}

export async function addComment(slug: string, id: string, body: string): Promise<Result> {
  const ctx = await requireRider(slug);
  await visibleDestination(ctx, id);
  const text = cleanMultiline(body, 1000);
  if (!text) return fail("Say something first.");
  await (await cols()).comments.insertOne({
    _id: rid(),
    destinationId: id,
    riderId: ctx.viewer.id,
    body: text,
    createdAt: new Date(),
    deletedAt: null,
  });
  await logActivity(ctx.log, "commented", id, text.slice(0, 140));
  refresh(slug);
  return { ok: true };
}

export async function deleteComment(slug: string, commentId: string): Promise<Result> {
  const ctx = await requireRider(slug);
  const c = await cols();
  const row = await c.comments.findOne({ _id: commentId });
  if (!row || row.riderId !== ctx.viewer.id) return fail("You can only delete your own comments.");
  await c.comments.updateOne({ _id: commentId }, { $set: { deletedAt: new Date() } });
  refresh(slug);
  return { ok: true };
}

export async function addStop(
  slug: string,
  id: string,
  input: { kind: string; name: string; note: string; link: string },
): Promise<Result> {
  const ctx = await requireRider(slug);
  await visibleDestination(ctx, id);
  const kind = STOP_KIND_KEYS.includes(input.kind as never) ? input.kind : "other";
  let name = clean(input.name, 60);
  const link = clean(input.link, 600);
  let lat: number | null = null;
  let lng: number | null = null;
  let mapsUrl: string | null = null;
  if (link) {
    try {
      const place = await resolvePlace(link);
      lat = place.lat;
      lng = place.lng;
      mapsUrl = place.mapsUrl;
      name = name || place.name;
    } catch {
      return fail("Couldn't read that Maps link. Leave it empty or try another.");
    }
  }
  if (!name) return fail("Give the stop a name.");
  await (await cols()).stops.insertOne({
    _id: rid(),
    createdAt: new Date(),
    destinationId: id,
    riderId: ctx.viewer.id,
    kind,
    name,
    note: cleanMultiline(input.note, 300) || null,
    mapsUrl,
    lat,
    lng,
  });
  await logActivity(ctx.log, "stop", id, `${kind}:${name}`);
  refresh(slug);
  return { ok: true };
}

export async function deleteStop(slug: string, stopId: string): Promise<Result> {
  const ctx = await requireRider(slug);
  const c = await cols();
  const row = await c.stops.findOne({ _id: stopId });
  if (!row) return fail("Not found.");
  const dest = await visibleDestination(ctx, row.destinationId);
  if (row.riderId !== ctx.viewer.id && dest.riderId !== ctx.viewer.id) return fail("Not yours to remove.");
  await c.stops.deleteOne({ _id: stopId });
  refresh(slug);
  return { ok: true };
}

// ---------- Profile ----------

export async function updateProfile(slug: string, input: { emoji: string; color: string }): Promise<Result> {
  const ctx = await requireRider(slug);
  if (!(AVATAR_EMOJIS as readonly string[]).includes(input.emoji)) return fail("Pick an avatar.");
  if (!(AVATAR_COLORS as readonly string[]).includes(input.color)) return fail("Pick a colour.");
  await (await cols()).riders.updateOne({ _id: ctx.viewer.id }, { $set: { emoji: input.emoji, color: input.color } });
  refresh(slug);
  return { ok: true };
}

export async function changePin(slug: string, current: string, next: string): Promise<Result> {
  const ctx = await requireRider(slug);
  if (!isValidPin(next)) return fail("New PIN must be 4 digits.");
  const check = await verifyRiderPin(ctx.viewer, current);
  if (!check.ok) return check;
  const sessionVersion = ctx.viewer.sessionVersion + 1;
  await (await cols()).riders.updateOne({ _id: ctx.viewer.id }, { $set: { pinHash: hashPin(next), sessionVersion } });
  // Keep this device signed in; every other device gets signed out.
  await startSession({ ...ctx.viewer, sessionVersion });
  return { ok: true };
}

export async function markActivitySeen(slug: string) {
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return;
  await (await cols()).riders.updateOne({ _id: ctx.viewer.id }, { $set: { activitySeenAt: new Date() } });
  refresh(slug);
}
