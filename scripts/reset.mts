// Drops every crew, rider and ride in the configured database. Run: npm run reset
import "./env.mts";
import { MongoClient } from "mongodb";

const client = await MongoClient.connect(process.env.MONGODB_URI!);
const name = process.env.MONGODB_DB || "list-it";
await client.db(name).dropDatabase();
console.log(`Dropped database "${name}".`);
await client.close();
