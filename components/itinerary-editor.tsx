"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { previewRideItinerary } from "@/app/g/[slug]/itinerary-actions";
import { importLoopRoute, resolveLoopPlace, searchLoopPlaces } from "@/app/g/[slug]/loop-actions";
import type { Preview } from "@/app/g/[slug]/actions";
import type { LoopStop, StartPoint } from "@/lib/types";
import { importStops, loopDays } from "@/lib/loops";
import { duration, km } from "@/lib/format";
import { attempt } from "./toast";

export type SavedPlace = { id: string; name: string; area: string | null; lat: number; lng: number };

export function ItineraryEditor({ slug, editId, preview, rides, start, appendStop, onPreview, onPending }: {
  slug: string; editId?: string; preview: Preview; rides: SavedPlace[]; start: StartPoint;
  appendStop?: LoopStop; onPreview: (preview: Preview) => void; onPending: (pending: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(!!preview.itinerary || !!appendStop);
  const [stops, setStops] = useState<LoopStop[]>(() => [
    ...(preview.itinerary?.stops ?? [{ destinationId: editId && !editId.startsWith("loop:") ? editId : null, name: preview.name, lat: preview.lat, lng: preview.lng, nightHere: false }]),
    ...(appendStop ? [appendStop] : []),
  ]);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<LoopStop[]>([]);
  const [finding, setFinding] = useState(false);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imported, setImported] = useState<LoopStop[] | null>(null);
  const importPending = useRef(false);
  const [retry, setRetry] = useState(0);
  const callbacks = useRef({ onPreview, onPending });
  const routedKey = useRef(JSON.stringify(preview.itinerary?.stops ?? [{ destinationId: editId && !editId.startsWith("loop:") ? editId : null, name: preview.name, lat: preview.lat, lng: preview.lng, nightHere: false }]));
  const key = JSON.stringify(stops);
  useEffect(() => { callbacks.current = { onPreview, onPending }; }, [onPreview, onPending]);
  useEffect(() => {
    if (!expanded || key === routedKey.current) return;
    let active = true;
    const timer = setTimeout(async () => {
      setRouting(true);
      const result = await attempt(() => previewRideItinerary(slug, JSON.parse(key), editId));
      if (!active) return;
      setRouting(false);
      if (!result?.ok) {
        setError(result && !result.ok ? result.error : "Routing is unavailable. Try again.");
        callbacks.current.onPending(true);
        return;
      }
      routedKey.current = JSON.stringify(result.preview.itinerary!.stops);
      setStops(result.preview.itinerary!.stops);
      setError("");
      callbacks.current.onPreview(result.preview);
      callbacks.current.onPending(importPending.current);
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [slug, editId, expanded, key, retry]);

  const change = (next: LoopStop[]) => {
    if (!next.length) return;
    if (next.length > 20) return setError("A ride can include up to 20 places.");
    callbacks.current.onPending(true);
    setError(""); setStops(next);
    if (JSON.stringify(next) === routedKey.current) callbacks.current.onPending(importPending.current);
  };
  const add = (stop: LoopStop) => { change([...stops, stop]); setQuery(""); setFound([]); };
  const find = async (search: boolean) => {
    setFinding(true); setError(""); setNotice("");
    if (search) {
      const result = await attempt(() => searchLoopPlaces(slug, query));
      if (result?.ok) { setFound(result.places); if (!result.places.length) setError("No places found. Try a Maps link."); }
      else setError(result ? result.error : "Search is unavailable.");
    } else {
      let imported = false;
      if (/https?:\/\//.test(query)) {
        const result = await attempt(() => importLoopRoute(slug, query));
        if (result && !result.ok && /\/dir\/|[?&]destination=/.test(query)) { setError(result.error); imported = true; }
        if (result?.ok) {
          const parsed = importStops(result.places, preview.itinerary?.start ?? start, rides);
          const notes = [...result.skipped, ...parsed.dropped];
          if (!parsed.stops.length) setError("No route places remain after removing the start and return home.");
          else { setImported(parsed.stops); importPending.current = true; callbacks.current.onPending(true); }
          if (notes.length) setNotice(`Skipped: ${notes.join(", ")}. Check the itinerary before saving.`);
          imported = true;
        }
      }
      if (!imported) {
        const result = await attempt(() => resolveLoopPlace(slug, query));
        if (result?.ok) add(result.place);
        else setError(result ? result.error : "Could not read that place.");
      }
    }
    setFinding(false);
  };

  if (!expanded) return <section className="border-y border-line py-5">
    <button type="button" onClick={() => { setExpanded(true); }} className="btn btn-line"><Plus size={17} /> Add another place</button>
    <p className="mt-2 text-[14px] text-muted">Build a route with several places, or stay overnight.</p>
  </section>;

  const trip = preview.itinerary;
  const days = trip ? loopDays(trip.start, trip.stops, trip.legs) : [];
  const applyImport = (append: boolean) => {
    const next = append ? [...stops, ...imported!] : imported!;
    if (next.length > 20) return setError("A ride can include up to 20 places. Replace the itinerary or remove some places first.");
    importPending.current = false;
    setImported(null); setQuery(""); change(next);
  };
  return <section className="border-y border-line py-6" aria-label="Edit itinerary">
    <h2 className="display text-[28px]">Your itinerary</h2>
    <p className="mt-1 text-[15px] text-muted">Starts and ends in {trip?.start.name ?? start.name}. Add an overnight to split the ride into days.</p>
    <ol className="mt-4 space-y-2">{stops.map((stop, index) => <li key={index} className="rounded-panel bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="num w-6 shrink-0 text-faint">{index + 1}</span><span className="min-w-0 flex-1 font-semibold">{stop.name}</span>
        <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-25" disabled={index === 0} aria-label={`Move ${stop.name} up`} onClick={() => { const next = [...stops]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; change(next); }}><ArrowUp size={17} /></button>
        <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-25" disabled={index === stops.length - 1} aria-label={`Move ${stop.name} down`} onClick={() => { const next = [...stops]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; change(next); }}><ArrowDown size={17} /></button>
        <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:text-danger disabled:opacity-25" disabled={stops.length === 1} aria-label={`Remove ${stop.name}`} onClick={() => change(stops.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
      </div>
      <label className="ml-8 flex min-h-10 items-center gap-2 text-[14px] text-muted"><input type="checkbox" aria-label={`Stay overnight in ${stop.name}`} checked={stop.nightHere} onChange={e => change(stops.map((s, i) => i === index ? { ...s, nightHere: e.target.checked } : s))} /> Stay overnight here</label>
    </li>)}</ol>
    <label className="mt-5 block text-[15px] font-semibold" htmlFor="itinerary-place">Add a place or Maps directions link</label>
    <input id="itinerary-place" className="field mt-2" value={query} onChange={e => { setQuery(e.target.value); setFound([]); }} placeholder="Search a place or paste a Maps link" />
    {query.trim() && <ul className="mt-2">{rides.filter(ride => `${ride.name} ${ride.area ?? ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6).map(ride => <li key={ride.id}><button type="button" className="min-h-11 w-full border-b border-line text-left text-[15px]" onClick={() => add({ destinationId: ride.id, name: ride.name, lat: ride.lat, lng: ride.lng, nightHere: false })}>{ride.name}<span className="ml-2 text-faint">Saved place</span></button></li>)}</ul>}
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn btn-line" disabled={finding || query.trim().length < 2} onClick={() => find(true)}>Search places</button><button type="button" className="btn btn-line" disabled={finding || !query.trim()} onClick={() => find(false)}>{finding && <Loader2 size={15} className="animate-spin" />} Add from link</button></div>
    {imported && <div className="mt-4 rounded-panel bg-surface p-4" aria-label="Review imported itinerary">
      <p className="font-semibold">Found {imported.length} {imported.length === 1 ? "place" : "places"}</p>
      <p className="mt-1 text-[15px] text-muted">{imported.map(stop => stop.name).join(" → ")}</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn btn-ink" onClick={() => applyImport(false)}>Replace itinerary</button><button type="button" className="btn btn-line" onClick={() => applyImport(true)}>Add to the end</button><button type="button" className="btn btn-quiet" onClick={() => { importPending.current = false; setImported(null); setError(""); setNotice(""); callbacks.current.onPending(key !== routedKey.current); }}>Cancel import</button></div>
    </div>}
    <ul className="mt-2">{found.map((place, index) => <li key={index}><button type="button" className="min-h-11 w-full border-b border-line text-left" onClick={() => add(place)}>{place.name}</button></li>)}</ul>
    {notice && <p role="status" className="mt-3 text-[14px] text-muted">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-[15px] text-danger">{error} <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>Retry route</button></p>}
    {routing ? <p role="status" className="mt-4 flex items-center gap-2 text-muted"><Loader2 size={16} className="animate-spin" /> Updating route…</p> : !error && days.length > 0 && <div className="mt-5 space-y-2">{days.map((day, index) => <div key={index} className="text-[14px]"><p className="font-semibold">Day {index + 1} · {day.names.join(" → ")}</p><p className="num text-muted">{day.approx ? "About " : ""}{km(day.km)} · {duration(day.min)} riding{day.km > 500 || day.min > 480 ? " · Long day: consider another overnight" : ""}</p></div>)}</div>}
  </section>;
}
