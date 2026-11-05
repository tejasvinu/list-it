import path from "node:path";
import type { NextConfig } from "next";

// A crew's share link is its password, so keep it out of other sites' referrers and keep pages out of frames.
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  // Next's hydration bootstrap is inline. Dev also needs eval for HMR; production does not.
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.wikimedia.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: csp },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The dev badge sits on top of the bottom nav.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Every page here is per-rider and per-request, so we stay on the
  // classic dynamic rendering model instead of Cache Components.
  turbopack: {
    // A package.json higher up (in Documents) would otherwise be taken as the workspace root.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
