import { HOME } from "@/lib/config";
import { categoryOf } from "@/lib/format";

type Props = {
  id: string;
  route: [number, number][];
  category: string;
  width?: number;
  height?: number;
  animate?: boolean;
  labels?: boolean;
  /** Fraction of the height kept clear at the bottom, e.g. for a title overlay */
  bottomRoom?: number;
  className?: string;
};

/**
 * The route drawn as art: Bengaluru out to the destination and back,
 * projected onto a dark dotted canvas. No map tiles needed.
 */
export function RouteArt({ id, route, category, width = 400, height = 300, animate = true, labels = true, bottomRoom = 0, className }: Props) {
  const color = categoryOf(category).color;
  const pts = route.length >= 2 ? route : [[HOME.lat, HOME.lng] as [number, number], [HOME.lat + 0.1, HOME.lng + 0.1] as [number, number]];

  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const xs = lngs.map((l) => l * Math.cos(midLat));
  const ys = lats.map((l) => -l);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.min(width, height) * 0.2;
  const spanX = maxX - minX || 1e-6;
  const spanY = maxY - minY || 1e-6;
  const room = height * bottomRoom;
  const scale = Math.min((width - pad * 2) / spanX, (height - room - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - room - spanY * scale) / 2;
  const project = (lat: number, lng: number) =>
    [offX + (lng * Math.cos(midLat) - minX) * scale, offY + (-lat - minY) * scale] as const;

  const d = pts.map(([la, ln], i) => `${i ? "L" : "M"}${project(la, ln).map((v) => v.toFixed(1)).join(" ")}`).join("");

  // The destination is the point farthest from home.
  let far = pts[0];
  let farD = -1;
  for (const p of pts) {
    const dd = (p[0] - HOME.lat) ** 2 + (p[1] - HOME.lng) ** 2;
    if (dd > farD) {
      farD = dd;
      far = p;
    }
  }
  const [hx, hy] = project(HOME.lat, HOME.lng);
  const [dx, dy] = project(far[0], far[1]);
  const gid = `rg-${id}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id={`${gid}-dots`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.07)" />
        </pattern>
        <radialGradient id={`${gid}-glow`} cx={dx / width} cy={dy / height} r="0.6">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${gid}-line`} gradientUnits="userSpaceOnUse" x1={hx} y1={hy} x2={dx} y2={dy}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
        <filter id={`${gid}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width={width} height={height} fill="#0e0e12" />
      <rect width={width} height={height} fill={`url(#${gid}-dots)`} />
      <rect width={width} height={height} fill={`url(#${gid}-glow)`} />
      <path d={d} fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="7" filter={`url(#${gid}-blur)`} />
      <path
        d={d}
        fill="none"
        stroke={`url(#${gid}-line)`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className={animate ? "route-draw" : undefined}
      />
      <circle cx={hx} cy={hy} r="5" fill="#0e0e12" stroke="#fff" strokeWidth="2" />
      <circle cx={dx} cy={dy} r="6" fill={color} className={animate ? "ping-soft" : undefined} opacity="0.6" />
      <circle cx={dx} cy={dy} r="6" fill={color} stroke="#0e0e12" strokeWidth="2" />
      {labels && (
        <text
          x={hx}
          y={hy + (hy > height - 30 ? -12 : 20)}
          textAnchor="middle"
          fill="rgba(255,255,255,0.6)"
          fontSize="11"
          fontWeight="700"
          letterSpacing="1.5"
        >
          {HOME.short}
        </text>
      )}
    </svg>
  );
}
