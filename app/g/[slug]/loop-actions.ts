"use server";

import { revalidatePath } from "next/cache";
import { getGroupContext } from "@/lib/data";
import { cols, fromDoc, toDoc, type Activity } from "@/lib/db";
import { HOME } from "@/lib/config";
import { resolvePlace, resolveRoute, searchPlaces } from "@/lib/geo";
import { routeLoop } from "@/lib/loop-routing";
import { rid } from "@/lib/ids";
import { notify } from "@/lib/notifications";
import { cleanMultiline, inRange, validateLoop } from "@/lib/validate";
import type { Loop, LoopStop } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const refresh = (slug: string) => revalidatePath(`/g/${slug}`, "layout");

async function context(slug: string) {
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) throw new Error("Sign in first");
  return { ...ctx, viewer: ctx.viewer };
}

async function ownedLoop(groupId: string, riderId: string, id: string) {
  return fromDoc<Loop>(await (await cols()).loops.findOne({ _id: id, groupId, riderId, deletedAt: null }));
}

async function checkedStops(groupId: string, stops: LoopStop[]) {
  const ids = stops.flatMap((s) => (s.destinationId ? [s.destinationId] : []));
  const rows = await (await cols()).destinations.find({ _id: { $in: ids }, groupId, deletedAt: null }).toArray();
  const byId = new Map(rows.map((row) => [row._id, row]));
  if (ids.some((id) => !byId.has(id))) return null;
  return stops.map((s) => {
    const d = s.destinationId ? byId.get(s.destinationId) : null;
    return d ? { ...s, name: d.name, lat: d.lat, lng: d.lng } : s;
  });
}

async function activity(groupId: string, riderId: string, loopId: string, kind: string, detail: string | null = null) {
  await (
    await cols()
  ).activity.insertOne(
    toDoc<Activity>({ id: rid(), groupId, riderId, loopId, kind, destinationId: null, detail, createdAt: new Date() }),
  );
}

export async function resolveLoopPlace(slug: string, input: string): Promise<Result<{ place: LoopStop }>> {
  await context(slug);
  if (typeof input !== "string" || !input.trim() || input.length > 2000) return fail("Enter a place first.");
  try {
    const place = await resolvePlace(input);
    if (!inRange(place.lat, place.lng)) return fail("That place is too far from Bengaluru.");
    return {
      ok: true,
      place: { destinationId: null, name: place.name, lat: place.lat, lng: place.lng, nightHere: false },
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't find that place.");
  }
}

export async function importLoopRoute(
  slug: string,
  input: string,
): Promise<Result<{ places: { name: string; lat: number; lng: number }[]; skipped: string[] }>> {
  await context(slug);
  if (typeof input !== "string" || !input.trim() || input.length > 4000) return fail("Paste a Maps route first.");
  try {
    const { places, skipped } = await resolveRoute(input);
    const near = places.filter((p) => inRange(p.lat, p.lng));
    for (const p of places) if (!near.includes(p)) skipped.push(`${p.name} (too far from Bengaluru)`);
    if (!near.length) return fail("Couldn't place any stops from that route.");
    return { ok: true, places: near.map(({ name, lat, lng }) => ({ name, lat, lng })), skipped };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't read that route.");
  }
}

export async function searchLoopPlaces(slug: string, input: string): Promise<Result<{ places: LoopStop[] }>> {
  await context(slug);
  if (typeof input !== "string" || input.trim().length < 2 || input.length > 80)
    return fail("Enter a place to search.");
  try {
    const places = await searchPlaces(input);
    return {
      ok: true,
      places: places
        .filter((p) => inRange(p.lat, p.lng))
        .map((p) => ({ destinationId: null, name: p.name, lat: p.lat, lng: p.lng, nightHere: false })),
    };
  } catch {
    return fail("Place search is unavailable. Try a Maps link.");
  }
}

export async function previewLoop(
  slug: string,
  input: unknown,
  id: string | null,
): Promise<Result<{ routed: Awaited<ReturnType<typeof routeLoop>> }>> {
  const ctx = await context(slug);
  if (id !== null && (typeof id !== "string" || !id || id.length > 80)) return fail("Loop not found.");
  const data = validateLoop(input);
  if (!data) return fail("Add a name and at least one valid stop.");
  const old = id ? await ownedLoop(ctx.group.id, ctx.viewer.id, id) : null;
  if (id && !old) return fail("Only the owner can edit this loop.");
  const stops = await checkedStops(ctx.group.id, data.stops);
  if (!stops) return fail("A ride in this loop is no longer available.");
  return { ok: true, routed: await routeLoop(old?.start ?? ctx.viewer.start ?? HOME, stops) };
}

export async function saveLoop(slug: string, input: unknown, id: string | null): Promise<Result<{ id: string }>> {
  const ctx = await context(slug);
  if (id !== null && (typeof id !== "string" || !id || id.length > 80)) return fail("Loop not found.");
  const data = validateLoop(input);
  if (!data) return fail("Add a name and at least one valid stop, and check the date.");
  const c = await cols();
  const old = id ? await ownedLoop(ctx.group.id, ctx.viewer.id, id) : null;
  if (id && !old) return fail("Only the owner can edit this loop.");
  const stops = await checkedStops(ctx.group.id, data.stops);
  if (!stops) return fail("A ride in this loop is no longer available.");
  const start = old?.start ?? ctx.viewer.start ?? HOME;
  const routed = await routeLoop(start, stops);
  const now = new Date();
  if (old) {
    const result = await c.loops.updateOne(
      { _id: old.id, groupId: ctx.group.id, riderId: ctx.viewer.id, deletedAt: null, updatedAt: old.updatedAt },
      { $set: { ...data, stops, ...routed, updatedAt: now } },
    );
    if (!result.matchedCount) return fail("The loop changed. Reload and try again.");
  } else {
    id = rid(10);
    await c.loops.insertOne(
      toDoc<Loop>({
        id,
        groupId: ctx.group.id,
        riderId: ctx.viewer.id,
        ...data,
        stops,
        start,
        ...routed,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }),
    );
    await activity(ctx.group.id, ctx.viewer.id, id, "loop-added");
  }
  refresh(slug);
  return { ok: true, id: id! };
}

export async function deleteLoop(slug: string, id: string): Promise<Result> {
  const ctx = await context(slug);
  if (typeof id !== "string" || !id || id.length > 80) return fail("Loop not found.");
  const result = await (
    await cols()
  ).loops.updateOne(
    { _id: id, groupId: ctx.group.id, riderId: ctx.viewer.id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  );
  if (!result.matchedCount) return fail("Only the owner can delete this loop.");
  refresh(slug);
  return { ok: true };
}

export async function toggleLoopIn(slug: string, id: string): Promise<Result> {
  const ctx = await context(slug);
  if (typeof id !== "string" || !id || id.length > 80) return fail("Loop not found.");
  const c = await cols();
  if (!(await c.loops.findOne({ _id: id, groupId: ctx.group.id, deletedAt: null }))) return fail("Loop not found.");
  const key = { loopId: id, riderId: ctx.viewer.id };
  if ((await c.loopInterests.deleteOne(key)).deletedCount) {
    await c.activity.deleteMany({ ...key, groupId: ctx.group.id, kind: "loop-in" });
  } else {
    await c.loopInterests.updateOne(key, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    await activity(ctx.group.id, ctx.viewer.id, id, "loop-in");
    await notify(ctx.group.id, ctx.viewer.id, "loop-in", null, id);
  }
  refresh(slug);
  return { ok: true };
}

export async function commentLoop(slug: string, id: string, body: string): Promise<Result> {
  const ctx = await context(slug);
  if (typeof id !== "string" || !id || id.length > 80) return fail("Loop not found.");
  const c = await cols();
  if (!(await c.loops.findOne({ _id: id, groupId: ctx.group.id, deletedAt: null }))) return fail("Loop not found.");
  const text = cleanMultiline(body, 1000);
  if (!text) return fail("Say something first.");
  await c.loopComments.insertOne({
    _id: rid(),
    loopId: id,
    riderId: ctx.viewer.id,
    body: text,
    createdAt: new Date(),
    deletedAt: null,
  });
  await activity(ctx.group.id, ctx.viewer.id, id, "loop-commented", text.slice(0, 140));
  await notify(ctx.group.id, ctx.viewer.id, "loop-commented", null, id, text.slice(0, 140));
  refresh(slug);
  return { ok: true };
}

export async function deleteLoopComment(slug: string, id: string, commentId: string): Promise<Result> {
  const ctx = await context(slug);
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 80 ||
    typeof commentId !== "string" ||
    !commentId ||
    commentId.length > 80
  )
    return fail("Comment not found.");
  const c = await cols();
  if (!(await c.loops.findOne({ _id: id, groupId: ctx.group.id, deletedAt: null }))) return fail("Loop not found.");
  const result = await c.loopComments.updateOne(
    { _id: commentId, loopId: id, riderId: ctx.viewer.id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  );
  if (!result.matchedCount) return fail("You can only delete your own comments.");
  refresh(slug);
  return { ok: true };
}

export async function addRideToLoop(slug: string, loopId: string, destinationId: string): Promise<Result> {
  const ctx = await context(slug);
  if (
    typeof loopId !== "string" ||
    !loopId ||
    loopId.length > 80 ||
    typeof destinationId !== "string" ||
    !destinationId ||
    destinationId.length > 80
  )
    return fail("Loop or ride not found.");
  const c = await cols();
  const loop = await ownedLoop(ctx.group.id, ctx.viewer.id, loopId);
  const destination = await c.destinations.findOne({ _id: destinationId, groupId: ctx.group.id, deletedAt: null });
  if (!loop || !destination) return fail("Loop or ride not found.");
  if (loop.stops.length >= 20) return fail("A loop can have up to 20 stops.");
  if (loop.stops.some((s) => s.destinationId === destinationId)) return fail("This ride is already in the loop.");
  const stops = [
    ...loop.stops,
    { destinationId, name: destination.name, lat: destination.lat, lng: destination.lng, nightHere: false },
  ];
  const routed = await routeLoop(loop.start, stops);
  const updated = await c.loops.updateOne(
    { _id: loopId, groupId: ctx.group.id, riderId: ctx.viewer.id, deletedAt: null, updatedAt: loop.updatedAt },
    { $set: { stops, ...routed, updatedAt: new Date() } },
  );
  if (!updated.matchedCount) return fail("The loop changed. Reload and try again.");
  refresh(slug);
  return { ok: true };
}
