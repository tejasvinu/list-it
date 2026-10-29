// Drops every crew, rider and ride in the configured database. Run: npm run reset
// Refuses to touch a non-local database unless you pass --force, and never drops a remote one whose name
// doesn't end in -dev (production is "list-it" on the same cluster).
import "./env.mts";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
const name = process.env.MONGODB_DB!;
const local = /^mongodb:\/\/(localhost|127\.0\.0\.1)/.test(uri);
if (!local && !name.endsWith("-dev")) {
  console.error(`Refusing to drop remote database "${name}": only names ending in -dev can be reset.`);
  process.exit(1);
}
if (!local && !process.argv.includes("--force")) {
  console.error(`MONGODB_URI is not a local database. Refusing to drop "${name}". Re-run with --force if you really mean it.`);
  process.exit(1);
}
const client = await MongoClient.connect(uri);
await client.db(name).dropDatabase();
console.log(`Dropped database "${name}".`);
await client.close();
