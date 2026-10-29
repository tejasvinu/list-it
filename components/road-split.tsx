import { splitParts, splitSummary } from "@/lib/format";
import type { RoadSplit } from "@/lib/types";

/** The round trip's road mix, in kilometre-stone colours. */
export function RoadSplitBar({ split }: { split: RoadSplit }) {
  const parts = splitParts(split);
  return (
    <figure>
      <figcaption className="mb-2.5 text-[16px] font-semibold">{splitSummary(split)}</figcaption>
      <div className="flex h-3 gap-[3px]" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round(p.km)} km`).join(", ")}>
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${p.pct}%`, background: p.color }} className="h-full rounded-[2px]" />
        ))}
      </div>
      <ul className="num mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2 text-[14px] text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: p.color }} />
            {p.label}
            <span className="font-semibold text-text">{Math.round(p.km)} km</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
