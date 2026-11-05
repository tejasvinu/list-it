import "server-only";
import { headers } from "next/headers";

/** The site's public origin, for building share links on the server. */
export async function siteOrigin() {
  // Prefer an explicit origin or Vercel's own project URL; forwarded headers are only a fallback because
  // a proxy or a local tunnel can set them to something unexpected.
  const configured = process.env.APP_ORIGIN ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (configured) return (configured.startsWith("http") ? configured : `https://${configured}`).replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
