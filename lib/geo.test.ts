import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePolyline, olcRecover, parseMapsUrl, PLUS_CODE, roadSplitOf, simplify } from "./geo";

test("parseMapsUrl takes the last exact pin over the viewport", () => {
  const p = parseMapsUrl("https://www.google.com/maps/place/Yercaud/@11.77,78.20,13z/data=!3d11.1!4d78.1!3d11.7747614!4d78.2093355");
  assert.equal(p.lat, 11.7747614);
  assert.equal(p.lng, 78.2093355);
  assert.equal(p.text, "Yercaud");
});

test("parseMapsUrl keeps the viewport and its zoom alongside a name", () => {
  const p = parseMapsUrl("https://www.google.com/maps/search/Madikeri,+Karnataka/@12.4244,75.7382,13z");
  assert.equal(p.text, "Madikeri, Karnataka");
  assert.equal(p.lat, undefined);
  assert.deepEqual(p.view, { lat: 12.4244, lng: 75.7382, zoom: 13 });
});

test("parseMapsUrl falls back to the viewport when there's no name", () => {
  const p = parseMapsUrl("https://www.google.com/maps/@13.37,77.68,15z");
  assert.equal(p.lat, 13.37);
  assert.equal(p.lng, 77.68);
});

test("parseMapsUrl reads coordinates from ?q=", () => {
  const p = parseMapsUrl("https://maps.google.com/?q=13.3702,77.6835");
  assert.equal(p.lat, 13.3702);
  assert.equal(p.lng, 77.6835);
  assert.equal(p.text, undefined);
});

test("parseMapsUrl uses the last stop of a directions link", () => {
  const p = parseMapsUrl("https://www.google.com/maps/dir/Bengaluru/Nandi+Hills/@13.2,77.6,10z");
  assert.equal(p.text, "Nandi Hills");
});

test("PLUS_CODE splits a code from its locality", () => {
  const m = "Q4XQ+2C Kotagiri, Tamil Nadu".match(PLUS_CODE);
  assert.ok(m);
  assert.equal(m[1], "Q4XQ+2C");
  assert.equal(m[2], "Kotagiri, Tamil Nadu");
  assert.equal("hello there".match(PLUS_CODE), null);
});

test("olcRecover matches the Open Location Code reference example", () => {
  // From the spec: 9C3W9QCJ+2VX centres on 51.3701125, -1.217765625. Recover it from the short form.
  for (const code of ["9C3W9QCJ+2VX", "9QCJ+2VX"]) {
    const { lat, lng } = olcRecover(code, 51.3708675, -1.217765625);
    assert.ok(Math.abs(lat - 51.3701125) < 1e-6, `${code} lat ${lat}`);
    assert.ok(Math.abs(lng - -1.217765625) < 1e-6, `${code} lng ${lng}`);
  }
});

test("decodePolyline decodes Google's reference example", () => {
  assert.deepEqual(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@"), [
    [38.5, -120.2],
    [40.7, -120.95],
    [43.252, -126.453],
  ]);
});

test("simplify keeps the ends and drops points on a straight line", () => {
  const line: [number, number][] = [
    [0, 0],
    [0.5, 0.5],
    [1, 1],
    [2, 2],
  ];
  assert.deepEqual(simplify(line, 0.001), [
    [0, 0],
    [2, 2],
  ]);
});

test("roadSplitOf buckets steps by road class, with the city first", () => {
  const split = roadSplitOf([
    { distance: 10000, ref: "NH 44", maneuver: { location: [77.6, 12.98] } }, // inside the city
    { distance: 50000, ref: "NH 44;AH 43", maneuver: { location: [77.8, 13.4] } },
    { distance: 20000, ref: "SH 9", maneuver: { location: [77.2, 13.6] } },
    { distance: 5000, maneuver: { location: [77.0, 13.8] } },
  ]);
  assert.deepEqual(split, { city: 10, nh: 50, sh: 20, other: 5 });
});
