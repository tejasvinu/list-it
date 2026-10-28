"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { markActivitySeen } from "@/app/g/[slug]/actions";
import { STOP_KINDS, type StopKind } from "@/lib/config";
import { prettyDate, timeAgo } from "@/lib/format";
import type { ActivityItem } from "@/lib/data";
import { Avatar } from "./avatar";
import { RouteArt } from "./route-art";

function describe(a: ActivityItem) {
  const dest = <span className="font-semibold">{a.destName}</span>;
  switch (a.kind) {
    case "joined":
      return <>joined the crew 👋</>;
    case "added":
      return <>added {dest}</>;
    case "planned":
      return (
        <>
          locked in {dest}
          {a.detail && ` for ${prettyDate(a.detail)}`} 📅
        </>
      );
    case "done":
      return <>rode {dest} 🏁</>;
    case "reacted":
      return (
        <>
          reacted {a.detail} to {dest}
        </>
      );
    case "in":
      return <>is in for {dest} 🏍️</>;
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
          added a {k.label.toLowerCase()} stop {k.emoji} <span className="font-semibold">{rest.join(":")}</span> for {dest}
        </>
      );
    }
    default:
      return <>did something to {dest}</>;
  }
}

function dayLabel(d: Date) {
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  const diff = (today.getTime() - d.getTime()) / 86400000;
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
    markActivitySeen(slug);
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
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl">
        <h1 className="font-display text-2xl font-bold">Activity</h1>
      </header>
      {items.length === 0 && <p className="px-4 py-16 text-center text-faint">Quiet so far. Go stir something up.</p>}
      {groups.map((g) => (
        <section key={g.label} className="pt-4">
          <h2 className="px-4 pb-1 section-label">{g.label}</h2>
          <ul>
            {g.items.map((a, i) => {
              const fresh = a.riderId !== meId && new Date(a.createdAt).getTime() > seen;
              const row = (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.02 }}
                  className={`flex items-center gap-3 px-4 py-2.5 ${fresh ? "bg-accent/[0.06]" : ""}`}
                >
                  <Avatar rider={a.rider} size={40} />
                  <p className="min-w-0 flex-1 text-[14px] leading-snug">
                    <span className="font-semibold">{a.riderId === meId ? "You" : a.rider.name}</span> {describe(a)}{" "}
                    <span className="text-faint" suppressHydrationWarning>
                      {timeAgo(a.createdAt)}
                    </span>
                  </p>
                  {a.destinationId && a.destRoute && (
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line">
                      {a.destPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.destPhoto} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <RouteArt id={`a-${a.id}`} route={a.destRoute} category={a.destCategory ?? "day"} width={44} height={44} labels={false} animate={false} className="h-full w-full" />
                      )}
                    </span>
                  )}
                  {fresh && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
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
