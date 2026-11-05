"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cols, toDoc, type Group, type Rider } from "@/lib/db";
import { adminLoginAllowed, adminSecretMatches, endAdminSession, hashPin, isAdmin, isValidPin, startAdminSession } from "@/lib/auth";
import { groupSlug, rid } from "@/lib/ids";
import { logActivity } from "@/lib/data";
import { refreshLoop, refreshRoute } from "@/lib/reroute";
import { isValidId } from "@/lib/validate";
import { rideRef } from "@/lib/ride-model";
import { AVATAR_COLORS, AVATAR_EMOJIS, REGISTRATION_DAYS } from "@/lib/config";

async function guard() {
  if (!(await isAdmin())) redirect("/admin");
}

const days = (n: number) => new Date(Date.now() + n * 86400000);

export async function adminLogin(_: string | null, form: FormData) {
  const secret = String(form.get("secret") ?? "");
  if (!(await adminLoginAllowed())) return "Too many tries. Wait a while.";
  if (!secret || !adminSecretMatches(secret)) {
    await new Promise((r) => setTimeout(r, 800));
    return "Nope.";
  }
  await startAdminSession();
  redirect("/admin");
}

export async function adminLogout() {
  await endAdminSession();
  redirect("/admin");
}

export async function createGroup(form: FormData) {
  await guard();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  const id = rid();
  await (await cols()).groups.insertOne(
    toDoc<Group>({ id, slug: groupSlug(name), name, registrationClosesAt: days(REGISTRATION_DAYS), createdAt: new Date() }),
  );
  redirect(`/admin/g/${id}`);
}

export async function renameGroup(groupId: string, form: FormData) {
  await guard();
  if (!isValidId(groupId)) return;
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (name) await (await cols()).groups.updateOne({ _id: groupId }, { $set: { name } });
  revalidatePath("/admin", "layout");
}

export async function setRegistration(groupId: string, open: boolean) {
  await guard();
  if (!isValidId(groupId)) return;
  const c = await cols();
  const group = await c.groups.findOne({ _id: groupId });
  if (!group) return;
  const start = Math.max(Date.now(), group.registrationClosesAt.getTime());
  const closesAt = open ? new Date(start + REGISTRATION_DAYS * 86400000) : new Date();
  await c.groups.updateOne({ _id: groupId }, { $set: { registrationClosesAt: closesAt } });
  revalidatePath("/admin", "layout");
}

const resetFields = (pin: string) => ({
  $set: { pinHash: hashPin(pin), failedAttempts: 0, lockedUntil: null, lockouts: 0 },
  $inc: { sessionVersion: 1 },
});

export async function addRider(groupId: string, _: string | null, form: FormData) {
  await guard();
  if (!isValidId(groupId)) return "Crew not found.";
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 24);
  const pin = String(form.get("pin") ?? "");
  if (name.length < 2) return "Name needs 2+ letters.";
  if (!isValidPin(pin)) return "PIN must be 4 digits.";
  const nameKey = name.toLowerCase();
  const c = await cols();
  const taken = await c.riders.findOne({ groupId, nameKey });
  if (taken && !taken.removedAt) return `${name} already exists. Reset their PIN instead.`;
  if (taken) {
    // Bring back a removed rider with a fresh PIN.
    const reset = resetFields(pin);
    await c.riders.updateOne({ _id: taken._id }, { ...reset, $set: { ...reset.$set, removedAt: null } });
  } else {
    const id = rid();
    const now = new Date();
    await c.riders.insertOne(
      toDoc<Rider>({
        id,
        groupId,
        name,
        nameKey,
        emoji: AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)],
        color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        pinHash: hashPin(pin),
        sessionVersion: 1,
        failedAttempts: 0,
        lockedUntil: null,
        activitySeenAt: now,
        removedAt: null,
        createdAt: now,
      }),
    );
    await logActivity({ groupId, riderId: id }, "joined", null);
  }
  revalidatePath("/admin", "layout");
  return `Added ${name}. Send them the link and PIN ${pin}.`;
}

export async function resetPin(riderId: string, _: string | null, form: FormData) {
  await guard();
  if (!isValidId(riderId)) return "Rider not found.";
  const pin = String(form.get("pin") ?? "");
  if (!isValidPin(pin)) return "4 digits.";
  await (await cols()).riders.updateOne({ _id: riderId }, resetFields(pin));
  revalidatePath("/admin", "layout");
  return `PIN set to ${pin}`;
}

export async function removeRider(riderId: string) {
  await guard();
  if (!isValidId(riderId)) return;
  await (await cols()).riders.updateOne({ _id: riderId }, { $set: { removedAt: new Date() }, $inc: { sessionVersion: 1 } });
  revalidatePath("/admin", "layout");
}

export async function refreshRoutes(groupId: string, ids: string[]) {
  await guard();
  if (!isValidId(groupId) || !Array.isArray(ids) || ids.length > 3 || ids.some((id) => !rideRef(id))) {
    return { ok: false as const, error: "Invalid rides." };
  }
  const c = await cols();
  if (!(await c.groups.findOne({ _id: groupId }))) return { ok: false as const, error: "Crew not found." };
  const destIds = ids.filter((id) => !id.startsWith("loop:"));
  const loopIds = ids.filter((id) => id.startsWith("loop:")).map((id) => id.slice(5));
  const [rows, loops] = await Promise.all([
    c.destinations.find({ _id: { $in: destIds }, groupId, deletedAt: null }).toArray(),
    c.loops.find({ _id: { $in: loopIds }, groupId, deletedAt: null }).toArray(),
  ]);
  const results = await Promise.all([...rows.map(refreshRoute), ...loops.map(refreshLoop)]);
  revalidatePath("/admin", "layout");
  return { ok: true as const, updated: results.filter(Boolean).length, attempted: ids.length };
}
