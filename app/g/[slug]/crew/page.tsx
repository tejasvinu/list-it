import Link from "next/link";
import { ChevronRight, Lock, UserPlus } from "lucide-react";
import { getFeed, getGroupContext } from "@/lib/data";
import { Avatar } from "@/components/avatar";
import { BackButton } from "@/components/back-button";

export const metadata = { title: "Crew" };

export default async function CrewPage({ params }: PageProps<"/g/[slug]/crew">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const feed = await getFeed(ctx);
  const closes = ctx.group.registrationClosesAt;

  return (
    <div>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/80 px-3 py-2.5 backdrop-blur-xl">
        <BackButton fallback={`/g/${slug}`} />
        <h1 className="font-display text-xl font-bold">The crew</h1>
        <span className="text-faint">{ctx.riders.length}</span>
      </header>

      <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-sm">
        {ctx.registrationOpen ? <UserPlus size={18} className="mt-0.5 text-accent" /> : <Lock size={18} className="mt-0.5 text-faint" />}
        <p className="text-muted">
          {ctx.registrationOpen ? (
            <>
              Joining is open until{" "}
              <span className="font-semibold text-text">
                {closes.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
              </span>
              . Anyone with the link can set a name and PIN.
            </>
          ) : (
            "Joining is closed. New riders get added by the admin."
          )}
        </p>
      </div>

      <ul className="mt-2">
        {ctx.riders.map((r) => {
          const added = feed.filter((d) => d.riderId === r.id).length;
          const ridden = feed.filter((d) => d.riddenBy.some((x) => x.rider.id === r.id)).length;
          return (
            <li key={r.id}>
              <Link href={`/g/${slug}/r/${r.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface">
                <Avatar rider={r} size={46} />
                <div className="flex-1">
                  <p className="font-semibold">
                    {r.name}
                    {r.id === ctx.viewer!.id && <span className="ml-1.5 text-xs font-normal text-faint">you</span>}
                  </p>
                  <p className="text-[13px] text-faint">
                    {added} added · {ridden} ridden
                  </p>
                </div>
                <ChevronRight size={18} className="text-faint" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
