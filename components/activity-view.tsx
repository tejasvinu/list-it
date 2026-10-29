"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { markActivitySeen } from "@/app/g/[slug]/actions";
import { STOP_KINDS, type StopKind } from "@/lib/config";
import { prettyDate, timeAgo, todayYmd } from "@/lib/format";
import type { ActivityItem } from "@/lib/data";
import { Avatar } from "./avatar";
import { RouteArt } from "./route-art";

function describe(a: ActivityItem) {
  const dest = <span className="font-semibold">{a.destName}</span>;
  switch (a.kind) {
    case "joined":
      return <>joined the crew</>;
    case "added":
      return <>added {dest}</>;
    case "planned":
      return (
        <>
          locked in {dest}
          {a.detail && ` for ${prettyDate(a.detail)}`}
        </>
      );
    case "rode": {
      const [date, count] = (a.detail ?? "").split(" · ");
      return <>rode {dest}{date && ` on ${prettyDate(date)}`}{count && ` with ${count}`}</>;
    }
    case "done":
      return <>rode {dest}</>;
    case "reacted":
      return (
        <>
          reacted {a.detail} to {dest}
        </>
      );
    case "in":
      return <>is in for {dest}</>;
    case "commented":
      return (
        <>
          on {dest}: <span className="text-muted">&ldquo;{a.detail}&rdquo;</span>
        </>
      );
    case "stop": {
      const [kind, ...rest] = (a.detail ?? "").split(":");
      const k = STOP_KINDS[(kind in STOP_KINDS ? kind : "other") as StopKind];
      return (
        <>
          added a {k.label.toLowerCase()} stop, <span className="font-semibold">{rest.join(":")}</span>, for {dest}
        </>
      );
    }
    default:
      return <>did something to {dest}</>;
  }
}

/** Days are counted in India, so the server (UTC) and the phone put a 1 am ride under the same heading. */
function dayLabel(d: Date) {
  const now = Date.now();
  const day = todayYmd(d);
  if (day === todayYmd(now)) return "Today";
  if (day === todayYmd(now - 86400000)) return "Yesterday";
  const diff = (now - d.getTime()) / 86400000;
  if (diff < 7) return "This week";
  if (diff < 31) return "This month";
  return "Earlier";
}

export function ActivityView({
  slug,
  items,
  meId,
  seenAt,
}: {
  slug: string;
  items: ActivityItem[];
  meId: string;
  seenAt: number;
}) {
  // Keep the "new" highlights for this visit even after we mark everything seen.
  const [seen] = useState(seenAt);
  useEffect(() => {
    // Only clears the unread dot; if it fails, the dot just stays until next time.
    markActivitySeen(slug).catch(() => {});
  }, [slug]);

  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const a of items) {
    const label = dayLabel(new Date(a.createdAt));
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }

  return (
    <div>
      <header className="topbar px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)] lg:static lg:bg-transparent lg:px-0 lg:pt-10 lg:shadow-none">
        <h1 className="display text-[30px] lg:text-[44px]">Activity</h1>
      </header>
      {items.length === 0 && (
        <div className="px-4 py-16 lg:px-0">
          <p className="display text-[28px]">Quiet so far</p>
          <p className="mt-2 text-[16px] text-muted">Add a ride or say you&apos;re in for one, and it shows up here for the crew.</p>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label} className="pt-6">
          <h2 className="display px-4 pb-2 text-[22px] lg:px-0">{g.label}</h2>
          <ul className="lg:-mx-3">
            {g.items.map((a, i) => {
              const fresh = a.riderId !== meId && new Date(a.createdAt).getTime() > seen;
              const row = (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.02 }}
                  className={`flex items-center gap-3 rounded-panel px-4 py-3 transition-colors hover:bg-surface lg:px-3 ${fresh ? "bg-accent-soft hover:bg-accent-soft" : ""}`}
                >
                  <Avatar rider={a.rider} size={40} />
                  <p className="min-w-0 flex-1 text-[16px] leading-snug">
                    <span className="font-semibold">{a.riderId === meId ? "You" : a.rider.name}</span> {describe(a)}{" "}
                    <span className="num whitespace-nowrap text-[14px] text-faint" suppressHydrationWarning>
                      {timeAgo(a.createdAt)}
                    </span>
                  </p>
                  {a.destinationId && a.destRoute && (
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[4px]">
                      {a.destPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.destPhoto} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <RouteArt id={`a-${a.id}`} route={a.destRoute} category={a.destCategory ?? "day"} width={48} height={48} labels={false} animate={false} className="h-full w-full" />
                      )}
                    </span>
                  )}
                  {fresh && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-text" aria-label="New" />}
                </motion.div>
              );
              return (
                <li key={a.id}>
                  {a.destinationId ? (
                    <Link href={`/g/${slug}/d/${a.destinationId}${a.kind === "commented" ? "#comments" : a.kind === "stop" ? "#stops" : ""}`}>{row}</Link>
                  ) : (
                    <Link href={`/g/${slug}/r/${a.riderId}`}>{row}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
