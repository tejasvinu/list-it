// Temporary: creates or removes a throwaway crew for smoke-testing a deployment.
// Usage: tsx --conditions=react-server scripts/smoke.mts setup|cleanup
import "./env.mts";
import { cols, getDb, toDoc, type Destination, type Group } from "../lib/db.ts";
import { rid } from "../lib/ids.ts";
import { resolvePlace, routeFromHome } from "../lib/geo.ts";

const c = await cols();
const mode = process.argv[2];
if (mode === "setup") {
  const groupId = "smoke" + rid(8);
  const slug = `zz-smoke-test-${rid(10)}`;
  await c.groups.insertOne(
    toDoc<Group>({ id: groupId, slug, name: "Smoke test (delete me)", registrationClosesAt: new Date(Date.now() + 3600000), createdAt: new Date() }),
  );
  console.log(JSON.stringify({ groupId, slug }));
} else if (mode === "add") {
  const [groupId, riderId] = process.argv.slice(3);
  const place = await resolvePlace("https://www.google.com/maps/place/Yercaud/@11.7747614,78.2093355,13z/data=!3d11.7747614!4d78.2093355");
  const r = await routeFromHome(place);
  const id = rid(10);
  const now = new Date();
  await c.destinations.insertOne(
    toDoc<Destination>({
      id, groupId, riderId, name: place.name, area: place.area, mapsUrl: place.mapsUrl, lat: place.lat, lng: place.lng,
      distanceKm: r.distanceKm, durationMin: r.durationMin, approx: r.approx, route: r.route, roadSplit: r.roadSplit,
      photos: [], category: "day", tags: ["twisties"], seasons: [], hairpins: 20, notes: "smoke", rideReport: null,
      status: "wishlist", statusDate: null, createdAt: now, updatedAt: now, deletedAt: null,
    }),
  );
  console.log(id);
} else if (mode === "cleanup") {
  const groups = await c.groups.find({ slug: /^zz-smoke-test-/ }).toArray();
  for (const g of groups) {
    const dests = (await c.destinations.find({ groupId: g._id }).toArray()).map((d) => d._id);
    const res = await Promise.all([
      c.reactions.deleteMany({ destinationId: { $in: dests } }),
      c.interests.deleteMany({ destinationId: { $in: dests } }),
      c.comments.deleteMany({ destinationId: { $in: dests } }),
      c.stops.deleteMany({ destinationId: { $in: dests } }),
      c.destinations.deleteMany({ groupId: g._id }),
      c.activity.deleteMany({ groupId: g._id }),
      c.riders.deleteMany({ groupId: g._id }),
      c.groups.deleteOne({ _id: g._id }),
    ]);
    console.log("removed", g.slug, res.map((x) => x.deletedCount).join("/"));
  }
  const counts = await Promise.all(["groups", "riders", "destinations", "activity"].map(async (n) => `${n}=${await (await getDb()).collection(n).countDocuments()}`));
  console.log("left:", counts.join(" "));
}
await (await getDb()).client.close();
