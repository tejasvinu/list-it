"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { HOME, STOP_KINDS, type StopKind } from "@/lib/config";
import { categoryOf } from "@/lib/format";

// Standard OSM tiles (free, no key), turned dark with a CSS filter on .dark-tiles in globals.css.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

type L = typeof Leaflet;

function homeIcon(L: L) {
  return L.divIcon({
    className: "",
    iconSize: [44, 22],
    iconAnchor: [22, 11],
    html: `<div style="display:grid;place-items:center;height:22px;border-radius:999px;background:#09090b;border:2px solid #fff;color:#fff;font:700 10px/1 system-ui;letter-spacing:1px">${HOME.short}</div>`,
  });
}

function pinIcon(L: L, color: string, label?: string, big = false) {
  const s = big ? 22 : 16;
  return L.divIcon({
    className: "",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    html: `<div style="position:relative;width:${s}px;height:${s}px">
      <span style="position:absolute;inset:0;border-radius:999px;background:${color};opacity:.35;transform:scale(2.2)"></span>
      <span style="position:absolute;inset:0;border-radius:999px;background:${color};border:2.5px solid #09090b;box-shadow:0 0 12px ${color}"></span>
      ${label ? `<span style="position:absolute;left:50%;top:${s + 6}px;transform:translateX(-50%);white-space:nowrap;font:700 11px/1.2 system-ui;color:#fff;text-shadow:0 1px 4px #000,0 0 2px #000">${label}</span>` : ""}
    </div>`,
  });
}

function stopIcon(L: L, kind: string) {
  const emoji = STOP_KINDS[(kind in STOP_KINDS ? kind : "other") as StopKind].emoji;
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:#1b1b20;border:1.5px solid rgba(255,255,255,.25);font-size:14px">${emoji}</div>`,
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
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19, className: "dark-tiles" }).addTo(map);
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
      L.polyline(route, { color, weight: 9, opacity: 0.18 }).addTo(map);
      const line = L.polyline(route, { color, weight: 3.5, opacity: 0.95 }).addTo(map);
      L.marker([HOME.lat, HOME.lng], { icon: homeIcon(L) }).addTo(map);
      L.marker([dest.lat, dest.lng], { icon: pinIcon(L, color, dest.name, true) }).addTo(map);
      for (const s of stops) {
        if (s.lat != null && s.lng != null) {
          L.marker([s.lat, s.lng], { icon: stopIcon(L, s.kind) }).bindTooltip(s.name, { direction: "top" }).addTo(map);
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
      const line = L.polyline(route, { color, weight: 3, opacity: 0.85 }).addTo(map);
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

// Leave room for the title and filter chips on top.
const FIT_ALL = { paddingTopLeft: [36, 130] as [number, number], paddingBottomRight: [36, 36] as [number, number] };

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
  selected,
  onSelect,
  className,
}: {
  items: CrewMapItem[];
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
        const line = L.polyline(d.route, { color, weight: 2, opacity: 0.55 }).addTo(map);
        const marker = L.marker([d.lat, d.lng], { icon: pinIcon(L, color, d.name) })
          .on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            selectRef.current(d.id);
          })
          .addTo(map);
        home.extend([d.lat, d.lng]);
        byId.set(d.id, { line, marker, item: d });
      }
      L.marker([HOME.lat, HOME.lng], { icon: homeIcon(L) }).addTo(map);
      map.on("click", () => selectRef.current(null));
      map.fitBounds(home, FIT_ALL);
      layers.current = { L, map, home, byId };
      return () => {
        layers.current = null;
      };
    },
    [JSON.stringify(items.map((i) => i.id))],
  );

  // Restyle in place when the selection changes, so the map never reloads.
  useEffect(() => {
    const ctx = layers.current;
    if (!ctx) return;
    const { L, map, home, byId } = ctx;
    for (const [id, { line, marker, item }] of byId) {
      const color = categoryOf(item.category).color;
      const on = id === selected;
      line.setStyle({ weight: on ? 4 : 2, opacity: selected ? (on ? 1 : 0.12) : 0.55 });
      if (on) line.bringToFront();
      marker.setIcon(pinIcon(L, color, on || !selected ? item.name : undefined, on));
      marker.setZIndexOffset(on ? 1000 : 0);
    }
    const target = selected ? byId.get(selected) : null;
    if (target) map.flyToBounds(target.line.getBounds(), { paddingTopLeft: [40, 130], paddingBottomRight: [40, 150], duration: 0.8 });
    else map.flyToBounds(home, { ...FIT_ALL, duration: 0.8 });
  }, [selected]);

  return <div ref={ref} className={`isolate ${className ?? ""}`} />;
}
