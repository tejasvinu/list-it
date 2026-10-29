"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ClipboardPaste,
  Link2,
  Loader2,
  Minus,
  MoveRight,
  Plus,
  MapPin,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  createDestination,
  previewFromLink,
  previewFromPlace,
  searchPlacesAction,
  updateDestination,
  type Preview,
} from "@/app/g/[slug]/actions";
import type { DestinationInput } from "@/lib/validate";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  ROAD_TAG_KEYS,
  ROAD_TAGS,
  SEASON_KEYS,
  SEASONS,
  STATUS_KEYS,
  STATUSES,
  tagLabel,
  type Category,
} from "@/lib/config";
import { duration, km, todayYmd } from "@/lib/format";
import type { Place } from "@/lib/geo";
import { RouteArt } from "./route-art";
import { Milestone } from "./milestone";
import { RoadSplitBar } from "./road-split";
import { attempt, toast } from "./toast";

const PickMap = dynamic(() => import("./maps").then((m) => m.PickMap), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});

const LOADING_LINES = [
  "Reading the link…",
  "Plotting the route out of Bengaluru…",
  "Counting the kilometres…",
  "Hunting for photos…",
];

type Details = {
  category: Category;
  tags: string[];
  seasons: string[];
  hairpins: number | null;
  notes: string;
  status: string;
  statusDate: string | null;
  rideReport: string;
};

export function DestinationForm({
  slug,
  editId,
  backToRide = false,
  initial,
}: {
  slug: string;
  editId?: string;
  /** Opened from the ride page, so the ride is the previous history entry */
  backToRide?: boolean;
  initial?: { preview: Preview; name: string; details: Details };
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(initial?.preview ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [details, setDetails] = useState<Details>(
    initial?.details ?? {
      category: "day",
      tags: [],
      seasons: [],
      hairpins: null,
      notes: "",
      status: "wishlist",
      statusDate: null,
      rideReport: "",
    },
  );
  const [saving, startSave] = useTransition();
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFound = (p: Preview) => {
    setPreview(p);
    setName(p.name);
    if (!editId) setDetails((d) => ({ ...d, category: p.suggested }));
  };

  const movePin = async (lat: number, lng: number) => {
    if (!preview) return;
    setMoving(true);
    const res = await attempt(() => previewFromPlace(slug, { name, area: preview.area, lat, lng, mapsUrl: null }));
    setMoving(false);
    if (!res) return;
    if (res.ok) {
      setPreview({ ...res.preview, name });
      toast(`Pin moved: ${km(res.preview.distanceKm)} round trip`);
    } else {
      toast(res.error);
    }
  };

  /** Back to the ride without leaving the form in history, so Back from the ride doesn't reopen it. */
  const leaveEdit = () => {
    if (backToRide) router.back();
    else router.replace(`/g/${slug}/d/${editId}`);
  };

  const save = () => {
    if (!preview) return;
    setError(null);
    const input: DestinationInput = {
      name: name.trim() || preview.name,
      area: preview.area,
      mapsUrl: preview.mapsUrl,
      lat: preview.lat,
      lng: preview.lng,
      distanceKm: preview.distanceKm,
      durationMin: preview.durationMin,
      approx: preview.approx,
      route: preview.route,
      roadSplit: preview.roadSplit,
      seal: preview.seal,
      photos: preview.photos,
      ...details,
    };
    startSave(async () => {
      if (editId) {
        const res = await attempt(() => updateDestination(slug, editId, input));
        if (!res) return;
        if (!res.ok) {
          setError(res.error);
          return toast(res.error);
        }
        toast("Changes saved");
        leaveEdit();
      } else {
        const res = await attempt(() => createDestination(slug, input));
        if (!res) return;
        if (!res.ok) {
          setError(res.error);
          return toast(res.error);
        }
        toast("Posted to the crew");
        // Replace, so Back from the new ride doesn't land on a form that has already been posted.
        router.replace(`/g/${slug}/d/${res.id}`);
      }
    });
  };

  return (
    <div className="min-h-dvh">
      <header className="topbar flex items-center gap-2 px-2 pb-2.5 pt-[max(env(safe-area-inset-top),10px)] lg:px-6">
        {preview && !editId ? (
          <button onClick={() => setPreview(null)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        ) : editId ? (
          <button onClick={leaveEdit} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
            <X size={22} />
          </button>
        ) : (
          <Link href={`/g/${slug}`} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
            <X size={22} />
          </Link>
        )}
        <h1 className="display flex-1 text-[24px]">{editId ? "Edit ride" : preview ? "Ride details" : "New ride"}</h1>
        {preview && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={save}
            disabled={saving}
            className="btn btn-ink !min-h-10"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {editId ? "Save changes" : "Post to the crew"}
          </motion.button>
        )}
      </header>

      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div key="find" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Finder slug={slug} onFound={onFound} />
          </motion.div>
        ) : (
          <motion.div key="details" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-[720px] pb-28">
            <section className="relative h-[260px] bg-surface-2 lg:mt-6 lg:overflow-hidden lg:rounded-panel">
              <PickMap
                lat={preview.lat}
                lng={preview.lng}
                route={preview.route}
                category={details.category}
                onMove={movePin}
                className="h-full w-full"
              />
              <span className="float pointer-events-none absolute left-3 top-3 z-[500] rounded-[3px] bg-surface px-2.5 py-1.5 text-[14px] font-medium text-text">
                {moving ? "Re-routing…" : "Pin off? Drag it to the right spot"}
              </span>
              {moving && (
                <div className="absolute inset-0 z-[600] grid place-items-center bg-[var(--scrim)]">
                  <Loader2 className="animate-spin text-white" />
                </div>
              )}
            </section>

            <section className="space-y-8 px-4 pt-6 lg:px-0">
              {editId && (
                <button
                  onClick={() => setPreview(null)}
                  className="flex min-h-11 items-center gap-1.5 text-[15px] font-semibold underline decoration-line-strong underline-offset-4"
                >
                  <Link2 size={14} /> Change location
                </button>
              )}
              <div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  aria-label="Ride name"
                  className="display w-full rounded-[4px] bg-transparent text-[44px] outline-none placeholder:text-faint"
                  placeholder="Name this place"
                />
                {preview.area && <p className="mt-1 text-[16px] text-muted">{preview.area}</p>}
              </div>

              <div className="flex items-end gap-6">
                <Milestone name={name || preview.name} distanceKm={preview.distanceKm} split={preview.roadSplit} approx={preview.approx} size={15} />
                <dl className="num grid flex-1 grid-cols-2 gap-x-6 gap-y-3">
                  <Metric label="Round trip" value={km(preview.distanceKm)} sub={preview.approx ? "Rough estimate" : "Bengaluru and back"} />
                  <Metric label="Riding time" value={duration(preview.durationMin)} sub="Without stops" />
                </dl>
              </div>
              {preview.roadSplit && <RoadSplitBar split={preview.roadSplit} />}

              {preview.nearby.length > 0 && !editId && (
                <div className="flex gap-3 rounded-panel bg-accent-soft p-4 text-[15px]">
                  <TriangleAlert size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p>Already close to something on the list:</p>
                    {preview.nearby.map((n) => (
                      <Link key={n.id} href={`/g/${slug}/d/${n.id}`} className="mt-1 block font-semibold underline underline-offset-4">
                        {n.name} by {n.owner}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {preview.photosFailed && preview.photos.length === 0 && (
                <p className="flex items-start gap-2 rounded-panel bg-surface p-3 text-[15px] text-muted">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                  Wikimedia Commons is busy, so no photos yet. Save the ride, then try “Find photos again” from its menu later.
                </p>
              )}

              {preview.photos.length > 0 && (
                <Field label="Photos nearby" hint="From Wikimedia Commons. Remove any that don't fit.">
                  <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                    {preview.photos.map((p) => (
                      <div key={p.thumb} className="relative h-32 w-44 shrink-0 overflow-hidden rounded-panel bg-surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumb} alt={p.title} className="h-full w-full object-cover" />
                        <button
                          onClick={() => setPreview({ ...preview, photos: preview.photos.filter((x) => x.thumb !== p.thumb) })}
                          className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full bg-[var(--scrim)] text-white"
                          aria-label={`Remove photo ${p.title}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="What kind of ride?">
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORY_KEYS.map((c) => {
                    const on = details.category === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setDetails({ ...details, category: c })}
                        aria-pressed={on}
                        className={`relative rounded-panel p-3 text-left transition-colors ${on ? "bg-text text-inverse" : "bg-surface hover:bg-surface-2"}`}
                      >
                        <span className="mb-2 block h-2.5 w-2.5 rounded-full" style={{ background: CATEGORIES[c].color }} />
                        <span className="display block text-[20px]">{CATEGORIES[c].short}</span>
                        <span className={`mt-0.5 block text-[13px] leading-snug ${on ? "opacity-75" : "text-faint"}`}>{CATEGORIES[c].hint}</span>
                        {preview.suggested === c && (
                          <span className={`absolute right-2.5 top-2.5 text-[12px] font-medium ${on ? "opacity-75" : "text-faint"}`}>Suggested</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Status">
                <div className="flex flex-wrap gap-2">
                  {STATUS_KEYS.map((s) => (
                    <button
                      key={s}
                      aria-pressed={details.status === s}
                      onClick={() =>
                        setDetails({
                          ...details,
                          status: s,
                          statusDate: s === "planned" || s === "done" ? details.statusDate ?? (s === "done" ? todayYmd() : null) : null,
                        })
                      }
                      className="chip"
                    >
                      {STATUSES[s].label}
                    </button>
                  ))}
                </div>
                {(details.status === "planned" || details.status === "done") && (
                  <label className="field mt-3 flex items-center justify-between">
                    <span className="text-muted">{details.status === "planned" ? "Ride date" : "Ridden on"}</span>
                    <input
                      type="date"
                      value={details.statusDate ?? ""}
                      onChange={(e) => setDetails({ ...details, statusDate: e.target.value || null })}
                      className="bg-transparent text-right font-semibold outline-none"
                    />
                  </label>
                )}
                {details.status === "done" && (
                  <textarea
                    value={details.rideReport}
                    onChange={(e) => setDetails({ ...details, rideReport: e.target.value })}
                    rows={3}
                    maxLength={3000}
                    placeholder="Ride report: road conditions, what to skip, what we'd do differently…"
                    aria-label="Ride report"
                    className="field mt-3 resize-none"
                  />
                )}
              </Field>

              <Field label="The road" hint="Pick any, or add your own">
                <TagPicker tags={details.tags} onChange={(tags) => setDetails({ ...details, tags })} />
              </Field>

              <Field label="Hairpins">
                <Stepper value={details.hairpins} onChange={(hairpins) => setDetails({ ...details, hairpins })} />
              </Field>

              <Field label="Best time to go">
                <div className="flex flex-wrap gap-1.5">
                  {SEASON_KEYS.map((s) => (
                    <Chip
                      key={s}
                      on={details.seasons.includes(s)}
                      onClick={() =>
                        setDetails({
                          ...details,
                          seasons: details.seasons.includes(s) ? details.seasons.filter((x) => x !== s) : [...details.seasons, s],
                        })
                      }
                    >
                      {SEASONS[s]}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Notes">
                <textarea
                  value={details.notes}
                  onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                  rows={4}
                  maxLength={2000}
                  placeholder="Why this one? Fuel stops, cop spots, the dosa place…"
                  aria-label="Notes"
                  className="field resize-none"
                />
              </Field>

              {error && <p className="text-[15px] text-danger">{error}</p>}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Finder({ slug, onFound }: { slug: string; onFound: (p: Preview) => void }) {
  const [mode, setMode] = useState<"link" | "search">("link");
  const [link, setLink] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [art, setArt] = useState<Preview | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setLine((l) => Math.min(l + 1, LOADING_LINES.length - 1)), 1300);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (mode !== "search" || query.trim().length < 2) return;
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = (await attempt(() => searchPlacesAction(slug, query))) ?? [];
      if (seq === searchSeq.current) {
        setResults(r);
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [query, mode, slug]);

  const run = async (fn: () => Promise<{ ok: true; preview: Preview } | { ok: false; error: string }>) => {
    setError(null);
    setLine(0);
    setLoading(true);
    const res = await attempt(fn);
    if (!res?.ok) {
      setLoading(false);
      setError(res ? res.error : "Couldn't reach list-it. Check your signal and try again.");
      return;
    }
    // Let the route draw in for a beat before moving on.
    setArt(res.preview);
    setTimeout(() => onFound(res.preview), 1400);
  };

  const fromLink = (value = link) => {
    if (!value.trim()) return;
    run(() => previewFromLink(slug, value));
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setLink(text);
      if (/https?:\/\//.test(text)) fromLink(text);
    } catch {
      toast("Long-press the box and paste instead");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-6 w-full max-w-[360px] overflow-hidden rounded-panel bg-surface">
          {art ? (
            <RouteArt id="finder" route={art.route} category={art.suggested} width={500} height={400} className="aspect-[5/4] h-auto w-full" />
          ) : (
            <div className="skeleton aspect-[5/4] w-full" />
          )}
          {art && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-4 text-left"
            >
              <p className="display text-[30px]">{art.name}</p>
              <p className="num text-[15px] text-muted">
                {km(art.distanceKm)} round trip, {duration(art.durationMin)} riding
              </p>
            </motion.div>
          )}
        </div>
        {!art && (
          <AnimatePresence mode="wait">
            <motion.p
              key={line}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              aria-live="polite"
              className="text-[16px] text-muted"
            >
              {LOADING_LINES[line]}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 pt-8">
      <h2 className="display text-[56px] leading-[0.9]">Where to?</h2>
      <p className="mt-3 max-w-[40ch] text-[17px] text-muted">
        Paste a Google Maps link. The round trip from Bengaluru, riding time, road mix and nearby photos are worked out for you.
      </p>

      <div className="mt-8 flex rounded-full bg-surface-2 p-1" role="tablist" aria-label="How to find the place">
        {(["link", "search"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            role="tab"
            aria-selected={mode === m}
            className={`relative flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold ${
              mode === m ? "text-text" : "text-faint hover:text-text"
            }`}
          >
            {mode === m && <motion.span layoutId="finder-tab" className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.12)]" />}
            <span className="relative flex items-center gap-1.5">
              {m === "link" ? <Link2 size={15} /> : <Search size={15} />}
              {m === "link" ? "Maps link" : "Search"}
            </span>
          </button>
        ))}
      </div>

      {mode === "link" ? (
        <div className="mt-6 space-y-3">
          <label htmlFor="maps-link" className="block text-[15px] font-semibold">
            Google Maps link
          </label>
          <div className="field !p-1.5">
            <textarea
              id="maps-link"
              aria-describedby="maps-link-help"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (/https?:\/\//.test(text)) setTimeout(() => fromLink(text), 50);
              }}
              rows={3}
              placeholder="https://maps.app.goo.gl/…"
              className="w-full resize-none bg-transparent p-2 text-[16px] outline-none placeholder:text-faint"
            />
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={paste} className="btn btn-line !min-h-12">
              <ClipboardPaste size={18} /> Paste
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => fromLink()} disabled={!link.trim()} className="btn btn-ink !min-h-12 flex-1">
              Preview ride <MoveRight size={18} />
            </motion.button>
          </div>
          <p id="maps-link-help" className="pt-2 text-[15px] leading-relaxed text-muted">
            In Google Maps, open the place, tap Share and copy the link. A whole WhatsApp message with a link in it works too, and so do plus codes and plain coordinates.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="field flex items-center gap-2 !py-0">
            <Search size={18} className="text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) setResults([]);
              }}
              placeholder="Yercaud, Coorg, Nandi Hills…"
              aria-label="Search for a place"
              className="flex-1 bg-transparent py-3.5 text-[16px] outline-none placeholder:text-faint"
            />
            {searching && <Loader2 size={16} className="animate-spin text-faint" />}
          </div>
          <ul className="mt-2">
            {results.map((p, i) => (
              <motion.li key={`${p.lat},${p.lng}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <button
                  onClick={() => run(() => previewFromPlace(slug, p))}
                  className="flex min-h-14 w-full items-center gap-3 rounded-panel px-2 py-2.5 text-left hover:bg-surface active:bg-surface-2"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2">
                    <MapPin size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold">{p.name}</span>
                    {p.area && <span className="block truncate text-[14px] text-faint">{p.area}</span>}
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
          <p className="mt-3 text-[15px] text-muted">Search uses OpenStreetMap, so small spots may be missing. A Maps link is more exact.</p>
        </div>
      )}

      {error && (
        <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 rounded-panel bg-surface p-4 text-[15px] text-danger shadow-[inset_3px_0_0_var(--danger)]">
          {error}
        </motion.p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[16px] font-semibold">
        {label}
        {hint && <span className="ml-2 text-[14px] font-normal text-faint">{hint}</span>}
      </h3>
      {children}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="text-[14px] text-faint">{label}</dt>
      <dd className="display mt-0.5 text-[28px]">{value}</dd>
      <dd className="text-[14px] text-muted">{sub}</dd>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick} aria-pressed={on} className="chip">
      {children}
    </motion.button>
  );
}

function TagPicker({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const toggle = (t: string) => onChange(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const customs = tags.filter((t) => !(t in ROAD_TAGS));
  const add = () => {
    const t = custom.trim().toLowerCase().replace(/^#/, "");
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setCustom("");
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROAD_TAG_KEYS.map((t) => (
        <Chip key={t} on={tags.includes(t)} onClick={() => toggle(t)}>
          {ROAD_TAGS[t]}
        </Chip>
      ))}
      {customs.map((t) => (
        <Chip key={t} on onClick={() => toggle(t)}>
          {tagLabel(t)} <X size={14} aria-label="remove" />
        </Chip>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex min-h-9 items-center rounded-full pl-3.5 shadow-[inset_0_0_0_1px_var(--line-strong)]"
      >
        <span className="text-faint" aria-hidden>#</span>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={add}
          maxLength={24}
          placeholder="custom tag"
          aria-label="Add your own tag"
          className="w-28 bg-transparent py-1.5 pl-0.5 pr-3 text-[14px] outline-none placeholder:text-faint"
        />
      </form>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-full bg-surface">
        <button onClick={() => onChange(v <= 1 ? null : v - 1)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Fewer hairpins">
          <Minus size={16} />
        </button>
        <input
          inputMode="numeric"
          value={value ?? ""}
          onChange={(e) => {
            const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
            onChange(Number.isFinite(n) && n > 0 ? Math.min(n, 999) : null);
          }}
          placeholder="?"
          aria-label="Hairpins"
          className="display num w-14 bg-transparent text-center text-[26px] outline-none placeholder:text-faint"
        />
        <button onClick={() => onChange(v + 1)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2" aria-label="More hairpins">
          <Plus size={16} />
        </button>
      </div>
      <span className="text-[15px] text-muted">{value ? `${value} hairpin bend${value === 1 ? "" : "s"}` : "Don't know? Leave it."}</span>
    </div>
  );
}
