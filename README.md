# list-it

A private, phone-first ride list for riding crews. Paste a Google Maps link to see the round trip, road mix, photos and route. Plan rides and multi-day loops with your crew, add stops, and keep a ride log.

No accounts. Each crew lives at a secret link. Anyone with the link can join with a name and a 4-digit PIN for **3 days**, then joining closes. After that the admin adds people and resets PINs from `/admin`.

## How it works

| Thing | How |
|---|---|
| Access | `/g/<name>-<random>` is the only way in. Each crew is separate, so you can run different crews with different people. |
| Identity | Pick a name, avatar and PIN once. The phone stays signed in for a year (signed cookie). New phone: tap your name and enter your PIN. |
| PIN safety | Hashed with scrypt. 5 wrong tries lock that rider for 10 minutes, and each lock in a row lasts longer (1 h, 6 h, then a day) until they get it right or the admin resets the PIN. A PIN reset signs out every device. |
| Ownership | Only the rider who added a ride can edit it, change its status or delete it. Everyone can react, comment, say "I'm in" and add stops. |
| Location | Short and long Google Maps links, whole WhatsApp messages containing one, plus codes (`26X6+737 …`), or plain `lat, lng`. Falls back to OpenStreetMap search. If the pin lands wrong, drag it on the preview map. |
| Distance | Bengaluru → destination → Bengaluru using OSRM, with road mix. Set your own start area for a personal round trip. |
| Loops | Chain rides or other places, split the trip into days, and see the route and overnight forecasts. |
| Planning | Search rides, see this weekend, share, add planned rides or loops to a calendar, and say "I'm in". |
| Stops | Add stops yourself or request OpenStreetMap suggestions along the outbound route. |
| Ride log | Record who rode, when, and personal notes; see each rider's history. |
| Weather | Forecasts from Open-Meteo and seasonal hints, including monsoon warnings for ghat roads. |
| Activity | In-app notifications and a WhatsApp summary you choose to send. |
| Photos | Rider uploads stored in MongoDB (up to 6 per rider per ride and 400 per crew), plus credited Wikimedia Commons photos. |
| Link previews | Every ride has its own WhatsApp preview image: route, distance, hairpins, photo. |

Stack: Next.js 16 (App Router, server actions), MongoDB, Tailwind 4, Motion, Leaflet with OpenStreetMap tiles. Nothing here needs a paid API key.

## Run it locally

```bash
npm install
docker run -d --name list-it-mongo -p 27018:27017 mongo:7   # local MongoDB
cp .env.example .env.local   # then fill SESSION_SECRET and ADMIN_SECRET
npm run seed                 # optional: a demo crew with real routes, PIN 1234
npm run dev
```

Collections and indexes are created on first connect, so there is no migration step.

Open `http://localhost:3000/admin`, enter `ADMIN_SECRET`, create a crew and copy its link.

`npm test` runs the unit tests for parsing, routing, dates, photos and validation.

Outside Vercel the app refuses to open a remote database unless its name ends in `-dev`, so a local `next start` can't write to production by accident. Set `ALLOW_REMOTE_DB=1` to override.

Other scripts: `npm run reroute` refreshes saved routes in batches, preserving manually entered hairpins and leaving existing routes intact when OSRM fails. It only accepts a `-dev` database unless both `-- --force` and `ALLOW_REMOTE_DB=1` are supplied. The crew admin page also has a Refresh routes button. `npm run reset` drops the database (a non-local one needs `-- --force`, and only if its name ends in `-dev`), and `npx tsx scripts/dev-session.mts <name>` prints a rider's session cookie for testing pages with curl.

## Deploy (Vercel + MongoDB Atlas, both free tiers)

1. Create a free M0 cluster on MongoDB Atlas (or add the MongoDB Atlas integration from the Vercel marketplace, which sets `MONGODB_URI` for you). Under Network Access, allow `0.0.0.0/0`, since Vercel functions don't have fixed IPs.
2. In the Vercel project, set `MONGODB_URI`, `MONGODB_DB` (e.g. `list-it`), `SESSION_SECRET` (long random string) and `ADMIN_SECRET`.
3. Deploy (`vercel --prod`, or push to the connected Git repo), open `/admin`, create the crew, drop the link in the WhatsApp group.

The 3-day joining window starts when the crew is created in `/admin`. "Extend 3 days", "Reopen 3 days" and "Close now" are on the crew's admin page.

## What's new in v2

Set a personal start area, build multi-day loops, log rides and rider photos, see forecasts, find suggested stops, and follow crew activity through in-app notifications. Share a weekly WhatsApp digest or add planned trips to your calendar. The feed can search by place, show this weekend and sort by cached distances from your area.

## Roadmap

- Web push and an email digest, which need additional services or keys.
- Blob photo storage if a crew outgrows the MongoDB photo limits.
- A self-hosted or paid Overpass instance if the public servers stay unreliable. Stop suggestions use the free public ones, which refused or timed out on every request while v2 was being tested.
- Drag to reorder loop stops (up and down buttons for now).
- Re-route production rides saved before the road-split fix: "Refresh routes" on each crew's admin page.
