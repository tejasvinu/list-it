import test from "node:test";
import assert from "node:assert/strict";
import { calendarEvent } from "./calendar";

test("calendar uses exclusive end dates and escapes text", () => {
  const event = calendarEvent({
    id: "abc",
    title: "Hills, coast; home",
    date: "2026-12-31",
    days: 3,
    maps: "https://maps.example",
    link: "https://example.com/g/a",
    now: new Date("2026-10-29T00:00:00Z"),
  });
  assert.match(event, /DTSTART;VALUE=DATE:20261231/);
  assert.match(event, /DTEND;VALUE=DATE:20270103/);
  assert.match(event, /SUMMARY:Hills\\, coast\\; home/);
  assert.match(event, /DTSTAMP:20261029T000000Z/);
});

test("calendar folds long unicode lines at 75 bytes", () => {
  const event = calendarEvent({
    id: "x",
    title: "é".repeat(100),
    date: "2026-01-01",
    days: 1,
    maps: "https://maps.example",
    link: "https://example.com",
  });
  assert.ok(event.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
});

test("single day events end the next day", () => {
  const event = calendarEvent({
    id: "x",
    title: "Ride",
    date: "2026-01-31",
    days: 1,
    maps: "https://maps.example",
    link: "https://example.com",
  });
  assert.match(event, /DTEND;VALUE=DATE:20260201/);
});
