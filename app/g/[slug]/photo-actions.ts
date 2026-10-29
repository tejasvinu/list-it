"use server";

import { Binary, MongoServerError } from "mongodb";
import { revalidatePath } from "next/cache";
import { getGroupBySlug, getViewer } from "@/lib/auth";
import { cols, toDoc, type Upload } from "@/lib/db";
import { rid } from "@/lib/ids";
import { freePhotoSlot, PHOTO_CREW_LIMIT, PHOTO_MAX_BYTES, PHOTO_RIDER_LIMIT, PHOTO_THUMB_MAX_BYTES } from "@/lib/validate";
import { inspectPhoto } from "@/lib/photo";

type Result = { ok: true } | { ok: false; error: string };

export async function uploadPhoto(slug: string, destinationId: string, form: FormData): Promise<Result> {
  if (typeof slug !== "string" || typeof destinationId !== "string" || !destinationId || !(form instanceof FormData)) {
    return { ok: false, error: "That photo couldn't be uploaded." };
  }
  const group = await getGroupBySlug(slug);
  const viewer = group && await getViewer(group.id);
  if (!group || !viewer) return { ok: false, error: "Sign in to add a photo." };
  const photo = form.get("photo");
  const thumbnail = form.get("thumb");
  if (!(photo instanceof File) || !(thumbnail instanceof File) ||
    !["image/webp", "image/jpeg"].includes(photo.type) || thumbnail.type !== photo.type ||
    !photo.size || photo.size > PHOTO_MAX_BYTES || !thumbnail.size || thumbnail.size > PHOTO_THUMB_MAX_BYTES) {
    return { ok: false, error: "Use a resized JPEG or WebP under 600 KB." };
  }
  const bytes = Buffer.from(await photo.arrayBuffer());
  const thumb = Buffer.from(await thumbnail.arrayBuffer());
  const dimensions = await inspectPhoto(bytes, thumb, photo.type);
  if (!dimensions) return { ok: false, error: "That image has an invalid format or size." };
  const c = await cols();
  const destination = await c.destinations.findOne({ _id: destinationId, groupId: group.id, deletedAt: null });
  if (!destination) return { ok: false, error: "Ride not found." };
  for (let attempt = 0; attempt < PHOTO_CREW_LIMIT; attempt++) {
    const slots = await c.uploads.find({ groupId: group.id }, {
      projection: { groupSlot: 1, riderSlot: 1, destinationId: 1, riderId: 1 },
    }).toArray();
    const groupSlots = new Set(slots.map((row) => row.groupSlot));
    const riderSlots = new Set(slots.filter((row) => row.destinationId === destinationId && row.riderId === viewer.id).map((row) => row.riderSlot));
    const groupSlot = freePhotoSlot(groupSlots, PHOTO_CREW_LIMIT);
    const riderSlot = freePhotoSlot(riderSlots, PHOTO_RIDER_LIMIT);
    if (riderSlot === undefined) return { ok: false, error: "You can add up to 6 photos per ride." };
    if (groupSlot === undefined) return { ok: false, error: "This crew has reached its 400 photo limit." };
    const upload: Upload = {
      id: rid(), groupId: group.id, destinationId, riderId: viewer.id,
      mime: photo.type, ...dimensions, bytes: new Binary(bytes), thumb: new Binary(thumb),
      groupSlot, riderSlot, createdAt: new Date(),
    };
    try {
      await c.uploads.insertOne(toDoc(upload));
      if (!(await c.destinations.findOne({ _id: destinationId, groupId: group.id, deletedAt: null }, { projection: { _id: 1 } }))) {
        await c.uploads.deleteOne({ _id: upload.id });
        return { ok: false, error: "Ride not found." };
      }
      revalidatePath(`/g/${slug}/d/${destinationId}`);
      return { ok: true };
    } catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
    }
  }
  return { ok: false, error: "Photos are busy. Try again." };
}

export async function deletePhoto(slug: string, photoId: string): Promise<Result> {
  if (typeof slug !== "string" || typeof photoId !== "string" || !photoId) return { ok: false, error: "Photo not found." };
  const group = await getGroupBySlug(slug);
  const viewer = group && await getViewer(group.id);
  if (!group || !viewer) return { ok: false, error: "Sign in to delete a photo." };
  const c = await cols();
  const photo = await c.uploads.findOne({ _id: photoId, groupId: group.id }, { projection: { riderId: 1, destinationId: 1 } });
  if (!photo) return { ok: false, error: "Photo not found." };
  const destination = await c.destinations.findOne({ _id: photo.destinationId, groupId: group.id, deletedAt: null }, { projection: { riderId: 1 } });
  if (!destination || (photo.riderId !== viewer.id && destination.riderId !== viewer.id)) {
    return { ok: false, error: "Only the photographer or ride owner can delete this photo." };
  }
  await c.uploads.deleteOne({ _id: photoId, groupId: group.id });
  revalidatePath(`/g/${slug}/d/${photo.destinationId}`);
  return { ok: true };
}
