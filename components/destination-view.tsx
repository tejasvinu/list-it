"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Navigation,
  Pencil,
  Plus,
  Share,
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
import { StatusChip } from "./feed-card";
import { Milestone } from "./milestone";
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
  // Rides from removed riders can be looked after by anyone, or nobody could ever change them.
  const mine = d.owner.id === me.id || d.ownerGone;
  const { state, set } = useReactions(slug, d.id, me, { mine: d.myReaction, list: d.reactions });
  const [menu, setMenu] = useState(false);
  const [statusSheet, setStatusSheet] = useState(false);
  const [busy, start] = useTransition();
  const cat = categoryOf(d.category);
  const ownerRide = d.riddenBy.find((r) => r.rider.id === d.owner.id);

  const share = () =>
    shareLink({ title: d.name, text: `${d.name}: ${km(d.distanceKm)} round trip from Bengaluru`, url: location.href });

  return (
    <div className="pb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:pb-0">
      <div className="relative h-[34dvh] min-h-[240px] bg-surface-2 lg:sticky lg:top-0 lg:h-dvh">
        <RouteMap route={d.route} category={d.category} dest={d} stops={d.stops} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex justify-between p-3 pt-[max(env(safe-area-inset-top),12px)]">
          <button
            onClick={() => (history.length > 1 ? router.back() : router.push(`/g/${slug}`))}
            className="float pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-surface text-text"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="pointer-events-auto flex gap-2">
            {mine && (
              <Link
                href={`/g/${slug}/d/${d.id}/edit?from=ride`}
                className="float flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-[15px] font-semibold text-text"
              >
                <Pencil size={16} /> Edit ride
              </Link>
            )}
            <button onClick={share} className="float grid h-11 w-11 place-items-center rounded-full bg-surface text-text" aria-label="Share">
              <Share size={19} />
            </button>
            {mine && (
              <button onClick={() => setMenu(true)} className="float grid h-11 w-11 place-items-center rounded-full bg-surface text-text" aria-label="More">
                <MoreHorizontal size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 bg-bg px-4 pt-5 lg:px-10 lg:pb-16 lg:pt-12">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-h-7 flex-wrap items-center gap-2">
              {mine ? (
                <button onClick={() => setStatusSheet(true)} className="flex items-center gap-1.5 rounded-full" aria-label="Change status">
                  <StatusChip status={d.status} date={d.statusDate} ridden={d.riddenBy} meId={me.id} always />
                  <Pencil size={13} className="text-faint" />
                </button>
              ) : (
                <StatusChip status={d.status} date={d.statusDate} ridden={d.riddenBy} meId={me.id} />
              )}
            </div>
            <h1 className="display mt-3 text-[44px] leading-[0.92] lg:text-[64px]">{d.name}</h1>
            {d.area && <p className="mt-2 text-[16px] text-muted">{d.area}</p>}
          </div>
          <Milestone name={d.name} distanceKm={d.distanceKm} split={d.roadSplit} approx={d.approx} size={17} className="settle -mt-14 lg:mt-0" />
        </div>

        <dl className="num mt-6 grid grid-cols-2 gap-x-6 gap-y-5">
          <Fact label="Round trip" value={km(d.distanceKm)} sub={d.approx ? "Rough estimate" : "Bengaluru and back"} />
          <Fact label="Riding time" value={duration(d.durationMin)} sub={`About ${duration(d.durationMin / 2)} each way`} />
          <Fact label="Hairpins" value={d.hairpins ? String(d.hairpins) : "Not counted"} muted={!d.hairpins} />
          <Fact label="Ride type" value={cat.short} sub={cat.hint} dot={cat.color} />
        </dl>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <InButton slug={slug} id={d.id} me={me} imIn={d.imIn} interested={d.interested} />
          <a href={googleMapsRoute(d.lat, d.lng)} target="_blank" rel="noreferrer" className="btn btn-line">
            <Navigation size={16} /> Route in Maps
          </a>
        </div>
        <p className="mt-3 text-[15px] text-muted">
          {d.interested.length > 0 ? (
            <>
              <span className="font-semibold text-text">{d.interested.map((r) => (r.id === me.id ? "You" : r.name)).join(", ")}</span>{" "}
              {d.interested.length === 1 && d.interested[0].id !== me.id ? "is" : "are"} up for this.
            </>
          ) : (
            "Nobody's in yet. Be the first."
          )}{" "}
          {d.ownerGone ? (
            <span className="text-faint" suppressHydrationWarning>
              Added by a former rider {timeAgo(d.createdAt)} ago. Anyone in the crew can edit it.
            </span>
          ) : (
            <Link href={`/g/${slug}/r/${d.owner.id}`} className="text-faint hover:text-text" suppressHydrationWarning>
              Added by {d.owner.id === me.id ? "you" : d.owner.name} {timeAgo(d.createdAt)} ago.
            </Link>
          )}
        </p>

        <div className="mt-6 flex items-center gap-2">
          <ReactionButton mine={state.mine} onPick={set} />
          <div className="min-w-0 flex-1">
            {state.list.length ? <ReactionSummary list={state.list} meId={me.id} /> : <p className="text-[14px] text-faint">No reactions yet</p>}
          </div>
          <a
            href={d.mapsUrl ?? googleMapsPlace(d.lat, d.lng)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-text"
          >
            Open place <ExternalLink size={14} />
          </a>
        </div>

        <Ridden d={d} slug={slug} me={me} />

        {(d.roadSplit || d.tags.length > 0 || d.seasons.length > 0) && (
          <section className="mt-10">
            <SectionTitle>The road</SectionTitle>
            {d.roadSplit && <RoadSplitBar split={d.roadSplit} />}
            {(d.tags.length > 0 || d.seasons.length > 0) && (
              <p className={`text-[16px] text-muted ${d.roadSplit ? "mt-4" : ""}`}>
                {d.tags.map(tagLabel).join(", ")}
                {d.tags.length > 0 && d.seasons.length > 0 && ". "}
                {d.seasons.length > 0 && <>Best in {d.seasons.map((s) => (SEASONS[s as Season] ?? s).toLowerCase()).join(", ")}.</>}
              </p>
            )}
          </section>
        )}

        {d.notes && (
          <section className="mt-10">
            <SectionTitle>Notes from {d.owner.id === me.id ? "you" : d.owner.name}</SectionTitle>
            <p className="max-w-[62ch] whitespace-pre-wrap text-[17px] leading-relaxed">{d.notes}</p>
          </section>
        )}

        {ownerRide && (
          <section className="mt-10 border-l-[3px] border-good pl-4">
            <h2 className="display text-[22px] text-good">
              {d.owner.id === me.id ? "Your" : `${d.owner.name}’s`} ride report
              {ownerRide.date && <span className="num font-semibold">, {prettyDate(ownerRide.date, { day: "numeric", month: "short", year: "numeric" })}</span>}
            </h2>
            <p className="mt-2 max-w-[62ch] whitespace-pre-wrap text-[17px] leading-relaxed">
              {d.rideReport ?? (mine ? "Add what you learned so the next crew knows: Edit, then Ride report." : "No report yet. Ask in the chatter below.")}
            </p>
          </section>
        )}

        {d.photos.length > 0 && (
          <section className="mt-10">
            <SectionTitle>Around here</SectionTitle>
            <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 lg:-mx-10 lg:scroll-px-10 lg:px-10">
              {d.photos.map((p) => (
                <a key={p.thumb} href={p.page} target="_blank" rel="noreferrer" className="group w-[260px] shrink-0 snap-start">
                  <span className="block h-[180px] overflow-hidden rounded-panel bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  </span>
                  <span className="mt-1.5 block truncate text-[12px] text-faint">
                    Photo: {p.credit ?? "Wikimedia Commons"}
                    {p.license && `, ${p.license}`}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        <Stops d={d} slug={slug} me={me} />
        <Comments d={d} slug={slug} me={me} />
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <div className="space-y-1">
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
                toast("Ride deleted");
                router.push(`/g/${slug}`);
              });
            }}
          >
            Delete ride
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
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Status">
        {STATUS_KEYS.filter((s) => s !== "done").map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={status === s}
            onClick={() => setS(s)}
            className={`rounded-panel p-3 text-left transition-colors ${status === s ? "bg-text text-inverse" : "bg-surface-2 hover:bg-surface-3"}`}
          >
            <span className="display block text-[20px]">{STATUSES[s].label}</span>
            <span className={`mt-1 block text-[13px] leading-snug ${status === s ? "opacity-75" : "text-faint"}`}>{STATUSES[s].hint}</span>
          </button>
        ))}
      </div>
      {needsDate && (
        <label className="field mt-3 flex items-center justify-between">
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
            toast(status === "planned" ? "Date locked in" : "Status saved");
          })
        }
        className="btn btn-ink mt-5 w-full !min-h-12"
      >
        {busy && <Loader2 size={16} className="animate-spin" />} Save status
      </button>
      <p className="mt-3 text-center text-[14px] text-faint">Been there? Everyone marks that for themselves with &ldquo;I&apos;ve ridden this&rdquo;.</p>
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
      toast(!res.ok ? res.error : value ? "Ride logged" : "Ride unmarked");
    });

  return (
    <section className="mt-6 flex items-center gap-3 rounded-panel bg-surface p-3 pl-4">
      <div className="min-w-0 flex-1">
        {d.riddenBy.length ? (
          <div className="flex items-center gap-2.5">
            <AvatarStack riders={d.riddenBy.map((r) => r.rider)} max={4} size={28} />
            <p className="truncate text-[15px] text-muted">
              <span className="font-semibold text-text">{d.riddenBy.map((r) => (r.rider.id === me.id ? "You" : r.rider.name)).join(", ")}</span> rode this
            </p>
          </div>
        ) : (
          <p className="text-[15px] text-faint">Nobody&apos;s ridden this yet</p>
        )}
      </div>
      <button
        disabled={busy}
        onClick={() => {
          setDate(mine?.date ?? todayYmd());
          setOpen(true);
        }}
        className={`btn shrink-0 !min-h-10 !px-4 text-[14px] ${mine ? "bg-good-soft text-good" : "btn-line"}`}
      >
        {mine ? (
          <>
            <Check size={15} strokeWidth={2.6} /> Ridden
            {mine.date && <span className="num font-medium">, {prettyDate(mine.date, { day: "numeric", month: "short" })}</span>}
          </>
        ) : (
          "I've ridden this"
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={mine ? "Your ride" : "When did you ride it?"}>
        <label className="field flex items-center justify-between">
          <span className="text-muted">Ridden on</span>
          <input type="date" value={date} max={todayYmd()} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-right font-semibold outline-none" />
        </label>
        <button disabled={busy || !date} onClick={() => save(date)} className="btn btn-ink mt-5 w-full !min-h-12">
          {busy && <Loader2 size={16} className="animate-spin" />} {mine ? "Save date" : "Log ride"}
        </button>
        {mine && (
          <button disabled={busy} onClick={() => save(null)} className="mt-2 min-h-11 w-full text-[15px] font-semibold text-danger">
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
    <section id="stops" className="mt-12 scroll-mt-4">
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle className="mb-0">
          On the way {d.stops.length > 0 && <span className="num text-faint">{d.stops.length}</span>}
        </SectionTitle>
        <button onClick={() => setOpen(true)} className="btn btn-quiet !min-h-10 !px-4 text-[14px]">
          <Plus size={15} /> Add a stop
        </button>
      </div>
      {d.stops.length === 0 ? (
        <button onClick={() => setOpen(true)} className="w-full rounded-panel bg-surface p-4 text-left text-[15px] text-muted transition-colors hover:bg-surface-2">
          Breakfast places, viewpoints, photo spots, fuel. Anyone in the crew can add one.
        </button>
      ) : (
        <ol className="relative space-y-1 pl-5 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-[2px] before:bg-line-strong">
          {d.stops.map((s) => {
            const k = STOP_KINDS[(s.kind in STOP_KINDS ? s.kind : "other") as StopKind];
            const canDelete = s.riderId === me.id || d.owner.id === me.id;
            return (
              <li key={s.id} className="relative flex gap-3 rounded-panel py-2.5 pl-3">
                <span className="absolute -left-5 top-4 h-4 w-4 rounded-full border-[3px] border-bg bg-text" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold leading-tight">{s.name}</p>
                  <p className="mt-0.5 text-[14px] text-faint">
                    {k.label}, added by {s.rider.id === me.id ? "you" : s.rider.name}
                  </p>
                  {s.note && <p className="mt-1.5 text-[15px] leading-snug text-muted">{s.note}</p>}
                </div>
                <div className="flex items-start gap-1">
                  {(s.mapsUrl || s.lat != null) && (
                    <a
                      href={s.mapsUrl ?? googleMapsPlace(s.lat!, s.lng!)}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
                      aria-label={`Open ${s.name} in Maps`}
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => confirm("Remove this stop?") && start(async () => void (await deleteStop(slug, s.id)))}
                      className="grid h-11 w-11 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-danger"
                      aria-label={`Remove ${s.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Add a stop">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of stop">
          {STOP_KIND_KEYS.map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className="chip">
              {STOP_KINDS[k].label}
            </button>
          ))}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (or leave empty and paste a link)" maxLength={60} className="field mt-4" />
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Google Maps link (optional)" className="field mt-2" />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why stop here? Opening time, what to order…"
          rows={2}
          maxLength={300}
          className="field mt-2 resize-none"
        />
        {error && <p className="mt-2 text-[15px] text-danger">{error}</p>}
        <button onClick={submit} disabled={busy || (!name.trim() && !link.trim())} className="btn btn-ink mt-4 w-full !min-h-12">
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
    <section id="comments" className="mt-12 scroll-mt-4">
      <SectionTitle>
        Chatter {d.comments.length > 0 && <span className="num text-faint">{d.comments.length}</span>}
      </SectionTitle>
      {d.comments.length === 0 && !pending && <p className="text-[15px] text-faint">No comments yet. Start the planning.</p>}
      <ul className="space-y-5">
        <AnimatePresence initial={false}>
          {d.comments.map((c) => (
            <motion.li key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="group flex gap-3">
              <Avatar rider={c.rider} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px]">
                  <span className="font-semibold">{c.rider.id === me.id ? "You" : c.rider.name}</span>
                  <span className="ml-2 text-faint" suppressHydrationWarning>
                    {timeAgo(c.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[16px] leading-snug">{c.body}</p>
              </div>
              {c.riderId === me.id && (
                <button
                  onClick={() => confirm("Delete this comment?") && start(async () => void (await deleteComment(slug, c.id)))}
                  className="grid h-9 w-9 place-items-center self-start rounded-full text-faint hover:bg-surface-2 hover:text-danger"
                  aria-label="Delete comment"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </motion.li>
          ))}
          {pending && (
            <motion.li key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 0.6, y: 0 }} className="flex gap-3">
              <Avatar rider={me} size={36} />
              <div>
                <p className="text-[14px] font-semibold">You</p>
                <p className="mt-0.5 whitespace-pre-wrap text-[16px]">{pending}</p>
              </div>
            </motion.li>
          )}
        </AnimatePresence>
      </ul>
      <div ref={endRef} />

      <div className="mt-6 flex items-end gap-3">
        <Avatar rider={me} size={36} className="mb-1.5" />
        <div className="field flex flex-1 items-end !py-1 !pl-3.5 !pr-1.5">
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
            aria-label="Write a comment"
            placeholder={`Say something about ${d.name}…`}
            className="max-h-[120px] flex-1 resize-none bg-transparent py-2 text-[16px] outline-none placeholder:text-faint"
          />
          <AnimatePresence>
            {body.trim() && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                onClick={send}
                disabled={busy}
                className="mb-0.5 grid h-9 w-9 place-items-center rounded-full bg-text text-inverse"
                aria-label="Send comment"
              >
                <ArrowUp size={18} strokeWidth={2.6} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/** One trip fact: a label, the value large, and a line of context. */
function Fact({ label, value, sub, dot, muted }: { label: string; value: string; sub?: string; dot?: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[14px] text-faint">{label}</dt>
      <dd className={`display mt-1 flex items-center gap-2 text-[28px] ${muted ? "text-faint" : ""}`}>
        {dot && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: dot }} />}
        {value}
      </dd>
      {sub && <dd className="mt-0.5 text-[14px] leading-snug text-muted">{sub}</dd>}
    </div>
  );
}

function SectionTitle({ children, className = "mb-4" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`display flex items-baseline gap-2 text-[26px] ${className}`}>{children}</h2>;
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
  const cls = `flex min-h-12 w-full items-center gap-3 rounded-panel px-3 text-left text-[16px] font-semibold hover:bg-surface-2 active:bg-surface-2 ${danger ? "text-danger" : ""}`;
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
