import { RideEditorPage } from "@/components/ride-editor-page";
export const metadata = { title: "Edit ride" };
export default async function EditPage({ params, searchParams }: PageProps<"/g/[slug]/d/[id]/edit">) {
  const { slug, id } = await params;
  return <RideEditorPage slug={slug} editKey={id} query={await searchParams} />;
}
