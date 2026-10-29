// Shared constants. Safe to import from client and server code.

/** Every ride starts and ends here (Bengaluru city centre). */
export const HOME = { name: "Bengaluru", short: "BLR", lat: 12.9716, lng: 77.5946 };

export const START_AREAS = [
  { name: "Whitefield", lat: 12.9698, lng: 77.75 },
  { name: "Yelahanka", lat: 13.1007, lng: 77.5963 },
  { name: "Hebbal", lat: 13.0358, lng: 77.597 },
  { name: "Electronic City", lat: 12.8456, lng: 77.6603 },
  { name: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
  { name: "JP Nagar", lat: 12.9063, lng: 77.5857 },
  { name: "Banashankari", lat: 12.9255, lng: 77.5468 },
  { name: "Rajajinagar", lat: 12.9916, lng: 77.551 },
  { name: "Marathahalli", lat: 12.9591, lng: 77.6974 },
  { name: "Sarjapur Road", lat: 12.9141, lng: 77.6774 },
  { name: "Kengeri", lat: 12.9142, lng: 77.4825 },
  { name: "Hennur", lat: 13.0356, lng: 77.642 },
  { name: "Bellandur", lat: 12.9304, lng: 77.6784 },
  { name: "HSR Layout", lat: 12.9116, lng: 77.6474 },
  { name: "Jayanagar", lat: 12.925, lng: 77.5938 },
  { name: "Malleshwaram", lat: 13.0031, lng: 77.5643 },
  { name: "Devanahalli", lat: 13.247, lng: 77.713 },
] as const;

export const REGISTRATION_DAYS = 3;

export const CATEGORIES = {
  short: { label: "Short ride", short: "Short", hint: "Breakfast run, back by lunch", color: "#13a189" },
  day: { label: "Day ride", short: "Day ride", hint: "Leave at dawn, home by night", color: "#3a78f0" },
  multi: { label: "Multi-day", short: "Multi-day", hint: "Pack a bag", color: "#e2513a" },
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

/** Suggest a bucket from the round-trip distance. Riders can override. */
export function suggestCategory(roundTripKm: number): Category {
  if (roundTripKm <= 300) return "short";
  if (roundTripKm <= 650) return "day";
  return "multi";
}

export const ROAD_TAGS = {
  twisties: "Twisties",
  ghat: "Ghat section",
  highway: "Highway",
  scenic: "Scenic",
  offroad: "Off-road",
  broken: "Broken patches",
  forest: "Forest",
  coastal: "Coastal",
  food: "Great food",
  stay: "Good stays",
} as const;
export type RoadTag = keyof typeof ROAD_TAGS;
export const ROAD_TAG_KEYS = Object.keys(ROAD_TAGS) as RoadTag[];

export const SEASONS = {
  winter: "Winter",
  summer: "Summer",
  monsoon: "Monsoon",
  postmonsoon: "Post-monsoon",
  anytime: "Any time",
} as const;
export type Season = keyof typeof SEASONS;
export const SEASON_KEYS = Object.keys(SEASONS) as Season[];

export const STATUSES = {
  wishlist: { label: "Wishlist", emoji: "✨", hint: "Want to do this" },
  hailmary: { label: "Hail Mary", emoji: "🙏", hint: "Dream ride, someday" },
  planned: { label: "Planned", emoji: "📅", hint: "Date's locked" },
  done: { label: "Ridden", emoji: "🏁", hint: "Been there" },
} as const;
export type Status = keyof typeof STATUSES;
export const STATUS_KEYS = Object.keys(STATUSES) as Status[];

export const STOP_KINDS = {
  breakfast: { label: "Breakfast", emoji: "🍳" },
  viewpoint: { label: "Viewpoint", emoji: "🏞️" },
  photo: { label: "Photo spot", emoji: "📸" },
  fuel: { label: "Fuel", emoji: "⛽" },
  other: { label: "Stop", emoji: "📍" },
} as const;
export type StopKind = keyof typeof STOP_KINDS;
export const STOP_KIND_KEYS = Object.keys(STOP_KINDS) as StopKind[];

/** Label for a tag: known tags get their name, custom ones get a hash. */
export function tagLabel(tag: string) {
  return tag in ROAD_TAGS ? ROAD_TAGS[tag as RoadTag] : `#${tag}`;
}

/** Coloured like Indian kilometre stones: yellow NH, green SH, orange village roads. */
export const ROAD_SPLIT_LABELS = {
  city: { label: "City", color: "#8d8f88" },
  nh: { label: "National highway", color: "#f2be00" },
  sh: { label: "State highway", color: "#20a059" },
  other: { label: "Country roads", color: "#f07a1f" },
} as const;

export const REACTIONS = ["🔥", "🤘", "😍", "🏍️", "🥶", "👀"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const AVATAR_EMOJIS = [
  "🏍️", "🦅", "🐺", "🐯", "🦁", "🐻", "🦊", "🐉", "🦈", "🐆",
  "🔥", "⚡", "🌪️", "☄️", "🌙", "🏔️", "🛞", "🪖", "😎", "🤠",
] as const;

export const AVATAR_COLORS = [
  "#ff7a1a", "#f43f5e", "#e879f9", "#a78bfa", "#60a5fa",
  "#22d3ee", "#2dd4bf", "#4ade80", "#facc15", "#fb923c",
] as const;
