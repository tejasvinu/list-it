"use client";
import Link from "next/link";
import { useState } from "react";
import { rideHref } from "@/lib/ride-model";
import type { LoopStop } from "@/lib/types";
import { Sheet } from "./sheet";

/** Compatibility component name; the product only exposes rides and itinerary places. */
export function AddToLoop({ slug, rideId, loops, places }: { slug: string; rideId: string; loops: { id: string; name: string }[]; places?: LoopStop[] }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(0);
  const seed = `${encodeURIComponent(rideId)}${places ? `&place=${place}` : ""}`;
  return <>
    <button className="btn btn-line" onClick={() => setOpen(true)}>Use in a ride</button>
    <Sheet open={open} onClose={() => setOpen(false)} title="Use this place in a ride">
      {places && <label className="mb-4 block text-[15px] font-semibold">Choose an itinerary place<select className="field mt-2" value={place} onChange={event => setPlace(Number(event.target.value))}>{places.map((stop, index) => <option key={index} value={index}>{stop.name}</option>)}</select></label>}
      <Link href={`/g/${slug}/new?ride=${seed}`} className="btn btn-ink w-full">Start a new ride here</Link>
      {loops.length > 0 && <><p className="mt-5 text-muted">Or add the place to one of your rides:</p><ul className="mt-2">{loops.map(ride => <li key={ride.id}><Link href={`${rideHref(slug, ride.id)}/edit?add=${seed}`} className="flex min-h-12 items-center border-b border-line font-semibold">{ride.name}</Link></li>)}</ul></>}
      <p className="mt-4 text-[14px] text-muted">Review the itinerary before saving. Each ride keeps its own comments, photos and history.</p>
    </Sheet>
  </>;
}
