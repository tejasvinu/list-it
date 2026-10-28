import { splitParts, splitSummary } from "@/lib/format";
import type { RoadSplit } from "@/lib/types";

export function RoadSplitBar({ split }: { split: RoadSplit }) {
  const parts = splitParts(split);
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[13px] font-semibold">{splitSummary(split)}</p>
        <p className="text-[11px] text-faint">road mix, round trip</p>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${p.pct}%`, background: p.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} <span className="text-faint">{Math.round(p.pct)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
