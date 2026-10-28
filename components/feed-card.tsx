"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, MessageCircle, Send } from "lucide-react";
import { Avatar } from "./avatar";
import { RouteArt } from "./route-art";
import { InButton, ReactionButton, ReactionSummary, useReactions } from "./social";
import { shareLink } from "./toast";
import { STATUSES, tagLabel, type Status } from "@/lib/config";
import { categoryOf, duration, km, prettyDate, splitSummary, timeAgo } from "@/lib/format";
import type { FeedItem } from "@/lib/data";
import type { RiderLite } from "@/lib/types";

export function StatusChip({
  status,
  date,
  ridden = [],
  meId,
}: {
  status: string;
  date: string | null;
  ridden?: FeedItem["riddenBy"];
  meId?: string;
}) {
  const chip = "inline-flex max-w-[180px] items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold";
  if (ridden.length) {
    const who = ridden.length > 1 ? `${ridden.length}` : ridden[0].rider.id === meId ? "you" : ridden[0].rider.name;
    const last = ridden[0].date;
    return (
      <span className={`${chip} bg-emerald-400/15 text-emerald-300`}>
        <span>🏁</span>
        <span className="truncate">Ridden by {who}</span>
        {last && <span className="shrink-0 opacity-75">· {prettyDate(last, { day: "numeric", month: "short" })}</span>}
      </span>
    );
  }
  const s = STATUSES[(status in STATUSES ? status : "wishlist") as Status];
  const tone =
    status === "planned"
      ? "bg-accent/15 text-accent-2"
      : status === "hailmary"
        ? "bg-fuchsia-400/15 text-fuchsia-300"
        : "bg-white/8 text-muted";
  return (
    <span className={`${chip} ${tone}`}>
      <span>{s.emoji}</span>
      {s.label}
      {date && status === "planned" && <span className="opacity-75">· {prettyDate(date, { day: "numeric", month: "short" })}</span>}
    </span>
  );
}

export function CategoryChip({ category }: { category: string }) {
  const c = categoryOf(category);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
      {c.short}
    </span>
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
    <article className="pb-5">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={`/g/${slug}/r/${item.owner.id}`}>
          <Avatar rider={item.owner} size={36} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px]">
            <Link href={`/g/${slug}/r/${item.owner.id}`} className="font-semibold">
              {item.owner.name}
            </Link>
            <span className="text-faint" suppressHydrationWarning>
              {" "}
              · {timeAgo(item.createdAt)}
            </span>
          </p>
          {item.area && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-muted">
              <MapPin size={11} /> {item.area}
            </p>
          )}
        </div>
        <StatusChip status={item.status} date={item.statusDate} ridden={item.riddenBy} meId={me.id} />
      </header>

      <div className="relative mx-3 overflow-hidden rounded-[22px] border border-line bg-surface">
        <div
          className="no-scrollbar flex aspect-[5/4] snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlide(Math.round(el.scrollLeft / el.clientWidth));
          }}
          onClick={onMediaTap}
        >
          <div className="relative h-full w-full shrink-0 snap-center">
            <RouteArt id={item.id} route={item.route} category={item.category} width={500} height={400} bottomRoom={0.22} map className="h-full w-full" />
          </div>
          {item.photos.map((p, i) => (
            <div key={p.thumb} className="relative h-full w-full shrink-0 snap-center bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumb}
                alt={p.title}
                loading={priority && i === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover"
              />
              <a
                href={p.page}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-[84px] right-3 max-w-[70%] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur"
              >
                📷 {p.credit ?? "Wikimedia Commons"}
              </a>
            </div>
          ))}
        </div>

        {/* Overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <CategoryChip category={item.category} />
          {slides > 1 && (
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums backdrop-blur-md">
              {slide + 1}/{slides}
            </span>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3.5 pt-14">
          <h2 className="font-display text-[26px] font-bold leading-none tracking-tight drop-shadow">{item.name}</h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 text-[13px] font-medium text-white/80">
            <span>{km(item.distanceKm)} round trip</span>
            <span className="text-white/30">•</span>
            <span>{duration(item.durationMin)} riding</span>
            {item.hairpins ? (
              <>
                <span className="text-white/30">•</span>
                <span>🌀 {item.hairpins}</span>
              </>
            ) : null}
          </p>
        </div>
        {slides > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-[19px] flex justify-center gap-1">
            {Array.from({ length: slides }, (_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === slide ? "w-4 bg-white" : "w-1 bg-white/40"}`} />
            ))}
          </div>
        )}

        <AnimatePresence>
          {burst > 0 && (
            <motion.span
              key={burst}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.9, times: [0, 0.3, 0.6, 1] }}
              onAnimationComplete={() => setBurst(0)}
              className="pointer-events-none absolute inset-0 grid place-items-center text-[96px] drop-shadow-[0_0_30px_rgba(255,122,26,0.8)]"
            >
              🔥
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-1.5 flex items-center gap-0.5 px-2">
        <ReactionButton mine={state.mine} onPick={set} />
        <Link href={`${href}#comments`} className="grid h-10 w-10 place-items-center" aria-label="Comments">
          <MessageCircle size={23} strokeWidth={1.9} />
        </Link>
        <button
          onClick={() =>
            shareLink({
              title: item.name,
              text: `${item.name}: ${km(item.distanceKm)} round trip from Bengaluru`,
              url: `${location.origin}${href}`,
            })
          }
          className="grid h-10 w-10 place-items-center"
          aria-label="Share"
        >
          <Send size={21} strokeWidth={1.9} />
        </button>
        <div className="ml-auto">
          <InButton slug={slug} id={item.id} me={me} imIn={item.imIn} interested={item.interested} compact />
        </div>
      </div>

      <div className="space-y-1.5 px-4">
        <ReactionSummary list={state.list} meId={me.id} />
        {(summary || item.tags.length > 0) && (
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pt-0.5">
            {summary && (
              <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">🛣️ {summary}</span>
            )}
            {item.tags.map((t) => (
              <span key={t} className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">
                {tagLabel(t)}
              </span>
            ))}
          </div>
        )}
        {item.notes && (
          <p className="line-clamp-2 text-[14px] leading-snug">
            <span className="font-semibold">{item.owner.name}</span> <span className="text-text/90">{item.notes}</span>
          </p>
        )}
        {item.rideReport && (
          <p className="line-clamp-2 rounded-xl bg-emerald-400/8 px-3 py-2 text-[13px] text-emerald-100/90">
            🏁 {item.rideReport}
          </p>
        )}
        <div className="flex gap-3 text-[13px] text-faint">
          {item.commentCount > 0 && (
            <Link href={`${href}#comments`}>
              View {item.commentCount === 1 ? "1 comment" : `all ${item.commentCount} comments`}
            </Link>
          )}
          {item.stopCount > 0 && (
            <Link href={`${href}#stops`}>
              {item.stopCount} stop{item.stopCount === 1 ? "" : "s"} on the way
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
