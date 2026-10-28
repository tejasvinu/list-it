"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Navigation,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import {
  addComment,
  addStop,
  deleteComment,
  deleteDestination,
  deleteStop,
  markRidden,
  refreshPhotos,
  setStatus,
} from "@/app/g/[slug]/actions";
import { SEASONS, STATUS_KEYS, STATUSES, STOP_KIND_KEYS, STOP_KINDS, tagLabel, type Season, type StopKind } from "@/lib/config";
import { categoryOf, duration, googleMapsPlace, googleMapsRoute, km, prettyDate, timeAgo, todayYmd } from "@/lib/format";
import type { DestinationDetail } from "@/lib/data";
import type { RiderLite } from "@/lib/types";
import { Avatar, AvatarStack } from "./avatar";
import { CategoryChip, StatusChip } from "./feed-card";
import { RoadSplitBar } from "./road-split";
import { Sheet } from "./sheet";
import { InButton, ReactionButton, ReactionSummary, useReactions } from "./social";
import { shareLink, toast } from "./toast";

const RouteMap = dynamic(() => import("./maps").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});

export function DestinationView({ d, slug, me }: { d: DestinationDetail; slug: string; me: RiderLite }) {
  const router = useRouter();
  const mine = d.owner.id === me.id;
  const { state, set } = useReactions(slug, d.id, me, { mine: d.myReaction, list: d.reactions });
  const [menu, setMenu] = useState(false);
  const [statusSheet, setStatusSheet] = useState(false);
  const [busy, start] = useTransition();
  const cat = categoryOf(d.category);
  const ownerRide = d.riddenBy.find((r) => r.rider.id === d.owner.id);

  const share = () =>
    shareLink({ title: d.name, text: `${d.name}: ${km(d.distanceKm)} round trip from Bengaluru`, url: location.href });

  return (
    <div className="pb-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:pb-0">
      <div className="relative h-[44dvh] min-h-[280px] lg:sticky lg:top-0 lg:h-dvh">
        <RouteMap route={d.route} category={d.category} dest={d} stops={d.stops} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex justify-between bg-gradient-to-b from-black/60 to-transparent p-3 pb-10">
          <button
            onClick={() => (history.length > 1 ? router.back() : router.push(`/g/${slug}`))}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full glass"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="pointer-events-auto flex gap-2">
            <button onClick={share} className="grid h-10 w-10 place-items-center rounded-full glass" aria-label="Share">
              <Send size={18} />
            </button>
            {mine && (
              <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full glass" aria-label="More">
                <MoreHorizontal size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-6 rounded-t-[28px] border-t border-line bg-bg px-4 pt-5 lg:mt-0 lg:rounded-none lg:border-l lg:border-t-0 lg:px-8 lg:pb-12 lg:pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip category={d.category} />
          {mine ? (
            <button onClick={() => setStatusSheet(true)} className="flex items-center gap-1">
              <StatusChip status={d.status} date={d.statusDate} ridden={d.riddenBy} meId={me.id} />
              <Pencil size={12} className="text-faint" />
            </button>
          ) : (
            <StatusChip status={d.status} date={d.statusDate} ridden={d.riddenBy} meId={me.id} />
          )}
        </div>
        <h1 className="mt-3 font-display text-[34px] font-bold leading-[1.02] tracking-tight">{d.name}</h1>
        {d.area && <p className="mt-1 text-muted">{d.area}</p>}

        <Link href={`/g/${slug}/r/${d.owner.id}`} className="mt-4 flex items-center gap-2.5">
          <Avatar rider={d.owner} size={32} />
          <p className="text-sm">
            <span className="font-semibold">{d.owner.name}</span>
            <span className="text-faint" suppressHydrationWarning>
              {" "}
              added this {timeAgo(d.createdAt)} ago
            </span>
          </p>
        </Link>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Stat label="Round trip" value={km(d.distanceKm)} sub={d.approx ? "rough estimate" : "BLR → here → BLR"} accent={cat.color} />
          <Stat label="Riding time" value={duration(d.durationMin)} sub={`~${duration(d.durationMin / 2)} each way`} />
          <Stat label="Hairpins" value={d.hairpins ? `🌀 ${d.hairpins}` : "—"} sub={d.hairpins ? "bends" : "nobody counted yet"} />
          <Stat label="Type" value={cat.short} sub={cat.hint} />
        </div>

        {d.roadSplit && (
          <div className="mt-2">
            <RoadSplitBar split={d.roadSplit} />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={googleMapsRoute(d.lat, d.lng)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-text py-3 text-sm font-bold text-black"
          >
            <Navigation size={16} /> Route in Maps
          </a>
          <a
            href={d.mapsUrl ?? googleMapsPlace(d.lat, d.lng)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl border border-line-strong py-3 text-sm font-semibold"
          >
            <ExternalLink size={15} /> Open place
          </a>
        </div>

        <div className="mt-4 flex items-center gap-1 border-y border-line py-2">
          <ReactionButton mine={state.mine} onPick={set} />
          <div className="min-w-0 flex-1">
            <ReactionSummary list={state.list} meId={me.id} />
            {!state.list.length && <p className="text-[13px] text-faint">Be the first to react</p>}
          </div>
          <InButton slug={slug} id={d.id} me={me} imIn={d.imIn} interested={d.interested} />
        </div>

        {d.interested.length > 0 && (
          <p className="mt-2 text-[13px] text-muted">
            <span className="font-semibold text-text">{d.interested.map((r) => (r.id === me.id ? "You" : r.name)).join(", ")}</span>{" "}
            {d.interested.length === 1 && d.interested[0].id !== me.id ? "is" : "are"} up for this
          </p>
        )}

        <Ridden d={d} slug={slug} me={me} />

        {d.photos.length > 0 && (
          <section className="mt-6">
            <SectionTitle>Around here</SectionTitle>
            <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4">
              {d.photos.map((p) => (
                <a
                  key={p.thumb}
                  href={p.page}
                  target="_blank"
                  rel="noreferrer"
                  className="relative h-44 w-60 shrink-0 snap-start overflow-hidden rounded-2xl bg-surface-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-1.5 pt-6 text-[10px] text-white/70">
                    📷 {p.credit ?? "Wikimedia Commons"}
                    {p.license && ` · ${p.license}`}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {(d.tags.length > 0 || d.seasons.length > 0) && (
          <section className="mt-6 flex flex-wrap gap-1.5">
            {d.tags.map((t) => (
              <span key={t} className="rounded-full border border-line px-3 py-1.5 text-[13px] text-muted">
                {tagLabel(t)}
              </span>
            ))}
            {d.seasons.map((s) => (
              <span key={s} className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] text-muted">
                {SEASONS[s as Season] ?? s}
              </span>
            ))}
          </section>
        )}

        {d.notes && (
          <section className="mt-6">
            <SectionTitle>Notes from {d.owner.name}</SectionTitle>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text/90">{d.notes}</p>
          </section>
        )}

        {ownerRide && (
          <section className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-[13px] font-semibold text-emerald-300">
              🏁 {d.owner.name}&apos;s ride report{ownerRide.date && ` · ${prettyDate(ownerRide.date, { day: "numeric", month: "short", year: "numeric" })}`}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-emerald-50/90">
              {d.rideReport ?? (mine ? "Add what you learned so the next crew knows. Edit → Ride report." : "No report yet. Ask in the comments.")}
            </p>
          </section>
        )}

        <Stops d={d} slug={slug} me={me} />
        <Comments d={d} slug={slug} me={me} />
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <div className="space-y-1">
          <MenuItem href={`/g/${slug}/d/${d.id}/edit`} icon={<Pencil size={18} />}>
            Edit
          </MenuItem>
          <MenuItem
            icon={busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            onClick={() =>
              start(async () => {
                const res = await refreshPhotos(slug, d.id);
                setMenu(false);
                toast(res.ok ? `Found ${res.count} photo${res.count === 1 ? "" : "s"}` : res.error);
              })
            }
          >
            Find photos again
          </MenuItem>
          <MenuItem
            danger
            icon={<Trash2 size={18} />}
            onClick={() => {
              if (!confirm(`Delete ${d.name}? Comments and reactions go with it.`)) return;
              start(async () => {
                await deleteDestination(slug, d.id);
                toast("Deleted");
                router.push(`/g/${slug}`);
              });
            }}
          >
            Delete
          </MenuItem>
        </div>
      </Sheet>

      <StatusSheet open={statusSheet} onClose={() => setStatusSheet(false)} d={d} slug={slug} />
    </div>
  );
}

function StatusSheet({ open, onClose, d, slug }: { open: boolean; onClose: () => void; d: DestinationDetail; slug: string }) {
  const [status, setS] = useState(d.status);
  const [date, setDate] = useState(d.statusDate ?? "");
  const [busy, start] = useTransition();
  const needsDate = status === "planned";
  return (
    <Sheet open={open} onClose={onClose} title="Where's this at?">
      <div className="grid grid-cols-3 gap-2">
        {STATUS_KEYS.filter((s) => s !== "done").map((s) => (
          <button
            key={s}
            onClick={() => setS(s)}
            className={`rounded-2xl p-3 text-left transition ${status === s ? "bg-text text-black" : "bg-surface-2"}`}
          >
            <span className="text-xl">{STATUSES[s].emoji}</span>
            <span className="mt-1 block font-semibold">{STATUSES[s].label}</span>
            <span className={`block text-xs ${status === s ? "text-black/60" : "text-faint"}`}>{STATUSES[s].hint}</span>
          </button>
        ))}
      </div>
      {needsDate && (
        <label className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 text-sm">
          <span className="text-muted">Ride date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-right font-semibold outline-none" />
        </label>
      )}
      <button
        disabled={busy}
        onClick={() =>
          start(async () => {
            await setStatus(slug, d.id, status, needsDate ? date || null : null);
            onClose();
            toast(status === "planned" ? "Locked in 📅" : "Updated");
          })
        }
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl btn-primary py-3.5 font-display font-bold text-black"
      >
        {busy && <Loader2 size={16} className="animate-spin" />} Save
      </button>
      <p className="mt-3 text-center text-xs text-faint">Been there? Everyone marks that for themselves with &ldquo;I&apos;ve ridden this&rdquo;.</p>
    </Sheet>
  );
}

/** Who has ridden it, and the viewer's own "I've ridden this" toggle. */
function Ridden({ d, slug, me }: { d: DestinationDetail; slug: string; me: RiderLite }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [busy, start] = useTransition();
  const mine = d.riddenBy.find((r) => r.rider.id === me.id);
  const save = (value: string | null) =>
    start(async () => {
      const res = await markRidden(slug, d.id, value);
      setOpen(false);
      toast(!res.ok ? res.error : value ? "Logged 🏁" : "Unmarked");
    });

  return (
    <section className="mt-3 rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {d.riddenBy.length ? (
            <div className="flex items-center gap-2">
              <AvatarStack riders={d.riddenBy.map((r) => r.rider)} max={4} size={24} />
              <p className="truncate text-[13px] text-muted">
                <span className="font-semibold text-text">
                  {d.riddenBy.map((r) => (r.rider.id === me.id ? "You" : r.rider.name)).join(", ")}
                </span>{" "}
                rode this
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-faint">Nobody&apos;s ridden this yet</p>
          )}
        </div>
        <button
          disabled={busy}
          onClick={() => {
            setDate(mine?.date ?? todayYmd());
            setOpen(true);
          }}
          className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${
            mine ? "bg-emerald-400/15 text-emerald-300" : "border border-line-strong"
          }`}
        >
          {mine ? `🏁 Ridden${mine.date ? ` · ${prettyDate(mine.date, { day: "numeric", month: "short" })}` : ""}` : "🏁 I've ridden this"}
        </button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={mine ? "Your ride" : "When did you ride it?"}>
        <label className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3 text-sm">
          <span className="text-muted">Ridden on</span>
          <input type="date" value={date} max={todayYmd()} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-right font-semibold outline-none" />
        </label>
        <button
          disabled={busy || !date}
          onClick={() => save(date)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl btn-primary py-3.5 font-display font-bold text-black disabled:opacity-50"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} {mine ? "Save date" : "Log it 🏁"}
        </button>
        {mine && (
          <button disabled={busy} onClick={() => save(null)} className="mt-2 w-full py-3 text-sm font-semibold text-red-400">
            I haven&apos;t ridden it
          </button>
        )}
      </Sheet>
    </section>
  );
}

function Stops({ d, slug, me }: { d: DestinationDetail; slug: string; me: RiderLite }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<StopKind>("breakfast");
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await addStop(slug, d.id, { kind, name, link, note });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      setName("");
      setLink("");
      setNote("");
      toast("Stop added");
    });

  return (
    <section id="stops" className="mt-8 scroll-mt-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle className="mb-0">On the way</SectionTitle>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold">
          <Plus size={14} /> Add stop
        </button>
      </div>
      {d.stops.length === 0 ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-dashed border-line-strong p-4 text-left text-sm text-faint"
        >
          Breakfast places, viewpoints, photo spots, fuel. Anyone can add one.
        </button>
      ) : (
        <ul className="space-y-2">
          {d.stops.map((s) => {
            const k = STOP_KINDS[(s.kind in STOP_KINDS ? s.kind : "other") as StopKind];
            const canDelete = s.riderId === me.id || d.owner.id === me.id;
            return (
              <li key={s.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">{k.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{s.name}</p>
                  <p className="text-[12px] text-faint">
                    {k.label} · by {s.rider.id === me.id ? "you" : s.rider.name}
                  </p>
                  {s.note && <p className="mt-1 text-[14px] text-text/85">{s.note}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {(s.mapsUrl || s.lat != null) && (
                    <a
                      href={s.mapsUrl ?? googleMapsPlace(s.lat!, s.lng!)}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-8 w-8 place-items-center rounded-full bg-surface-2"
                      aria-label="Open in Maps"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => confirm("Remove this stop?") && start(async () => void (await deleteStop(slug, s.id)))}
                      className="grid h-8 w-8 place-items-center rounded-full text-faint"
                      aria-label="Remove stop"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Add a stop">
        <div className="grid grid-cols-5 gap-1.5">
          {STOP_KIND_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-xl py-2.5 text-center ${kind === k ? "bg-text text-black" : "bg-surface-2"}`}
            >
              <span className="block text-xl">{STOP_KINDS[k].emoji}</span>
              <span className="mt-0.5 block text-[10px] font-semibold">{STOP_KINDS[k].label}</span>
            </button>
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (or leave empty and paste a link)"
          maxLength={60}
          className="mt-3 w-full rounded-xl bg-surface-2 px-3 py-3 outline-none placeholder:text-faint"
        />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Google Maps link (optional)"
          className="mt-2 w-full rounded-xl bg-surface-2 px-3 py-3 outline-none placeholder:text-faint"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why stop here? Opening time, what to order…"
          rows={2}
          maxLength={300}
          className="mt-2 w-full resize-none rounded-xl bg-surface-2 px-3 py-3 outline-none placeholder:text-faint"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button
          onClick={submit}
          disabled={busy || (!name.trim() && !link.trim())}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl btn-primary py-3.5 font-display font-bold text-black disabled:opacity-40"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} Add stop
        </button>
      </Sheet>
    </section>
  );
}

function Comments({ d, slug, me }: { d: DestinationDetail; slug: string; me: RiderLite }) {
  const [body, setBody] = useState("");
  const [busy, start] = useTransition();
  const [pending, setPending] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (area.current) {
      area.current.style.height = "auto";
      area.current.style.height = `${Math.min(area.current.scrollHeight, 120)}px`;
    }
  }, [body]);

  const send = () => {
    const text = body.trim();
    if (!text) return;
    setPending(text);
    setBody("");
    start(async () => {
      const res = await addComment(slug, d.id, text);
      setPending(null);
      if (!res.ok) {
        setBody(text);
        toast(res.error);
      } else {
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
      }
    });
  };

  return (
    <section id="comments" className="mt-8 scroll-mt-4">
      <SectionTitle>
        Chatter {d.comments.length > 0 && <span className="text-faint/60">{d.comments.length}</span>}
      </SectionTitle>
      {d.comments.length === 0 && !pending && <p className="text-sm text-faint">No comments yet. Start the planning.</p>}
      <ul className="space-y-4">
        <AnimatePresence initial={false}>
          {d.comments.map((c) => (
            <motion.li key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="group flex gap-2.5">
              <Avatar rider={c.rider} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  <span className="font-semibold">{c.rider.id === me.id ? "You" : c.rider.name}</span>
                  <span className="text-faint" suppressHydrationWarning>
                    {" "}
                    · {timeAgo(c.createdAt)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap text-[15px] leading-snug text-text/90">{c.body}</p>
              </div>
              {c.riderId === me.id && (
                <button
                  onClick={() => confirm("Delete this comment?") && start(async () => void (await deleteComment(slug, c.id)))}
                  className="self-start p-1 text-faint opacity-60"
                  aria-label="Delete comment"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </motion.li>
          ))}
          {pending && (
            <motion.li key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 0.6, y: 0 }} className="flex gap-2.5">
              <Avatar rider={me} size={32} />
              <div>
                <p className="text-[13px] font-semibold">You</p>
                <p className="whitespace-pre-wrap text-[15px]">{pending}</p>
              </div>
            </motion.li>
          )}
        </AnimatePresence>
      </ul>
      <div ref={endRef} />

      <div className="mt-5">
        <div className="flex items-end gap-2">
          <Avatar rider={me} size={32} className="mb-1" />
          <div className="flex flex-1 items-end rounded-[20px] border border-line-strong bg-surface pl-3.5 pr-1 focus-within:border-accent">
            <textarea
              ref={area}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder={`Say something about ${d.name}…`}
              className="max-h-[120px] flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-faint"
            />
            <AnimatePresence>
              {body.trim() && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={send}
                  disabled={busy}
                  className="mb-1 grid h-8 w-8 place-items-center rounded-full bg-accent text-black"
                  aria-label="Send"
                >
                  <ArrowUp size={18} strokeWidth={2.6} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[12px] text-faint">{label}</p>
      <p className="font-display text-[22px] font-bold leading-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      <p className="truncate text-[12px] text-faint">{sub}</p>
    </div>
  );
}

function SectionTitle({ children, className = "mb-3" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`section-label ${className}`}>{children}</h2>;
}

function MenuItem({
  children,
  icon,
  href,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const cls = `flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left font-semibold active:bg-surface-2 ${danger ? "text-danger" : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {icon}
      {children}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {icon}
      {children}
    </button>
  );
}
