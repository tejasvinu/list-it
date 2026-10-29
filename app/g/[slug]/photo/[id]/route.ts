import { getGroupBySlug, getViewer } from "@/lib/auth";
import { cols } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const group = await getGroupBySlug(slug);
  if (!group || !(await getViewer(group.id))) return new Response("Not found", { status: 404 });
  const c = await cols();
  const photo = await c.uploads.findOne({ _id: id, groupId: group.id });
  if (!photo || !(await c.destinations.findOne({ _id: photo.destinationId, groupId: group.id, deletedAt: null }, { projection: { _id: 1 } }))) {
    return new Response("Not found", { status: 404 });
  }
  const isThumb = new URL(request.url).searchParams.get("thumb") === "1";
  const etag = `"${id}-${isThumb ? "thumb" : "full"}"`;
  const headers = {
    "Content-Type": photo.mime,
    "Cache-Control": "private, max-age=31536000, immutable",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const data = isThumb ? photo.thumb : photo.bytes;
  return new Response(new Uint8Array(data.buffer), { headers });
}
