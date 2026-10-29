# list-it redesign, October 2026

Frontend only. Routes, server actions, data and auth are unchanged.

## Why

The previous pass ("tactical glass", `BLR RADAR // v2.6`) stacked the exact defaults that make a screen read as generated: near-black ground with one vermilion accent, frosted glass, glows, gradient buttons, monospace caps labels, pills everywhere and emoji as icons. The audit in `frontend-audit-2026-10-28.md` also found the feed and ride page put social chrome ahead of the decision (where, how far, who's in).

Skills used: Anthropic `frontend-design` (subject-first direction, avoid the generated-look clusters) and `design-taste-frontend` v2 (Awwwards SOTD study; app-screen rules for the crew screens, page rules for the landing page).

## The idea

On list-it, **the Indian highway kilometre stone** becomes the ride's identity. Every ride shows its round-trip distance painted on a milestone, and the stone's cap takes the colour of the road class it mostly runs on, exactly as on the road: yellow for national highways, green for state highways, orange for village and district roads, grey for the city. The road-mix bar uses the same four colours, so the encoding is learned once.

The competitor test: a generic "ride app" card fails it. A whitewashed stone with a yellow NH cap reading "455 km" belongs to riding out of Bengaluru.

## Tokens

| Role | Daylight | Night ride |
| --- | --- | --- |
| Ground | `#EDEEE9` limewash | `#0E0F0D` asphalt |
| Surface | `#FFFFFF` | `#181917` |
| Raised | `#E2E3DD` | `#232421` |
| Ink | `#121311` | `#F1F1EC` |
| Muted | `#464842` | `#B7B8B1` |
| Faint | `#62645E` | `#8F918A` |
| Accent (NH yellow) | `#FFC700` | `#FFC700` |

Light is the default; night follows `prefers-color-scheme`, using `light-dark()` so every token is defined once.

- Ride length (map lines, filters): short `#13A189`, day `#3A78F0`, multi-day `#E2513A`. No violet.
- Road class (milestone cap, road mix): city `#8D8F88`, NH `#F2BE00`, SH `#20A059`, country `#F07A1F`.

**Type.** Barlow Condensed (the milestone face: headings, distances, figures) and Barlow (text). Both descend from highway signage. Tabular figures for numbers. No monospace.

**Shape.** Milestones have a round top and a square base. Buttons are fully round (pill). Media and panels are 6px. Sheets 22px at the top. Nothing else is rounded.

**Surfaces.** Tone steps, not glass. One 1px line where a group needs an edge. Shadows only on what floats (sheet, toast, popover, the selected-ride card on the map).

**Colour budget.** Ink is the primary action. Yellow is for the milestone cap, "I'm in", the active nav mark and new activity. Category hues only on routes and their legend.

**Motion.** One orchestrated moment per screen: the route draws in, the milestone settles. Everything else answers a tap (press, sheet, reaction). All of it drops travel under `prefers-reduced-motion`.

## Screens

- **Shell.** Phone: a plain opaque bottom bar, five labelled destinations, ink "+" in the middle. Desktop: a 248px sidebar on the page ground with the wordmark and crew name, labelled links, and "Add a ride" as the one ink button.
- **Feed.** Each ride leads with the destination: media, then name, place, and the facts line (time, hairpins, who's in), with the milestone standing on the media's lower edge. Ride length is the main filter; Ridden and Hail Mary are separate toggles; sort is a quiet labelled choice. Crew totals are figures, not tiles.
- **Ride.** First screen on a phone: a short map, the name, the milestone, the facts, who's in and "Count me in". Then the road mix, notes, photos, stops and chatter.
- **Map.** Grey tiles so the coloured routes carry the meaning. Opaque top bar on phones, opaque ride list on desktop.
- **Landing.** One argument per section: what it is (with the crew's real routes as the live element: tap a ride to see its milestone), what a Maps link turns into (a real ride card), how joining works (link + PIN), and a full-width close.
