import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cols } from "@/lib/db";
import { getDestination, getGroupContext, lite } from "@/lib/data";
import { categoryOf, duration, km } from "@/lib/format";
import { originRoute } from "@/lib/origin-routes";
import { forecast } from "@/lib/weather";
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
  const d = await getDestination(ctx, id);
  if (!d) notFound();
  const [origin, weather] = await Promise.all([ctx.viewer.start ? originRoute(d, ctx.viewer.start) : null, forecast(d)]);
  return <DestinationView d={{ ...d, fromYou: origin && ctx.viewer.start ? { name: ctx.viewer.start.name, distanceKm: origin.distanceKm, durationMin: origin.durationMin, approx: origin.approx } : null }} slug={slug} me={lite(ctx.viewer)} riders={ctx.riders} weather={weather} />;
}
