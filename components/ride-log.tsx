"use client";
import { useState, useTransition } from "react";
import { logRide, removeRideLog } from "@/app/g/[slug]/actions";
import { prettyDate, todayYmd } from "@/lib/format";
import type { DestinationDetail } from "@/lib/data";
import type { RiderLite } from "@/lib/types";
import { Avatar } from "./avatar";
import { Sheet } from "./sheet";
import { attempt, toast } from "./toast";
import { RiderPhotos } from "./rider-photos";

export function RideLog({ d, slug, me, riders }: { d: DestinationDetail; slug: string; me: RiderLite; riders: RiderLite[] }) {
  const [open, setOpen] = useState(false);
  const own = d.riddenBy.find(r => r.rider.id === me.id);
  const [date, setDate] = useState(own?.date ?? todayYmd());
  const [note, setNote] = useState(own?.note ?? "");
  const [selected, setSelected] = useState<string[]>([me.id]);
  const [busy, run] = useTransition();
  const sorted = [...riders].sort((a, b) => Number(d.interested.some(r => r.id === b.id)) - Number(d.interested.some(r => r.id === a.id)));
  const dates = [...new Set(d.riddenBy.map(r => r.date))];
  const openLog = (planned = false) => { setDate(planned && d.statusDate ? d.statusDate : own?.date ?? todayYmd()); setNote(own?.note ?? ""); setSelected([me.id]); setOpen(true); };
  return <section className="mt-10">
    <div className="flex items-center justify-between gap-3"><h2 className="display text-[28px]">Ride log</h2><button className="btn btn-line !min-h-10" onClick={() => openLog()}>{own ? "Edit your ride" : "Log a ride"}</button></div>
    {d.status === "planned" && d.statusDate && d.statusDate < todayYmd() && (d.owner.id === me.id || d.imIn) && <p className="mt-3 text-[15px] text-muted">Did you ride it on {prettyDate(d.statusDate)}? <button className="font-semibold text-text underline" onClick={() => openLog(true)}>Log it.</button></p>}
    {dates.length === 0 ? <p className="mt-3 text-muted">Nobody has logged a ride here yet.</p> : dates.map(day => <div key={day ?? "unknown"} className="mt-5">
      <h3 className="text-[14px] font-semibold text-muted">{day ? prettyDate(day, { day: "numeric", month: "long", year: "numeric" }) : "Date unknown"}</h3>
      {d.riddenBy.filter(r => r.date === day).map(entry => <div key={entry.rider.id} className="mt-3 flex items-start gap-3"><Avatar rider={entry.rider} size={36} /><div className="min-w-0 flex-1"><p className="font-semibold">{entry.rider.name}</p>{entry.note && <p className="whitespace-pre-wrap text-[15px] text-muted">{entry.note}</p>}
        <div className="mt-2"><RiderPhotos photos={d.uploads.filter(photo => photo.riderId === entry.rider.id)} slug={slug} destinationId={d.id} ownerId={d.owner.id} meId={me.id} allowUpload={entry.rider.id === me.id} compact /></div>
      </div>{(entry.rider.id === me.id || entry.loggedBy === me.id) && <button className="min-h-9 text-[14px] text-danger" disabled={busy} onClick={() => { if (!confirm(`Remove ${entry.rider.name}'s ride log?`)) return; run(async () => { const res = await attempt(() => removeRideLog(slug, d.id, entry.rider.id)); if (res) toast(res.ok ? "Ride removed" : res.error); }); }}>Remove</button>}</div>)}
    </div>)}
    <Sheet open={open} onClose={() => setOpen(false)} title="Log a ride">
      <label className="field flex items-center justify-between"><span>Ridden on</span><input type="date" value={date} max={todayYmd()} onChange={e => setDate(e.target.value)} className="bg-transparent" /></label>
      <p className="mt-5 text-[14px] font-semibold">Who came?</p>
      <div className="max-h-60 overflow-y-auto">{sorted.map(r => <label key={r.id} className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={selected.includes(r.id)} onChange={e => setSelected(e.target.checked ? [...selected, r.id] : selected.filter(id => id !== r.id))} /><Avatar rider={r} size={30} /><span>{r.name}{d.interested.some(i => i.id === r.id) ? " · in" : ""}</span></label>)}</div>
      <label className="mt-4 block text-[14px] font-semibold" htmlFor="ride-note">Your note (optional)</label><textarea id="ride-note" className="field mt-2 min-h-24" value={note} maxLength={500} onChange={e => setNote(e.target.value)} />
      <button className="btn btn-ink mt-5 w-full" disabled={busy || !date || !selected.length} onClick={() => run(async () => { const res = await attempt(() => logRide(slug, d.id, { date, riderIds: selected, note })); if (!res?.ok) { if (res) toast(res.error); return; } setOpen(false); toast("Ride logged"); })}>Save ride</button>
    </Sheet>
  </section>;
}
