import Link from "next/link";
import { Milestone } from "@/components/milestone";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6">
      <Milestone name="Nowhere" distanceKm={0} split={null} size={20} className="self-start" />
      <h1 className="display mt-8 text-[56px] leading-[0.9]">Wrong turn</h1>
      <p className="mt-3 text-[17px] text-muted">That link doesn&apos;t lead anywhere. It may have been mistyped, or the ride was deleted.</p>
      <Link href="/" className="btn btn-ink mt-8 self-start">
        Back to list-it
      </Link>
    </main>
  );
}
