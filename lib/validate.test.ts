import { test } from "node:test";
import assert from "node:assert/strict";
import { daysUntil, todayYmd } from "./format";
import { cleanRoadSplit, inRange, isGoogleMapsHost, mapsUrlOk, validateDestination, validRideDate, validStart } from "./validate";

const base = {
  name: "  Nandi   Hills ",
  area: "Chikkaballapur",
  mapsUrl: "https://maps.app.goo.gl/abc",
  lat: 13.37,
  lng: 77.68,
  distanceKm: 121.6,
  durationMin: 190.2,
  approx: false,
  route: [
    [12.97, 77.59],
    [13.37, 77.68],
    [12.97, 77.59],
  ],
  roadSplit: { city: 30, nh: 60, sh: 10, other: 20 },
  seal: "x",
  photos: [],
  category: "short",
  tags: ["twisties", "#Dosa Stop!"],
  seasons: ["winter", "nope"],
  hairpins: 40,
  notes: "Gates open at 6.",
  status: "wishlist",
  statusDate: null,
  rideReport: "",
};

test("validateDestination cleans a good ride", () => {
  const v = validateDestination(base);
  assert.ok(v);
  assert.equal(v.name, "Nandi Hills");
  assert.equal(v.distanceKm, 122);
  assert.deepEqual(v.tags, ["twisties", "dosa stop"]);
  assert.deepEqual(v.seasons, ["winter"]);
  assert.equal(v.mapsUrl, "https://maps.app.goo.gl/abc");
});

test("validateDestination survives junk instead of throwing", () => {
  for (const junk of [null, 42, "x", { ...base, tags: "twisties" }, { ...base, photos: [null, 3] }, { ...base, seasons: {} }]) {
    assert.doesNotThrow(() => validateDestination(junk));
  }
  assert.deepEqual(validateDestination({ ...base, tags: "twisties" })?.tags, []);
  assert.deepEqual(validateDestination({ ...base, photos: [null, 3] })?.photos, []);
});

test("validateDestination rejects places outside riding range", () => {
  assert.equal(validateDestination({ ...base, lat: 51.5, lng: -0.12 }), null);
  assert.equal(validateDestination({ ...base, route: [[12.97, 77.59], [99, 77]] }), null);
  assert.equal(validateDestination({ ...base, distanceKm: -5 }), null);
});

test("validateDestination drops a non-Google Maps link and extra road-split keys", () => {
  const v = validateDestination({ ...base, mapsUrl: "https://notgoogle.com/maps", roadSplit: { ...base.roadSplit, evil: "x" } });
  assert.equal(v?.mapsUrl, null);
  assert.deepEqual(v?.roadSplit, { city: 30, nh: 60, sh: 10, other: 20 });
});

test("validateDestination dates an undated ride in IST", () => {
  // 20:00 UTC on 28 Oct is 01:30 on 29 Oct in Bengaluru.
  const v = validateDestination({ ...base, status: "done" }, Date.UTC(2026, 9, 28, 20, 0));
  assert.equal(v?.riddenOn, "2026-10-29");
  assert.equal(v?.status, "wishlist");
});

test("isGoogleMapsHost matches Google exactly", () => {
  for (const ok of ["google.com", "www.google.com", "maps.google.co.in", "www.google.de", "maps.app.goo.gl", "goo.gl", "g.co"]) {
    assert.ok(isGoogleMapsHost(ok), ok);
  }
  for (const bad of ["notgoogle.com", "google.evil.example", "google.com.evil.io", "goo.gl.evil.io", "localhost"]) {
    assert.ok(!isGoogleMapsHost(bad), bad);
  }
  assert.ok(!mapsUrlOk("http://www.google.com/maps"));
  assert.ok(!mapsUrlOk("javascript:alert(1)"));
});

test("inRange and cleanRoadSplit", () => {
  assert.ok(inRange(12.97, 77.59));
  assert.ok(!inRange("12", 77));
  assert.ok(!inRange(Number.NaN, 77));
  assert.equal(cleanRoadSplit({ city: 1, nh: -1, sh: 0, other: 0 }), null);
});

test("todayYmd and daysUntil count days in IST", () => {
  const lateUtc = Date.UTC(2026, 9, 28, 20, 0); // already the 29th in India
  assert.equal(todayYmd(lateUtc), "2026-10-29");
  assert.equal(daysUntil("2026-11-06", lateUtc), 8);
  assert.equal(daysUntil("2026-10-29", lateUtc), 0);
});


test("ride dates reject future and impossible dates in IST", () => {
  const now = new Date("2026-11-02T18:29:00Z");
  assert.equal(validRideDate("2026-11-02", now), true);
  assert.equal(validRideDate("2026-11-03", now), false);
  assert.equal(validRideDate("2026-02-30", now), false);
});
test("start point needs a name and coordinates in range", () => {
  assert.deepEqual(validStart({ name: " Hebbal ", lat: 13.03, lng: 77.6 }), { name: "Hebbal", lat: 13.03, lng: 77.6 });
  assert.equal(validStart({ name: "", lat: 13, lng: 77 }), null);
  assert.equal(validStart({ name: "Far away", lat: 90, lng: 77 }), null);
});
