import { RideEditorPage } from "@/components/ride-editor-page";
import { loopKey } from "@/lib/ride-model";
export const metadata = { title: "Edit ride" };
export default async function EditLoopPage({ params, searchParams }: PageProps<"/g/[slug]/loops/[id]/edit">) {
  const { slug, id } = await params;
  return <RideEditorPage slug={slug} editKey={loopKey(id)} query={await searchParams} />;
}
