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
  type DestinationInput,
  type Preview,
} from "@/app/g/[slug]/actions";
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
import { RoadSplitBar } from "./road-split";
import { toast } from "./toast";

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
  initial,
}: {
  slug: string;
  editId?: string;
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
    const res = await previewFromPlace(slug, { name, area: preview.area, lat, lng, mapsUrl: preview.mapsUrl });
    setMoving(false);
    if (res.ok) {
      setPreview({ ...res.preview, name });
      toast(`Pin moved · ${km(res.preview.distanceKm)} round trip`);
    }
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
      photos: preview.photos,
      ...details,
    };
    startSave(async () => {
      if (editId) {
        const res = await updateDestination(slug, editId, input);
        if (!res.ok) {
          setError(res.error);
          return toast(res.error);
        }
        toast("Saved");
        router.push(`/g/${slug}/d/${editId}`);
      } else {
        const res = await createDestination(slug, input);
        if (!res.ok) {
          setError(res.error);
          return toast(res.error);
        }
        toast("Posted to the crew 🏍️");
        router.push(`/g/${slug}/d/${res.id}`);
      }
    });
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/85 px-3 py-2.5 backdrop-blur-xl">
        {preview && !editId ? (
          <button onClick={() => setPreview(null)} className="grid h-10 w-10 place-items-center rounded-full" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <Link
            href={editId ? `/g/${slug}/d/${editId}` : `/g/${slug}`}
            className="grid h-10 w-10 place-items-center rounded-full"
            aria-label="Close"
          >
            <X size={22} />
          </Link>
        )}
        <h1 className="flex-1 font-display text-lg font-bold">{editId ? "Edit ride" : preview ? "Details" : "New ride"}</h1>
        {preview && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full btn-primary px-5 py-2 font-display font-bold text-black disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {editId ? "Save" : "Post"}
          </motion.button>
        )}
      </header>

      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div key="find" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Finder slug={slug} onFound={onFound} />
          </motion.div>
        ) : (
          <motion.div key="details" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pb-28">
            <section className="relative h-[230px] border-b border-line">
              <PickMap
                lat={preview.lat}
                lng={preview.lng}
                route={preview.route}
                category={details.category}
                onMove={movePin}
                className="h-full w-full"
              />
              <span className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-black/65 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur">
                {moving ? "Re-routing…" : "Pin off? Drag it to the right spot"}
              </span>
              {moving && (
                <div className="absolute inset-0 z-[600] grid place-items-center bg-black/40">
                  <Loader2 className="animate-spin" />
                </div>
              )}
            </section>

            <section className="space-y-5 px-4 pt-4">
              {editId && (
                <button
                  onClick={() => setPreview(null)}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-2"
                >
                  <Link2 size={14} /> Change location
                </button>
              )}
              <div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="w-full bg-transparent font-display text-[28px] font-bold leading-tight outline-none placeholder:text-faint"
                  placeholder="Name this place"
                />
                {preview.area && <p className="text-sm text-muted">{preview.area}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Metric label="Round trip" value={km(preview.distanceKm)} sub={preview.approx ? "estimate" : "from Bengaluru"} />
                <Metric label="Riding time" value={duration(preview.durationMin)} sub="no stops" />
              </div>
              {preview.roadSplit && <RoadSplitBar split={preview.roadSplit} />}

              {preview.nearby.length > 0 && !editId && (
                <div className="flex gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/8 p-3 text-sm">
                  <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-amber-100">Already close to something on the list:</p>
                    {preview.nearby.map((n) => (
                      <Link key={n.id} href={`/g/${slug}/d/${n.id}`} className="mt-1 block font-semibold text-amber-200 underline">
                        {n.name} by {n.owner}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {preview.photos.length > 0 && (
                <Field label="Photos nearby" hint="From Wikimedia Commons. Tap ✕ on any that don't fit.">
                  <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                    {preview.photos.map((p) => (
                      <div key={p.thumb} className="relative h-28 w-36 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumb} alt={p.title} className="h-full w-full object-cover" />
                        <button
                          onClick={() => setPreview({ ...preview, photos: preview.photos.filter((x) => x.thumb !== p.thumb) })}
                          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70"
                          aria-label="Remove photo"
                        >
                          <X size={13} />
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
                        className={`relative rounded-2xl border p-3 text-left transition ${on ? "border-transparent" : "border-line bg-surface"}`}
                        style={on ? { background: `${CATEGORIES[c].color}1f`, boxShadow: `inset 0 0 0 1.5px ${CATEGORIES[c].color}` } : undefined}
                      >
                        <span className="mb-1.5 block h-2 w-2 rounded-full" style={{ background: CATEGORIES[c].color }} />
                        <span className="block text-[14px] font-semibold">{CATEGORIES[c].short}</span>
                        <span className="mt-0.5 block text-[11px] leading-tight text-faint">{CATEGORIES[c].hint}</span>
                        {preview.suggested === c && (
                          <span className="absolute right-2 top-2 text-[9px] font-bold uppercase tracking-wide text-faint">auto</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Status">
                <div className="grid grid-cols-4 gap-1.5">
                  {STATUS_KEYS.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        setDetails({
                          ...details,
                          status: s,
                          statusDate: s === "planned" || s === "done" ? details.statusDate ?? (s === "done" ? todayYmd() : null) : null,
                        })
                      }
                      className={`rounded-xl px-1 py-2.5 text-center transition ${
                        details.status === s ? "bg-text text-black" : "bg-surface-2 text-muted"
                      }`}
                    >
                      <span className="block text-lg leading-none">{STATUSES[s].emoji}</span>
                      <span className="mt-1 block text-[11px] font-semibold">{STATUSES[s].label}</span>
                    </button>
                  ))}
                </div>
                {(details.status === "planned" || details.status === "done") && (
                  <label className="mt-2 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
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
                    className="mt-2 w-full resize-none rounded-xl bg-surface-2 p-3 text-[15px] outline-none placeholder:text-faint"
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
                  className="w-full resize-none rounded-xl bg-surface-2 p-3 text-[15px] outline-none placeholder:text-faint"
                />
              </Field>

              {error && <p className="text-sm text-danger">{error}</p>}

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
      const r = await searchPlacesAction(slug, query);
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
    const res = await fn();
    if (!res.ok) {
      setLoading(false);
      setError(res.error);
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
        <div className="relative mb-6 aspect-[5/4] w-full max-w-[340px] overflow-hidden rounded-3xl border border-line">
          {art ? (
            <RouteArt id="finder" route={art.route} category={art.suggested} width={500} height={400} className="h-full w-full" />
          ) : (
            <div className="skeleton h-full w-full" />
          )}
          {art && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-10 text-left"
            >
              <p className="font-display text-2xl font-bold">{art.name}</p>
              <p className="text-sm text-white/75">
                {km(art.distanceKm)} round trip · {duration(art.durationMin)}
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
              className="text-muted"
            >
              {LOADING_LINES[line]}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <h2 className="font-display text-[34px] font-bold leading-[1.05] tracking-tight">
        Where to<span className="text-accent">?</span>
      </h2>
      <p className="mt-2 text-[15px] text-muted">Drop a Google Maps link. We&apos;ll work out the route, distance and photos.</p>

      <div className="mt-6 flex rounded-full bg-surface-2 p-1">
        {(["link", "search"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold ${
              mode === m ? "text-text" : "text-faint"
            }`}
          >
            {mode === m && <motion.span layoutId="finder-tab" className="absolute inset-0 rounded-full bg-surface-3" />}
            <span className="relative flex items-center gap-1.5">
              {m === "link" ? <Link2 size={15} /> : <Search size={15} />}
              {m === "link" ? "Maps link" : "Search"}
            </span>
          </button>
        ))}
      </div>

      {mode === "link" ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-line-strong bg-surface p-1.5 focus-within:border-accent">
            <textarea
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (/https?:\/\//.test(text)) setTimeout(() => fromLink(text), 50);
              }}
              rows={3}
              placeholder="https://maps.app.goo.gl/…"
              className="w-full resize-none bg-transparent p-2.5 text-[15px] outline-none placeholder:text-faint"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={paste}
              className="flex items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface py-3.5 font-semibold"
            >
              <ClipboardPaste size={18} /> Paste
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => fromLink()}
              disabled={!link.trim()}
              className="flex items-center justify-center gap-2 rounded-2xl btn-primary py-3.5 font-display font-bold text-black disabled:opacity-40"
            >
              Go <MoveRight size={18} />
            </motion.button>
          </div>
          <p className="pt-2 text-center text-xs leading-relaxed text-faint">
            In Google Maps: open a place → Share → Copy link.
            <br />
            Whole WhatsApp messages with a link in them work too.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-surface px-3.5 focus-within:border-accent">
            <Search size={18} className="text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) setResults([]);
              }}
              placeholder="Yercaud, Coorg, Nandi Hills…"
              className="flex-1 bg-transparent py-3.5 text-[15px] outline-none placeholder:text-faint"
            />
            {searching && <Loader2 size={16} className="animate-spin text-faint" />}
          </div>
          <ul className="mt-2">
            {results.map((p, i) => (
              <motion.li key={`${p.lat},${p.lng}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <button
                  onClick={() => run(() => previewFromPlace(slug, p))}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left active:bg-surface-2"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2">📍</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.name}</span>
                    {p.area && <span className="block truncate text-[13px] text-faint">{p.area}</span>}
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
          <p className="mt-3 text-center text-xs text-faint">Search uses OpenStreetMap, so small spots may be missing. A Maps link is more exact.</p>
        </div>
      )}

      {error && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-rose-200">
          {error}
        </motion.p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 section-label">
        {label}
        {hint && <span className="ml-2 font-normal normal-case tracking-normal text-faint/70">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="text-[11px] text-faint">{label}</p>
      <p className="font-display text-[22px] font-bold leading-tight">{value}</p>
      <p className="text-[11px] text-faint">{sub}</p>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
        on ? "bg-text text-black" : "border border-line bg-surface text-muted"
      }`}
    >
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
          {tagLabel(t)} ✕
        </Chip>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex items-center rounded-full border border-dashed border-line-strong pl-3"
      >
        <span className="text-faint">#</span>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={add}
          maxLength={24}
          placeholder="custom tag"
          className="w-24 bg-transparent py-1.5 pl-0.5 pr-3 text-[13px] outline-none placeholder:text-faint"
        />
      </form>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-full bg-surface-2">
        <button onClick={() => onChange(v <= 1 ? null : v - 1)} className="grid h-10 w-10 place-items-center" aria-label="Fewer">
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
          className="w-12 bg-transparent text-center font-display text-xl font-bold outline-none placeholder:text-faint"
        />
        <button onClick={() => onChange(v + 1)} className="grid h-10 w-10 place-items-center" aria-label="More">
          <Plus size={16} />
        </button>
      </div>
      <span className="text-sm text-faint">{value ? "🌀".repeat(Math.min(5, Math.ceil(value / 8))) : "Don't know? Leave it."}</span>
    </div>
  );
}
