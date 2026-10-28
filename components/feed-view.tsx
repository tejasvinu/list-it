"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Clock, LayoutList, Navigation, Rows3, UserPlus } from "lucide-react";
import { AvatarStack } from "./avatar";
import { CompactCard, FeedCard } from "./feed-card";
import { RouteArt } from "./route-art";
import { shareLink } from "./toast";
import { CATEGORIES } from "@/lib/config";
import { daysUntil, km, prettyDate } from "@/lib/format";
import type { FeedItem } from "@/lib/data";
import type { RiderLite } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "short", label: "Short", dot: CATEGORIES.short.color },
  { key: "day", label: "Day ride", dot: CATEGORIES.day.color },
  { key: "multi", label: "Multi-day", dot: CATEGORIES.multi.color },
  { key: "hailmary", label: "🙏 Hail Mary" },
  { key: "done", label: "🏁 Ridden" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const SORTS = [
  { key: "fresh", label: "Fresh", icon: Clock },
  { key: "hot", label: "Hot", icon: Flame },
  { key: "near", label: "Closest", icon: Navigation },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const heat = (d: FeedItem) => d.reactions.length + d.commentCount * 2 + d.interested.length * 3;

export function FeedView({
  slug,
  groupName,
  items,
  riders,
  me,
  inviteOpen,
  closesAt,
}: {
  slug: string;
  groupName: string;
  items: FeedItem[];
  riders: RiderLite[];
  me: RiderLite;
  inviteOpen: boolean;
  closesAt: number;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("fresh");
  const [now] = useState(() => Date.now());
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read a per-device preference after hydration
      setCompact(localStorage.getItem("feed-view") === "compact");
    } catch {}
  }, []);
  const toggleView = () => {
    setCompact(!compact);
    try {
      localStorage.setItem("feed-view", compact ? "cards" : "compact");
    } catch {}
  };

  const upcoming = useMemo(
    () =>
      items
        .filter((d) => d.status === "planned" && d.statusDate && daysUntil(d.statusDate) >= 0)
        .sort((a, b) => a.statusDate!.localeCompare(b.statusDate!)),
    [items],
  );

  const shown = useMemo(() => {
    let xs = items.filter((d) => {
      if (filter === "all") return true;
      if (filter === "done") return d.riddenBy.length > 0;
      if (filter === "hailmary") return d.status === filter;
      return d.category === filter;
    });
    if (sort === "hot") xs = [...xs].sort((a, b) => heat(b) - heat(a));
    if (sort === "near") xs = [...xs].sort((a, b) => a.distanceKm - b.distanceKm);
    return xs;
  }, [items, filter, sort]);

  const ridden = items.filter((d) => d.riddenBy.length > 0);
  const dreamKm = items.filter((d) => !d.riddenBy.length).reduce((s, d) => s + d.distanceKm, 0);
  const hoursLeft = Math.max(0, Math.round((closesAt - now) / 3600000));

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 px-4 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 flex-1 truncate font-display text-[24px] font-bold tracking-tight">{groupName}</h1>
          <Link href={`/g/${slug}/crew`} className="flex items-center" aria-label="Crew">
            <AvatarStack riders={riders} max={4} size={26} />
          </Link>
          {inviteOpen && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() =>
                shareLink({
                  title: groupName,
                  text: `Join ${groupName} on list-it. Set a name and a PIN, that's it.`,
                  url: `${location.origin}/g/${slug}`,
                })
              }
              className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-[12px] font-semibold text-accent-2"
            >
              <UserPlus size={14} /> {hoursLeft < 48 ? `${hoursLeft}h` : `${Math.round(hoursLeft / 24)}d`}
            </motion.button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                filter === f.key ? "text-black" : "bg-surface-2 text-muted"
              }`}
            >
              {filter === f.key && (
                <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-full bg-text" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
              )}
              <span className="relative flex items-center gap-1.5">
                {"dot" in f && <span className="h-2 w-2 rounded-full" style={{ background: f.dot }} />}
                {f.label}
              </span>
            </button>
          ))}
        </div>
      </header>

      {items.length > 0 && filter === "all" && (
        <section className="px-4 pt-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat value={String(items.length)} label="on the list" />
            <Stat value={String(ridden.length)} label="ridden" />
            <Stat value={km(dreamKm).replace(" km", "")} label="km to go" />
          </div>
        </section>
      )}

      {upcoming.length > 0 && filter === "all" && (
        <section className="pt-5">
          <h3 className="mb-2.5 px-4 section-label">Up next</h3>
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4">
            {upcoming.map((d) => {
              const days = daysUntil(d.statusDate!);
              return (
                <Link
                  key={d.id}
                  href={`/g/${slug}/d/${d.id}`}
                  className="relative h-[150px] w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line"
                >
                  <RouteArt id={`up-${d.id}`} route={d.route} category={d.category} width={220} height={150} labels={false} map className="absolute inset-0 h-full w-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-black">
                    {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `In ${days} days`}
                  </span>
                  <div className="absolute inset-x-3 bottom-2.5">
                    <p className="truncate font-display text-lg font-bold leading-tight">{d.name}</p>
                    <div className="mt-1 flex items-center justify-between text-[12px] text-white/70">
                      <span>{prettyDate(d.statusDate!)}</span>
                      {d.interested.length > 0 && <AvatarStack riders={d.interested} max={3} size={18} />}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between px-4 pb-1 pt-5">
        <h3 className="section-label">
          {filter === "all" ? "The list" : FILTERS.find((f) => f.key === filter)?.label}
          <span className="ml-1.5 text-faint">{shown.length}</span>
        </h3>
        <div className="flex items-center gap-1.5">
        <div className="flex rounded-full bg-surface-2 p-0.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition ${
                sort === s.key ? "bg-surface-3 text-text" : "text-faint"
              }`}
            >
              <s.icon size={12} /> {s.label}
            </button>
          ))}
        </div>
          <button
            onClick={toggleView}
            className="grid h-[28px] w-[28px] place-items-center rounded-full bg-surface-2 text-muted hover:text-text"
            aria-label={compact ? "Show full cards" : "Show compact list"}
            title={compact ? "Full cards" : "Compact list"}
          >
            {compact ? <Rows3 size={14} /> : <LayoutList size={14} />}
          </button>
        </div>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {shown.map((item, i) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
          >
            {compact ? (
              <div className="px-4 py-1">
                <CompactCard item={item} slug={slug} me={me} />
              </div>
            ) : (
              <FeedCard item={item} slug={slug} me={me} priority={i < 2} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {shown.length === 0 && (
        <div className="flex flex-col items-center px-8 py-16 text-center">
          <div className="mb-4 text-5xl">{items.length ? "🔍" : "🗺️"}</div>
          <p className="font-display text-xl font-bold">{items.length ? "Nothing here yet" : "The list is empty"}</p>
          <p className="mt-1.5 text-sm text-muted">
            {items.length ? "Try another filter." : "Paste a Google Maps link and get the crew talking."}
          </p>
          {!items.length && (
            <Link
              href={`/g/${slug}/new`}
              className="mt-6 rounded-2xl btn-primary px-6 py-3 font-display font-bold text-black"
            >
              Add the first ride
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="font-display text-[24px] font-bold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-1.5 text-[12px] text-faint">{label}</p>
    </div>
  );
}
