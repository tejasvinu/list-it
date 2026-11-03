import RideImage from "@/components/ride-opengraph";
import { loopKey } from "@/lib/ride-model";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ride preview";
export default async function Image({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  return RideImage({ params: Promise.resolve({ slug, id: loopKey(id) }) });
}
