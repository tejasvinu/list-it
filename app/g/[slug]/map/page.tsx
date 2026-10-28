import { getFeed, getGroupContext } from "@/lib/data";
import { CrewMapView } from "@/components/crew-map-view";

export const metadata = { title: "Map" };

export default async function MapPage({ params }: PageProps<"/g/[slug]/map">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const items = await getFeed(ctx);
  return <CrewMapView slug={slug} items={items} />;
}
