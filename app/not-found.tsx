import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl">🛞</p>
      <h1 className="mt-4 font-display text-3xl font-bold">Wrong turn</h1>
      <p className="mt-2 text-muted">That link doesn&apos;t lead anywhere. It may have been mistyped, or the ride was deleted.</p>
      <Link href="/" className="mt-6 rounded-full bg-surface-2 px-5 py-2.5 font-semibold">
        Home
      </Link>
    </main>
  );
}
