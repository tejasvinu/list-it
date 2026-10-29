import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { inspectPhoto } from "./photo";
import { freePhotoSlot, PHOTO_CREW_LIMIT, PHOTO_RIDER_LIMIT, validPhotoDimensions } from "./validate";

async function image(width: number, height: number, format: "jpeg" | "webp" = "webp") {
  return sharp({ create: { width, height, channels: 3, background: "red" } }).toFormat(format).toBuffer();
}

test("photo validation checks actual image formats and dimensions", async () => {
  const full = await image(800, 600);
  const thumb = await image(400, 300);
  assert.deepEqual(await inspectPhoto(full, thumb, "image/webp"), { width: 800, height: 600 });
  assert.equal(await inspectPhoto(full, thumb, "image/jpeg"), null);
  assert.equal(await inspectPhoto(full, await image(400, 200), "image/webp"), null);
  assert.equal(await inspectPhoto(await image(1601, 10), await image(400, 2), "image/webp"), null);
  assert.equal(await inspectPhoto(full.subarray(0, 20), thumb, "image/webp"), null);
  assert.deepEqual(await inspectPhoto(await image(50, 60, "jpeg"), await image(50, 60, "jpeg"), "image/jpeg"), { width: 50, height: 60 });
  assert.equal(validPhotoDimensions(0, 10, 1600), false);
  assert.equal(validPhotoDimensions(100.5, 10, 1600), false);
});

test("photo slots enforce both quotas and reuse deleted slots", () => {
  assert.equal(freePhotoSlot([0, 1, 3], PHOTO_RIDER_LIMIT), 2);
  assert.equal(freePhotoSlot([0, 1, 2, 3, 4, 5], PHOTO_RIDER_LIMIT), undefined);
  assert.equal(freePhotoSlot(Array.from({ length: PHOTO_CREW_LIMIT }, (_, index) => index), PHOTO_CREW_LIMIT), undefined);
});
