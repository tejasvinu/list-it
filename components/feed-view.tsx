"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { UserPlus } from "lucide-react";
import { AvatarStack } from "./avatar";
import { CompactCard, FeedCard } from "./feed-card";
import { Milestone } from "./milestone";
import { shareLink } from "./toast";
import { CATEGORIES } from "@/lib/config";
import { daysUntil, prettyDate } from "@/lib/format";
import type { FeedItem } from "@/lib/data";
import type { RiderLite } from "@/lib/types";

// Ride length is the main question; status and history are separate toggles.
const LENGTHS = [
  { key: "all", label: "All rides" },
  { key: "short", label: "Short", dot: CATEGORIES.short.color },
  { key: "day", label: "Day ride", dot: CATEGORIES.day.color },
  { key: "multi", label: "Multi-day", dot: CATEGORIES.multi.color },
] as const;
type LengthKey = (typeof LENGTHS)[number]["key"];
type Only = "none" | "done" | "hailmary";

const SORTS = [
  { key: "fresh", label: "Newest" },
  { key: "hot", label: "Most talked about" },
  { key: "near", label: "Closest first" },
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
  const [length, setLength] = useState<LengthKey>("all");
  const [only, setOnly] = useState<Only>("none");
  const [sort, setSort] = useState<SortKey>("fresh");
  const [now] = useState(() => Date.now());
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read a per-device preference after hydration
      setCompact(localStorage.getItem("feed-view") === "compact");
    } catch {}
  }, []);
  const setView = (next: boolean) => {
    setCompact(next);
    try {
      localStorage.setItem("feed-view", next ? "compact" : "cards");
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
      if (length !== "all" && d.category !== length) return false;
      if (only === "done") return d.riddenBy.length > 0;
      if (only === "hailmary") return d.status === "hailmary";
      return true;
    });
    if (sort === "hot") xs = [...xs].sort((a, b) => heat(b) - heat(a));
    if (sort === "near") xs = [...xs].sort((a, b) => a.distanceKm - b.distanceKm);
    return xs;
  }, [items, length, only, sort]);

  const ridden = items.filter((d) => d.riddenBy.length > 0);
  const toGoKm = items.filter((d) => !d.riddenBy.length).reduce((s, d) => s + d.distanceKm, 0);
  const hoursLeft = Math.max(0, Math.round((closesAt - now) / 3600000));
  const filtered = length !== "all" || only !== "none";

  return (
    <div>
      <header className="topbar px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)] lg:static lg:bg-transparent lg:px-0 lg:pt-10 lg:shadow-none">
        <div className="flex items-center gap-3">
          <h1 className="display min-w-0 flex-1 truncate text-[30px] lg:text-[44px]">{groupName}</h1>
          <Link href={`/g/${slug}/crew`} className="flex h-11 items-center gap-2 rounded-full pr-1 text-[14px] text-muted" aria-label={`The crew, ${riders.length} riders`}>
            <AvatarStack riders={riders} max={4} size={30} />
          </Link>
          {inviteOpen && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() =>
                shareLink({
                  title: groupName,
                  text: `Join ${groupName} on list-it. Set a name and a PIN, that's it.`,
                  url: `${location.origin}/g/${slug}`,
                })
              }
              className="btn btn-quiet !min-h-10 !px-3.5 text-[14px]"
              aria-label={`Invite riders, joining closes in ${hoursLeft} hours`}
            >
              <UserPlus size={16} /> {hoursLeft < 48 ? `${hoursLeft}h left` : `${Math.round(hoursLeft / 24)} days left`}
            </motion.button>
          )}
        </div>
      </header>

      {items.length > 0 && !filtered && (
        <section aria-label="Crew totals" className="mt-4 flex items-end gap-8 px-4 lg:mt-2 lg:px-0">
          <Figure value={items.length.toLocaleString("en-IN")} label={items.length === 1 ? "ride on the list" : "rides on the list"} />
          <Figure value={ridden.length.toLocaleString("en-IN")} label="ridden" />
          <Figure value={Math.round(toGoKm).toLocaleString("en-IN")} label="km still to ride" />
        </section>
      )}

      {upcoming.length > 0 && !filtered && (
        <section className="mt-8">
          <h2 className="display mb-3 px-4 text-[22px] lg:px-0">Up next</h2>
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 lg:px-0">
            {upcoming.map((d) => {
              const days = daysUntil(d.statusDate!);
              return (
                <Link
                  key={d.id}
                  href={`/g/${slug}/d/${d.id}`}
                  className="flex w-[290px] shrink-0 snap-start items-center gap-4 rounded-panel bg-accent p-4 text-on-accent transition-transform active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}, {prettyDate(d.statusDate!)}
                    </span>
                    <span className="display mt-1 block truncate text-[28px]">{d.name}</span>
                    <span className="mt-2 flex items-center gap-2 text-[14px]">
                      {d.interested.length > 0 ? (
                        <>
                          <AvatarStack riders={d.interested} max={3} size={22} />
                          {d.interested.length} in
                        </>
                      ) : (
                        "Nobody in yet"
                      )}
                    </span>
                  </span>
                  <Milestone name={d.name} distanceKm={d.distanceKm} split={d.roadSplit} approx={d.approx} size={11} />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section aria-label="Filter rides" className="mt-8 space-y-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 lg:px-0">
          {LENGTHS.map((f) => (
            <button key={f.key} aria-pressed={length === f.key} onClick={() => setLength(f.key)} className="chip shrink-0">
              {"dot" in f && <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.dot }} />}
              {f.label}
            </button>
          ))}
          <span className="w-2 shrink-0" aria-hidden />
          {(
            [
              ["done", "Ridden"],
              ["hailmary", "Hail Mary"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} aria-pressed={only === k} onClick={() => setOnly(only === k ? "none" : k)} className="chip shrink-0">
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 lg:px-0">
          <div className="flex min-h-11 items-center gap-3 whitespace-nowrap text-[15px]">
            <span className="num font-semibold">
              {shown.length} {shown.length === 1 ? "ride" : "rides"}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort rides"
              className="min-h-9 rounded-full bg-transparent px-2 text-muted outline-none hover:text-text"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div role="group" aria-label="Layout" className="flex rounded-full bg-surface-2 p-1">
            {(
              [
                [false, "Cards"],
                [true, "List"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                aria-pressed={compact === value}
                onClick={() => setView(value)}
                className={`min-h-9 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${compact === value ? "bg-surface text-text shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-faint hover:text-text"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className={compact ? "mt-3 space-y-2 px-4 pb-8 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:px-0" : "mt-5 lg:grid lg:grid-cols-2 lg:gap-x-10"}>
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
            >
              {compact ? <CompactCard item={item} slug={slug} me={me} /> : <FeedCard item={item} slug={slug} me={me} priority={i < 2} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {shown.length === 0 && (
        <div className="px-4 py-16 lg:px-0">
          <p className="display text-[30px]">{items.length ? "No rides match" : "The list is empty"}</p>
          <p className="mt-2 max-w-[38ch] text-[16px] text-muted">
            {items.length
              ? "Try another ride length, or turn off Ridden and Hail Mary."
              : "Paste a Google Maps link and the round trip from Bengaluru is worked out for you."}
          </p>
          {items.length ? (
            <button
              className="btn btn-line mt-6"
              onClick={() => {
                setLength("all");
                setOnly("none");
              }}
            >
              Show all rides
            </button>
          ) : (
            <Link href={`/g/${slug}/new`} className="btn btn-ink mt-6">
              Add the first ride
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <p className="min-w-0">
      <span className="display num block text-[40px] font-extrabold lg:text-[52px]">{value}</span>
      <span className="mt-1 block text-[14px] text-muted">{label}</span>
    </p>
  );
}
