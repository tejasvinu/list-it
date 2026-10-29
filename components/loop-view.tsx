"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { commentLoop, deleteLoop, deleteLoopComment, toggleLoopIn } from "@/app/g/[slug]/loop-actions";
import { duration, km, prettyDate, timeAgo } from "@/lib/format";
import { loopDate, loopDays } from "@/lib/loops";
import type { LoopDetail } from "@/lib/loop-data";
import { Avatar } from "./avatar";
import { attempt, shareLink, toast } from "./toast";

const LoopMap = dynamic(() => import("./maps").then((m) => m.LoopMap), {
  ssr: false,
  loading: () => <div className="skeleton h-full" />,
});
export function LoopView({
  slug,
  loop,
  meId,
  weather,
  liveIds,
}: {
  slug: string;
  loop: LoopDetail;
  meId: string;
  weather: React.ReactNode[];
  liveIds: string[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const days = loopDays(loop.start, loop.stops, loop.legs);
  const colors = ["#3A78F0", "#E2513A", "#13A189", "#F07A1F", "#20A059"];
  const run = async (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    const result = await attempt(action);
    if (result && !result.ok) toast(result.error);
    if (result?.ok) router.refresh();
    setBusy(false);
    return result?.ok;
  };
  return (
    <div className="pb-12 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)]">
      <div className="h-[34dvh] min-h-[240px] bg-surface-2 lg:sticky lg:top-0 lg:h-dvh">
        <LoopMap start={loop.start} stops={loop.stops} legs={loop.legs} className="h-full w-full" />
      </div>
      <div className="px-4 pt-6 lg:px-10 lg:pt-12">
        <Link href={`/g/${slug}/loops`} className="text-muted">
          Back to loops
        </Link>
        <h1 className="display mt-4 text-[48px] leading-none">{loop.name}</h1>
        <p className="num mt-4 text-[18px]">
          {loop.legs.some((leg) => leg.approx) ? "About " : ""}
          {km(loop.totalKm)} · {duration(loop.totalMin)} riding · {days.length} {days.length === 1 ? "day" : "days"}
        </p>
        <p className="mt-2 text-muted">
          Added by {loop.owner?.name ?? "Former rider"}
          {loop.startDate && ` · ${prettyDate(loop.startDate)}`}
        </p>
        {loop.notes && <p className="mt-4 whitespace-pre-wrap">{loop.notes}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <button disabled={busy} aria-pressed={loop.imIn} className={`btn ${loop.imIn ? "btn-accent" : "btn-ink"}`} onClick={() => run(() => toggleLoopIn(slug, loop.id))}>
            {loop.imIn ? "I'm in ✓" : "Count me in"}
          </button>
          <button className="btn btn-line" onClick={() => void shareLink({ title: loop.name, text: `${loop.name}: ${km(loop.totalKm)}${loop.startDate ? ` · ${prettyDate(loop.startDate)}` : ""}`, url: location.href, whatsappFallback: true })}>Share</button>
          {loop.startDate && <a href={`/g/${slug}/calendar/loop/${loop.id}`} className="btn btn-line">Add to calendar</a>}
          {loop.riderId === meId && (
            <Link className="btn btn-line" href={`/g/${slug}/loops/${loop.id}/edit`}>
              Edit loop
            </Link>
          )}
        </div>
        <p className="mt-3 text-muted">
          {loop.interested.length
            ? `${loop.interested.map((r) => r.name).join(", ")} ${loop.interested.length === 1 ? "is" : "are"} in.`
            : "Nobody's in yet. Be the first."}
        </p>
        <section className="mt-9">
          <h2 className="display text-[32px]">Day by day</h2>
          {days.map((day, i) => (
            <div key={i} className="mt-4 border-t border-line pt-4">
              <h3 className="display flex items-center gap-2 text-[25px]">
                <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: colors[i % colors.length] }} />
                Day {i + 1}
                {loop.startDate && ` · ${prettyDate(loopDate(loop.startDate, i))}`}
              </h3>
              <p className="mt-1">{day.names.join(" → ")}</p>
              <p className="num mt-1 text-muted">
                {day.approx ? "About " : ""}
                {km(day.km)} · {duration(day.min)} riding{day.night && ` · Night in ${day.night.name}`}
              </p>
              {(day.km > 450 || day.min > 540) && (
                <p className="mt-2 text-danger">Long day: over 450 km or 9 hours of riding.</p>
              )}
              {weather[i]}
            </div>
          ))}
        </section>
        <section className="mt-9">
          <h2 className="display text-[32px]">Stops</h2>
          <ol className="mt-3 space-y-2">
            {loop.stops.map((stop, i) => (
              <li key={i}>
                {i + 1}.{" "}
                {stop.destinationId && liveIds.includes(stop.destinationId) ? (
                  <Link className="underline" href={`/g/${slug}/d/${stop.destinationId}`}>
                    {stop.name}
                  </Link>
                ) : (
                  stop.name
                )}
                {stop.nightHere && <span className="text-muted"> · Night here</span>}
              </li>
            ))}
          </ol>
        </section>
        <section id="comments" className="mt-9">
          <h2 className="display text-[32px]">Chatter</h2>
          {!loop.comments.length && <p className="mt-3 text-muted">No comments yet. Start the conversation.</p>}
          <ul className="mt-4 space-y-4">
            {loop.comments.map((comment) => (
              <li key={comment.id} className="flex gap-3">
                {comment.rider && <Avatar rider={comment.rider} size={36} />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {comment.rider?.name ?? "Former rider"}{" "}
                    <span className="font-normal text-faint" suppressHydrationWarning>
                      {timeAgo(comment.createdAt)}
                    </span>
                  </p>
                  <p className="whitespace-pre-wrap">{comment.body}</p>
                </div>
                {comment.riderId === meId && (
                  <button
                    className="text-muted"
                    disabled={busy}
                    onClick={() => run(() => deleteLoopComment(slug, loop.id, comment.id))}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
          <label className="mt-5 block">
            <span className="sr-only">Add a comment</span>
            <textarea
              className="field"
              rows={3}
              maxLength={1000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  if (!busy && body.trim()) {
                    void run(() => commentLoop(slug, loop.id, body)).then((ok) => { if (ok) setBody(""); });
                  }
                }
              }}
              placeholder="Say something…"
            />
          </label>
          <button
            className="btn btn-line mt-2"
            disabled={busy || !body.trim()}
            onClick={async () => {
              if (await run(() => commentLoop(slug, loop.id, body))) setBody("");
            }}
          >
            Post comment
          </button>
        </section>
        {loop.riderId === meId && (
          <button
            className="mt-10 text-danger underline"
            disabled={busy}
            onClick={async () => {
              if (window.confirm("Delete this loop?")) {
                const ok = await run(() => deleteLoop(slug, loop.id));
                if (ok) router.push(`/g/${slug}/loops`);
              }
            }}
          >
            Delete loop
          </button>
        )}
      </div>
    </div>
  );
}
