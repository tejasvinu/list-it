import "server-only";
import { MongoClient, type Binary, type Collection, type Db } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import type { Photo, RoadSplit, StartPoint, Loop } from "./types";
export type { Loop } from "./types";

// ---------- Shapes (as the app sees them; stored with `_id` instead of `id`) ----------

export type Group = {
  id: string;
  /** The secret part of the share link: /g/<slug> */
  slug: string;
  name: string;
  registrationClosesAt: Date;
  createdAt: Date;
};

export type Rider = {
  id: string;
  groupId: string;
  name: string;
  /** Lowercased name, unique per group */
  nameKey: string;
  emoji: string;
  color: string;
  pinHash: string;
  /** Bumped on PIN reset or removal, which signs out every device */
  sessionVersion: number;
  failedAttempts: number;
  lockedUntil: Date | null;
  /** Lockouts in a row since the last correct PIN; each one lasts longer. Missing on older riders. */
  lockouts?: number;
  start?: StartPoint | null;
  activitySeenAt: Date | null;
  removedAt: Date | null;
  createdAt: Date;
};

export type Destination = {
  id: string;
  groupId: string;
  riderId: string;
  name: string;
  area: string | null;
  mapsUrl: string | null;
  lat: number;
  lng: number;
  /** Bengaluru -> destination -> Bengaluru */
  distanceKm: number;
  durationMin: number;
  /** True when routing failed and the numbers are a straight-line estimate */
  approx: boolean;
  /** [[lat, lng], ...], simplified */
  route: [number, number][];
  category: string;
  tags: string[];
  seasons: string[];
  roadSplit: RoadSplit | null;
  photos: Photo[];
  hairpins: number | null;
  notes: string | null;
  /** What we learned riding it: written by the owner once they've ridden it */
  rideReport: string | null;
  /** wishlist | hailmary | planned. Who has ridden it lives in `rides`, per rider. */
  status: string;
  /** YYYY-MM-DD: the planned ride date */
  statusDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type Stop = {
  id: string;
  destinationId: string;
  riderId: string;
  /** breakfast | viewpoint | photo | fuel | other */
  kind: string;
  name: string;
  note: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
};

export type Comment = {
  id: string;
  destinationId: string;
  riderId: string;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
};

/** One per rider per destination */
export type Reaction = { destinationId: string; riderId: string; emoji: string; createdAt: Date };
/** "I'm in", one per rider per destination */
export type Interest = { destinationId: string; riderId: string; createdAt: Date };
/** "I've ridden this", one per rider per destination. `date` is YYYY-MM-DD. */
export type Ride = { destinationId: string; riderId: string; date: string | null; createdAt: Date; note?: string | null; loggedBy?: string | null };

export type Activity = {
  id: string;
  groupId: string;
  riderId: string;
  /** joined | added | planned | done | commented | reacted | in | stop */
  kind: string;
  destinationId: string | null;
  detail: string | null;
  loopId?: string | null;
  createdAt: Date;
};

export type LoopInterest = { loopId: string; riderId: string; createdAt: Date };
export type LoopComment = { id: string; loopId: string; riderId: string; body: string; createdAt: Date; deletedAt: Date | null };

export type Notification = {
  id: string; groupId: string; riderId: string; kind: string; actorId: string;
  destinationId: string | null; loopId: string | null; detail: string | null;
  createdAt: Date; readAt: Date | null;
};
export type SuggestedStop = { id: string; kind: string; name: string; lat: number; lng: number; km: number };
export type StopSuggestions = { destinationId: string; routeKey: string; stops: SuggestedStop[]; failed?: boolean; updatedAt: Date };

export type Upload = {
  id: string; groupId: string; destinationId: string; riderId: string;
  mime: string; width: number; height: number; bytes: Binary; thumb: Binary;
  groupSlot: number; riderSlot: number; createdAt: Date;
};

export type OriginRoute = { destinationId: string; lat: number; lng: number; distanceKm: number; durationMin: number; approx: boolean; destinationLat: number; destinationLng: number; updatedAt: Date };
export type WeatherCache = { lat: number; lng: number; days: import("./weather-types").WeatherDay[]; updatedAt: Date };

/** Fixed-window counter for rate limits; expires on its own at `resetAt`. */
export type Throttle = { _id: string; count: number; resetAt: Date };
/** A signed-in admin device; deleting the row signs it out. */
export type AdminSession = { _id: string; expiresAt: Date };

type Stored<T> = T extends { id: string } ? Omit<T, "id"> & { _id: string } : T;

/** Stored document -> app shape. */
export function fromDoc<T extends { id: string }>(doc: Stored<T>): T;
export function fromDoc<T extends { id: string }>(doc: Stored<T> | null): T | null;
export function fromDoc<T extends { id: string }>(doc: Stored<T> | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc as { _id: string };
  return { id: _id, ...rest } as unknown as T;
}

/** App shape -> stored document. */
export function toDoc<T extends { id: string }>(value: T): Stored<T> {
  const { id, ...rest } = value;
  return { _id: id, ...rest } as unknown as Stored<T>;
}

// ---------- Connection ----------

const globalForDb = globalThis as unknown as { mongo?: Promise<Db> };

async function connect() {
  const uri = process.env.MONGODB_URI;
  const name = process.env.MONGODB_DB;
  if (!uri) throw new Error("MONGODB_URI is not set");
  // No default: falling back to a name could quietly point a dev machine at production.
  if (!name) throw new Error("MONGODB_DB is not set");
  const local = /^mongodb:\/\/(localhost|127\.0\.0\.1)/.test(uri);
  if (!process.env.VERCEL && !local && !name.endsWith("-dev") && process.env.ALLOW_REMOTE_DB !== "1") {
    throw new Error(`Refusing to use remote database "${name}" outside Vercel. Set ALLOW_REMOTE_DB=1 if you mean it.`);
  }
  const client = new MongoClient(uri, { maxPoolSize: 10, appName: "list-it" });
  // Lets Vercel close idle connections cleanly when a function instance is suspended.
  attachDatabasePool(client);
  await client.connect();
  const db = client.db(name);
  await ensureIndexes(db);
  await migrate(db);
  return db;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("uploads").createIndex({ groupId: 1, groupSlot: 1 }, { unique: true }),
    db.collection("uploads").createIndex({ groupId: 1, destinationId: 1, riderId: 1, riderSlot: 1 }, { unique: true }),
    db.collection("uploads").createIndex({ groupId: 1, destinationId: 1, createdAt: 1 }),
    db.collection("notifications").createIndex({ groupId: 1, riderId: 1, readAt: 1, createdAt: -1 }),
    db.collection("stopSuggestions").createIndex({ destinationId: 1 }, { unique: true }),
    db.collection("loops").createIndex({ groupId: 1, createdAt: -1 }),
    db.collection("loopInterests").createIndex({ loopId: 1, riderId: 1 }, { unique: true }),
    db.collection("loopComments").createIndex({ loopId: 1, createdAt: 1 }),
    db.collection("groups").createIndex({ slug: 1 }, { unique: true }),
    db.collection("riders").createIndex({ groupId: 1, nameKey: 1 }, { unique: true }),
    db.collection("destinations").createIndex({ groupId: 1, createdAt: -1 }),
    db.collection("reactions").createIndex({ destinationId: 1, riderId: 1 }, { unique: true }),
    db.collection("interests").createIndex({ destinationId: 1, riderId: 1 }, { unique: true }),
    db.collection("originRoutes").createIndex({ destinationId: 1, lat: 1, lng: 1 }, { unique: true }),
    db.collection("weather").createIndex({ lat: 1, lng: 1 }, { unique: true }),
    db.collection("rides").createIndex({ destinationId: 1, riderId: 1 }, { unique: true }),
    db.collection("comments").createIndex({ destinationId: 1, createdAt: 1 }),
    db.collection("stops").createIndex({ destinationId: 1, createdAt: 1 }),
    db.collection("activity").createIndex({ groupId: 1, createdAt: -1 }),
    db.collection("activity").createIndex({ destinationId: 1, riderId: 1, kind: 1 }),
    db.collection("destinations").createIndex({ status: 1 }),
    db.collection("throttle").createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("adminSessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

/** "Ridden" used to be a status on the whole ride. Move each one to a ride by the rider who added it. */
async function migrate(db: Db) {
  const dests = db.collection<Stored<Destination>>("destinations");
  for (const d of await dests.find({ status: "done" }, { projection: { riderId: 1, statusDate: 1, updatedAt: 1 } }).toArray()) {
    await db
      .collection<Ride>("rides")
      .updateOne(
        { destinationId: d._id, riderId: d.riderId },
        { $setOnInsert: { date: d.statusDate, createdAt: d.updatedAt } },
        { upsert: true },
      );
    await dests.updateOne({ _id: d._id }, { $set: { status: "wishlist", statusDate: null } });
  }
}

export function getDb() {
  globalForDb.mongo ??= connect().catch((e) => {
    globalForDb.mongo = undefined;
    throw e;
  });
  return globalForDb.mongo;
}

export async function cols() {
  const db = await getDb();
  return {
    uploads: db.collection<Stored<Upload>>("uploads"),
    notifications: db.collection<Stored<Notification>>("notifications"),
    stopSuggestions: db.collection<StopSuggestions>("stopSuggestions"),
    loops: db.collection<Stored<Loop>>("loops"),
    loopInterests: db.collection<LoopInterest>("loopInterests"),
    loopComments: db.collection<Stored<LoopComment>>("loopComments"),
    groups: db.collection<Stored<Group>>("groups"),
    riders: db.collection<Stored<Rider>>("riders"),
    destinations: db.collection<Stored<Destination>>("destinations"),
    stops: db.collection<Stored<Stop>>("stops"),
    comments: db.collection<Stored<Comment>>("comments"),
    reactions: db.collection<Reaction>("reactions") as Collection<Reaction>,
    interests: db.collection<Interest>("interests") as Collection<Interest>,
    originRoutes: db.collection<OriginRoute>("originRoutes"),
    weather: db.collection<WeatherCache>("weather"),
    rides: db.collection<Ride>("rides") as Collection<Ride>,
    activity: db.collection<Stored<Activity>>("activity"),
    throttle: db.collection<Throttle>("throttle"),
    adminSessions: db.collection<AdminSession>("adminSessions"),
  };
}
