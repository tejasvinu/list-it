import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePolyline, olcRecover, parseMapsRoute, parseMapsUrl, PLUS_CODE, roadSplitOf, simplify } from "./geo";

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

/** Google's polyline encoding, for building step geometries in tests. */
function encode(points: [number, number][]) {
  let out = "";
  const prev = [0, 0];
  for (const p of points) {
    for (const i of [0, 1]) {
      const v = Math.round(p[i] * 1e5);
      let n = v - prev[i];
      prev[i] = v;
      n = n < 0 ? ~(n << 1) : n << 1;
      while (n >= 0x20) {
        out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
        n >>= 5;
      }
      out += String.fromCharCode(n + 63);
    }
  }
  return out;
}

test("roadSplitOf counts only the part of a highway step inside the city as city", () => {
  // 100 km due north on NH 44 from the centre: the first ~22 km are in the city radius.
  const line: [number, number][] = Array.from({ length: 101 }, (_, i) => [12.9716 + (i * 0.9) / 100, 77.5946]);
  const split = roadSplitOf([{ distance: 100000, ref: "NH 44", geometry: encode(line), maneuver: { location: [77.5946, 12.9716] } }]);
  assert.ok(split.city >= 20 && split.city <= 25, `city ${split.city}`);
  assert.equal(split.city + split.nh, 100);
});

// Three named stops, each with its exact pin in the data blob (!2m2!1d<lng>!2d<lat>).
const TRIP =
  "https://www.google.com/maps/dir/Bengaluru,+Karnataka/Yercaud,+Tamil+Nadu/Mettur,+Tamil+Nadu/@12.1,78.0,8z" +
  "/data=!3m1!4b1!4m20!4m19" +
  "!1m5!1m1!1s0x3bae1670c9b44e6d:0xf8dfc3e8517e4fe0!2m2!1d77.5945627!2d12.9715987" +
  "!1m5!1m1!1s0x3babf0d1b6b9e8c3:0x9d0c4e1c3b1b0f1a!2m2!1d78.2093355!2d11.7747614" +
  "!1m5!1m1!1s0x3babcf1a1e4d3b39:0x6f2a1c8a8b1c9d2e!2m2!1d77.8008!2d11.7863" +
  "!3e0";

test("parseMapsRoute reads every stop of a directions link with its pin", () => {
  const r = parseMapsRoute(TRIP);
  assert.deepEqual(
    r.waypoints.map((w) => [w.text, w.lat, w.lng]),
    [
      ["Bengaluru, Karnataka", 12.9715987, 77.5945627],
      ["Yercaud, Tamil Nadu", 11.7747614, 78.2093355],
      ["Mettur, Tamil Nadu", 11.7863, 77.8008],
    ],
  );
  assert.deepEqual(r.view, { lat: 12.1, lng: 78.0, zoom: 8 });
});

test("parseMapsRoute ignores dragged via points and reads coordinate stops", () => {
  const r = parseMapsRoute(
    "https://www.google.com/maps/dir/Yercaud/12.5,77.9/@12,78,9z/data=!4m14!4m13" +
      "!1m10!1m1!1s0x3babf0d1b6b9e8c3:0x9d0c4e1c3b1b0f1a!2m2!1d78.2093355!2d11.7747614!3m4!1m2!1d78.01!2d12.2!3s0x1:0x2" +
      "!1m0!3e0",
  );
  assert.deepEqual(
    r.waypoints.map((w) => [w.text, w.lat, w.lng]),
    [
      ["Yercaud", 11.7747614, 78.2093355],
      [undefined, 12.5, 77.9],
    ],
  );
});

test("parseMapsRoute keeps an empty 'your location' stop as blank, and names without data", () => {
  const r = parseMapsRoute("https://www.google.com/maps/dir//Nandi+Hills/Skandagiri/");
  assert.deepEqual(
    r.waypoints.map((w) => [w.text, w.lat]),
    [
      [undefined, undefined],
      ["Nandi Hills", undefined],
      ["Skandagiri", undefined],
    ],
  );
});

test("parseMapsRoute reads the api=1 form with waypoints", () => {
  const r = parseMapsRoute(
    "https://www.google.com/maps/dir/?api=1&origin=Bengaluru&destination=Mettur&waypoints=Yercaud%7C11.9,78.1",
  );
  assert.deepEqual(
    r.waypoints.map((w) => [w.text, w.lat, w.lng]),
    [
      ["Bengaluru", undefined, undefined],
      ["Yercaud", undefined, undefined],
      [undefined, 11.9, 78.1],
      ["Mettur", undefined, undefined],
    ],
  );
});

test("parseMapsRoute finds no stops in a place link", () => {
  assert.equal(parseMapsRoute("https://www.google.com/maps/place/Yercaud/@11.77,78.20,13z").waypoints.length, 0);
});

test("parseMapsRoute reads a real directions link copied from the address bar", () => {
  const r = parseMapsRoute(
    "https://www.google.com/maps/dir/Bengaluru,+Karnataka/Goa/Mangaluru,+Karnataka/Bengaluru,+Karnataka/@14.0541068,75.5910494,414008m" +
      "/data=!3m1!1e3!4m26!4m25!1m5!1m1!1s0x3bae1670c9b44e6d:0xf8dfc3e8517e4fe0!2m2!1d77.57754!2d12.9628957" +
      "!1m5!1m1!1s0x3bbfba106336b741:0xeaf887ff62f34092!2m2!1d74.123996!2d15.2993265" +
      "!1m5!1m1!1s0x3ba35a4c37bf488f:0x827bbc7a74fcfe64!2m2!1d74.8388112!2d12.8854777" +
      "!1m5!1m1!1s0x3bae1670c9b44e6d:0xf8dfc3e8517e4fe0!2m2!1d77.57754!2d12.9628957" +
      "!3e0?entry=ttu&g_ep=EgoyMDI2MTAyNy4wIKXMDSoASAFQAw%3D%3D",
  );
  assert.deepEqual(
    r.waypoints.map((w) => [w.text, w.lat, w.lng]),
    [
      ["Bengaluru, Karnataka", 12.9628957, 77.57754],
      ["Goa", 15.2993265, 74.123996],
      ["Mangaluru, Karnataka", 12.8854777, 74.8388112],
      ["Bengaluru, Karnataka", 12.9628957, 77.57754],
    ],
  );
});
