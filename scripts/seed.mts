// Creates a demo crew with a few real routes. Run: npm run seed
import "./env.mts";
import { cols, getDb, toDoc, type Activity, type Destination, type Group, type Rider } from "../lib/db.ts";
import { hashPin } from "../lib/auth.ts";
import { rid, groupSlug } from "../lib/ids.ts";
import { resolvePlace, routeFromHome, photosNear } from "../lib/geo.ts";

const DEMO_PIN = "1234";
const c = await cols();
const now = Date.now();
const name = "Demo Crew";
const groupId = rid();
const slug = groupSlug(name);
await c.groups.insertOne(
  toDoc<Group>({ id: groupId, slug, name, registrationClosesAt: new Date(now + 3 * 86400000), createdAt: new Date() }),
);

const log = (riderId: string, kind: string, destinationId: string | null = null, detail: string | null = null) =>
  c.activity.insertOne(toDoc<Activity>({ id: rid(), groupId, riderId, kind, destinationId, detail, createdAt: new Date() }));

const crew = [
  ["Karthik", "🦅", "#ff7a1a"],
  ["Chinmay", "🐺", "#60a5fa"],
  ["Arunn", "⚡", "#4ade80"],
  ["Preetham", "🐯", "#e879f9"],
] as const;
const ids: string[] = [];
for (const [n, emoji, color] of crew) {
  const id = rid();
  ids.push(id);
  await c.riders.insertOne(
    toDoc<Rider>({
      id,
      groupId,
      name: n,
      nameKey: n.toLowerCase(),
      emoji,
      color,
      pinHash: hashPin(DEMO_PIN),
      sessionVersion: 1,
      failedAttempts: 0,
      lockedUntil: null,
      activitySeenAt: null,
      removedAt: null,
      createdAt: new Date(now - 86400000 * 2),
    }),
  );
  await log(id, "joined");
}

const places = [
  { link: "https://www.google.com/maps/place/Yercaud/@11.7747614,78.2093355,13z/data=!3d11.7747614!4d78.2093355", by: 0, cat: "day", tags: ["twisties", "ghat", "scenic"], hairpins: 20, status: "wishlist", notes: "Mostly highway till Salem, then 20 hairpins up the ghat. Same road we took back from Kodaikanal." },
  { link: "https://maps.app.goo.gl/BNgB53NB4zTWw38g7?g_st=ac", by: 0, cat: "day", tags: ["twisties", "forest"], hairpins: 22, status: "planned", date: 9, notes: "Vathalmalai ghat. Quiet road, tight hairpins, very little traffic." },
  { link: "13.3702, 77.6835", name: "Nandi Hills", by: 1, cat: "short", tags: ["twisties", "food"], hairpins: 40, status: "done", date: -20, notes: "Classic sunrise run. Gates open at 6.", report: "Leave by 4:30 to beat the queue at the gate. Breakfast at the Mysore Mylari place on the way back." },
  { link: "https://www.google.com/maps/place/Kodaikanal/@10.2381,77.4892,13z/data=!3d10.2381!4d77.4892", by: 2, cat: "multi", tags: ["ghat", "scenic", "stay"], hairpins: null, status: "hailmary", notes: "Two days minimum. Come back via Palani." },
  { link: "https://www.google.com/maps/place/Mettur+Dam/@11.7956,77.8067,14z/data=!3d11.7956!4d77.8067", by: 3, cat: "day", tags: ["highway", "scenic"], hairpins: null, status: "wishlist", notes: "Pair with Yercaud for a two-day loop." },
];

for (const [i, p] of places.entries()) {
  const place = await resolvePlace(p.link);
  if (p.name) place.name = p.name;
  const [r, found] = await Promise.all([routeFromHome(place), photosNear(place)]);
  const photos = found ?? [];
  const id = rid(10);
  const date = p.date !== undefined ? new Date(now + p.date * 86400000).toISOString().slice(0, 10) : null;
  const createdAt = new Date(now - (places.length - i) * 3600000 * 7);
  await c.destinations.insertOne(
    toDoc<Destination>({
      id, groupId, riderId: ids[p.by], name: place.name, area: place.area, mapsUrl: place.mapsUrl,
      lat: place.lat, lng: place.lng, distanceKm: r.distanceKm, durationMin: r.durationMin, approx: r.approx,
      route: r.route, roadSplit: r.roadSplit, photos, category: p.cat, tags: p.tags, seasons: ["winter", "postmonsoon"],
      hairpins: p.hairpins, notes: p.notes, status: p.status, statusDate: date, rideReport: p.report ?? null,
      createdAt, updatedAt: createdAt, deletedAt: null,
    }),
  );
  await log(ids[p.by], "added", id);
  for (const [j, rider] of ids.entries()) {
    if (j !== p.by && (i + j) % 2 === 0) {
      const emoji = ["🔥", "🤘", "😍"][j % 3];
      await c.reactions.insertOne({ destinationId: id, riderId: rider, emoji, createdAt: new Date() });
      await log(rider, "reacted", id, emoji);
    }
    if ((i + j) % 3 === 0) await c.interests.insertOne({ destinationId: id, riderId: rider, createdAt: new Date() });
  }
  if (i < 2) {
    await c.comments.insertOne({
      _id: rid(), destinationId: id, riderId: ids[1], createdAt: new Date(), deletedAt: null,
      body: i ? "Count me in, I'll bring the GoPro" : "How's the road surface after the rains?",
    });
    await c.stops.insertOne({
      _id: rid(), destinationId: id, riderId: ids[2], kind: "breakfast", name: "Hotel Saravana Bhavan, Hosur",
      note: "Ghee podi dosa. Opens 6:30.", mapsUrl: null, lat: null, lng: null, createdAt: new Date(),
    });
  }
  console.log("✓", place.name, r.distanceKm, "km", photos.length, "photos");
}

console.log(`\nDemo crew ready: /g/${slug}\nRiders: ${crew.map((x) => x[0]).join(", ")} (PIN ${DEMO_PIN})`);
await (await getDb()).client.close();
