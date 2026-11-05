import "server-only";
import { headers } from "next/headers";
import { ipAddress } from "@vercel/functions";
import { cols } from "./db";

/** The caller's IP on Vercel; one shared bucket when running locally or outside a request (scripts). */
export async function clientIp() {
  try {
    return ipAddress(await headers()) ?? "local";
  } catch {
    return "local";
  }
}

/**
 * Counts one hit against `key` in a fixed window, atomically, and says whether it's still within `limit`.
 * Parallel requests can't share a count, so this holds up against bursts.
 */
export async function allow(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const live = { $gt: ["$resetAt", now] };
  const c = await cols();
  // Two first-ever requests for the same key can race on the upsert and one may get a duplicate-key
  // error. Retry once; the counter itself is already atomic.
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await c.throttle.findOneAndUpdate(
        { _id: key },
        [
          {
            $set: {
              count: { $cond: [live, { $add: ["$count", 1] }, 1] },
              resetAt: { $cond: [live, "$resetAt", new Date(now.getTime() + windowMs)] },
            },
          },
        ],
        { upsert: true, returnDocument: "after" },
      );
      return (doc?.count ?? 1) <= limit;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000 || attempt >= 1) throw error;
    }
  }
}
