"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  resolveRoute,
  routeFromHome,
  searchPlaces,
  type Place,
  type RoutedPlace,
} from "@/lib/geo";
import { AVATAR_COLORS, AVATAR_EMOJIS, REACTIONS, RIDER_LIMIT, STATUS_KEYS, STOP_KIND_KEYS } from "@/lib/config";
import { routeSealOk, sealRoute } from "@/lib/seal";
import { clean, cleanMultiline, inRange, isValidId, validateDestination, validDate, validRideDate, validStart, type DestinationInput } from "@/lib/validate";
import { allow, clientIp } from "@/lib/throttle";
import type { Photo, StartPoint, Itinerary } from "@/lib/types";
import { originRoute } from "@/lib/origin-routes";
import { notify } from "@/lib/notifications";
import { suggestStops } from "@/lib/overpass";
import { readRide, writeRide, validRidePlaces } from "@/lib/ride-store";
import { rideRef, rideEndDate } from "@/lib/ride-model";
import { importStops } from "@/lib/loops";
import { HOME } from "@/lib/config";
import { previewRideItinerary } from "./itinerary-actions";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

async function requireRider(slug: string) {
  const ctx = await getGroupContext(slug);
  // A revoked session gets the join screen straight away. Returning a structured "signed-out" result
  // would make every caller handle the same branch, and Next's production error redaction makes a
  // thrown error indistinguishable from a dropped connection on the client.
  if (!ctx.viewer) redirect(`/g/${slug}`);
  return { ...ctx, viewer: ctx.viewer, log: { groupId: ctx.group.id, riderId: ctx.viewer.id } };
}

const TEN_MINUTES = 10 * 60 * 1000;

/** Expensive or abusable actions share a cheap per-IP/per-rider bucket. */
async function within(key: string, limit: number, windowMs = TEN_MINUTES) {
  return allow(key, limit, windowMs);
}

const refresh = (slug: string) => revalidatePath(`/g/${slug}`, "layout");

// ---------- Joining & signing in ----------

export async function joinGroup(
  slug: string,
  input: { name: string; emoji: string; color: string; pin: string },
): Promise<Result> {
  const ctx = await getGroupContext(slug);
  if (!ctx.registrationOpen) return fail("Joining is closed for this crew. Ask the admin to add you.");
  if (!input || typeof input !== "object") return fail("Pick a name and a PIN first.");
  if (!(await within(`join:${await clientIp()}`, 10))) return fail("Too many joins from this phone. Wait a few minutes.");
  const name = clean(input.name, 24);
  if (name.length < 2) return fail("Name needs at least 2 letters.");
  if (!isValidPin(input.pin)) return fail("PIN must be 4 digits.");
  if (!(AVATAR_EMOJIS as readonly string[]).includes(input.emoji)) return fail("Pick an avatar.");
  if (!(AVATAR_COLORS as readonly string[]).includes(input.color)) return fail("Pick a colour.");
  if (ctx.riders.length >= RIDER_LIMIT) return fail("This crew is full.");
  const nameKey = name.toLowerCase();
  const takenMsg = fail(`"${name}" is taken. If that's you, use "I'm already in".`);
  const c = await cols();
  const existing = await c.riders.findOne({ groupId: ctx.group.id, nameKey }, { projection: { removedAt: 1 } });
  // A removed rider keeps their name so the admin can bring them back with their rides; say so plainly.
  if (existing?.removedAt) return fail(`"${name}" belonged to a rider the admin removed. Ask the admin to add them back, or pick another name.`);
  if (existing) return takenMsg;

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
  // The pre-insert count is only a fast path. Parallel joins can all pass it, so re-check after the
  // write and back this one out if the crew crossed the cap.
  if ((await c.riders.countDocuments({ groupId: ctx.group.id, removedAt: null })) > RIDER_LIMIT) {
    await c.riders.deleteOne({ _id: id, groupId: ctx.group.id });
    return fail("This crew is full.");
  }
  await startSession(rider);
  await logActivity({ groupId: ctx.group.id, riderId: id }, "joined", null);
  refresh(slug);
  return { ok: true };
}

export async function signIn(slug: string, riderId: string, pin: string): Promise<Result> {
  const ctx = await getGroupContext(slug);
  if (!isValidId(riderId)) return fail("Rider not found.");
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
  itinerary?: Itinerary | null;
  importNotes?: string[];
  photos: Photo[];
  /** Commons didn't answer, so there may well be photos; worth trying again later */
  photosFailed: boolean;
  nearby: { id: string; name: string; owner: string }[];
  /** Server signature over the route numbers; saving checks it */
  seal: string;
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
  return { ...routed, photos: photos ?? [], photosFailed: photos === null, nearby, seal: sealRoute(routed) };
}

export async function previewFromLink(slug: string, link: string): Promise<Result<{ preview: Preview }>> {
  const ctx = await requireRider(slug);
  if (!(await within(`preview:${ctx.viewer.id}`, 30))) return fail("Too many previews. Try again in a few minutes.");
  try {
    if (typeof link !== "string" || link.length > 4000) return fail("Paste a valid Maps link.");
    if (/https?:\/\//.test(link)) {
      let imported: Awaited<ReturnType<typeof resolveRoute>> | null = null;
      try { imported = await resolveRoute(link); } catch (error) {
        if (/\/dir\/|[?&]destination=/.test(link)) return fail(error instanceof Error ? error.message : "Could not read that route.");
      }
      if (imported) {
        const rides = await (await cols()).destinations.find({ groupId: ctx.group.id, deletedAt: null }).toArray();
        const { stops, dropped } = importStops(imported.places, ctx.viewer.start ?? HOME, rides.filter(d => !d.itinerary).map(d => ({ ...d, id: d._id })));
        const result = await previewRideItinerary(slug, stops);
        if (result.ok) result.preview.importNotes = [...imported.skipped.map(name => `${name} (not imported)`), ...dropped.map(name => `${name} (using your saved start instead)`)];
        return result;
      }
    }
    return { ok: true, preview: await preview(ctx, await resolvePlace(link)) };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't read that link.");
  }
}

export async function previewFromPlace(slug: string, place: Place): Promise<Result<{ preview: Preview }>> {
  const ctx = await requireRider(slug);
  if (!(await within(`preview:${ctx.viewer.id}`, 60))) return fail("Too many pin moves. Try again in a few minutes.");
  if (!inRange(place?.lat, place?.lng)) return fail("That spot is too far from Bengaluru to ride.");
  return {
    ok: true,
    preview: await preview(ctx, {
      name: clean(place.name, 80) || "Dropped pin",
      area: clean(place.area, 80) || null,
      lat: place.lat,
      lng: place.lng,
      // A searched or moved pin has no Maps link of its own; one from the browser can't be trusted.
      mapsUrl: null,
    }),
  };
}

export async function searchPlacesAction(slug: string, q: string): Promise<Place[]> {
  const ctx = await requireRider(slug);
  if (!(await within(`search:${ctx.viewer.id}`, 60))) return [];
  try {
    return typeof q === "string" ? await searchPlaces(q.slice(0, 80)) : [];
  } catch {
    return [];
  }
}

// ---------- Destinations ----------

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

/** Cleans the form and checks the route numbers are the ones the server worked out. */
function checkInput(input: DestinationInput) {
  const valid = validateDestination(input);
  return valid && routeSealOk(input, input.seal) ? valid : null;
}

export async function createDestination(slug: string, input: DestinationInput): Promise<Result<{ id: string }>> {
  const ctx = await requireRider(slug);
  if (!(await within(`write:${ctx.viewer.id}`, 30))) return fail("Too many new rides. Try again in a few minutes.");
  const valid = checkInput(input);
  if (!valid) return fail("Something's off with that place. Try finding it again.");
  const { riddenOn, ...data } = valid;
  if (process.env.DISABLE_NEW_ITINERARIES === "1" && data.itinerary) return fail("New itineraries are temporarily unavailable.");
  if (!(await validRidePlaces(ctx.group.id, data.itinerary))) return fail("A saved place is no longer available in this crew.");
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
  const row = await readRide(ctx.group.id, id);
  if (!row) throw new Error("Not found");
  // Rides from riders the admin removed would otherwise be stuck, so the crew looks after them.
  // This applies to legacy loops as well as destinations.
  const ownerGone = !ctx.riders.some((r) => r.id === row.riderId);
  if (row.riderId !== ctx.viewer.id && !ownerGone) throw new Error("Only the rider who added this can change it");
  return row;
}

export async function updateDestination(slug: string, id: string, input: DestinationInput): Promise<Result> {
  const ctx = await requireRider(slug);
  const before = await ownDestination(ctx, id);
  const valid = checkInput(input);
  if (!valid) return fail("Something's off with that place. Try finding it again.");
  const { riddenOn, ...data } = valid;
  if (process.env.DISABLE_NEW_ITINERARIES === "1" && data.itinerary && !before.itinerary) return fail("New itineraries are temporarily unavailable.");
  if (!(await validRidePlaces(ctx.group.id, data.itinerary, before.itinerary))) return fail("A saved place is no longer available in this crew.");
  if (input.expectedUpdatedAt && input.expectedUpdatedAt !== before.updatedAt.toISOString()) return fail("This ride changed. Reload before saving.");
  // Old open forms cannot replace an itinerary with a single-pin route.
  if (before.itinerary && !("itinerary" in input)) return fail("This ride now has an itinerary. Reload before saving.");
  if (rideRef(id)?.source === "loop" && !data.itinerary) return fail("Keep at least one itinerary place.");
  const saved = await writeRide(ctx.group.id, id, { ...data, updatedAt: new Date() }, before.updatedAt);
  if (!saved.matchedCount) return fail("This ride changed. Reload before saving.");
  if (data.status === "planned" && (before.status !== "planned" || (data.statusDate && data.statusDate !== before.statusDate))) {
    await logActivity(ctx.log, "planned", id, data.statusDate);
  }
  if (riddenOn) await setRidden(ctx, id, riddenOn);
  refresh(slug);
  return { ok: true };
}

export async function setStatus(slug: string, id: string, status: string, date: string | null): Promise<Result> {
  const ctx = await requireRider(slug);
  const before = await ownDestination(ctx, id);
  if (!STATUS_KEYS.includes(status as never) || status === "done") return fail("Unknown status.");
  if (status === "planned" && date && !validDate(date)) return fail("Pick a valid date.");
  const statusDate = status === "planned" && date ? date : null;
  const saved = await writeRide(ctx.group.id, id, { status, statusDate, updatedAt: new Date() }, before.updatedAt);
  if (!saved.matchedCount) return fail("This ride changed. Reload before saving.");
  if (status === "planned" && (before.status !== "planned" || (statusDate && statusDate !== before.statusDate))) {
    await logActivity(ctx.log, status, id, statusDate);
  }
  refresh(slug);
  return { ok: true };
}

export async function deleteDestination(slug: string, id: string): Promise<Result> {
  const ctx = await requireRider(slug);
  await ownDestination(ctx, id);
  const c = await cols();
  await writeRide(ctx.group.id, id, { deletedAt: new Date() });
  await c.uploads.deleteMany({ groupId: ctx.group.id, destinationId: id });
  refresh(slug);
  return { ok: true };
}

export async function refreshPhotos(slug: string, id: string): Promise<Result<{ count: number }>> {
  const ctx = await requireRider(slug);
  if (!(await within(`photos:${ctx.viewer.id}`, 10))) return fail("Too many photo lookups. Try again in a few minutes.");
  const row = await ownDestination(ctx, id);
  const photos = await photosNear(row);
  // Keep what's there when Commons is down, rather than wiping it.
  if (photos === null) return fail("Wikimedia Commons isn't answering. Try again in a bit.");
  const saved = await writeRide(ctx.group.id, id, { photos, updatedAt: new Date() }, row.updatedAt);
  if (!saved.matchedCount) return fail("This ride changed while finding photos. Try again.");
  refresh(slug);
  return { ok: true, count: photos.length };
}

// ---------- Social ----------

async function visibleDestination(ctx: Awaited<ReturnType<typeof requireRider>>, id: string) {
  const row = await readRide(ctx.group.id, id);
  if (!row) throw new Error("Ride not found");
  return row;
}

async function dropActivity(ctx: Awaited<ReturnType<typeof requireRider>>, kind: string, destinationId: string) {
  const ref = rideRef(destinationId);
  const eventKind = ref?.source === "loop" && kind === "in" ? "loop-in" : kind;
  await (await cols()).activity.deleteMany({ groupId: ctx.group.id, riderId: ctx.viewer.id, kind: eventKind, ...(ref?.source === "loop" ? { loopId: ref.id } : { destinationId }) });
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
  const ref = rideRef(id)!;
  const existing = ref.source === "loop"
    ? (await c.loopInterests.deleteOne({ loopId: ref.id, riderId: ctx.viewer.id })).deletedCount > 0
    : (await c.interests.deleteOne({ destinationId: id, riderId: ctx.viewer.id })).deletedCount > 0;
  if (existing) {
    await dropActivity(ctx, "in", id);
  } else {
    if (ref.source === "loop") await c.loopInterests.updateOne({ loopId: ref.id, riderId: ctx.viewer.id }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    else await c.interests.updateOne({ destinationId: id, riderId: ctx.viewer.id }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    await logActivity(ctx.log, "in", id);
  }
  refresh(slug);
  return { ok: true, in: !existing };
}

/** "I've ridden this" for any rider, on any ride. Pass a date to mark it, null to unmark. */
export async function markRidden(slug: string, id: string, date: string | null): Promise<Result> {
  const ctx = await requireRider(slug);
  await visibleDestination(ctx, id);
  if (date !== null && !validRideDate(date)) return fail("Pick a date.");
  await setRidden(ctx, id, date);
  refresh(slug);
  return { ok: true };
}

export async function addComment(slug: string, id: string, body: string): Promise<Result> {
  const ctx = await requireRider(slug);
  if (!(await within(`comment:${ctx.viewer.id}`, 60))) return fail("Too many comments. Try again in a few minutes.");
  await visibleDestination(ctx, id);
  const text = cleanMultiline(body, 1000);
  if (!text) return fail("Say something first.");
  const ref = rideRef(id)!;
  const c = await cols();
  const comment = { _id: rid(), riderId: ctx.viewer.id, body: text, createdAt: new Date(), deletedAt: null };
  if (ref.source === "loop") await c.loopComments.insertOne({ ...comment, loopId: ref.id });
  else await c.comments.insertOne({ ...comment, destinationId: id });
  await logActivity(ctx.log, "commented", id, text.slice(0, 140));
  refresh(slug);
  return { ok: true };
}

export async function deleteComment(slug: string, commentId: string, parentKey?: string): Promise<Result> {
  const ctx = await requireRider(slug);
  if (!isValidId(commentId)) return fail("Comment not found.");
  const c = await cols();
  const ref = parentKey ? rideRef(parentKey) : null;
  if (parentKey && !ref) return fail("Comment not found.");
  if (ref?.source === "loop") {
    await visibleDestination(ctx, parentKey!);
    const result = await c.loopComments.updateOne({ _id: commentId, loopId: ref.id, riderId: ctx.viewer.id, deletedAt: null }, { $set: { deletedAt: new Date() } });
    if (!result.matchedCount) return fail("You can only delete your own comments.");
  } else {
    const row = await c.comments.findOne({ _id: commentId });
    if (!row || row.riderId !== ctx.viewer.id || (parentKey && row.destinationId !== parentKey)) return fail("You can only delete your own comments.");
    await visibleDestination(ctx, row.destinationId);
    await c.comments.updateOne({ _id: commentId }, { $set: { deletedAt: new Date() } });
  }
  refresh(slug);
  return { ok: true };
}

export async function addStop(
  slug: string,
  id: string,
  input: { kind: string; name: string; note: string; link: string },
): Promise<Result> {
  const ctx = await requireRider(slug);
  if (!input || typeof input !== "object") return fail("Give the stop a name.");
  if (!(await within(`stop:${ctx.viewer.id}`, 30))) return fail("Too many stops. Try again in a few minutes.");
  await visibleDestination(ctx, id);
  const kind = STOP_KIND_KEYS.includes(input.kind as never) ? input.kind : "other";
  let name = clean(input.name, 60);
  const link = clean(input.link, 600);
  let lat: number | null = null;
  let lng: number | null = null;
  let mapsUrl: string | null = null;
  if (link) {
    try {
      // With a name typed in, only the coordinates are needed; skip the slow name lookup.
      const place = await resolvePlace(link, { lookupName: !name });
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
  if (!isValidId(stopId)) return fail("Not found.");
  const c = await cols();
  const row = await c.stops.findOne({ _id: stopId });
  if (!row) return fail("Not found.");
  const dest = await visibleDestination(ctx, row.destinationId);
  const ownerGone = !ctx.riders.some((r) => r.id === dest.riderId);
  if (row.riderId !== ctx.viewer.id && dest.riderId !== ctx.viewer.id && !ownerGone) return fail("Not yours to remove.");
  await c.stops.deleteOne({ _id: stopId });
  refresh(slug);
  return { ok: true };
}

// ---------- Profile ----------

export async function updateProfile(slug: string, input: { name: string; emoji: string; color: string }): Promise<Result> {
  const ctx = await requireRider(slug);
  if (!input || typeof input !== "object") return fail("Pick a name and an avatar.");
  const name = clean(input.name, 24);
  if (name.length < 2) return fail("Name needs at least 2 letters.");
  if (!(AVATAR_EMOJIS as readonly string[]).includes(input.emoji)) return fail("Pick an avatar.");
  if (!(AVATAR_COLORS as readonly string[]).includes(input.color)) return fail("Pick a colour.");
  const nameKey = name.toLowerCase();
  const taken = fail(`"${name}" is taken in this crew. Try another.`);
  const c = await cols();
  if (nameKey !== ctx.viewer.nameKey && (await c.riders.findOne({ groupId: ctx.group.id, nameKey }))) return taken;
  try {
    await c.riders.updateOne({ _id: ctx.viewer.id }, { $set: { name, nameKey, emoji: input.emoji, color: input.color } });
  } catch (e) {
    // Someone took the name between the check and the write: the unique index wins.
    if ((e as { code?: number }).code === 11000) return taken;
    throw e;
  }
  refresh(slug);
  return { ok: true };
}

export async function changePin(slug: string, current: string, next: string): Promise<Result> {
  const ctx = await requireRider(slug);
  if (!isValidPin(current)) return fail("Current PIN must be 4 digits.");
  if (!isValidPin(next)) return fail("New PIN must be 4 digits.");
  const check = await verifyRiderPin(ctx.viewer, current);
  if (!check.ok) return check;
  const sessionVersion = (ctx.viewer.sessionVersion ?? 0) + 1;
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

export async function saveStart(slug: string, input: StartPoint | null): Promise<Result> {
  const ctx = await requireRider(slug);
  const start = input === null ? null : validStart(input);
  if (input !== null && !start) return fail("Pick a valid start point.");
  await (await cols()).riders.updateOne({ _id: ctx.viewer.id, groupId: ctx.group.id }, { $set: { start } });
  refresh(slug);
  return { ok: true };
}

export async function fillOriginRoutes(slug: string, ids: string[]): Promise<Result<{ count: number }>> {
  const ctx = await requireRider(slug);
  if (!ctx.viewer.start) return fail("Set your start point first.");
  if (!Array.isArray(ids) || ids.length > 3 || ids.some(id => !rideRef(id))) return fail("Invalid rides.");
  if (!(await within(`origin:${ctx.viewer.id}`, 20))) return fail("Too many distance lookups. Try again in a few minutes.");
  const rows = (await Promise.all(ids.map(id => readRide(ctx.group.id, id)))).filter((d): d is Destination => !!d);
  await Promise.all(rows.map(d => originRoute(d, ctx.viewer.start!)));
  refresh(slug);
  return { ok: true, count: rows.length };
}

export async function logRide(slug: string, id: string, input: { date: string; riderIds: string[]; note: string }): Promise<Result> {
  const ctx = await requireRider(slug);
  await visibleDestination(ctx, id);
  if (!input || !validRideDate(input.date)) return fail("Pick a valid date that isn't in the future.");
  if (!Array.isArray(input.riderIds) || !input.riderIds.length || input.riderIds.length > ctx.riders.length || input.riderIds.some(r => typeof r !== "string" || !ctx.riders.some(member => member.id === r))) return fail("Pick riders from this crew.");
  if (typeof input.note !== "string" || input.note.length > 500) return fail("Keep your note to 500 characters.");
  const ids = [...new Set(input.riderIds)];
  const c = await cols();
  await Promise.all(ids.map(riderId => c.rides.updateOne({ destinationId: id, riderId }, {
    $set: { date: input.date, ...(riderId === ctx.viewer.id ? { note: cleanMultiline(input.note, 500) } : {}) },
    $setOnInsert: { createdAt: new Date(), ...(riderId !== ctx.viewer.id ? { loggedBy: ctx.viewer.id } : {}) },
  }, { upsert: true })));
  const planned = await visibleDestination(ctx, id);
  if (planned.status === "planned" && rideEndDate(planned) === input.date) await writeRide(ctx.group.id, id, { status: "wishlist", statusDate: null, updatedAt: new Date() }, planned.updatedAt);
  await logActivity(ctx.log, "rode", id, `${input.date} · ${ids.length} rider${ids.length === 1 ? "" : "s"}`);
  const owner = await visibleDestination(ctx, id);
  if (!ids.includes(owner.riderId)) await notify(ctx.group.id, ctx.viewer.id, "rode", id, null, input.date);
  await notify(ctx.group.id, ctx.viewer.id, "logged", id, null, input.date, ids);
  refresh(slug);
  return { ok: true };
}

export async function removeRideLog(slug: string, id: string, riderId: string): Promise<Result> {
  const ctx = await requireRider(slug);
  await visibleDestination(ctx, id);
  if (typeof riderId !== "string" || !ctx.riders.some(r => r.id === riderId)) return fail("Rider not found.");
  const c = await cols();
  const entry = await c.rides.findOne({ destinationId: id, riderId });
  if (!entry || (riderId !== ctx.viewer.id && entry.loggedBy !== ctx.viewer.id)) return fail("You can't remove this ride.");
  await c.rides.deleteOne({ destinationId: id, riderId });
  refresh(slug);
  return { ok: true };
}

export async function loadSuggestions(
  slug: string,
  id: string,
): Promise<Result<{ stops: import("@/lib/db").SuggestedStop[] }>> {
  const ctx = await requireRider(slug);
  if (!rideRef(id)) return fail("Ride not found.");
  if (!(await within(`stops:${ctx.viewer.id}`, 10))) return fail("Too many stop lookups. Try again in a few minutes.");
  const row = await readRide(ctx.group.id, id);
  if (!row) return fail("Ride not found.");
  const stops = await suggestStops(row);
  if (!stops) return fail("OpenStreetMap's stop finder is busy. Try again in a few minutes.");
  return { ok: true, stops };
}

export async function addSuggestion(slug: string, id: string, suggestionId: string): Promise<Result> {
  const ctx = await requireRider(slug);
  await visibleDestination(ctx, id);
  if (typeof suggestionId !== "string" || !/^\d+$/.test(suggestionId)) return fail("Stop not found.");
  const c = await cols();
  const cached = await c.stopSuggestions.findOne({ destinationId: id });
  const destination = await readRide(ctx.group.id, id);
  const routeKey = destination && JSON.stringify([destination.lat, destination.lng, destination.route]);
  const stop = cached?.routeKey === routeKey ? cached.stops.find((item) => item.id === suggestionId) : undefined;
  if (!stop) return fail("Stop not found. Load suggestions again.");
  const existing = await c.stops.findOne({ destinationId: id, kind: stop.kind, lat: stop.lat, lng: stop.lng });
  if (existing) return { ok: true };
  await c.stops.insertOne({
    _id: rid(),
    destinationId: id,
    riderId: ctx.viewer.id,
    kind: stop.kind,
    name: stop.name,
    lat: stop.lat,
    lng: stop.lng,
    mapsUrl: null,
    note: null,
    createdAt: new Date(),
  });
  await logActivity(ctx.log, "stop", id, `${stop.kind}:${stop.name}`);
  refresh(slug);
  return { ok: true };
}

export async function markNotificationsRead(slug: string): Promise<Result> {
  const ctx = await requireRider(slug);
  await (
    await cols()
  ).notifications.updateMany(
    { groupId: ctx.group.id, riderId: ctx.viewer.id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  refresh(slug);
  return { ok: true };
}
