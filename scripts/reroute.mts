// Refresh saved routes without replacing manually entered hairpin counts.
import "./env.mts";
import { cols } from "../lib/db.ts";
import { refreshRoute } from "../lib/reroute.ts";

const name = process.env.MONGODB_DB;
if (!name || (!name.endsWith("-dev") && !(process.argv.includes("--force") && process.env.ALLOW_REMOTE_DB === "1"))) {
  console.error("Refusing to refresh routes outside a -dev database without --force and ALLOW_REMOTE_DB=1.");
  process.exit(1);
}
const c = await cols();
const rows = await c.destinations.find({ deletedAt: null }).toArray();
let updated = 0;
for (let i = 0; i < rows.length; i += 3) {
  const results = await Promise.all(rows.slice(i, i + 3).map(refreshRoute));
  updated += results.filter(Boolean).length;
  console.log(`${Math.min(i + 3, rows.length)} of ${rows.length} checked; ${updated} refreshed`);
}
console.log("Unavailable or changed rides were left as they were.");
process.exit(0);
