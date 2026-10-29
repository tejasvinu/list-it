import { ROAD_SPLIT_LABELS } from "@/lib/config";
import { mainRoad } from "@/lib/format";
import type { RoadSplit } from "@/lib/types";

const CAP_TEXT = { nh: "NH", sh: "SH", other: "", city: "" } as const;

/**
 * A ride's round trip painted on an Indian kilometre stone. As on the road, the
 * cap is yellow for a national highway, green for a state highway and orange for
 * country roads: here it's the road class the ride mostly runs on.
 */
export function Milestone({
  name,
  distanceKm,
  split,
  size = 14,
  approx = false,
  className = "",
}: {
  name: string;
  distanceKm: number;
  split: RoadSplit | null;
  /** Base font size in px; the stone scales with it. */
  size?: number;
  approx?: boolean;
  className?: string;
}) {
  const road = mainRoad(split);
  const value = Math.round(distanceKm).toLocaleString("en-IN");
  const label = `${approx ? "About " : ""}${value} km round trip to ${name}, mostly ${ROAD_SPLIT_LABELS[road].label.toLowerCase()}`;
  return (
    <span role="img" aria-label={label} className={`milestone ${className}`} style={{ fontSize: size, ["--cap" as string]: ROAD_SPLIT_LABELS[road].color }}>
      <span className="milestone-cap" aria-hidden>
        {CAP_TEXT[road]}
      </span>
      <span className="milestone-face" aria-hidden>
        <i>{name}</i>
        <b>
          {approx && "~"}
          {value}
        </b>
        <small>km</small>
      </span>
    </span>
  );
}

/** A small hairpin-bend glyph, as on the ghat road warning boards. */
export function HairpinIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M4 15V7a4 4 0 0 1 8 0v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 12.5 12 15l2-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
