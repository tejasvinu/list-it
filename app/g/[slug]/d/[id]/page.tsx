import type { Metadata } from "next";
import { cols } from "@/lib/db";
import { getGroupContext } from "@/lib/data";
import { categoryOf, duration, km } from "@/lib/format";
import { RideDetailPage } from "@/components/ride-detail-page";

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
  return <RideDetailPage slug={slug} rideKey={id} />;
}
