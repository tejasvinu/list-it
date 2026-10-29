import { HOME } from "@/lib/config";
import { categoryOf } from "@/lib/format";

type Props = {
  id: string;
  route: [number, number][];
  category: string;
  width?: number;
  height?: number;
  animate?: boolean;
  /** Name home on the drawing. Defaults to on without map tiles, off with them. */
  labels?: boolean;
  /** Fraction of the height kept clear at the bottom, e.g. for a title overlay */
  bottomRoom?: number;
  /** Draw grey OpenStreetMap tiles under the route instead of a plain ground */
  map?: boolean;
  className?: string;
};

/** Web Mercator, in pixels of a 256px world (zoom 0). */
const mercator = (lat: number, lng: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * 256, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256] as const;
};

/**
 * The route drawn as a road on a map: Bengaluru out to the destination and back,
 * on a plain ground, or with `map`, over grey tiles (day or night, from the theme).
 */
export function RouteArt({ id, route, category, width = 400, height = 300, animate = true, labels, bottomRoom = 0, map = false, className }: Props) {
  // Map tiles already name the city, so only the plain drawing labels home by default.
  labels ??= !map;
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
  const stroke = Math.max(2.5, Math.min(width, height) / 110);

  const tileImages = tiles.map((t) => (
    // Overlap by a hair so seams between tiles don't show.
    <image key={t.href + t.x} href={t.href} x={t.x} y={t.y} width={t.size + 1} height={t.size + 1} preserveAspectRatio="none" />
  ));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      {map && (
        <defs>
          {/* Day: grey and a little lifted. Night: inverted to asphalt. Matches .map-tiles on the Leaflet maps. */}
          <filter id={`${gid}-day`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.86" intercept="0.12" />
              <feFuncG type="linear" slope="0.86" intercept="0.12" />
              <feFuncB type="linear" slope="0.86" intercept="0.11" />
            </feComponentTransfer>
          </filter>
          <filter id={`${gid}-night`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.74" intercept="0.03" />
              <feFuncG type="linear" slope="0.74" intercept="0.03" />
              <feFuncB type="linear" slope="0.74" intercept="0.025" />
            </feComponentTransfer>
          </filter>
        </defs>
      )}
      <rect width={width} height={height} style={{ fill: "var(--surface-2)" }} />
      {map && (
        <>
          <g className="tiles-day" filter={`url(#${gid}-day)`}>
            {tileImages}
          </g>
          <g className="tiles-night" filter={`url(#${gid}-night)`}>
            {tileImages}
          </g>
        </>
      )}
      {/* A casing in the ground colour so the line reads on any tile. */}
      <path d={d} fill="none" style={{ stroke: "var(--surface)" }} strokeOpacity="0.9" strokeWidth={stroke + 3} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className={animate ? "route-draw" : undefined}
      />
      <circle cx={hx} cy={hy} r={stroke + 2} style={{ fill: "var(--surface)", stroke: "var(--text)" }} strokeWidth="2" />
      <circle cx={dx} cy={dy} r={stroke + 3} fill={color} style={{ stroke: "var(--surface)" }} strokeWidth="2.5" />
      {labels && (
        <text
          x={hx}
          y={hy + (hy > height - 30 ? -12 : 22)}
          textAnchor="middle"
          style={{ fill: "var(--text)", fontFamily: "var(--font-display)" }}
          fontSize="13"
          fontWeight="700"
        >
          {HOME.name}
        </text>
      )}
    </svg>
  );
}
