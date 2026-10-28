import "server-only";
import { MongoClient, type Collection, type Db } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import type { Photo, RoadSplit } from "./types";

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
  /** What we learned riding it: written by the owner once it's ridden */
  rideReport: string | null;
  status: string;
  /** YYYY-MM-DD: planned ride date or the day it was ridden */
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

export type Activity = {
  id: string;
  groupId: string;
  riderId: string;
  /** joined | added | planned | done | commented | reacted | in | stop */
  kind: string;
  destinationId: string | null;
  detail: string | null;
  createdAt: Date;
};

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
  if (!uri) throw new Error("MONGODB_URI is not set");
  const client = new MongoClient(uri, { maxPoolSize: 10, appName: "list-it" });
  // Lets Vercel close idle connections cleanly when a function instance is suspended.
  attachDatabasePool(client);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "list-it");
  await ensureIndexes(db);
  return db;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("groups").createIndex({ slug: 1 }, { unique: true }),
    db.collection("riders").createIndex({ groupId: 1, nameKey: 1 }, { unique: true }),
    db.collection("destinations").createIndex({ groupId: 1, createdAt: -1 }),
    db.collection("reactions").createIndex({ destinationId: 1, riderId: 1 }, { unique: true }),
    db.collection("interests").createIndex({ destinationId: 1, riderId: 1 }, { unique: true }),
    db.collection("comments").createIndex({ destinationId: 1, createdAt: 1 }),
    db.collection("stops").createIndex({ destinationId: 1, createdAt: 1 }),
    db.collection("activity").createIndex({ groupId: 1, createdAt: -1 }),
  ]);
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
    groups: db.collection<Stored<Group>>("groups"),
    riders: db.collection<Stored<Rider>>("riders"),
    destinations: db.collection<Stored<Destination>>("destinations"),
    stops: db.collection<Stored<Stop>>("stops"),
    comments: db.collection<Stored<Comment>>("comments"),
    reactions: db.collection<Reaction>("reactions") as Collection<Reaction>,
    interests: db.collection<Interest>("interests") as Collection<Interest>,
    activity: db.collection<Stored<Activity>>("activity"),
  };
}
