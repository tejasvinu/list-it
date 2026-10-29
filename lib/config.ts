// Shared constants. Safe to import from client and server code.

/** Every ride starts and ends here (Bengaluru city centre). */
export const HOME = { name: "Bengaluru", short: "BLR", lat: 12.9716, lng: 77.5946 };

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
