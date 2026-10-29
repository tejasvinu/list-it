import { notFound, redirect } from "next/navigation";
import { getDestination, getGroupContext } from "@/lib/data";
import { DestinationForm } from "@/components/destination-form";
import { suggestCategory, type Category } from "@/lib/config";
import { sealRoute } from "@/lib/seal";

export const metadata = { title: "Edit ride" };

export default async function EditPage({ params }: PageProps<"/g/[slug]/d/[id]/edit">) {
  const { slug, id } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const d = await getDestination(ctx, id);
  if (!d) notFound();
  if (d.owner.id !== ctx.viewer.id && !d.ownerGone) redirect(`/g/${slug}/d/${id}`);
  // The form's "Ridden" means the person editing has ridden it.
  const myRide = d.riddenBy.find((r) => r.rider.id === ctx.viewer!.id);
  const routed = {
    lat: d.lat,
    lng: d.lng,
    mapsUrl: d.mapsUrl,
    distanceKm: d.distanceKm,
    durationMin: d.durationMin,
    approx: d.approx,
    route: d.route,
    roadSplit: d.roadSplit,
  };

  return (
    <DestinationForm
      slug={slug}
      editId={id}
      initial={{
        name: d.name,
        preview: {
          ...routed,
          name: d.name,
          area: d.area,
          photos: d.photos,
          photosFailed: false,
          suggested: suggestCategory(d.distanceKm),
          nearby: [],
          seal: sealRoute(routed),
        },
        details: {
          category: d.category as Category,
          tags: d.tags,
          seasons: d.seasons,
          hairpins: d.hairpins,
          notes: d.notes ?? "",
          status: myRide ? "done" : d.status,
          statusDate: myRide ? myRide.date : d.statusDate,
          rideReport: d.rideReport ?? "",
        },
      }}
    />
  );
}
