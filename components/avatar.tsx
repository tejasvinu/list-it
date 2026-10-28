import type { RiderLite } from "@/lib/types";

export function Avatar({
  rider,
  size = 36,
  ring = false,
  className = "",
}: {
  rider: Pick<RiderLite, "emoji" | "color" | "name">;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      title={rider.name}
      className={`inline-grid shrink-0 place-items-center rounded-full select-none ${ring ? "ring-2 ring-bg" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `radial-gradient(circle at 30% 25%, ${rider.color}55, ${rider.color}22 60%, ${rider.color}11)`,
        boxShadow: `inset 0 0 0 1.5px ${rider.color}66`,
      }}
    >
      <span style={{ lineHeight: 1 }}>{rider.emoji}</span>
    </span>
  );
}

export function AvatarStack({ riders, max = 4, size = 24 }: { riders: RiderLite[]; max?: number; size?: number }) {
  const shown = riders.slice(0, max);
  const extra = riders.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((r, i) => (
        <Avatar key={r.id + i} rider={r} size={size} ring className={i ? "-ml-2" : ""} />
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 inline-grid place-items-center rounded-full bg-surface-3 text-[10px] font-semibold text-muted ring-2 ring-bg"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
