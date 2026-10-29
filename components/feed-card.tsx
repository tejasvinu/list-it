"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock, MessageCircle, Share } from "lucide-react";
import { Avatar } from "./avatar";
import { HairpinIcon, Milestone } from "./milestone";
import { RouteArt } from "./route-art";
import { InButton, ReactionButton, ReactionSummary, useReactions } from "./social";
import { shareLink } from "./toast";
import { STATUSES, tagLabel, type Status } from "@/lib/config";
import { categoryOf, duration, km, prettyDate, splitSummary, timeAgo } from "@/lib/format";
import type { FeedItem } from "@/lib/data";
import type { RiderLite } from "@/lib/types";

/**
 * Where a ride stands, as a small pill. Wishlist is the default state, so it
 * shows nothing unless `always` is set.
 */
export function StatusChip({
  status,
  date,
  ridden = [],
  meId,
  always = false,
}: {
  status: string;
  date: string | null;
  ridden?: FeedItem["riddenBy"];
  meId?: string;
  always?: boolean;
}) {
  const chip = "inline-flex h-7 max-w-[240px] items-center whitespace-pre rounded-full px-2.5 text-[13px] font-semibold";
  if (ridden.length) {
    const who = ridden.length > 1 ? `${ridden.length} riders` : ridden[0].rider.id === meId ? "you" : ridden[0].rider.name;
    const last = ridden[0].date;
    return (
      <span className={`${chip} bg-good-soft text-good`}>
        <span className="truncate">Ridden by {who}</span>
        {last && <span className="num shrink-0 font-medium opacity-80">, {prettyDate(last, { day: "numeric", month: "short" })}</span>}
      </span>
    );
  }
  if (status === "planned")
    return (
      <span className={`${chip} bg-accent text-on-accent`}>
        Planned{date && <span className="num font-medium">, {prettyDate(date, { weekday: "short", day: "numeric", month: "short" })}</span>}
      </span>
    );
  if (status === "hailmary") return <span className={`${chip} bg-surface-3 text-text`}>Hail Mary</span>;
  if (!always) return null;
  const s = STATUSES[(status in STATUSES ? status : "wishlist") as Status];
  return <span className={`${chip} bg-surface-2 text-muted`}>{s.label}</span>;
}

/** Ride length, as a coloured dot and its name. Plain text, not a control. */
export function CategoryLabel({ category, className = "" }: { category: string; className?: string }) {
  const c = categoryOf(category);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
      {c.short}
    </span>
  );
}

/** Time, hairpins and ride length on one line. */
export function RideFacts({ item, className = "" }: { item: Pick<FeedItem, "durationMin" | "hairpins" | "category">; className?: string }) {
  return (
    <p className={`num flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-muted ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        <Clock size={15} strokeWidth={2} />
        {duration(item.durationMin)} riding
      </span>
      {item.hairpins ? (
        <span className="inline-flex items-center gap-1.5">
          <HairpinIcon size={15} />
          {item.hairpins} hairpins
        </span>
      ) : null}
      <CategoryLabel category={item.category} />
    </p>
  );
}

export function FeedCard({ item, slug, me, priority }: { item: FeedItem; slug: string; me: RiderLite; priority?: boolean }) {
  const router = useRouter();
  const href = `/g/${slug}/d/${item.id}`;
  const { state, set } = useReactions(slug, item.id, me, { mine: item.myReaction, list: item.reactions });
  const [burst, setBurst] = useState(0);
  const [slide, setSlide] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slides = 1 + item.photos.length;
  const summary = splitSummary(item.roadSplit);
  const tags = item.tags.map(tagLabel);

  // Single tap opens the ride, double tap fires a 🔥.
  const onMediaTap = () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      setBurst((b) => b + 1);
      if (navigator.vibrate) navigator.vibrate(15);
      if (state.mine !== "🔥") set("🔥");
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      router.push(href);
    }, 260);
  };

  return (
    <article className="pb-10">
      <div className="relative mx-4 overflow-hidden rounded-panel bg-surface-2 lg:mx-0">
        <div
          className="no-scrollbar flex aspect-[16/11] snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlide(Math.round(el.scrollLeft / el.clientWidth));
          }}
          onClick={onMediaTap}
        >
          <div className="relative h-full w-full shrink-0 snap-center">
            <RouteArt id={item.id} route={item.route} category={item.category} width={520} height={358} map className="h-full w-full" />
          </div>
          {item.photos.map((p, i) => (
            <div key={p.thumb} className="relative h-full w-full shrink-0 snap-center bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt={p.title} loading={priority && i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
              <a
                href={p.page}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-2 left-2 max-w-[60%] truncate rounded-[3px] bg-[var(--scrim)] px-1.5 py-0.5 text-[11px] text-white/85"
              >
                Photo: {p.credit ?? "Wikimedia Commons"}
              </a>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute left-3 top-3">
          <StatusChip status={item.status} date={item.statusDate} ridden={item.riddenBy} meId={me.id} />
        </div>
        {slides > 1 && (
          <div className="pointer-events-none absolute right-3 top-3 flex gap-1 rounded-full bg-[var(--scrim)] px-2 py-1.5" aria-hidden>
            {Array.from({ length: slides }, (_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-[width,background-color] ${i === slide ? "w-4 bg-white" : "w-1.5 bg-white/45"}`} />
            ))}
          </div>
        )}

        <AnimatePresence>
          {burst > 0 && (
            <motion.span
              key={burst}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.9, times: [0, 0.3, 0.6, 1] }}
              onAnimationComplete={() => setBurst(0)}
              className="pointer-events-none absolute inset-0 grid place-items-center text-[96px]"
            >
              🔥
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-start gap-4 px-4 pt-3 lg:px-0">
        <Link href={href} className="min-w-0 flex-1 pt-1">
          <h2 className="display text-[34px] leading-[0.95] lg:text-[40px]">{item.name}</h2>
          {item.area && <p className="mt-1 truncate text-[15px] text-muted">{item.area}</p>}
        </Link>
        <Link href={href} className="-mt-14 mr-1 shrink-0" aria-label={`Open ${item.name}`}>
          <Milestone name={item.name} distanceKm={item.distanceKm} split={item.roadSplit} approx={item.approx} size={15} />
        </Link>
      </div>

      <div className="space-y-3 px-4 pt-3 lg:px-0">
        <RideFacts item={item} />
        {item.notes && (
          <p className="line-clamp-2 text-[16px] leading-snug">
            <Link href={`/g/${slug}/r/${item.owner.id}`} className="font-semibold">
              {item.owner.name}
            </Link>{" "}
            {item.notes}
          </p>
        )}
        {item.rideReport && (
          <p className="line-clamp-2 border-l-[3px] border-good pl-3 text-[15px] text-muted">
            <span className="font-semibold text-good">Ride report </span>
            {item.rideReport}
          </p>
        )}
        {(summary || tags.length > 0) && (
          <p className="text-[14px] text-faint">
            {[summary, ...tags].filter(Boolean).join(", ")}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1 px-2.5 lg:px-0 lg:-ml-2.5">
        <ReactionButton mine={state.mine} onPick={set} />
        <Link
          href={`${href}#comments`}
          className="num flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 text-[15px] text-muted hover:text-text"
          aria-label={item.commentCount ? `${item.commentCount} comments` : "Comment"}
        >
          <MessageCircle size={21} strokeWidth={1.9} />
          {item.commentCount > 0 && item.commentCount}
        </Link>
        <button
          onClick={() =>
            shareLink({
              title: item.name,
              text: `${item.name}: ${km(item.distanceKm)} round trip from Bengaluru`,
              url: `${location.origin}${href}`,
            })
          }
          className="grid h-11 w-11 place-items-center rounded-full text-muted hover:text-text"
          aria-label="Share"
        >
          <Share size={20} strokeWidth={1.9} />
        </button>
        <div className="ml-auto pr-1.5 lg:pr-0">
          <InButton slug={slug} id={item.id} me={me} imIn={item.imIn} interested={item.interested} compact />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2 text-[14px] text-faint lg:px-0">
        <ReactionSummary list={state.list} meId={me.id} />
        <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
          <Avatar rider={item.owner} size={20} />
          {item.owner.id === me.id ? "You" : item.owner.name} added this {timeAgo(item.createdAt)} ago
        </span>
        {item.stopCount > 0 && (
          <Link href={`${href}#stops`} className="underline decoration-line-strong underline-offset-4 hover:text-text">
            {item.stopCount} stop{item.stopCount === 1 ? "" : "s"} on the way
          </Link>
        )}
      </div>
    </article>
  );
}

/** One row for the compact list: the stone, the name and the numbers that matter. */
export function CompactCard({ item, slug, me }: { item: FeedItem; slug: string; me: RiderLite }) {
  return (
    <Link
      href={`/g/${slug}/d/${item.id}`}
      className="flex items-center gap-4 rounded-panel bg-surface p-3 pr-4 transition-colors hover:bg-surface-2 active:scale-[0.995]"
    >
      <span className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[4px]">
        <RouteArt id={`c-${item.id}`} route={item.route} category={item.category} width={76} height={76} labels={false} animate={false} className="h-full w-full" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="display block truncate text-[24px]">{item.name}</span>
        <span className="num mt-1 flex flex-wrap items-center gap-x-3 text-[14px] text-muted">
          <span>{duration(item.durationMin)}</span>
          {item.hairpins ? <span>{item.hairpins} hairpins</span> : null}
          <CategoryLabel category={item.category} />
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <StatusChip status={item.status} date={item.statusDate} ridden={item.riddenBy} meId={me.id} />
          {item.interested.length > 0 && <span className="text-[13px] text-faint">{item.interested.length} in</span>}
        </span>
      </span>
      <Milestone name={item.name} distanceKm={item.distanceKm} split={item.roadSplit} approx={item.approx} size={11} />
    </Link>
  );
}
