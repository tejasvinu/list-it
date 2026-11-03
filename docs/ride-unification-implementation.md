# Ride unification implementation

3 November 2026. Implemented locally; not deployed.

## Behavior

- One Rides feed, Add a ride action, creator and detail experience. Multiple places and overnight stays are optional itinerary controls inside a ride.
- Existing loops use the same statuses, reactions, attendance, reports, logs, photos, POI stops, sharing and calendars as other rides. Their saved start, ordered places, overnight flags, day splits and approximate route labels remain available.
- Feed filters/search/popularity, upcoming rides, map selection, crew counts, profiles/history and weekly digests include both original sources. Weekend filtering includes trips that start before Saturday and continue into the weekend.
- Use in a ride selects an individual itinerary place and opens a new or existing ride for review. It does not merge the saved records or copy their comments, attendance, logs or photos.
- New itinerary rides use destinations with an optional versioned itinerary. Existing destinations can gain an itinerary under their original ID. Existing loops are edited in place in loops.
- The original destination and loop detail/edit URLs remain active. Only the old loop listing and creation routes redirect. Calendar endpoint kinds and event UIDs remain unchanged, and both detail URL families have image previews.

## Preservation and rollout

No parent conversion, relationship backfill, collection deletion, index replacement or migration script is needed. Reads do not persist adapter defaults. Existing loop comments/attendance continue using their original collections.

The original plan proposed changing relationship indexes. The implementation avoids this by storing new loop reactions, completion logs, uploads, POI stops and caches with a namespaced `destinationId` relationship key, `loop:<original ID>`. The ID generator cannot produce a colon. Original destination relationships remain untouched, and the existing compound unique indexes and shared crew photo quota remain effective. Public links always use the original IDs and URL families.

All source dispatch and mutations resolve the parent inside the signed-in crew. Destination ownership/adoption and loop ownership rules remain source-specific. Saved photos retain their IDs, serving URLs, access checks and quotas. Completion logs remain independent of attendance and of linked itinerary places.

Metadata edits retain saved route geometry and aggregates. Adding/reordering places preserves the primary destination; explicitly removing it selects the first remaining place for map/weather metadata. Directions imports offer replacement or append after review. Route changes are signed over the complete itinerary; linked places are checked against crew access. Stale saves are rejected. A missing linked destination remains a saved place snapshot. The personal-distance cache validates all itinerary coordinates, and the route refresher branches to itinerary routing instead of flattening a trip to one pin. Failed refreshes retain an existing good route.

`DISABLE_NEW_ITINERARIES=1` stops creation of new itineraries and adding an itinerary to an existing single-place ride. Existing itinerary records remain readable/editable. Use the current compatibility code as the rollback baseline; do not restore an older binary that assumes every destination is a single pin.

## Validation

The automated suite covers source/ID collisions, original URL resolution, legacy loop normalization without mutation, saved metadata/timestamps, day splits, weekend overlap, Maps directions, full-itinerary cache invalidation, route signatures, malformed itineraries, original 80-character loop names, report retention, crew-scoped storage dispatch, optimistic update filters and bounded full-route stop suggestions.

Browser checks used an isolated, in-memory MongoDB-shaped fixture, with a test crew, an existing destination, a legacy loop and historical comments/attendance/logs. No real records were modified. Verified:

- 390px feed and loop detail, and 1440px editor/map layouts, without horizontal overflow.
- Legacy loops appear once in the main list, upcoming section, map selection and profiles, with canonical old links.
- A Friday-to-Saturday legacy loop appears in This weekend.
- Changing only an existing loop's notes retains its 470 km saved route, original overnight/day split, attendance and original comment.
- Adding places and overnight stays on an existing destination preserves its URL, saved notes, ride report and personal log.
- Creating a new itinerary saves through the destination flow.
- Logging an existing loop updates rider history and preserves a different upcoming plan date.
- Photo upload on an existing loop works; the authenticated photo URL serves an image that loads in both the main gallery and log entry.
- A concurrent editor save causes the older editor's save to be rejected.
- The legacy loop-create route redirects to the unified creator and preserves its seed query.
- Legacy loop calendar export returns 200, retains its original UID and correct exclusive multi-day end date.
- Destination and legacy loop image-preview routes return 200 with image/png.

The temporary browser fixture was removed and its server stopped after verification. All 57 unit tests, TypeScript checks, lint, the production build and diff whitespace checks passed.

## Remaining verification limit

The configured development MongoDB instance was unreachable, including a direct connectivity check outside the sandbox. Live MongoDB integration, concurrent quota enforcement against MongoDB, and real notification delivery between crew members were not exercised. Existing unique-index declarations were deliberately left unchanged. Production data and deployment were not touched.

Subsequent local connection repair: Windows DNS resolved the Atlas SRV/TXT records while Node's resolver timed out. Only `.env.local` was changed to the equivalent TLS seed-list connection, retaining its database, credentials and discovered replica-set/authentication options. The dev server was restarted with network access. MongoDB authentication/ping and the public `/admin` sign-in response passed. No private crew-page check or data mutation was performed; the original integration-test limits above still apply.
