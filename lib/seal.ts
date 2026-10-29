import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RoadSplit } from "./types";

/** The part of a ride the server works out itself: where it is and what the route looks like. */
export type Routed = {
  lat: number;
  lng: number;
  mapsUrl: string | null;
  distanceKm: number;
  durationMin: number;
  approx: boolean;
  route: [number, number][];
  roadSplit: RoadSplit | null;
};

function mac(r: Routed) {
  const split = r.roadSplit && [r.roadSplit.city, r.roadSplit.nh, r.roadSplit.sh, r.roadSplit.other];
  const body = JSON.stringify([r.lat, r.lng, r.mapsUrl, r.distanceKm, r.durationMin, r.approx, r.route, split]);
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", key).update(`route.${body}`).digest();
}

/** Signs a preview so saving it later proves the numbers came from us, not from the browser. */
export function sealRoute(r: Routed) {
  return mac(r).toString("base64url");
}

export function routeSealOk(r: Routed, seal: unknown) {
  if (typeof seal !== "string") return false;
  const given = Buffer.from(seal, "base64url");
  const want = mac(r);
  return given.length === want.length && timingSafeEqual(given, want);
}
