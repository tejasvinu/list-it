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
  /** Draw darkened OpenStreetMap tiles under the route instead of the dotted canvas */
  map?: boolean;
  className?: string;
};

/** Web Mercator, in pixels of a 256px world (zoom 0). */
const mercator = (lat: number, lng: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * 256, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256] as const;
};

/**
 * The route drawn as art: Bengaluru out to the destination and back,
 * on a dark dotted canvas, or with `map`, over darkened map tiles.
 */
export function RouteArt({ id, route, category, width = 400, height = 300, animate = true, labels = true, bottomRoom = 0, map = false, className }: Props) {
  const color = categoryOf(category).color;
  const pts = route.length >= 2 ? route : [[HOME.lat, HOME.lng] as [number, number], [HOME.lat + 0.1, HOME.lng + 0.1] as [number, number]];

  // Both projections are equirectangular-ish at this scale; map mode uses Mercator so it lines up with the tiles.
  const lats = pts.map((p) => p[0]);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const toXY = (lat: number, lng: number) => (map ? mercator(lat, lng) : ([lng * Math.cos(midLat), -lat] as const));
  const xy = pts.map(([la, ln]) => toXY(la, ln));
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
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
  // Rounded so the server and the browser agree to the digit (their Math.log can differ in the last bits).
  const round = (v: number) => Math.round(v * 10) / 10;
  const project = (lat: number, lng: number) => {
    const [x, y] = toXY(lat, lng);
    return [round(offX + (x - minX) * scale), round(offY + (y - minY) * scale)] as const;
  };

  // Tiles one zoom level finer than the fit, so they stay sharp on high-density screens.
  const tiles: { href: string; x: number; y: number; size: number }[] = [];
  if (map) {
    const z = Math.max(2, Math.min(16, Math.floor(Math.log2(scale)) + 1));
    const n = 2 ** z;
    const size = (256 / n) * scale;
    const x0 = offX - minX * scale;
    const y0 = offY - minY * scale;
    for (let ty = Math.max(0, Math.floor(-y0 / size)); ty <= Math.min(n - 1, Math.floor((height - y0) / size)); ty++) {
      for (let tx = Math.floor(-x0 / size); tx <= Math.floor((width - x0) / size); tx++) {
        const wx = ((tx % n) + n) % n;
        tiles.push({ href: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`, x: round(x0 + tx * size), y: round(y0 + ty * size), size: round(size) });
      }
    }
  }

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
        <radialGradient id={`${gid}-glow`} cx={(dx / width).toFixed(3)} cy={(dy / height).toFixed(3)} r="0.6">
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
        {map && (
          // Same look as the Leaflet maps' .dark-tiles: invert, turn the hues back, then mute.
          <filter id={`${gid}-dark`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" />
            <feColorMatrix type="hueRotate" values="180" />
            <feColorMatrix type="saturate" values="0.35" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.72" intercept="0.02" />
              <feFuncG type="linear" slope="0.72" intercept="0.02" />
              <feFuncB type="linear" slope="0.72" intercept="0.03" />
            </feComponentTransfer>
          </filter>
        )}
      </defs>
      <rect width={width} height={height} fill="#0e0e12" />
      {map ? (
        <g filter={`url(#${gid}-dark)`}>
          {tiles.map((t) => (
            // Overlap by a hair so seams between tiles don't show.
            <image key={t.href + t.x} href={t.href} x={t.x} y={t.y} width={t.size + 1} height={t.size + 1} preserveAspectRatio="none" />
          ))}
        </g>
      ) : (
        <rect width={width} height={height} fill={`url(#${gid}-dots)`} />
      )}
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
