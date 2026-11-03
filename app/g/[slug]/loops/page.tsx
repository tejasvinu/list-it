import { redirect } from "next/navigation";
export default async function LoopsPage({ params }: PageProps<"/g/[slug]/loops">) {
  const { slug } = await params;
  redirect(`/g/${slug}`);
}
