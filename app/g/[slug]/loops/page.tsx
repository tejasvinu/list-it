import Link from "next/link";
import { getGroupContext } from "@/lib/data";
import { getLoops } from "@/lib/loop-data";
import { loopDays } from "@/lib/loops";
import { duration, km } from "@/lib/format";
import { AvatarStack } from "@/components/avatar";
import { RouteArt } from "@/components/route-art";
import { FeedSwitch } from "@/components/feed-switch";

export const metadata = { title: "Loops" };
export default async function LoopsPage({ params }: PageProps<"/g/[slug]/loops">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const loops = await getLoops(ctx);
  return (
    <div className="px-4 pb-12 lg:px-0">
      <header className="pt-5 lg:pt-10">
        <h1 className="display text-[30px] lg:text-[44px]">{ctx.group.name}</h1>
        <FeedSwitch slug={slug} current="loops" />
      </header>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="display text-[32px]">Loops</h2>
        <Link href={`/g/${slug}/loops/new`} className="btn btn-ink">
          Add a loop
        </Link>
      </div>
      {!loops.length && (
        <div className="py-16">
          <p className="display text-[28px]">No loops yet</p>
          <p className="mt-2 text-muted">Join a few rides together and make a circuit.</p>
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {loops.map((loop) => (
          <Link href={`/g/${slug}/loops/${loop.id}`} key={loop.id} className="overflow-hidden rounded-panel bg-surface">
            <RouteArt id={loop.id} route={loop.route} category="multi" className="h-48 w-full bg-surface-2" />
            <div className="p-4">
              <h3 className="display text-[30px]">{loop.name}</h3>
              <p className="num text-muted">
                {loopDays(loop.start, loop.stops, loop.legs).length} days ·{" "}
                {loop.legs.some((l) => l.approx) ? "about " : ""}
                {km(loop.totalKm)} · {duration(loop.totalMin)}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <AvatarStack riders={loop.interested} />
                <span className="text-[14px] text-muted">
                  {loop.interested.length ? `${loop.interested.length} in` : "Nobody in yet"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
