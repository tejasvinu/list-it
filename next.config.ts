import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge sits on top of the bottom nav.
  devIndicators: false,
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
