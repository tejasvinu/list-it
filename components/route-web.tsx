import { HOME } from "@/lib/config";
import { categoryOf } from "@/lib/format";

/** Every route in the crew at once, radiating out of Bengaluru, with true-distance rings. */
export function RouteWeb({
  routes,
  width = 400,
  height = 260,
  className,
  active = null,
  animate = true,
}: {
  routes: { route: [number, number][]; category: string; name?: string }[];
  width?: number;
  height?: number;
  className?: string;
  /** Index of a route to bring forward; the others fade back. */
  active?: number | null;
  animate?: boolean;
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
  const pad = 26;
  const scale = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  const project = (lat: number, lng: number) => [offX + (lng * cos - minX) * scale, offY + (-lat - minY) * scale];
  const [cx, cy] = project(HOME.lat, HOME.lng);

  // Rings at real straight-line distances (one degree of latitude is about 111 km).
  const reach = Math.max(...all.map(([la, ln]) => Math.hypot(la - HOME.lat, (ln - HOME.lng) * cos)), 0.4) * 111;
  const rings = [50, 100, 200, 300, 400, 500].filter((r) => r < reach * 1.15).slice(-3);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      {rings.map((r) => {
        const rad = (r / 111) * scale;
        return (
          <g key={r}>
            <circle cx={cx} cy={cy} r={rad} fill="none" style={{ stroke: "var(--line-strong)" }} strokeDasharray="3 5" />
            <text
              x={cx + rad * 0.7071 + 4}
              y={cy - rad * 0.7071 - 4}
              style={{ fill: "var(--faint)", fontFamily: "var(--font-body)" }}
              fontSize="11"
              fontWeight="500"
            >
              {r} km
            </text>
          </g>
        );
      })}
      {routes.map((r, i) => {
        const d = r.route.map(([la, ln], j) => `${j ? "L" : "M"}${project(la, ln).map((v) => v.toFixed(1)).join(" ")}`).join("");
        const on = active === i;
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={categoryOf(r.category).color}
            strokeOpacity={active == null || on ? 1 : 0.45}
            strokeWidth={on ? 4 : 2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className={animate ? "route-draw" : undefined}
            style={{ animationDelay: `${0.1 + i * 0.09}s`, transition: "stroke-opacity 240ms, stroke-width 240ms" }}
          />
        );
      })}
      {routes.map((r, i) => {
        // The destination is the point farthest from home.
        const far = r.route.reduce((a, b) => ((b[0] - HOME.lat) ** 2 + (b[1] - HOME.lng) ** 2 > (a[0] - HOME.lat) ** 2 + (a[1] - HOME.lng) ** 2 ? b : a));
        const [x, y] = project(far[0], far[1]);
        const on = active === i;
        return (
          <g key={i} style={{ opacity: active == null || on ? 1 : 0.6, transition: "opacity 240ms" }}>
            <circle cx={x} cy={y} r={on ? 6 : 4.5} fill={categoryOf(r.category).color} style={{ stroke: "var(--surface)" }} strokeWidth="2" />
            {r.name && (
              <text
                x={x + (x > cx ? 10 : -10)}
                y={y + 5}
                textAnchor={x > cx ? "start" : "end"}
                style={{ fill: on ? "var(--text)" : "var(--muted)", fontFamily: "var(--font-display)" }}
                fontSize={on ? 19 : 16}
                fontWeight="700"
              >
                {r.name}
              </text>
            )}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="6" style={{ fill: "var(--surface)", stroke: "var(--text)" }} strokeWidth="2.5" />
    </svg>
  );
}
