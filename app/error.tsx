"use client";

import { useEffect } from "react";
import { Milestone } from "@/components/milestone";

/** Anything that breaks below the root layout: a dropped connection, a session signed out from another phone. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6">
      <Milestone name="Detour" distanceKm={0} split={null} size={20} className="self-start" />
      <h1 className="display mt-8 text-[56px] leading-[0.9]">Road closed</h1>
      <p className="mt-3 text-[17px] text-muted">
        Something didn&apos;t load. If you&apos;re on patchy signal, try again in a moment. If you changed your PIN on another phone, you&apos;ll be asked for it.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={() => retry()} className="btn btn-ink">
          Try again
        </button>
        <button onClick={() => location.reload()} className="btn btn-line">
          Reload the page
        </button>
      </div>
    </main>
  );
}
