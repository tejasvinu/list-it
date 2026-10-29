import sharp from "sharp";
import { validPhotoDimensions } from "./validate";

export async function inspectPhoto(bytes: Buffer, thumb: Buffer, mime: string) {
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
    await Promise.all([image.stats(), small.stats()]);
    return { width, height };
  } catch {
    return null;
  }
}
