import { getGroupContext } from "@/lib/data";
import { DestinationForm } from "@/components/destination-form";

export const metadata = { title: "New ride" };

export default async function NewPage({ params }: PageProps<"/g/[slug]/new">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  return <DestinationForm slug={slug} />;
}
