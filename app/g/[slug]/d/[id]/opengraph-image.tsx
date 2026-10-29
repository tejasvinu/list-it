import { ImageResponse } from "next/og";
import { cols } from "@/lib/db";
import { HOME } from "@/lib/config";
import { categoryOf, duration, km } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ride preview";

/**
 * WhatsApp link preview: the route and the numbers. No background photo: a photo under the route made the
 * PNG about 700 KB, and WhatsApp tends to skip preview images that big.
 */
export default async function Image({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const c = await cols();
  const group = await c.groups.findOne({ slug });
  const d = group ? await c.destinations.findOne({ _id: id, groupId: group._id, deletedAt: null }) : null;
  if (!d) return new ImageResponse(<div style={{ width: "100%", height: "100%", background: "#09090b" }} />, size);

  const color = categoryOf(d.category).color;
  const W = 520;
  const H = 520;
  const lats = d.route.map((p) => p[0]);
  const lngs = d.route.map((p) => p[1]);
  const cos = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
  const minX = Math.min(...lngs) * cos;
  const maxX = Math.max(...lngs) * cos;
  const minY = -Math.max(...lats);
  const maxY = -Math.min(...lats);
  const scale = Math.min((W - 80) / (maxX - minX || 1e-6), (H - 80) / (maxY - minY || 1e-6));
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxY - minY) * scale) / 2;
  const pt = (la: number, ln: number) => [ox + (ln * cos - minX) * scale, oy + (-la - minY) * scale];
  const path = d.route.map(([la, ln], i) => `${i ? "L" : "M"}${pt(la, ln).map((v) => v.toFixed(1)).join(" ")}`).join("");
  const [hx, hy] = pt(HOME.lat, HOME.lng);
  const [dx, dy] = pt(d.lat, d.lng);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#09090b", color: "#fff", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 64, width: 680, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: "#a3a3ad" }}>
            <div style={{ width: 16, height: 16, borderRadius: 99, background: color }} />
            {categoryOf(d.category).label} · from Bengaluru
          </div>
          <div style={{ fontSize: d.name.length > 18 ? 72 : 96, fontWeight: 800, lineHeight: 1, marginTop: 18, letterSpacing: -2 }}>{d.name}</div>
          {d.area && <div style={{ fontSize: 30, color: "#a3a3ad", marginTop: 14 }}>{d.area}</div>}
          <div style={{ display: "flex", gap: 40, marginTop: 40, fontSize: 40, fontWeight: 700 }}>
            <span>{km(d.distanceKm)}</span>
            <span style={{ color: "#a3a3ad" }}>{duration(d.durationMin)}</span>
            {d.hairpins ? <span style={{ color }}>{d.hairpins} hairpins</span> : null}
          </div>
        </div>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", right: 40, top: 55 }}>
          <path d={path} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={hx} cy={hy} r={11} fill="#09090b" stroke="#fff" strokeWidth={5} />
          <circle cx={dx} cy={dy} r={14} fill={color} stroke="#09090b" strokeWidth={5} />
        </svg>
      </div>
    ),
    size,
  );
}
