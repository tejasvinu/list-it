import { RideEditorPage } from "@/components/ride-editor-page";
export const metadata = { title: "New ride" };
export default async function NewPage({ params, searchParams }: PageProps<"/g/[slug]/new">) {
  const { slug } = await params;
  return <RideEditorPage slug={slug} query={await searchParams} />;
}
