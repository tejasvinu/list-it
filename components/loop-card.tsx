import Link from "next/link";
import { Clock, Repeat } from "lucide-react";
import { Avatar, AvatarStack } from "./avatar";
import { RouteArt } from "./route-art";
import { duration, km, prettyDate, timeAgo } from "@/lib/format";
import { loopDays } from "@/lib/loops";
import type { LoopItem } from "@/lib/loop-data";
import type { RiderLite } from "@/lib/types";

const chip = "inline-flex h-7 items-center gap-1.5 whitespace-pre rounded-full px-2.5 text-[13px] font-semibold";

/** "Loop", and when it starts if it has a date. */
function LoopChips({ loop }: { loop: LoopItem }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={`${chip} bg-surface-3 text-text`}>
        <Repeat size={13} strokeWidth={2.4} />
        Loop
      </span>
      {loop.startDate && (
        <span className={`${chip} bg-accent text-on-accent`}>
          Starts <span className="num font-medium">{prettyDate(loop.startDate)}</span>
        </span>
      )}
    </span>
  );
}

/** Days, distance and riding time on one line. */
function loopFacts(loop: LoopItem) {
  const days = loopDays(loop.start, loop.stops, loop.legs).length;
  const approx = loop.legs.some((l) => l.approx) ? "about " : "";
  return `${days} ${days === 1 ? "day" : "days"} · ${approx}${km(loop.totalKm)}`;
}

/** The overnights, or every stop when the loop has no nights. */
function loopStops(loop: LoopItem) {
  const nights = loop.stops.filter((s) => s.nightHere);
  return (nights.length ? nights : loop.stops).map((s) => s.name).join(" → ");
}

export function LoopCard({ loop, slug, me }: { loop: LoopItem; slug: string; me: RiderLite }) {
  const href = `/g/${slug}/loops/${loop.id}`;
  return (
    <article className="pb-10">
      <Link href={href} className="relative mx-4 block overflow-hidden rounded-panel bg-surface-2 lg:mx-0">
        <span className="block aspect-[16/11]">
          <RouteArt id={`loop-${loop.id}`} route={loop.route} category="multi" start={loop.start} width={520} height={358} map className="h-full w-full" />
        </span>
        <span className="pointer-events-none absolute left-3 top-3">
          <LoopChips loop={loop} />
        </span>
      </Link>
      <Link href={href} className="block px-4 pt-4 lg:px-0">
        <h2 className="display text-[34px] leading-[0.95] lg:text-[40px]">{loop.name}</h2>
        <p className="num mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-muted">
          <span>{loopFacts(loop)}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={15} strokeWidth={2} />
            {duration(loop.totalMin)} riding
          </span>
        </p>
        {loop.stops.length > 0 && <p className="mt-2 line-clamp-2 text-[15px] text-muted">{loopStops(loop)}</p>}
      </Link>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 text-[14px] text-faint lg:px-0">
        <span className="inline-flex items-center gap-2">
          {loop.interested.length > 0 ? (
            <>
              <AvatarStack riders={loop.interested} max={4} size={22} />
              {loop.interested.length} in
            </>
          ) : (
            "Nobody in yet"
          )}
        </span>
        {loop.owner && (
          <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
            <Avatar rider={loop.owner} size={20} />
            {loop.owner.id === me.id ? "You" : loop.owner.name} added this {timeAgo(loop.createdAt)} ago
          </span>
        )}
      </div>
    </article>
  );
}

/** The loop as one row of the compact list. */
export function CompactLoopCard({ loop, slug }: { loop: LoopItem; slug: string }) {
  return (
    <Link
      href={`/g/${slug}/loops/${loop.id}`}
      className="flex items-center gap-4 rounded-panel bg-surface p-3 pr-4 transition-colors hover:bg-surface-2 active:scale-[0.995]"
    >
      <span className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[4px]">
        <RouteArt id={`c-loop-${loop.id}`} route={loop.route} category="multi" start={loop.start} width={76} height={76} labels={false} animate={false} className="h-full w-full" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="display block truncate text-[24px]">{loop.name}</span>
        <span className="num mt-1 block text-[14px] text-muted">
          {loopFacts(loop)} · {duration(loop.totalMin)}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <LoopChips loop={loop} />
          {loop.interested.length > 0 && <span className="text-[13px] text-faint">{loop.interested.length} in</span>}
        </span>
      </span>
    </Link>
  );
}
