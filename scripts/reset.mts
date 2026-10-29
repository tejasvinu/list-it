// Drops every crew, rider and ride in the configured database. Run: npm run reset
// Refuses to touch a non-local database unless you pass --force.
import "./env.mts";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
const name = process.env.MONGODB_DB!;
const local = /^mongodb:\/\/(localhost|127\.0\.0\.1)/.test(uri);
if (!local && !process.argv.includes("--force")) {
  console.error(`MONGODB_URI is not a local database. Refusing to drop "${name}". Re-run with --force if you really mean it.`);
  process.exit(1);
}
const client = await MongoClient.connect(uri);
await client.db(name).dropDatabase();
console.log(`Dropped database "${name}".`);
await client.close();
