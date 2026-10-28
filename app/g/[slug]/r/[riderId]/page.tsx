import { notFound } from "next/navigation";
import { cols, fromDoc, type Rider } from "@/lib/db";
import { getFeed, getGroupContext, lite } from "@/lib/data";
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
  const ridden = feed.filter(rode);

  return (
    <ProfileView
      slug={slug}
      rider={lite(rider)}
      isMe={rider.id === ctx.viewer.id}
      joinedAt={rider.createdAt.getTime()}
      added={added}
      imIn={imIn}
      ridden={ridden}
    />
  );
}

export async function generateMetadata({ params }: PageProps<"/g/[slug]/r/[riderId]">) {
  const { slug, riderId } = await params;
  const ctx = await getGroupContext(slug);
  return { title: ctx.riders.find((r) => r.id === riderId)?.name ?? "Rider" };
}
