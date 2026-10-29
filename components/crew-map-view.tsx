"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/config";
import { duration } from "@/lib/format";
import type { FeedItem } from "@/lib/data";
import { Avatar } from "./avatar";
import { StatusChip } from "./feed-card";
import { Milestone } from "./milestone";
import { RouteArt } from "./route-art";

const CrewMap = dynamic(() => import("./maps").then((m) => m.CrewMap), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});

export function CrewMapView({ slug, items }: { slug: string; items: FeedItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([...CATEGORY_KEYS]);
  const shown = useMemo(() => items.filter((d) => cats.includes(d.category as Category)), [items, cats]);
  const current = items.find((d) => d.id === selected) ?? null;

  const chips = (
    <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" role="group" aria-label="Ride lengths shown">
      {CATEGORY_KEYS.map((c) => {
        const on = cats.includes(c);
        return (
          <button
            key={c}
            aria-pressed={on}
            onClick={() => {
              setSelected(null);
              setCats(on ? cats.filter((x) => x !== c) : [...cats, c]);
            }}
            className="chip shrink-0"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORIES[c].color, opacity: on ? 1 : 0.4 }} />
            {CATEGORIES[c].short}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative -mb-[calc(64px+env(safe-area-inset-bottom))] h-dvh lg:mb-0">
      <CrewMap key={cats.join()} items={shown} selected={selected} onSelect={setSelected} className="h-full w-full" />

      <div className="absolute inset-x-0 top-0 z-[500] bg-bg px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)] shadow-[0_1px_0_var(--line)] lg:hidden">
        <h1 className="display text-[30px]">Ride map</h1>
        <p className="num text-[14px] text-muted">
          {shown.length} {shown.length === 1 ? "ride" : "rides"} out of Bengaluru
        </p>
        {chips}
      </div>

      {/* Desktop: ride list beside the map */}
      <aside className="float absolute bottom-4 left-4 top-4 z-[500] hidden w-[360px] flex-col overflow-hidden rounded-[10px] bg-bg lg:flex">
        <div className="p-5 pb-4 shadow-[0_1px_0_var(--line)]">
          <h1 className="display text-[34px]">Ride map</h1>
          <p className="num text-[14px] text-muted">
            {shown.length} {shown.length === 1 ? "ride" : "rides"} out of Bengaluru, closest first
          </p>
          {chips}
        </div>
        <ul className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2">
          {[...shown]
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setSelected(d.id === selected ? null : d.id)}
                  aria-pressed={d.id === selected}
                  className={`flex w-full items-center gap-3 rounded-panel p-2 text-left transition-colors ${
                    d.id === selected ? "bg-surface" : "hover:bg-surface/60"
                  }`}
                >
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[4px]">
                    <RouteArt id={`ml-${d.id}`} route={d.route} category={d.category} width={48} height={48} labels={false} animate={false} className="h-full w-full" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="display block truncate text-[21px]">{d.name}</span>
                    <span className="num flex items-center gap-1.5 text-[14px] text-muted">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORIES[d.category as Category]?.color }} />
                      {Math.round(d.distanceKm).toLocaleString("en-IN")} km, {duration(d.durationMin)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </aside>

      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[600] lg:bottom-6 lg:left-[396px] lg:right-auto lg:w-[440px]"
          >
            <Link href={`/g/${slug}/d/${current.id}`} className="float flex items-center gap-4 rounded-[10px] bg-surface p-3 pr-4">
              <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[4px]">
                {current.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.photos[0].thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <RouteArt id={`m-${current.id}`} route={current.route} category={current.category} width={88} height={88} labels={false} map className="h-full w-full" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <StatusChip status={current.status} date={current.statusDate} ridden={current.riddenBy} />
                <p className="display mt-1 truncate text-[26px]">{current.name}</p>
                <p className="num text-[14px] text-muted">{duration(current.durationMin)} riding</p>
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-faint">
                  <Avatar rider={current.owner} size={18} /> {current.owner.name}
                  {current.interested.length > 0 && `, ${current.interested.length} in`}
                </p>
              </div>
              <Milestone name={current.name} distanceKm={current.distanceKm} split={current.roadSplit} approx={current.approx} size={11} />
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
