import { getFeed, getGroupContext, lite } from "@/lib/data";
import { FeedView } from "@/components/feed-view";

export default async function FeedPage({ params }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const items = await getFeed(ctx);
  return (
    <FeedView
      slug={slug}
      groupName={ctx.group.name}
      items={items}
      riders={ctx.riders}
      me={lite(ctx.viewer)}
      inviteOpen={ctx.registrationOpen}
      closesAt={ctx.group.registrationClosesAt.getTime()}
    />
  );
}
