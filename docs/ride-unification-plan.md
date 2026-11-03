# One ride experience

Original plan, 3 November 2026. Implementation notes and verified results are in `ride-unification-implementation.md`. The implementation uses namespaced attachment keys to preserve existing indexes, replacing the proposed index transition below. No parent or history conversion is required.

## Decision

Make **Ride** the only product concept. A ride can have one destination or an itinerary with several places and overnight stays. Use the existing ride experience as the foundation, bringing the loop builder's route planning into it.

Preserve every saved item's identity and history. Existing rides stay in `destinations`; existing loops stay in `loops`. Adapt both into the same experience. All items created through the new flow use the extended destination model. This achieves consolidation without a bulk conversion, copied social history, or a forced upgrade of old records.

The merge is complete when creation, detail, discovery, logs, photos and profiles work consistently for both sources. Removing the Rides/Loops tabs alone is an intermediate step.

## What the code does today

- `components/feed-view.tsx` already mixes destinations and loops, but still renders `FeedSwitch`, a separate Loops filter and different cards. Its totals and Up next section include only destinations. Length filters exclude loops, and loop popularity ignores comments.
- `components/bottom-nav.tsx` still offers separate creation choices, and `/g/[slug]/loops` is a second listing.
- `DestinationView` supports statuses, reactions, attendance, reports, logs, rider photos, suggested stops, personal distances and weather. `LoopView` supports attendance, comments, itinerary days, overnight forecasts, sharing and calendar export, with a separate builder.
- Destination relationships use `destinationId`. Loop attendance and comments have their own collections. The MongoDB `rides` collection is a **completion log**, not the ride catalogue.
- Profiles and crew counts use destination data only. The map draws loop routes separately from its selectable destination list. Activity, notifications and calendar exports already understand both IDs.
- Loops save their start point, ordered stop snapshots, legs and totals. A stop can link to a destination without owning it. Destination deletion already leaves the stop's saved place intact.
- `lib/reroute.ts`, `origin-routes.ts` and stop suggestions assume a single destination. Reusing those paths unchanged could flatten an itinerary or return incorrect distances.

Sources: `lib/db.ts`, `lib/types.ts`, `lib/data.ts`, `lib/loop-data.ts`, `app/g/[slug]/actions.ts`, `app/g/[slug]/loop-actions.ts`, the two detail routes, photo actions/serving, calendar handler and profile route.

## Intended UX

### One list and one entry point

- Keep the Rides navigation item and **Add a ride** action. Remove the Rides/Loops switch, separate loop listing and creation chooser.
- Every saved item appears once in the same cards/list, search, map selection, upcoming section and profile views. Existing linked destinations remain independently saved rides; their presence in an itinerary is not a duplicate to delete.
- Keep Short, Day ride, Multi-day, Ridden, Hail Mary and This weekend. Stop count is a fact, not a separate product type. A one-day route with multiple places must not automatically become Multi-day.
- Search includes name, area and itinerary place names. Popularity includes reactions, comments and attendance for either source. Use a composite source-and-ID key throughout lists and caches.
- Upcoming includes dated items from either source. This weekend matches an itinerary whose inclusive trip dates overlap the weekend, including a Friday departure with a Saturday overnight. Ridden remains based on explicit per-rider logs, never an elapsed planned date.
- Preserve existing saved categories. For old loops without a category, derive Multi-day from actual overnight/day splits; otherwise suggest Short or Day ride from distance. Allow the same category override as rides.
- Preserve the meaning of existing ridden statistics. New loop logs contribute going forward; past attendance or dates never manufacture completion records. Count each saved item once. Riding an itinerary does not automatically mark its linked destinations ridden.

### One creation and editing flow

1. Start with the familiar Maps link/place search. Accept a directions link in the same field and preview all imported places before saving.
2. Show the existing ride details and an optional **Add another place** control. Expand the itinerary editor only when needed: ordered places, move/remove, overnight toggles, saved start, route preview and daily distance warnings.
3. Keep category, status/date, tags, seasons, notes and ride-report controls available in the same form. Save with one **Save ride** action. Retain unsaved values when adding/removing itinerary places or when routing fails.
4. Existing single-destination rides can gain an itinerary in place, keeping their ID, comments, photos and logs. Existing loops edit their original loop record through the same form. Reducing either to one place does not change its storage identity.
5. Replace **Add to a loop** with **Use in a ride**: start a new itinerary using this saved place, or add the place to one of your existing rides. This is a reference to a place; it never merges records or transfers their history. Do not flatten a multi-stop ride into a single place implicitly; offer its individual itinerary places for selection.

Opening or saving unrelated details must not recalculate a saved route. Recalculate when route inputs change or the owner explicitly refreshes it. Preserve the original primary destination when adding places to an existing destination; for a new itinerary the first place is the metadata anchor. The complete itinerary determines distance and map geometry.

### One detail experience

Use the current ride detail hierarchy for both sources: map, name, distance/time, plan/date, attendance and primary action, then notes, itinerary when present, report, log, photos, stops and comments.

Retain every loop capability: up to 20 itinerary places, reorder, overnight flags, start snapshot, day splits, final day home, approximate-leg labels, Maps directions, calendar duration and overnight forecasts. Treat itinerary places that shape the route separately from optional fuel/breakfast/viewpoint suggestions; adding a suggestion must not silently reroute the trip.

Bring statuses, reactions, reports, logs and photos to existing loops. Route-specific facts such as road mix and hairpins may be unknown: show them only when available. Do not sum linked rides' round trips to invent an itinerary's totals or road mix. Weather follows the itinerary's dates and overnight places; a one-day ride uses its destination forecast.

## Compatibility and data design

### Shared application model

Introduce a server-side ride service above the existing readers/actions, with an internal reference `{ source: "destination" | "loop", id }`. The browser-facing label is always Ride. Every action resolves that reference within the signed-in crew and applies the existing ownership/removal rules. Never fall back to searching the other collection when a reference is missing.

The service normalizes a common summary/detail shape and dispatches writes to the original parent. Keep legacy action exports as wrappers for forms already open during a deployment. Batch hydration for feed/profile pages; do not replace current batched reads with one query per card.

For destinations, add an optional versioned `itinerary` containing the saved start, ordered place snapshots and legs. Keep `distanceKm`, `durationMin` and `route` as the authoritative aggregate fields; do not introduce competing `totalKm` fields on destinations. Absence of the optional field means today's single-destination behavior. Older destination records require no writes.

For old loops, normalize existing `totalKm`, `totalMin`, `route`, `start`, `stops` and `legs` directly. Add optional ride metadata only on explicit saves. Missing metadata gets read defaults: empty tags/seasons/photos, unknown route facts, and Planned when `startDate` exists or Wishlist otherwise. Keep `startDate` as the loop's date authority; do not persist a competing `statusDate`. Preserve original creation dates, ownership, stop snapshots and deleted state.

### Relationships and missing loop features

- Destination comments/attendance continue in `comments`/`interests`; loop comments/attendance continue in `loopComments`/`loopInterests`. Shared service methods hide this difference. Do not copy or concatenate independent threads.
- Generalize ride-only relationships needed by old loops: reactions, completion logs, uploads, optional POI stops and their route caches. Use an exclusive destination-or-loop parent reference; preserve existing `destinationId` documents unchanged and allow `loopId` for loop-owned rows. Reject both/neither in all new writes.
- Existing activity and notifications keep their original IDs/kinds/timestamps. Normalize their copy and links at rendering time. New loop interactions must notify the correct owner/commenters/attendees without duplicating events. Loop date changes need the same attendee notification behavior as ride date changes.
- Keep one completion log per rider per saved item, including note and original logger permissions. A multi-day log's date is the completion day; logging must not clear or rewrite a multi-day plan merely because a single-day equality check matches. Preserve current destination log behavior, and clear an itinerary's matching plan only when the logged completion matches that plan's computed final day.
- Upload, deletion and photo serving must resolve either parent. Preserve existing photo IDs, URLs, ETags and access checks, 6-photo rider/item quotas and the shared 400-photo crew quota. Parent deletion affects only its own uploads; removing a log never deletes photos.

### Index rollout is required before loop feature writes

`ensureIndexes()` currently installs unconditional unique destination indexes. Simply inserting loop-owned records into these collections would make their absent destination keys share uniqueness constraints.

Use a separate, idempotent index transition with a dry-run/report mode, after a compatibility deployment:

- Inspect current indexes and duplicate/invalid parent records before changing anything.
- For reactions and completion logs, replace destination-only uniqueness with destination-scoped partial uniqueness and add loop-scoped uniqueness, each including rider ID.
- Apply equivalent parent-specific uniqueness to upload rider slots, personal-route cache keys and suggested-stop caches. Keep the crew upload-slot unique index intact.
- Add supporting loop indexes for reads. Update startup index declarations so they cannot recreate superseded unconditional indexes.
- Verify legacy destination writes and concurrent loop writes on a development database. Enable loop feature writes only after the transition succeeds and older server instances can no longer reinstall obsolete indexes.

This changes indexes and permits additive records; it does not rewrite parents or move history. Do not put a bulk conversion or index-dropping operation in the automatic `migrate()` connection path.

### Route and cache safeguards

- Adapt route refresh, profile batch calculations, preview validation and admin reroute before allowing destination itineraries. Branch to itinerary routing when present; never send one through the old home-to-pin refresher.
- Personal-route caches must validate the full ordered itinerary and selected start, not just `destinationLat`/`destinationLng`. Keep personal estimates separate from the saved canonical start/route. They must never move a saved loop when a rider edits their profile.
- Route seals/server validation must cover the complete itinerary. Resolve linked places in the crew, preserve unlinked snapshots when referenced rides were deleted, and reject stale concurrent edits.
- Metadata-only saves preserve legs, polyline and totals. Refresh failures preserve a good saved route. New/changed routes may use the current explicit approximate fallback, shown in preview before saving.
- Suggested stops need itinerary-leg sampling instead of truncating the whole route at one destination pin. Bound total work across legs and invalidate caches when the ordered itinerary changes. Route services/weather remain streamed or on demand.
- Profiles count the complete saved itinerary once, never the sum of its linked destination distances. Where a valid personal full-itinerary estimate is missing, label/use the saved route's distance; never reuse a one-pin estimate.

### Existing URLs and integrations

- Keep `/g/[slug]/d/[id]` and its edit route working, with the shared detail/editor. New items continue using these URLs.
- Keep `/g/[slug]/loops/[id]` and its edit route working for the original records, with the same shared detail/editor. No new public URL scheme or ID rewrite is needed.
- Temporarily redirect only the exact `/loops` listing to the main feed and the exact `/loops/new` route to `/new`. Preserve a valid `?ride=` seed in the unified creator. Do not use a wildcard redirect that catches existing loop details or edits.
- Keep old calendar endpoints and event UIDs: destination UID is the original ID; loop UID retains its `loop-` prefix. New destination itineraries export their computed duration. Preserve photo URLs, comment anchors, activity/notification targets and existing WhatsApp links/previews.
- Both detail routes go back to Rides. Apply common metadata/share presentation without requiring sign-in for the existing limited link-preview metadata or exposing additional private content.

## Implementation sequence and release gates

### 1. Establish compatibility and preservation checks

Add the shared reference/read model and fixture coverage for both sources while retaining current UI behavior. Capture a development baseline of parent IDs, ownership, routes, dates and relationship counts. Add missing source-aware photo/log/cache support behind a disabled feature flag. Prepare and verify the index transition separately.

Gate: existing records render identically in meaning, old actions still work, and simply loading any page writes no conversion/default fields. No production data operations are part of this planning task.

### 2. Add optional itineraries to the ride model

Extend destination validation, routing/seals, edits, personal routing, cache invalidation, admin refresh and calendar export together. Reuse the loop day/routing helpers behind source-neutral names or wrappers. Preserve old exports until callers move over.

Gate: a saved destination gains/removes/reorders itinerary places under its original ID without losing relationships. An unchanged route survives metadata edits and a routing outage. Existing loops retain their original saved start, nights and geometry.

### 3. Deliver one complete experience

Compose the shared creator/detail from the ride UI and itinerary editor; connect existing loops to all applicable ride features. Unify cards, filters, totals, Up next, map selection, profiles/history, notifications/digest copy and creation actions. Apply exact legacy-list/create redirects, preserving detail/edit URLs.

Gate: both saved sources support the same ordinary ride tasks. Remove the separate loop navigation only when the unified flow can replace its capabilities. Enable behind a flag in development first, then release after preservation checks pass.

### 4. Remove redundant UI implementations

Delete unused switch/chooser/cards/views once their callers are gone, and update seed data and README terminology. Retain compatibility routes/actions and legacy storage support. Physical collection consolidation is unnecessary for this change and can be evaluated separately later.

Gate: one creator and detail implementation, no user-facing choice between Ride and Loop, and no orphaned historical links.

## Verification before release

- Load real-shape fixtures for a ridden/photo-rich destination, planned destination, one-day loop, multi-day loop with a final overnight, deleted linked destination, removed owner and deleted parent. Compare preserved IDs, ownership, route values, dates, notes and relationships before/after read and edit flows.
- Test same bare ID in both collections, cross-crew references, malformed/both-parent references and unauthorized edits/deletions. Keep current source-specific permissions during consolidation; policy changes are separate work.
- Exercise attendance toggle, comment deletion, reactions, multi-rider log update/removal, original logger/note preservation, photo serving/removal and concurrent photo/log uniqueness for each parent source.
- Test metadata-only edits, adding an itinerary to an existing destination, reducing an itinerary to one place, stale saves, profile-start changes and failed route refresh. Verify caches and admin reroute cannot substitute a single-pin route.
- Check Short/Day/Multi-day, search, popularity, Ridden, overlapping weekend dates, Up next and profile counts/history with mixed data. Never infer a completed ride from attendance or a past plan.
- Open saved detail/edit/photo/notification/comment links and download calendars through both old endpoint kinds. Assert unchanged event UIDs and correct multi-day exclusive end dates.
- Walk create/edit/detail, map and profile at 390px and 1440px, with keyboard and reduced motion. Check that a single-destination ride remains a short flow and an existing loop loses no itinerary controls.
- Run typecheck, lint, unit/integration tests and production build. Use a development database for index/concurrency checks; record what was actually exercised before release.

## Rollback

Use the tested compatibility release as the rollback baseline. It must read optional itineraries and loop relationships before either is enabled. Disable the new UI/creation flag to stop further new flows while retaining full read/edit access to saved data.

Do not roll back to a pre-compatibility binary: it can flatten destination itineraries on refresh, hide new loop features or recreate obsolete indexes. Do not undo indexes, delete additive data or convert records as part of rollback. Retain readers for anything already written.

## Scope of this planning pass

Only this plan was added. No application code, stored rides/loops, schema, indexes or production services were changed. Runtime/browser/database verification remains implementation work.
