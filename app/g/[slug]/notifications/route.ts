import { getGroupBySlug, getViewer } from "@/lib/auth";
import { cols } from "@/lib/db";

export async function GET(_request: Request, { params }: RouteContext<"/g/[slug]/notifications">) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  const viewer = group && (await getViewer(group.id));
  if (!group || !viewer) return new Response("Not found", { status: 404 });
  const c = await cols();
  const rows = await c.notifications
    .find({ groupId: group.id, riderId: viewer.id, readAt: null })
    .sort({ createdAt: -1 })
    .limit(120)
    .toArray();
  return Response.json(
    { count: rows.length, latest: rows[0]?._id ?? null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
