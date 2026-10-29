"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addRideToLoop } from "@/app/g/[slug]/loop-actions";
import { Sheet } from "./sheet";
import { attempt, toast } from "./toast";
export function AddToLoop({
  slug,
  rideId,
  loops,
}: {
  slug: string;
  rideId: string;
  loops: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      <button className="btn btn-line" onClick={() => setOpen(true)}>
        Add to a loop
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add to a loop">
        <Link className="btn btn-ink w-full" href={`/g/${slug}/loops/new?ride=${encodeURIComponent(rideId)}`}>
          Start a new loop
        </Link>
        {loops.length ? (
          <>
            <p className="mt-5 text-muted">Or add this ride to one of your loops:</p>
            <ul className="mt-2">
              {loops.map((loop) => (
                <li key={loop.id}>
                  <button
                    className="min-h-12 w-full border-b border-line text-left font-semibold"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const result = await attempt(() => addRideToLoop(slug, loop.id, rideId));
                      if (result?.ok) {
                        setOpen(false);
                        router.push(`/g/${slug}/loops/${loop.id}`);
                      } else if (result) toast(result.error);
                      setBusy(false);
                    }}
                  >
                    {loop.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 text-muted">You haven’t made a loop yet.</p>
        )}
      </Sheet>
    </>
  );
}
