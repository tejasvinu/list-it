"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORIES, type Category } from "@/lib/config";
import { duration } from "@/lib/format";
import type { RoadSplit } from "@/lib/types";
import { HairpinIcon, Milestone } from "./milestone";
import { RouteWeb } from "./route-web";

export type SampleRide = {
  name: string;
  area: string;
  category: Category;
  distanceKm: number;
  durationMin: number;
  hairpins: number | null;
  split: RoadSplit;
  route: [number, number][];
};

/** The landing page's live element: pick a ride, see its route light up and its stone. */
export function LandingRoutes({ rides }: { rides: SampleRide[] }) {
  const [active, setActive] = useState(1);
  const ride = rides[active];
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <ul className="space-y-1" role="radiogroup" aria-label="Sample rides">
          {rides.map((r, i) => (
            <li key={r.name}>
              <button
                role="radio"
                aria-checked={active === i}
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                className={`flex min-h-14 w-full items-center gap-4 rounded-panel px-4 py-2 text-left transition-colors ${
                  active === i ? "bg-text text-inverse" : "hover:bg-surface"
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: CATEGORIES[r.category].color }} />
                <span className="display flex-1 truncate text-[26px]">{r.name}</span>
                <span className="num text-[16px] font-semibold">{r.distanceKm.toLocaleString("en-IN")} km</span>
              </button>
            </li>
          ))}
        </ul>
        <AnimatePresence mode="wait">
          <motion.div
            key={ride.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24 }}
            className="mt-6 flex items-end gap-5 px-1"
          >
            <Milestone name={ride.name} distanceKm={ride.distanceKm} split={ride.split} size={17} />
            <dl className="num grid gap-2 text-[16px]">
              <div className="flex gap-2">
                <dt className="text-muted">Area</dt>
                <dd className="font-semibold">{ride.area}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">Riding</dt>
                <dd className="font-semibold">{duration(ride.durationMin)}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-muted">
                  <HairpinIcon size={15} className="inline" /> Hairpins
                </dt>
                <dd className="font-semibold">{ride.hairpins ?? "Not counted"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">Type</dt>
                <dd className="font-semibold">{CATEGORIES[ride.category].label}</dd>
              </div>
            </dl>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="relative overflow-hidden rounded-panel bg-surface lg:col-span-7" data-ui>
        <RouteWeb routes={rides} active={active} width={640} height={520} className="h-auto w-full" />
        <p className="absolute bottom-3 left-4 text-[14px] text-faint">Straight-line rings from Bengaluru</p>
      </div>
    </div>
  );
}
