import { notFound, redirect } from "next/navigation";
import { getDestination, getGroupContext } from "@/lib/data";
import { DestinationForm } from "@/components/destination-form";
import { suggestCategory, type Category } from "@/lib/config";

export const metadata = { title: "Edit ride" };

export default async function EditPage({ params }: PageProps<"/g/[slug]/d/[id]/edit">) {
  const { slug, id } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const d = await getDestination(ctx, id);
  if (!d) notFound();
  if (d.owner.id !== ctx.viewer.id) redirect(`/g/${slug}/d/${id}`);

  return (
    <DestinationForm
      slug={slug}
      editId={id}
      initial={{
        name: d.name,
        preview: {
          name: d.name,
          area: d.area,
          lat: d.lat,
          lng: d.lng,
          mapsUrl: d.mapsUrl,
          distanceKm: d.distanceKm,
          durationMin: d.durationMin,
          approx: d.approx,
          route: d.route,
          roadSplit: d.roadSplit,
          photos: d.photos,
          suggested: suggestCategory(d.distanceKm),
          nearby: [],
        },
        details: {
          category: d.category as Category,
          tags: d.tags,
          seasons: d.seasons,
          hairpins: d.hairpins,
          notes: d.notes ?? "",
          status: d.status,
          statusDate: d.statusDate,
          rideReport: d.rideReport ?? "",
        },
      }}
    />
  );
}
