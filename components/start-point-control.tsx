"use client";
import { useState, useTransition } from "react";
import { fillOriginRoutes, saveStart, searchPlacesAction } from "@/app/g/[slug]/actions";
import { HOME, START_AREAS } from "@/lib/config";
import type { StartPoint } from "@/lib/types";
import { Sheet } from "./sheet";
import { attempt, toast } from "./toast";

export function StartPointControl({ slug, start, rideIds }: { slug: string; start: StartPoint | null; rideIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(start?.name ?? HOME.name);
  const [selected, setSelected] = useState<StartPoint | null>(start);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StartPoint[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, run] = useTransition();
  return <>
    <button className="btn btn-quiet !min-h-10 !px-4 text-[14px]" onClick={() => setOpen(true)}>Start: {start?.name ?? HOME.name}</button>
    {start && <button className="btn btn-quiet !min-h-10 !px-4 text-[14px]" disabled={busy} onClick={() => run(async () => {
      setProgress(0);
      for (let i = 0; i < rideIds.length; i += 3) {
        const res = await attempt(() => fillOriginRoutes(slug, rideIds.slice(i, i + 3)));
        if (!res?.ok) { if (res) toast(res.error); setProgress(null); return; }
        setProgress(Math.min(i + 3, rideIds.length));
      }
      toast("Distances worked out");
    })}>Work out from my area{progress !== null ? ` · ${progress}/${rideIds.length}` : ""}</button>}
    <Sheet open={open} onClose={() => setOpen(false)} title="Your start point">
      <label className="block text-[14px] font-semibold" htmlFor="start-area">Area</label>
      <select id="start-area" className="field mt-2" value={choice} onChange={e => {
        const value = e.target.value; setChoice(value);
        setSelected(START_AREAS.find(a => a.name === value) ?? (value === start?.name ? start : null));
      }}>
        <option value={HOME.name}>Bengaluru city centre</option>
        {START_AREAS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
        {start && !START_AREAS.some(a => a.name === start.name) && <option value={start.name}>{start.name}</option>}
        <option value="other">Somewhere else</option>
      </select>
      {choice === "other" && <div className="mt-4">
        <label htmlFor="start-search" className="text-[14px] font-semibold">Search for an area</label>
        <div className="mt-2 flex gap-2"><input id="start-search" className="field min-w-0 flex-1" value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }} /><button className="btn btn-line" disabled={busy || query.trim().length < 2} onClick={() => run(async () => { const found = await attempt(() => searchPlacesAction(slug, query)); if (found) setResults(found); })}>Search</button></div>
        {results.map((r, i) => <button key={`${r.name}-${i}`} className="block min-h-11 w-full border-b border-line text-left" onClick={() => { setSelected(r); setQuery(r.name); setResults([]); }}>{r.name}{"area" in r && typeof r.area === "string" ? `, ${r.area}` : ""}</button>)}
        {selected && <p className="mt-2 text-[14px] text-muted">Selected: {selected.name}</p>}
      </div>}
      <button className="btn btn-ink mt-5 w-full" disabled={busy || (choice === "other" && !selected)} onClick={() => run(async () => {
        const res = await attempt(() => saveStart(slug, choice === HOME.name ? null : selected));
        if (!res?.ok) { if (res) toast(res.error); return; }
        setOpen(false); toast("Start point saved");
      })}>Save start point</button>
    </Sheet>
  </>;
}
