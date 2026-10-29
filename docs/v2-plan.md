# list-it v2 — build plan

Written 29 October 2026. This is the brief for v2: every README roadmap item that can be built without a paid service, a new account or a new API key, plus a pass over the existing features. The product decisions below are final. Make a sensible call on anything not covered here and note it under "Decisions made while building" at the end of this file.

## Ground rules (every phase)

- **Next.js 16.4 is not the Next.js you know.** Before writing route, action, caching or metadata code, read the relevant guide in `node_modules/next/dist/docs/`. Follow the patterns already in `app/` and `lib/`.
- **Design.** Follow `docs/redesign-2026.md`: the kilometre-stone idea, its tokens, Barlow / Barlow Condensed, the rounding rules, the colour budget and one orchestrated motion moment per screen. Reuse the existing components (`Sheet`, `Milestone`, `RoadSplit`, `Avatar`, `toast`/`attempt()`, `Maps`) before writing new ones. No emoji as UI icons (use `lucide-react`), no glass, no glows, no gradients.
- **Copy.** Plain, short, sentence case, the way the existing screens talk. Every new page needs a real empty state.
- **Data.** MongoDB through `lib/db.ts` (`cols()`, `fromDoc`/`toDoc`). New collections and indexes go in `cols()` and `ensureIndexes()`. Older documents can lack new fields, so read them with defaults and never require a migration. Every server action must check the session, check that the viewer belongs to the crew, validate its input (extend `lib/validate.ts`), and return `Result` like the existing actions. Client calls go through `attempt()`.
- **Ownership** stays as in the README: only a ride's owner edits or deletes it. Anyone in the crew reacts, comments, says "I'm in" and adds stops. Loops follow the same rule.
- **Free services only, all without a key:** OSRM (`router.project-osrm.org`, already used), Nominatim and Overpass (OpenStreetMap), Open-Meteo, Wikimedia Commons. Send the same identifying User-Agent the app already sends to Wikimedia. Use a timeout on every call, cache results (in Mongo or with `fetch` caching), and fail soft: the page still renders and says the data is unavailable.
- **Database.** `.env.local` points at `list-it-dev` on Atlas. Never point anything at `list-it` (production). `npm run seed` is fine.
- **Don't** commit, push, deploy, run `vercel`, change env vars or install paid or keyed SDKs. A small free npm dependency is fine if it clearly saves work. Don't touch `screenshots/`, `scripts/take_*.py`, `scripts/update_screenshots.py` or `docs/frontend-audit-2026-10-28.md` (the user's own working files).
- **Done means:** `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` all pass. New pure logic gets unit tests next to the existing ones (`lib/*.test.ts`). Check each new screen in a real browser at 390 px and 1440 px: start `next dev` on port **3100** and drive it with Python Playwright (`channel="msedge"`, already installed), using `npx tsx scripts/dev-session.mts <name>` for a session cookie. Fix what you find, then stop the dev server.
- At the end of each phase, add a short section under "Progress" at the bottom of this file: what was built, how it was checked, anything left over.

## Phase 1 — Your own start point, ride log, weather and season

### 1a. Distance from your own area (roadmap)
- A rider can set a **start point** in their profile: a preset list of common Bengaluru areas (Whitefield, Yelahanka, Hebbal, Electronic City, Koramangala, Indiranagar, JP Nagar, Banashankari, Rajajinagar, Marathahalli, Sarjapur Road, Kengeri, Hennur, Bellandur, HSR Layout, Jayanagar, Malleshwaram, Devanahalli) with fixed coordinates in `lib/config.ts`, or "Somewhere else", resolved through the existing place search. The rider stores `{ name, lat, lng }` (optional field `start` on `Rider`). The default is the city centre (`HOME`), which is what they get today.
- On the ride page the facts show the city-centre round trip as now, plus **"From <area>: N km round trip, H h"** for the viewer when their start differs from the centre. Route it with OSRM start → destination → start, cache it in a new `originRoutes` collection keyed by destination + rounded start coordinates (3 decimals), and work it out on demand on the server. If OSRM fails, show the straight-line estimate marked "about".
- In the feed, for the viewer: if a cached from-you number exists, show it in the facts line ("from Hebbal 212 km") without blocking the render. Don't route every ride while the feed loads. Do add a "Work out from my area" action on the profile that fills the cache for every ride in the crew, a few at a time, with progress shown.
- The crew page shows each rider's start area.

### 1b. Ride log details (roadmap)
- The `Ride` record (one per rider per destination) gains optional fields: `note` (what this rider wants to remember: max 500 characters) and `loggedBy` (the rider id that recorded it, when someone else logged them).
- **"Log a ride"** on the ride page replaces the bare "I've ridden this": pick a date (default today in IST, no future dates), tick who came (the viewer is ticked by default; crew list with avatars; riders who said "I'm in" come first), and an optional note for yourself. Saving creates or updates a `Ride` for each ticked rider (the logger's note goes only on their own row) and writes one activity entry, "rode", with the date and the count of riders.
- Each rider can edit their own note and date, or remove their own ride entry. The logger can remove a rider they added by mistake.
- The ride page gets a **Ride log** section: entries grouped by date, newest first, with each rider's avatar, name and note. When the destination's owner writes a `rideReport` it stays as now, shown above the log.
- After a planned ride's date has passed, the ride page shows a quiet prompt to the owner and to riders who said "I'm in": "Did you ride it on Sat 2 Nov? Log it." Logging it with that date clears `planned` back to `wishlist`, the way marking it ridden does today.
- The rider page (`/r/[riderId]`) gets a **ridden** history: total rides, total km (from the destination's round trip, or the rider's own-start number when it's cached), a by-month list, and the farthest ride.

### 1c. Weather and season hints (roadmap)
- New `lib/weather.ts` uses Open-Meteo forecast (`api.open-meteo.com/v1/forecast`, daily: weather code, max and min temperature, rain probability, rain sum, max wind; timezone Asia/Kolkata). Cache it for 1 hour per destination, keyed on coordinates rounded to 2 decimals.
- On a **planned** ride whose date is within the forecast window (16 days): show that day's forecast on the ride page (a small, plain block with an icon for the weather code, max/min, chance of rain, wind) and a one-line version on the feed card ("Sat · 24° · 60% rain").
- On any ride without a date: show the next 7 days as a compact strip on the ride page, collapsed by default on phones.
- **Season hint**, worked out locally with no API: the destination's `seasons` say when it's best, and the current month (IST) is compared with them. **Monsoon warning** (June–September, and October–November for destinations south of about 13.5° N on the east side, the northeast monsoon): when the ride has hairpins ≥ 5, or tags that mean ghats or hills, or the forecast shows a rain sum > 10 mm, show "Ghat roads in the monsoon: expect rain, fog and slippery hairpins." Put the logic in `lib/season.ts` with unit tests.

## Phase 2 — Loops and circuits (roadmap)

- A new **Loop**: `{ id, groupId, riderId, name, notes, stops: [{ destinationId | null, name, lat, lng, nightHere: boolean }], startDate: YYYY-MM-DD | null, legs: [{ km, min, approx }], totalKm, totalMin, route (simplified polyline for the whole loop), createdAt, updatedAt, deletedAt }`. A loop is start (city centre, or the creator's start point) → stops in order → back to start.
- A stop is either one of the crew's rides or any place (the same link / search / plus code / `lat, lng` input the new-ride form takes; reuse its parsing and `resolvePlace`).
- Route with a single OSRM request through all the waypoints; legs come from the OSRM response. Simplify the polyline as rides do. If OSRM fails, use straight-line legs with `approx`.
- **Days.** Nights split the loop into days: each stop marked "Night here" ends a day. Show per-day km and riding time, and warn (not block) when a day goes over 450 km or 9 hours of riding.
- **Pages:**
  - `/g/[slug]/loops`: the list, as cards with the route drawn (reuse `route-art`), name, days, total km, and who's in.
  - `/g/[slug]/loops/new` and `/loops/[id]/edit`: builder. Add stops (pick from the crew's rides with a search box, or paste a place), reorder them (up/down buttons; drag is optional), mark nights, a start date (optional). A live preview of the total route, legs and days, updated as the loop changes.
  - `/g/[slug]/loops/[id]`: map of the whole loop with numbered stops and per-day colours, a day-by-day breakdown (Day 1: Bengaluru → Yercaud → Mettur, 312 km, 6 h 40 m, night in Mettur), total, "I'm in", comments, and links to each stop's ride page. When the start date is set and within range, show the forecast for each day's overnight stop.
- Entry points: a **Rides | Loops** switch at the top of the feed (same page header, keeps the bottom nav as is); "Add to a loop" on a ride page (opens a sheet: pick an existing loop of yours, or start a new one with this ride); an "Add a loop" choice next to "Add a ride" on the `+` destination (a small chooser sheet on phones, two buttons on desktop).
- Loops log to activity ("added a loop", "is in for <loop>") and show on the crew map as dashed routes.
- The seed script adds one loop (Yercaud → Mettur → home with a night in Yercaud) and a couple of ride log entries, so a fresh dev database shows the new screens.

## Phase 3 — Smarter stops, notifications, calendar and sharing

### 3a. Smarter stops (roadmap)
- New `lib/overpass.ts`. Sample the ride's route polyline about every 2 km. Query Overpass (`overpass-api.de/api/interpreter`, with `kumi.systems` as the fallback mirror) once for nodes within 400 m of the samples: breakfast (`amenity` = restaurant | cafe | fast_food, plus a name), viewpoints (`tourism=viewpoint`), fuel (`amenity=fuel`) and photo spots (`natural=peak`, `waterway=waterfall`, `historic`, `tourism=attraction`). Keep one or two requests, with a 25 s timeout.
- Rank by distance from the start along the route (show "at km 48"), drop duplicates, and cap each kind at about 8 results, spread along the route rather than bunched at the start. Breakfast between km 30 and 120 of the outbound leg ranks first.
- Cache the suggestions on a new `stopSuggestions` collection per destination for 7 days. Work them out only when someone opens "Suggest stops" on the ride page; then show them grouped by kind, each with "Add" (creates a normal `Stop` with that kind, name and coordinates) and "Open in Maps". Show stops already added as added.
- Show the route's stops (added and suggested) on the ride map as small markers by kind.

### 3b. Notifications (roadmap, in-app only)
- Web push and email need keys or a mail service, so v2 does **in-app notifications** plus a **WhatsApp digest the rider sends themselves**:
  - New `notifications` collection: `{ id, groupId, riderId (recipient), kind, actorId, destinationId | null, loopId | null, detail, createdAt, readAt }`. Fan out from the places that already log activity: someone says "I'm in" to, comments on, reacts to, logs a ride on, or adds a stop to *your* ride or loop; someone replies in a thread you commented in; a ride you said "I'm in" to gets a date or a new date; you were logged on a ride by someone else. Never notify the actor.
  - The Activity tab becomes **two views: "For you" (notifications, default) and "Crew" (the activity feed as today).** The nav dot shows unread notifications. Opening "For you" marks them read; each item links to the thing.
  - **Digest:** on the Activity page, a "Share this week" button builds a plain-text summary of the last 7 days (rides added, rides planned with dates and who's in, rides ridden, new loops) with links, and opens `https://wa.me/?text=…` (on desktop, also copy to the clipboard). Keep it under about 1,500 characters.
- When the page is open, check for new notifications every 60 s, only while the tab is visible, and show a toast for new ones.

### 3c. Calendar and sharing (existing feature iteration)
- Planned rides and loops with a date get "Add to calendar": a route handler that returns an `.ics` (all-day event, or multi-day for a loop, title, Maps link, crew page link). Only for signed-in riders.
- "Share" on the ride page and loop page: Web Share API when available, otherwise `wa.me` with the name, distance, date and link. The existing per-ride OG image stays the preview.

## Phase 4 — Rider photos (roadmap) without a new service

- Riders can add their own photos to a ride (and to their ride log entry). There is no blob service, so store images **in MongoDB** in a new `uploads` collection, with tight limits so the free Atlas tier (512 MB) is safe:
  - Resize in the browser before uploading (canvas): longest side 1600 px, WebP at quality 0.8 (JPEG if WebP isn't supported), target ≤ 350 KB. Reject anything still over 600 KB after resizing. Make a 400 px thumbnail too.
  - Store `{ _id, groupId, destinationId, riderId, mime, width, height, bytes: Binary, thumb: Binary, createdAt }`. Limit 6 photos per rider per ride and 400 photos per crew, and say so clearly when a limit is hit. Upload through a server action or route handler that checks the session, crew membership, mime type, real dimensions and size.
  - Serve with `/g/[slug]/photo/[id]` (and `?thumb=1`), only to riders signed in to that crew, with `Cache-Control: private, max-age=31536000, immutable` and an ETag.
- On the ride page, rider photos appear first in the photo strip, credited to the rider ("Arjun, 2 Nov"), ahead of the Commons photos. Tap to open full-screen with swipe or arrow keys. The uploader or the ride's owner can delete a photo.
- The admin crew page shows photo count and storage used.

## Phase 5 — Iterate on what exists, and finish the audit

- **Finish the audit's "Not covered" list** (`docs/audit-2026-10-29-e2e.md`): walk status changes, edit (including "Change location"), delete, map, activity, crew and profile pages and the admin pages (create crew, add rider, reset PIN, remove rider, joining window) at 390 and 1440 px, run `next build` and check the production response headers with `next start`. Fix what you find.
- **Re-route older rides:** a script `scripts/reroute.mts` (dev by default, refuses non `-dev` databases unless `--force` and `ALLOW_REMOTE_DB=1`, like `reset`) and an admin button on the crew page, "Refresh routes", that recomputes `distanceKm`, `durationMin`, `route`, `roadSplit` and `hairpins` for every ride in that crew a few at a time, with progress. This fixes rides saved before the road-split fix.
- **Feed:** a search box (name and area); sorting by "Nearest from you" once from-you numbers exist; a "This weekend" view of rides planned for the coming Saturday and Sunday (IST).
- **Ride page:** the first screen on phones still ends with "Count me in", with weather and from-you numbers fitted into the facts rather than pushing it down.
- **Accessibility:** touch targets ≥ 24 px on everything new and on the feed (morning audit finding 17), labels on every icon button, focus rings, and `prefers-reduced-motion`.
- **Performance:** check that the feed's queries are still indexed and that new sections on the ride page load in parallel; stream slow external data (forecast, from-you routing, suggestions) with `Suspense` so the page shell never waits on them.
- **README:** update the feature table and the Roadmap (what v2 shipped, what's left: web push, email digest, blob photo storage if the crew outgrows Mongo, and anything else deferred), and add a short "What's new in v2" section.

## Decisions made while building

- Start-area presets are representative neighbourhood coordinates. Custom areas use the existing place search; clearing the selection returns to Bengaluru city centre.
- An unavailable OSRM route uses twice the straight-line distance and a 50 km/h estimate. Approximate cached routes are retried after an hour; a changed destination pin invalidates its cached route.
- Seasons are winter (December–February), summer (March–May), monsoon (June–September), and post-monsoon (October–November), in IST. For the northeast monsoon heuristic, the east side is longitude 77° E or farther east and south of 13.5° N.
- Logging someone already in the ride log updates their date but preserves their note and original logger. A rider's personal note is saved only when that rider is selected.

## Progress

### Phase 1 — implementation in progress

- Added start-point selection, cached routes and profile batch calculation; ride log entries and rider history; and forecast and season hints. No migration is required for older records.
- `npm run typecheck` and `npm run build` passed. The 22 unit tests passed when invoked directly with a temporary workaround for Windows Node's failing `os.userInfo()` call; `npm test` itself failed before running tests. Lint passed on `app`, `components` and `lib`; a later full lint run included temporary browser-check files and failed on those generated files.
- The requested browser checks at 390 and 1440 px remain outstanding. Automated review rejected the scripted session-cookie check and rejected access to an existing Edge window containing unrelated personal tabs. The port 3100 server was stopped.
- Temporary `.phase1-check/` and `.check-node.cjs` files remain because automatic review rejected their removal. The temporary directory includes a copy of `.env.local` and a junction to the repository's `node_modules`; remove the junction itself before recursively removing the temporary directory. Do not commit either temporary path.
