import { test } from "node:test";
import { strict as assert } from "node:assert";
import { routeLoop } from "./loop-routing";
import type { LoopStop } from "./types";

const start = { name: "Bengaluru", lat: 12.97, lng: 77.59 };
const stop: LoopStop = { destinationId: null, name: "Yercaud", lat: 11.77, lng: 78.2, nightHere: true };

test("routes all waypoints together and keeps each leg", async () => {
  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    return new Response(
      JSON.stringify({
        code: "Ok",
        routes: [
          {
            geometry: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
            legs: [
              { distance: 102000, duration: 7200, steps: [] },
              { distance: 110000, duration: 7800, steps: [] },
            ],
          },
        ],
      }),
    );
  };
  try {
    const route = await routeLoop(start, [stop]);
    assert.match(requested, /77\.59,12\.97;78\.2,11\.77;77\.59,12\.97/);
    assert.deepEqual(
      route.legs.map((leg) => [leg.km, leg.min, leg.approx]),
      [
        [102, 120, false],
        [110, 130, false],
      ],
    );
    assert.equal(route.totalKm, 212);
  } finally {
    globalThis.fetch = original;
  }
});

test("a routing failure produces approximate legs and a complete line", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    const route = await routeLoop(start, [stop]);
    assert.equal(route.legs.length, 2);
    assert.ok(route.legs.every((leg) => leg.approx && leg.km > 0));
    assert.deepEqual(route.route, [
      [start.lat, start.lng],
      [stop.lat, stop.lng],
      [start.lat, start.lng],
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
