"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { previewLoop, resolveLoopPlace, saveLoop, searchLoopPlaces } from "@/app/g/[slug]/loop-actions";
import { duration, km } from "@/lib/format";
import { loopDays } from "@/lib/loops";
import type { Loop, LoopStop, StartPoint } from "@/lib/types";
import { RouteArt } from "./route-art";
import { attempt } from "./toast";

type Ride = { id: string; name: string; area: string | null; lat: number; lng: number };
type Routed = Pick<Loop, "legs" | "route" | "totalKm" | "totalMin">;
export function LoopBuilder({
  slug,
  rides,
  start,
  loop,
  initialStop,
}: {
  slug: string;
  rides: Ride[];
  start: StartPoint;
  loop?: Loop;
  initialStop?: LoopStop;
}) {
  const router = useRouter();
  const [name, setName] = useState(loop?.name ?? "");
  const [notes, setNotes] = useState(loop?.notes ?? "");
  const [date, setDate] = useState(loop?.startDate ?? "");
  const [stops, setStops] = useState<LoopStop[]>(loop?.stops ?? (initialStop ? [initialStop] : []));
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<LoopStop[]>([]);
  const [preview, setPreview] = useState<{ key: string; routed: Routed | null } | null>(
    loop ? { key: JSON.stringify(loop.stops), routed: loop } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);
  const key = JSON.stringify(stops);
  const routing = !!stops.length && preview?.key !== key;
  const routed = preview?.key === key ? preview.routed : null;
  useEffect(() => {
    const current = ++seq.current;
    if (!stops.length) return;
    const timer = setTimeout(async () => {
      const result = await attempt(() =>
        previewLoop(slug, { name: "Preview", notes: "", startDate: null, stops }, loop?.id ?? null),
      );
      if (current !== seq.current) return;
      setPreview({ key, routed: result?.ok ? result.routed : null });
    }, 500);
    return () => clearTimeout(timer);
  }, [slug, stops, key, loop?.id]);
  const add = (stop: LoopStop) => {
    if (stops.length >= 20) return setError("A loop can have up to 20 stops.");
    setStops([...stops, stop]);
    setQuery("");
    setPlaces([]);
    setError("");
  };
  const find = async (search: boolean) => {
    setBusy(true);
    setError("");
    if (search) {
      const result = await attempt(() => searchLoopPlaces(slug, query));
      if (result?.ok) {
        setPlaces(result.places);
        if (!result.places.length) setError("No places found. Try a Maps link.");
      } else if (result) setError(result.error);
    } else {
      const result = await attempt(() => resolveLoopPlace(slug, query));
      if (result?.ok) add(result.place);
      else if (result) setError(result.error);
    }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true);
    const result = await attempt(() =>
      saveLoop(slug, { name, notes, startDate: date || null, stops }, loop?.id ?? null),
    );
    if (result?.ok) router.push(`/g/${slug}/loops/${result.id}`);
    else if (result) setError(result.error);
    setBusy(false);
  };
  const move = (index: number, delta: number) => {
    const next = [...stops];
    const other = index + delta;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    setStops(next);
  };
  const matching = rides
    .filter((r) => query.trim() && `${r.name} ${r.area ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);
  const days = routed && stops.length ? loopDays(start, stops, routed.legs) : [];
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-16 pt-8 lg:pt-12">
      <Link href={loop ? `/g/${slug}/loops/${loop.id}` : `/g/${slug}/loops`} className="text-[15px] text-muted">
        Back to loops
      </Link>
      <h1 className="display mt-4 text-[48px]">{loop ? "Edit loop" : "Build a loop"}</h1>
      <p className="mt-2 text-muted">Starts and ends at {start.name}.</p>
      <div className="mt-7 space-y-5">
        <label className="block font-semibold">
          Loop name
          <input
            className="field mt-2"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yercaud and Mettur"
          />
        </label>
        <label className="block font-semibold">
          Start date <span className="font-normal text-muted">optional</span>
          <input
            className="field mt-2"
            type="date"
            min="1900-01-01"
            max="9998-12-31"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block font-semibold">
          Notes <span className="font-normal text-muted">optional</span>
          <textarea
            className="field mt-2"
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>
      <h2 className="display mt-8 text-[30px]">Stops</h2>
      {!stops.length && <p className="mt-2 text-muted">Add a ride or find a place to start your loop.</p>}
      <ol className="mt-3 space-y-2">
        {stops.map((stop, i) => (
          <li key={i} className="rounded-panel bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="num font-semibold">{i + 1}.</span>
              <span className="min-w-0 flex-1 font-semibold">{stop.name}</span>
              <button
                aria-label={`Move ${stop.name} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="grid h-10 w-10 place-items-center disabled:opacity-30"
              >
                <ArrowUp size={18} />
              </button>
              <button
                aria-label={`Move ${stop.name} down`}
                disabled={i === stops.length - 1}
                onClick={() => move(i, 1)}
                className="grid h-10 w-10 place-items-center disabled:opacity-30"
              >
                <ArrowDown size={18} />
              </button>
              <button
                aria-label={`Remove ${stop.name}`}
                onClick={() => setStops(stops.filter((_, j) => i !== j))}
                className="grid h-10 w-10 place-items-center"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-[15px]">
              <input
                type="checkbox"
                aria-label={`Night here at ${stop.name}`}
                className="h-6 w-6"
                checked={stop.nightHere}
                onChange={(e) => setStops(stops.map((s, j) => (j === i ? { ...s, nightHere: e.target.checked } : s)))}
              />{" "}
              Night here
            </label>
          </li>
        ))}
      </ol>
      <label className="mt-6 block font-semibold">
        Find a ride or place
        <input
          className="field mt-2"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPlaces([]);
          }}
          placeholder="Search, or paste a Maps link or coordinates"
        />
      </label>
      {matching.length > 0 && (
        <ul className="mt-2 bg-surface">
          {matching.map((ride) => (
            <li key={ride.id}>
              <button
                className="w-full px-4 py-3 text-left hover:bg-surface-2"
                onClick={() =>
                  add({ destinationId: ride.id, name: ride.name, lat: ride.lat, lng: ride.lng, nightHere: false })
                }
              >
                {ride.name}
                {ride.area && <span className="ml-2 text-muted">{ride.area}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-line" disabled={busy || !query.trim()} onClick={() => find(true)}>
          Search places
        </button>
        <button className="btn btn-line" disabled={busy || !query.trim()} onClick={() => find(false)}>
          Use link or coordinates
        </button>
      </div>
      {places.length > 0 && (
        <ul className="mt-2 bg-surface">
          {places.map((place, i) => (
            <li key={i}>
              <button className="w-full px-4 py-3 text-left hover:bg-surface-2" onClick={() => add(place)}>
                {place.name}{" "}
                <span className="text-muted">
                  {place.lat.toFixed(3)}, {place.lng.toFixed(3)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {stops.length > 0 && (
        <section className="mt-8">
          <h2 className="display text-[30px]">Route preview</h2>
          {routing ? (
            <p className="mt-3 text-muted">Working out the route…</p>
          ) : routed && days.length ? (
            <>
              <RouteArt
                id="loop-preview"
                route={routed.route}
                category="multi"
                start={start}
                className="mt-3 h-48 w-full rounded-panel bg-surface"
              />
              <p className="num mt-3 font-semibold">
                {routed.legs.some((l) => l.approx) ? "About " : ""}
                {km(routed.totalKm)} · {duration(routed.totalMin)} riding
              </p>
              <ol className="mt-3 space-y-1 text-[15px] text-muted">
                {routed.legs.map((leg, i) => (
                  <li key={i}>
                    {i === 0 ? start.name : stops[i - 1].name} → {stops[i]?.name ?? start.name}:
                    {leg.approx ? " about " : " "}
                    {km(leg.km)} · {duration(leg.min)}
                  </li>
                ))}
              </ol>
              {days.map((day, i) => (
                <p key={i} className="mt-2 text-muted">
                  Day {i + 1}: {day.names.join(" → ")} · {km(day.km)} · {duration(day.min)}
                  {day.km > 450 || day.min > 540 ? " · Long day: over 450 km or 9 hours" : ""}
                </p>
              ))}
            </>
          ) : (
            <p className="mt-3 text-muted">Route preview unavailable.</p>
          )}
        </section>
      )}
      {error && (
        <p role="alert" className="mt-5 text-danger">
          {error}
        </p>
      )}
      <button className="btn btn-ink mt-6" disabled={busy || !name.trim() || !stops.length} onClick={save}>
        {busy ? "Saving…" : "Save loop"}
      </button>
    </div>
  );
}
