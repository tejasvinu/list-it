import sharp from "sharp";
import { PHOTO_MAX_BYTES, PHOTO_THUMB_MAX_BYTES, validPhotoDimensions } from "./validate";

export type InspectedPhoto = {
  width: number;
  height: number;
  /** Re-encoded bytes: EXIF (including GPS) is stripped and orientation is baked in. */
  bytes: Buffer;
  thumb: Buffer;
};

export async function inspectPhoto(bytes: Buffer, thumb: Buffer, mime: string): Promise<InspectedPhoto | null> {
  try {
    const image = sharp(bytes, { limitInputPixels: 1600 * 1600, failOn: "warning" });
    const small = sharp(thumb, { limitInputPixels: 400 * 400, failOn: "warning" });
    const [meta, thumbMeta] = await Promise.all([image.metadata(), small.metadata()]);
    const format = mime === "image/webp" ? "webp" : mime === "image/jpeg" ? "jpeg" : null;
    if (!format || meta.format !== format || thumbMeta.format !== format || (meta.pages ?? 1) !== 1 || (thumbMeta.pages ?? 1) !== 1 ||
      !validPhotoDimensions(meta.width ?? 0, meta.height ?? 0, 1600) ||
      !validPhotoDimensions(thumbMeta.width ?? 0, thumbMeta.height ?? 0, 400)) return null;
    const width = meta.width!;
    const height = meta.height!;
    const expectedWidth = Math.max(1, Math.round(width * Math.min(1, 400 / Math.max(width, height))));
    const expectedHeight = Math.max(1, Math.round(height * Math.min(1, 400 / Math.max(width, height))));
    if (thumbMeta.width !== expectedWidth || thumbMeta.height !== expectedHeight) return null;
    // Force a decode before trusting the file, then write fresh images. Sharp drops metadata unless
    // withMetadata() is called, so the stored bytes contain no EXIF or location.
    await Promise.all([image.stats(), small.stats()]);
    const quality = format === "jpeg" ? 82 : 80;
    const [clean, cleanThumb] = await Promise.all([
      sharp(bytes, { limitInputPixels: 1600 * 1600, failOn: "warning" }).rotate().toFormat(format, { quality }).toBuffer(),
      sharp(thumb, { limitInputPixels: 400 * 400, failOn: "warning" }).rotate().toFormat(format, { quality }).toBuffer(),
    ]);
    if (clean.length > PHOTO_MAX_BYTES || cleanThumb.length > PHOTO_THUMB_MAX_BYTES) return null;
    const [cleanMeta, cleanThumbMeta] = await Promise.all([
      sharp(clean, { limitInputPixels: 1600 * 1600, failOn: "warning" }).metadata(),
      sharp(cleanThumb, { limitInputPixels: 400 * 400, failOn: "warning" }).metadata(),
    ]);
    if (!validPhotoDimensions(cleanMeta.width ?? 0, cleanMeta.height ?? 0, 1600) ||
      !validPhotoDimensions(cleanThumbMeta.width ?? 0, cleanThumbMeta.height ?? 0, 400)) return null;
    return { width: cleanMeta.width!, height: cleanMeta.height!, bytes: clean, thumb: cleanThumb };
  } catch {
    return null;
  }
}
