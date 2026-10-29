import { getFeed, getGroupContext } from "@/lib/data";
import { getLoops } from "@/lib/loop-data";
import { CrewMapView } from "@/components/crew-map-view";

export const metadata = { title: "Map" };

export default async function MapPage({ params }: PageProps<"/g/[slug]/map">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const [items, loops] = await Promise.all([getFeed(ctx), getLoops(ctx)]);
  return <CrewMapView slug={slug} items={items} loops={loops.map(({ id, route }) => ({ id, route }))} />;
}
