import Link from "next/link";
export function FeedSwitch({ slug, current }: { slug: string; current: "rides" | "loops" }) {
  return (
    <nav aria-label="Rides and loops" className="mt-4 flex gap-6 border-b border-line text-[16px] font-semibold">
      <Link
        href={`/g/${slug}`}
        aria-current={current === "rides" ? "page" : undefined}
        className={`pb-2 ${current === "rides" ? "border-b-2 border-text" : "text-muted"}`}
      >
        Rides
      </Link>
      <Link
        href={`/g/${slug}/loops`}
        aria-current={current === "loops" ? "page" : undefined}
        className={`pb-2 ${current === "loops" ? "border-b-2 border-text" : "text-muted"}`}
      >
        Loops
      </Link>
    </nav>
  );
}
