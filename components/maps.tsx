"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { HOME, STOP_KINDS, type StopKind } from "@/lib/config";
import { categoryOf } from "@/lib/format";

// Standard OSM tiles (free, no key), turned grey (or inverted at night) by .map-tiles in globals.css.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

type L = typeof Leaflet;

/** Leaflet paints lines in SVG attributes, which can't take var(); this is --surface for each theme. */
const casing = () => (matchMedia("(prefers-color-scheme: dark)").matches ? "#181917" : "#ffffff");

function homeIcon(L: L) {
  return L.divIcon({
    className: "",
    iconSize: [86, 26],
    iconAnchor: [43, 13],
    html: `<div style="display:grid;place-items:center;height:26px;border-radius:3px;background:var(--text);color:var(--inverse);font:700 14px/1 var(--font-display),system-ui;box-shadow:0 2px 6px rgb(0 0 0/.25)">${HOME.name}</div>`,
  });
}

const escapeHtml = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function pinIcon(L: L, color: string, label?: string, big = false) {
  const s = big ? 20 : 14;
  return L.divIcon({
    className: "",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    html: `<div style="position:relative;width:${s}px;height:${s}px">
      <span style="position:absolute;inset:0;border-radius:999px;background:${color};border:3px solid var(--surface);box-shadow:0 1px 4px rgb(0 0 0/.35)"></span>
      ${label ? `<span class="map-label" style="top:${s + 6}px">${escapeHtml(label)}</span>` : ""}
    </div>`,
  });
}

/** A stop: a small plate with the kind's initial, like a roadside board. */
function stopIcon(L: L, kind: string) {
  const label = STOP_KINDS[(kind in STOP_KINDS ? kind : "other") as StopKind].label;
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div title="${escapeHtml(label)}" style="display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:var(--surface);color:var(--text);box-shadow:0 0 0 2px var(--text);font:700 13px/1 var(--font-display),system-ui">${label[0]}</div>`,
  });
}

/** Mounts a Leaflet map into a div and hands it to `setup` once loaded. */
function useLeafletMap(setup: (L: L, map: Leaflet.Map) => void | (() => void), deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: Leaflet.Map | null = null;
    let cleanup: void | (() => void);
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod.default ?? mod) as L;
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { zoomControl: false, attributionControl: true });
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19, className: "map-tiles" }).addTo(map);
      cleanup = setup(L, map);
    });
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function RouteMap({
  route,
  category,
  dest,
  stops = [],
  className,
}: {
  route: [number, number][];
  category: string;
  dest: { lat: number; lng: number; name: string };
  stops?: { lat: number | null; lng: number | null; kind: string; name: string }[];
  className?: string;
}) {
  const color = categoryOf(category).color;
  const ref = useLeafletMap(
    (L, map) => {
      L.polyline(route, { color: casing(), weight: 8, opacity: 0.9 }).addTo(map);
      const line = L.polyline(route, { color, weight: 4, opacity: 1 }).addTo(map);
      L.marker([HOME.lat, HOME.lng], { icon: homeIcon(L) }).addTo(map);
      L.marker([dest.lat, dest.lng], { icon: pinIcon(L, color, dest.name, true) }).addTo(map);
      for (const s of stops) {
        if (s.lat != null && s.lng != null) {
          // Leaflet puts a string tooltip in as HTML, and stop names are typed by riders.
          L.marker([s.lat, s.lng], { icon: stopIcon(L, s.kind) }).bindTooltip(escapeHtml(s.name), { direction: "top" }).addTo(map);
        }
      }
      map.fitBounds(line.getBounds(), { padding: [36, 36] });
    },
    [JSON.stringify(route), dest.lat, dest.lng, JSON.stringify(stops)],
  );
  return <div ref={ref} className={`isolate ${className ?? ""}`} />;
}

/** Route preview with a draggable destination pin, for fixing a bad geocode. */
export function PickMap({
  lat,
  lng,
  route,
  category,
  onMove,
  className,
}: {
  lat: number;
  lng: number;
  route: [number, number][];
  category: string;
  onMove: (lat: number, lng: number) => void;
  className?: string;
}) {
  const moveRef = useRef(onMove);
  useEffect(() => {
    moveRef.current = onMove;
  }, [onMove]);
  const color = categoryOf(category).color;
  const ref = useLeafletMap(
    (L, map) => {
      L.polyline(route, { color: casing(), weight: 7, opacity: 0.9 }).addTo(map);
      const line = L.polyline(route, { color, weight: 3.5, opacity: 1 }).addTo(map);
      L.marker([HOME.lat, HOME.lng], { icon: homeIcon(L) }).addTo(map);
      const pin = L.marker([lat, lng], { icon: pinIcon(L, color, undefined, true), draggable: true }).addTo(map);
      pin.on("dragend", () => {
        const p = pin.getLatLng();
        moveRef.current(p.lat, p.lng);
      });
      map.fitBounds(line.getBounds().extend([lat, lng]), { padding: [28, 28] });
    },
    [lat, lng, JSON.stringify(route), color],
  );
  return <div ref={ref} className={`isolate ${className ?? ""}`} />;
}

// Leave room for the title and chips on top and the bar below on phones,
// and for the ride list panel on the left on desktop.
const wideScreen = () => window.matchMedia("(min-width: 1024px)").matches;
const fitAll = () =>
  wideScreen()
    ? { paddingTopLeft: [420, 60] as [number, number], paddingBottomRight: [60, 60] as [number, number] }
    : { paddingTopLeft: [36, 150] as [number, number], paddingBottomRight: [36, 110] as [number, number] };
const fitOne = () =>
  wideScreen()
    ? { paddingTopLeft: [440, 80] as [number, number], paddingBottomRight: [80, 200] as [number, number] }
    : { paddingTopLeft: [40, 150] as [number, number], paddingBottomRight: [40, 250] as [number, number] };

export type CrewMapItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  route: [number, number][];
};

export function CrewMap({
  items,
  loops,
  selected,
  onSelect,
  className,
}: {
  items: CrewMapItem[];
  loops: { id: string; route: [number, number][] }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  const selectRef = useRef(onSelect);
  const layers = useRef<{
    L: L;
    map: Leaflet.Map;
    home: Leaflet.LatLngBounds;
    byId: Map<string, { line: Leaflet.Polyline; marker: Leaflet.Marker; item: CrewMapItem }>;
  } | null>(null);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  const ref = useLeafletMap(
    (L, map) => {
      const home = L.latLngBounds([[HOME.lat, HOME.lng]]);
      const byId = new Map();
      for (const d of items) {
        const color = categoryOf(d.category).color;
        const line = L.polyline(d.route, { color, weight: 3, opacity: 0.85 }).addTo(map);
        const marker = L.marker([d.lat, d.lng], { icon: pinIcon(L, color, d.name) })
          .on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            selectRef.current(d.id);
          })
          .addTo(map);
        home.extend([d.lat, d.lng]);
        byId.set(d.id, { line, marker, item: d });
      }
      for (const loop of loops) {
        if (loop.route.length < 2) continue;
        const line = L.polyline(loop.route, { color: "#E2513A", weight: 3, opacity: 0.8, dashArray: "8 7" }).addTo(map);
        home.extend(line.getBounds());
      }
      L.marker([HOME.lat, HOME.lng], { icon: homeIcon(L) }).addTo(map);
      map.on("click", () => selectRef.current(null));
      map.fitBounds(home, fitAll());
      layers.current = { L, map, home, byId };
      return () => {
        layers.current = null;
      };
    },
    [JSON.stringify(items), JSON.stringify(loops)],
  );

  // Restyle in place when the selection changes, so the map never reloads.
  useEffect(() => {
    const ctx = layers.current;
    if (!ctx) return;
    const { L, map, home, byId } = ctx;
    for (const [id, { line, marker, item }] of byId) {
      const color = categoryOf(item.category).color;
      const on = id === selected;
      line.setStyle({ weight: on ? 5 : 3, opacity: selected ? (on ? 1 : 0.2) : 0.85 });
      if (on) line.bringToFront();
      marker.setIcon(pinIcon(L, color, on || !selected ? item.name : undefined, on));
      marker.setZIndexOffset(on ? 1000 : 0);
    }
    const target = selected ? byId.get(selected) : null;
    if (target) map.flyToBounds(target.line.getBounds(), { ...fitOne(), duration: 0.8 });
    else map.flyToBounds(home, { ...fitAll(), duration: 0.8 });
  }, [selected]);

  return <div ref={ref} className={`isolate ${className ?? ""}`} />;
}


const DAY_COLORS = ["#3A78F0", "#E2513A", "#13A189", "#F07A1F", "#20A059"];

/** Numbered stops and one colour for each day's routed legs. */
export function LoopMap({ start, stops, legs, className }: {
  start: import("@/lib/types").StartPoint;
  stops: import("@/lib/types").LoopStop[];
  legs: import("@/lib/types").LoopLeg[];
  className?: string;
}) {
  const ref = useLeafletMap((L, map) => {
    const bounds = L.latLngBounds([[start.lat, start.lng]]);
    let day = 0;
    legs.forEach((leg, i) => {
      const line = L.polyline(leg.route, { color: DAY_COLORS[day % DAY_COLORS.length], weight: 4, opacity: 0.9 }).addTo(map);
      if (leg.route.length) bounds.extend(line.getBounds());
      if (stops[i]?.nightHere) day++;
    });
    L.marker([start.lat, start.lng], { icon: pinIcon(L, "#121311", start.name, true) }).addTo(map);
    stops.forEach((stop, i) => {
      const icon = L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13], html: `<div style="display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--text);color:var(--inverse);font-weight:700">${i + 1}</div>` });
      L.marker([stop.lat, stop.lng], { icon }).bindTooltip(escapeHtml(stop.name)).addTo(map);
      bounds.extend([stop.lat, stop.lng]);
    });
    map.fitBounds(bounds, { padding: [35, 35] });
  }, [JSON.stringify(start), JSON.stringify(stops), JSON.stringify(legs)]);
  return <div ref={ref} className={`isolate ${className ?? ""}`} />;
}
