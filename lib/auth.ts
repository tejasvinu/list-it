import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, createHmac, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cols, fromDoc, type Group, type Rider } from "./db";
import { allow, clientIp } from "./throttle";

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;
const YEAR_S = 60 * 60 * 24 * 365;
/** PIN guesses per IP, across every rider, so one phone can't walk the roster. */
const IP_PIN_LIMIT = 30;
const IP_PIN_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const scryptAsync = promisify(scrypt) as (pin: string, salt: string, len: number) => Promise<Buffer>;

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

async function pinMatches(pin: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return safeEqual((await scryptAsync(pin, salt, 32)).toString("base64url"), hash);
}

export type PinCheck = { ok: true } | { ok: false; error: string };

const lockedMessage = (until: Date) => {
  const min = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000));
  const wait = min < 90 ? `${min} min` : `${Math.round(min / 60)} hours`;
  return `Too many tries. Try again in ${wait}, or ask the admin to reset your PIN.`;
};

/**
 * Locks a rider who has used up their tries, atomically. Each lock in a row lasts six times the last
 * (10 min, 1 h, 6 h, then a day), so a fixed 10-minute lock can't be waited out over and over to walk all
 * 10,000 PINs. A correct PIN resets the run. Null when someone else already locked or unlocked them.
 */
async function lockRider(id: string, filter: object, now: Date) {
  const c = await cols();
  const doc = await c.riders.findOneAndUpdate(
    { _id: id, ...filter },
    [
      { $set: { failedAttempts: 0, lockouts: { $add: [{ $ifNull: ["$lockouts", 0] }, 1] } } },
      {
        $set: {
          lockedUntil: {
            $add: [now, { $min: [MAX_LOCK_MS, { $multiply: [LOCK_MS, { $pow: [6, { $subtract: ["$lockouts", 1] }] }] }] }],
          },
        },
      },
    ],
    { returnDocument: "after" },
  );
  return doc?.lockedUntil ?? null;
}

/**
 * Checks a PIN with a lockout after repeated misses. Each attempt is counted in the database before the
 * PIN is compared, so parallel guesses can't all slip in under one count.
 */
export async function verifyRiderPin(rider: Rider, pin: string): Promise<PinCheck> {
  if (!(await allow(`pin:${await clientIp()}`, IP_PIN_LIMIT, IP_PIN_WINDOW_MS))) {
    return { ok: false, error: "Too many PIN tries from this phone. Wait a few minutes." };
  }
  const c = await cols();
  const now = new Date();
  const open = { _id: rider.id, failedAttempts: { $lt: MAX_FAILS }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] };
  const claimed = await c.riders.findOneAndUpdate(open, { $inc: { failedAttempts: 1 } }, { returnDocument: "after" });
  if (!claimed) {
    // Either locked, or every attempt is spoken for. Turn a full count into a lock (it also heals a count
    // left behind by a request that died before it could set one).
    const until = await lockRider(rider.id, { failedAttempts: { $gte: MAX_FAILS }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] }, now);
    const current = until ?? (await c.riders.findOne({ _id: rider.id }, { projection: { lockedUntil: 1 } }))?.lockedUntil;
    return { ok: false, error: lockedMessage(current ?? new Date(now.getTime() + LOCK_MS)) };
  }
  if (await pinMatches(pin, claimed.pinHash)) {
    await c.riders.updateOne({ _id: rider.id }, { $set: { failedAttempts: 0, lockedUntil: null, lockouts: 0 } });
    return { ok: true };
  }
  const fails = claimed.failedAttempts;
  if (fails >= MAX_FAILS) {
    const until = await lockRider(rider.id, {}, new Date());
    return { ok: false, error: lockedMessage(until ?? new Date(Date.now() + LOCK_MS)) };
  }
  return { ok: false, error: `Wrong PIN. ${MAX_FAILS - fails} ${MAX_FAILS - fails === 1 ? "try" : "tries"} left.` };
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

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Compares fixed-length digests, so the secret's length doesn't leak through timing. */
export function adminSecretMatches(input: string) {
  return timingSafeEqual(digest(input), digest(secret("ADMIN_SECRET")));
}

/**
 * Admin password tries: 10 per IP per 15 min. There's deliberately no cap across all IPs: anyone could use
 * one up and keep the real admin out. What stops guessing is a long random ADMIN_SECRET (32+ characters).
 */
export async function adminLoginAllowed() {
  return allow(`admin:${await clientIp()}`, 10, 15 * 60 * 1000);
}

export async function startAdminSession() {
  const token = randomBytes(32).toString("base64url");
  await (await cols()).adminSessions.insertOne({ _id: token, expiresAt: new Date(Date.now() + ADMIN_TTL_MS) });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TTL_MS / 1000,
  });
}

export async function endAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) await (await cols()).adminSessions.deleteOne({ _id: token });
  store.delete(ADMIN_COOKIE);
}

export const isAdmin = cache(async () => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return !!(await (await cols()).adminSessions.findOne({ _id: token, expiresAt: { $gt: new Date() } }));
});
