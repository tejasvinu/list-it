import { HOME } from "@/lib/config";
import { categoryOf } from "@/lib/format";

/** Every route in the crew at once, radiating out of Bengaluru. */
export function RouteWeb({
  routes,
  width = 400,
  height = 260,
  className,
}: {
  routes: { route: [number, number][]; category: string }[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const all = routes.flatMap((r) => r.route);
  const cos = Math.cos((HOME.lat * Math.PI) / 180);
  const xs = [HOME.lng, ...all.map((p) => p[1])].map((l) => l * cos);
  const ys = [HOME.lat, ...all.map((p) => p[0])].map((l) => -l);
  // Fit the routes' bounding box (at least ~0.8° around home so a lone short ride isn't huge).
  const minX = Math.min(...xs, HOME.lng * cos - 0.4);
  const maxX = Math.max(...xs, HOME.lng * cos + 0.4);
  const minY = Math.min(...ys, -HOME.lat - 0.4);
  const maxY = Math.max(...ys, -HOME.lat + 0.4);
  const pad = 22;
  const scale = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  const project = (lat: number, lng: number) => [offX + (lng * cos - minX) * scale, offY + (-lat - minY) * scale];
  const [cx, cy] = project(HOME.lat, HOME.lng);
  const ring = Math.max(width, height) / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <radialGradient id="web-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff7a1a" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={ring} fill="url(#web-glow)" />
      {[0.33, 0.66, 1].map((f) => (
        <circle
          key={f}
          cx={cx}
          cy={cy}
          r={ring * f}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeDasharray="2 5"
        />
      ))}
      {routes.map((r, i) => {
        const d = r.route.map(([la, ln], j) => `${j ? "L" : "M"}${project(la, ln).map((v) => v.toFixed(1)).join(" ")}`).join("");
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={categoryOf(r.category).color}
            strokeOpacity="0.75"
            strokeWidth="2.2"
            strokeLinecap="round"
            pathLength={1}
            className="route-draw"
            style={{ animationDelay: `${0.1 + i * 0.08}s` }}
          />
        );
      })}
      <circle cx={cx} cy={cy} r="5" fill="#09090b" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
