import { redirect } from "next/navigation";
export default async function NewLoopPage({ params, searchParams }: PageProps<"/g/[slug]/loops/new">) {
  const { slug } = await params;
  const { ride } = await searchParams;
  redirect(`/g/${slug}/new${typeof ride === "string" ? `?ride=${encodeURIComponent(ride)}` : ""}`);
}
