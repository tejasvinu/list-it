import { notFound } from "next/navigation";
import { cols, fromDoc, type Rider } from "@/lib/db";
import { getFeed, getGroupContext, lite } from "@/lib/data";
import { originKey } from "@/lib/origin-routes";
import { ProfileView } from "@/components/profile-view";

export default async function RiderPage({ params }: PageProps<"/g/[slug]/r/[riderId]">) {
  const { slug, riderId } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const rider = fromDoc<Rider>(await (await cols()).riders.findOne({ _id: riderId, groupId: ctx.group.id, removedAt: null }));
  if (!rider) notFound();

  const feed = await getFeed(ctx);
  const added = feed.filter((d) => d.riderId === rider.id);
  const rode = (d: (typeof feed)[number]) => d.riddenBy.some((r) => r.rider.id === rider.id);
  const imIn = feed.filter((d) => d.interested.some((r) => r.id === rider.id) && !rode(d));
  const ridden = feed.filter(rode).sort((a, b) => (b.riddenBy.find(r => r.rider.id === rider.id)?.date ?? "").localeCompare(a.riddenBy.find(r => r.rider.id === rider.id)?.date ?? ""));
  const routes = rider.start ? await (await cols()).originRoutes.find({ destinationId: { $in: ridden.map(d => d.id) }, ...originKey(rider.start) }).toArray() : [];
  const historyKm = Object.fromEntries(ridden.map(d => [d.id, routes.find(r => r.destinationId === d.id && r.destinationLat === d.lat && r.destinationLng === d.lng)?.distanceKm ?? d.distanceKm]));

  return (
    <ProfileView
      slug={slug}
      rider={lite(rider)}
      isMe={rider.id === ctx.viewer.id}
      joinedAt={rider.createdAt.getTime()}
      added={added}
      imIn={imIn}
      ridden={ridden}
      historyKm={historyKm}
      rideIds={feed.map(d => d.id)}
    />
  );
}

export async function generateMetadata({ params }: PageProps<"/g/[slug]/r/[riderId]">) {
  const { slug, riderId } = await params;
  const ctx = await getGroupContext(slug);
  return { title: ctx.riders.find((r) => r.id === riderId)?.name ?? "Rider" };
}
