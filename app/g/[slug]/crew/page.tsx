import Link from "next/link";
import { ChevronRight, Lock, UserPlus } from "lucide-react";
import { getGroupContext, getRiderCounts } from "@/lib/data";
import { Avatar } from "@/components/avatar";
import { BackButton } from "@/components/back-button";

export const metadata = { title: "Crew" };

export default async function CrewPage({ params }: PageProps<"/g/[slug]/crew">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const countsFor = await getRiderCounts(ctx);
  const closes = ctx.group.registrationClosesAt;

  return (
    <div>
      <header className="topbar flex items-center gap-2 px-2 pb-2 pt-[max(env(safe-area-inset-top),10px)] lg:static lg:bg-transparent lg:px-0 lg:pt-8 lg:shadow-none">
        <BackButton fallback={`/g/${slug}`} />
        <h1 className="display text-[30px] lg:text-[44px]">The crew</h1>
        <span className="num display text-[30px] text-faint lg:text-[44px]">{ctx.riders.length}</span>
      </header>

      <div className="mx-4 mt-4 flex items-start gap-3 rounded-panel bg-surface p-4 text-[15px] lg:mx-0">
        {ctx.registrationOpen ? <UserPlus size={18} className="mt-0.5 shrink-0" /> : <Lock size={18} className="mt-0.5 shrink-0 text-faint" />}
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

      <ul className="mt-4 lg:-mx-3">
        {ctx.riders.map((r) => {
          const { added, ridden } = countsFor(r.id);
          return (
            <li key={r.id}>
              <Link href={`/g/${slug}/r/${r.id}`} className="flex items-center gap-4 rounded-panel px-4 py-3 transition-colors hover:bg-surface lg:px-3">
                <Avatar rider={r} size={46} />
                <div className="flex-1">
                  <p className="text-[17px] font-semibold">
                    {r.name}
                    {r.id === ctx.viewer!.id && <span className="ml-2 text-[14px] font-normal text-faint">you</span>}
                  </p>
                  <p className="num text-[14px] text-muted">
                    {added} added, {ridden} ridden
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
