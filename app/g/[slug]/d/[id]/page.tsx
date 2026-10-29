import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cols } from "@/lib/db";
import { getDestination, getGroupContext, lite } from "@/lib/data";
import { categoryOf, duration, km } from "@/lib/format";
import { originRoute } from "@/lib/origin-routes";
import { forecast } from "@/lib/weather";
import { getLoops } from "@/lib/loop-data";
import { WeatherBlock } from "@/components/weather-block";
import { DestinationView } from "@/components/destination-view";

export async function generateMetadata({ params }: PageProps<"/g/[slug]/d/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const { group } = await getGroupContext(slug);
  // Read directly so link previews work for WhatsApp, which has no session.
  const d = await (await cols()).destinations.findOne({ _id: id, groupId: group.id, deletedAt: null });
  if (!d) return {};
  const description = `${km(d.distanceKm)} round trip from Bengaluru · ${duration(d.durationMin)} riding · ${categoryOf(d.category).label}${
    d.hairpins ? ` · ${d.hairpins} hairpins` : ""
  }`;
  return { title: d.name, description, openGraph: { title: d.name, description } };
}

export default async function DestinationPage({ params }: PageProps<"/g/[slug]/d/[id]">) {
  const { slug, id } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const [d, loops] = await Promise.all([getDestination(ctx, id), getLoops(ctx)]);
  if (!d) notFound();
  const origin = ctx.viewer.start ? originRoute(d, ctx.viewer.start).catch(() => null) : Promise.resolve(null);
  const weather = forecast(d).catch(() => null);
  return (
    <DestinationView
      d={d}
      slug={slug}
      me={lite(ctx.viewer)}
      riders={ctx.riders}
      originSlot={<Suspense fallback={null}><OriginFact origin={origin} name={ctx.viewer.start?.name} /></Suspense>}
      weatherSlot={<Suspense fallback={<p className="mt-6 text-muted">Loading forecast…</p>}><Forecast d={d} weather={weather} /></Suspense>}
      loops={loops.filter((loop) => loop.riderId === ctx.viewer!.id).map(({ id, name }) => ({ id, name }))}
    />
  );
}

async function OriginFact({ origin, name }: { origin: Promise<Awaited<ReturnType<typeof originRoute>> | null>; name?: string }) {
  const route = await origin;
  if (!route || !name) return null;
  return <p className="num mt-2 text-[15px] text-muted">From {name}: {route.approx ? "about " : ""}{km(route.distanceKm)} round trip, {duration(route.durationMin)}</p>;
}

async function Forecast({ d, weather }: { d: NonNullable<Awaited<ReturnType<typeof getDestination>>>; weather: ReturnType<typeof forecast> }) {
  return <WeatherBlock d={d} weather={await weather} />;
}
