// Dev helper: prints a rider's session cookie, slug and id, for poking pages with curl.
// Usage: npx tsx scripts/dev-session.mts <riderName>
import "./env.mts";
import { createHmac } from "node:crypto";
import { MongoClient } from "mongodb";

const client = await MongoClient.connect(process.env.MONGODB_URI!);
const db = client.db(process.env.MONGODB_DB || "list-it");
const name = (process.argv[2] ?? "karthik").toLowerCase();
const r = await db.collection<{ _id: string; groupId: string; sessionVersion: number }>("riders").findOne(
  { nameKey: name },
  { sort: { createdAt: -1 } },
);
if (!r) throw new Error(`No rider called ${name}`);
const g = await db.collection<{ _id: string; slug: string }>("groups").findOne({ _id: r.groupId });
const payload = `${r._id}.${r.sessionVersion}`;
const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("base64url");
console.log(`crew_${r.groupId}=${payload}.${sig} ${g?.slug} ${r._id}`);
await client.close();
