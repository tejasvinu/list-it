"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { markActivitySeen, markNotificationsRead } from "@/app/g/[slug]/actions";
import type { ActivityItem } from "@/lib/data";
import type { getNotifications } from "@/lib/notifications";
import { prettyDate, timeAgo } from "@/lib/format";
import { ActivityView } from "./activity-view";
import { attempt, toast } from "./toast";

type Digest = {
  added: { id: string; name: string }[];
  planned: { id: string; name: string; date: string; riders: string }[];
  ridden: { id: string; name: string; detail: string }[];
  loops: { id: string; name: string }[];
};

function message(kind: string, name: string, detail: string | null) {
  switch (kind) {
    case "in":
    case "loop-in":
      return `is in for ${name}`;
    case "commented":
    case "loop-commented":
      return `commented on ${name}${detail ? `: “${detail}”` : ""}`;
    case "reacted":
      return `reacted ${detail ?? ""} to ${name}`;
    case "stop":
      return `added a stop to ${name}`;
    case "rode":
    case "done":
      return `logged a ride on ${name}`;
    case "logged":
      return `logged you on ${name}${detail ? ` on ${prettyDate(detail)}` : ""}`;
    case "planned":
      return `set ${name} for ${detail ? prettyDate(detail) : "a date"}`;
    default:
      return `updated ${name}`;
  }
}

export function ActivityViews({
  slug,
  items,
  notifications,
  meId,
  seenAt,
  digest,
}: {
  slug: string;
  items: ActivityItem[];
  notifications: Awaited<ReturnType<typeof getNotifications>>;
  meId: string;
  seenAt: number;
  digest: Digest;
}) {
  const [view, setView] = useState<"you" | "crew">("you");
  const router = useRouter();
  useEffect(() => {
    if (view === "crew") {
      void attempt(() => markActivitySeen(slug));
      return;
    }
    void attempt(() => markNotificationsRead(slug)).then((result) => {
      if (result?.ok) window.dispatchEvent(new Event("list-it-notifications-read"));
    });
  }, [slug, view]);

  const share = async () => {
    const base = `${location.origin}/g/${slug}`;
    const lines = ["This week on list-it"];
    for (const item of digest.planned)
      lines.push(
        `Planned: ${item.name} · ${prettyDate(item.date)}${item.riders ? ` · ${item.riders} in` : ""}\n${base}/d/${item.id}`,
      );
    for (const item of digest.added) lines.push(`Added: ${item.name}\n${base}/d/${item.id}`);
    for (const item of digest.ridden)
      lines.push(`Ridden: ${item.name}${item.detail ? ` · ${item.detail}` : ""}\n${base}/d/${item.id}`);
    for (const item of digest.loops) lines.push(`New loop: ${item.name}\n${base}/loops/${item.id}`);
    let text = lines[0];
    for (const line of lines.slice(1)) {
      if (text.length + line.length + 2 > 1450) break;
      text += `\n\n${line}`;
    }
    if (lines.length === 1) text += `\nNo rides to share this week.\n${base}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    if (navigator.clipboard && !/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try {
        await navigator.clipboard.writeText(text);
        toast("Digest copied");
      } catch {
        /* Sharing still works. */
      }
    }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-5 lg:px-0 lg:pt-8">
        <button className="chip" aria-pressed={view === "you"} onClick={() => setView("you")}>
          For you
        </button>
        <button className="chip" aria-pressed={view === "crew"} onClick={() => setView("crew")}>
          Crew
        </button>
        <button className="btn btn-line ml-auto" onClick={() => void share()}>
          Share this week
        </button>
      </div>
      {view === "crew" ? (
        <ActivityView slug={slug} items={items} meId={meId} seenAt={seenAt} />
      ) : (
        <>
          <header className="px-4 pt-6 lg:px-0">
            <h1 className="display text-[30px] lg:text-[44px]">For you</h1>
          </header>
          {!notifications.length && (
            <div className="px-4 py-16 lg:px-0">
              <p className="display text-[28px]">Nothing for you yet</p>
              <p className="mt-2 text-muted">Updates about your rides and conversations will show up here.</p>
            </div>
          )}
          <ul className="mt-4">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  onClick={() => router.refresh()}
                  className={`block rounded-panel px-4 py-4 lg:px-3 ${!n.readAt ? "bg-accent-soft" : "hover:bg-surface"}`}
                  href={n.loopId ? `/g/${slug}/loops/${n.loopId}` : `/g/${slug}/d/${n.destinationId}`}
                >
                  <span className="font-semibold">{n.actor}</span> {message(n.kind, n.name ?? "a ride", n.detail)}{" "}
                  <span className="text-sm text-faint" suppressHydrationWarning>
                    {timeAgo(n.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
