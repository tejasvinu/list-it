import test from "node:test";
import assert from "node:assert/strict";
import { sampleRoute, rankStops } from "./stop-ranking";

test("samples simplified segments at roughly two kilometre intervals", () => {
  const samples = sampleRoute([
    [12, 77],
    [12.1, 77],
  ]);
  assert.ok(samples.length >= 6);
  assert.equal(samples[1].km, 2);
  assert.ok(samples[1].lat > 12 && samples[1].lat < 12.1);
});

test("deduplicates and spreads results while keeping an outbound breakfast", () => {
  const stops = Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    name: `Place ${i}`,
    kind: "breakfast",
    lat: 12 + i / 100,
    lng: 77,
    km: i * 10,
  }));
  const result = rankStops([...stops, { ...stops[4], id: "duplicate" }], 150);
  assert.equal(result.length, 8);
  assert.equal(result[0].km, 30);
  assert.ok(result.some((stop) => stop.km > 250));
  const duplicates = rankStops([stops[4], { ...stops[4], id: "duplicate" }], 150);
  assert.equal(duplicates.length, 1);
});
