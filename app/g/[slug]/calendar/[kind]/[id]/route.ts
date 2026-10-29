import { getGroupBySlug, getViewer } from "@/lib/auth";
import { cols } from "@/lib/db";
import { calendarEvent } from "@/lib/calendar";
import { googleMapsPlace } from "@/lib/format";
import { loopDays } from "@/lib/loops";
import { validDate } from "@/lib/validate";

export async function GET(request: Request, { params }: RouteContext<"/g/[slug]/calendar/[kind]/[id]">) {
  const { slug, kind, id } = await params;
  const group = await getGroupBySlug(slug);
  if (!group || !(await getViewer(group.id))) return new Response("Not found", { status: 404 });
  const c = await cols();
  const origin = new URL(request.url).origin;
  let event: Parameters<typeof calendarEvent>[0];
  if (kind === "ride") {
    const ride = await c.destinations.findOne({ _id: id, groupId: group.id, deletedAt: null, status: "planned" });
    if (!validDate(ride?.statusDate)) return new Response("Not found", { status: 404 });
    event = {
      id,
      title: ride.name,
      date: ride.statusDate,
      days: 1,
      maps: ride.mapsUrl ?? googleMapsPlace(ride.lat, ride.lng),
      link: `${origin}/g/${slug}/d/${id}`,
    };
  } else if (kind === "loop") {
    const loop = await c.loops.findOne({ _id: id, groupId: group.id, deletedAt: null });
    if (!validDate(loop?.startDate)) return new Response("Not found", { status: 404 });
    const point = (lat: number, lng: number) => `${lat},${lng}`;
    const maps = new URL("https://www.google.com/maps/dir/");
    maps.searchParams.set("api", "1");
    maps.searchParams.set("origin", point(loop.start.lat, loop.start.lng));
    maps.searchParams.set("destination", point(loop.start.lat, loop.start.lng));
    maps.searchParams.set("waypoints", loop.stops.map((stop) => point(stop.lat, stop.lng)).join("|"));
    maps.searchParams.set("travelmode", "driving");
    event = {
      id: `loop-${id}`,
      title: loop.name,
      date: loop.startDate,
      days: Math.max(1, loopDays(loop.start, loop.stops, loop.legs).length),
      maps: maps.toString(),
      link: `${origin}/g/${slug}/loops/${id}`,
    };
  } else return new Response("Not found", { status: 404 });
  return new Response(calendarEvent(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="ride.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
