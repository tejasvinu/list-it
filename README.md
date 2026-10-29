# list-it

A private, phone-first ride list for riding crews. Paste a Google Maps link and it works out the round trip from Bengaluru, the road mix, nearby photos and a route preview. Then the crew reacts, comments, says "I'm in" and adds stops along the way.

No accounts. Each crew lives at a secret link. Anyone with the link can join with a name and a 4-digit PIN for **3 days**, then joining closes. After that the admin adds people and resets PINs from `/admin`.

## How it works

| Thing | How |
|---|---|
| Access | `/g/<name>-<random>` is the only way in. Each crew is separate, so you can run different crews with different people. |
| Identity | Pick a name, avatar and PIN once. The phone stays signed in for a year (signed cookie). New phone: tap your name and enter your PIN. |
| PIN safety | Hashed with scrypt. 5 wrong tries locks that rider for 10 minutes. A PIN reset signs out every device. |
| Ownership | Only the rider who added a ride can edit it, change its status or delete it. Everyone can react, comment, say "I'm in" and add stops. |
| Location | Short and long Google Maps links, whole WhatsApp messages containing one, plus codes (`26X6+737 …`), or plain `lat, lng`. Falls back to OpenStreetMap search. If the pin lands wrong, drag it on the preview map. |
| Distance | Bengaluru (city centre) → destination → Bengaluru, using the public OSRM router. The road mix (city / NH / SH / country roads) comes from the same route. |
| Photos | Free, openly licensed photos taken near the place, from Wikimedia Commons, credited on each photo. |
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

`npm test` runs the unit tests for link parsing, routing helpers and ride validation.

Outside Vercel the app refuses to open a remote database unless its name ends in `-dev`, so a local `next start` can't write to production by accident. Set `ALLOW_REMOTE_DB=1` to override.

Other scripts: `npm run reset` drops the database (it refuses a non-local one unless you pass `-- --force`), and `npx tsx scripts/dev-session.mts <name>` prints a rider's session cookie for testing pages with curl.

## Deploy (Vercel + MongoDB Atlas, both free tiers)

1. Create a free M0 cluster on MongoDB Atlas (or add the MongoDB Atlas integration from the Vercel marketplace, which sets `MONGODB_URI` for you). Under Network Access, allow `0.0.0.0/0`, since Vercel functions don't have fixed IPs.
2. In the Vercel project, set `MONGODB_URI`, `MONGODB_DB` (e.g. `list-it`), `SESSION_SECRET` (long random string) and `ADMIN_SECRET`.
3. Deploy (`vercel --prod`, or push to the connected Git repo), open `/admin`, create the crew, drop the link in the WhatsApp group.

The 3-day joining window starts when the crew is created in `/admin`. "Extend 3 days", "Reopen 3 days" and "Close now" are on the crew's admin page.

## Roadmap

From the group chat, not built yet:

- **Loops and circuits.** Chain destinations into multi-day routes (e.g. Yercaud → Mettur → home) with day splits, overnight stops and total distance.
- **Distance from your own area.** Show distance from each rider's starting point (Whitefield, Yelahanka, Hebbal…) as well as the city-centre number.
- **Rider photos.** Upload your own ride photos to a ride (needs blob storage, e.g. Vercel Blob).
- **Smarter stops.** Suggest breakfast places and viewpoints along the actual route instead of only manual adds.
- **Ride log details.** Who actually showed up, the date, and per-rider notes on each ridden trip.
- **Notifications.** A daily digest or web push when someone plans a ride or says "I'm in" to yours.
- **Weather and season hints.** Forecast for planned dates, and a monsoon warning on ghat roads.
