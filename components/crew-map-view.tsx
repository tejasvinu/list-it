"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/config";
import { duration, km } from "@/lib/format";
import type { FeedItem } from "@/lib/data";
import { Avatar } from "./avatar";
import { StatusChip } from "./feed-card";
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
    <div className="pointer-events-auto mt-3 flex gap-1.5">
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
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold backdrop-blur-md transition ${
              on ? "border-white/15 bg-white/12 text-white" : "border-white/5 bg-black/50 text-white/40"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: on ? CATEGORIES[c].color : "#555" }} />
            {CATEGORIES[c].short}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative -mb-[calc(84px+env(safe-area-inset-bottom))] h-dvh lg:mb-0">
      <CrewMap
        key={cats.join()}
        items={shown}
        selected={selected}
        onSelect={setSelected}
        className="h-full w-full"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] bg-gradient-to-b from-black/75 via-black/40 to-transparent px-4 pb-10 pt-[max(env(safe-area-inset-top),12px)] lg:hidden">
        <h1 className="font-display text-2xl font-bold tracking-tight">Ride map</h1>
        <p className="text-[13px] text-white/65">{shown.length} rides out of Bengaluru</p>
        {chips}
      </div>

      {/* Desktop: ride list beside the map */}
      <aside className="glass absolute bottom-4 left-4 top-4 z-[500] hidden w-[340px] flex-col overflow-hidden rounded-3xl lg:flex">
        <div className="border-b border-line p-4">
          <h1 className="font-display text-2xl font-bold tracking-tight">Ride map</h1>
          <p className="text-[13px] text-muted">{shown.length} rides out of Bengaluru</p>
          {chips}
        </div>
        <ul className="no-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
          {[...shown]
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setSelected(d.id === selected ? null : d.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${
                    d.id === selected ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                    <RouteArt id={`ml-${d.id}`} route={d.route} category={d.category} width={48} height={48} labels={false} className="h-full w-full" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{d.name}</span>
                    <span className="block text-[13px] text-faint">
                      {km(d.distanceKm)} · {duration(d.durationMin)}
                    </span>
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORIES[d.category as Category]?.color }} />
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
            className="absolute inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[600] lg:bottom-6 lg:left-[376px] lg:right-auto lg:w-[400px]"
          >
            <Link
              href={`/g/${slug}/d/${current.id}`}
              className="glass flex gap-3 overflow-hidden rounded-3xl p-2.5"
            >
              <div className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-2xl">
                {current.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.photos[0].thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <RouteArt id={`m-${current.id}`} route={current.route} category={current.category} width={92} height={92} labels={false} map className="h-full w-full" />
                )}
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex items-center gap-2">
                  <StatusChip status={current.status} date={current.statusDate} ridden={current.riddenBy} />
                </div>
                <p className="mt-1 truncate font-display text-xl font-bold leading-tight">{current.name}</p>
                <p className="text-[13px] text-muted">
                  {km(current.distanceKm)} · {duration(current.durationMin)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-faint">
                  <Avatar rider={current.owner} size={16} /> {current.owner.name}
                  {current.interested.length > 0 && ` · ${current.interested.length} in`}
                </p>
              </div>
              <ChevronRight className="self-center text-faint" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
