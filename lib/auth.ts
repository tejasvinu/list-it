import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cols, fromDoc, type Group, type Rider } from "./db";

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const YEAR_S = 60 * 60 * 24 * 365;

function secret(name: "SESSION_SECRET" | "ADMIN_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret("SESSION_SECRET")).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ---------- PINs ----------

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(pin, salt, 32).toString("base64url");
  return `${salt}:${hash}`;
}

function pinMatches(pin: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return safeEqual(scryptSync(pin, salt, 32).toString("base64url"), hash);
}

export type PinCheck = { ok: true } | { ok: false; error: string };

/** Checks a PIN with a lockout after repeated misses. */
export async function verifyRiderPin(rider: Rider, pin: string): Promise<PinCheck> {
  const now = Date.now();
  if (rider.lockedUntil && rider.lockedUntil.getTime() > now) {
    const mins = Math.ceil((rider.lockedUntil.getTime() - now) / 60000);
    return { ok: false, error: `Too many tries. Try again in ${mins} min.` };
  }
  if (pinMatches(pin, rider.pinHash)) {
    if (rider.failedAttempts) {
      await (await cols()).riders.updateOne({ _id: rider.id }, { $set: { failedAttempts: 0, lockedUntil: null } });
    }
    return { ok: true };
  }
  const fails = rider.failedAttempts + 1;
  const locked = fails >= MAX_FAILS;
  await (await cols()).riders.updateOne(
    { _id: rider.id },
    { $set: { failedAttempts: locked ? 0 : fails, lockedUntil: locked ? new Date(now + LOCK_MS) : null } },
  );
  return {
    ok: false,
    error: locked ? "Too many tries. Locked for 10 min." : `Wrong PIN. ${MAX_FAILS - fails} ${MAX_FAILS - fails === 1 ? "try" : "tries"} left.`,
  };
}

// ---------- Rider sessions (one signed cookie per group) ----------

const cookieName = (groupId: string) => `crew_${groupId}`;

export async function startSession(rider: Rider) {
  const payload = `${rider.id}.${rider.sessionVersion}`;
  (await cookies()).set(cookieName(rider.groupId), `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: YEAR_S,
  });
}

export async function endSession(groupId: string) {
  (await cookies()).delete(cookieName(groupId));
}

export const getGroupBySlug = cache(async (slug: string): Promise<Group | null> => {
  return fromDoc<Group>(await (await cols()).groups.findOne({ slug }));
});

/** The signed-in rider for this group, or null. Deduped per request. */
export const getViewer = cache(async (groupId: string): Promise<Rider | null> => {
  const raw = (await cookies()).get(cookieName(groupId))?.value;
  if (!raw) return null;
  const [id, version, sig] = raw.split(".");
  if (!id || !version || !sig || !safeEqual(sig, sign(`${id}.${version}`))) return null;
  const rider = fromDoc<Rider>(await (await cols()).riders.findOne({ _id: id, groupId, removedAt: null }));
  if (!rider || String(rider.sessionVersion) !== version) return null;
  return rider;
});

export function isLockedOut(rider: Rider) {
  return !!rider.lockedUntil && rider.lockedUntil.getTime() > Date.now();
}

export function registrationOpen(group: Group) {
  return group.registrationClosesAt.getTime() > Date.now();
}

// ---------- Admin ----------

const ADMIN_COOKIE = "list_it_admin";

export function adminSecretMatches(input: string) {
  return safeEqual(input, secret("ADMIN_SECRET"));
}

export async function startAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, sign(`admin.${secret("ADMIN_SECRET")}`), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin() {
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!raw && safeEqual(raw, sign(`admin.${secret("ADMIN_SECRET")}`));
}
