import type { LoopLeg, LoopStop, StartPoint } from "./types";

export type LoopDay = {
  names: string[];
  km: number;
  min: number;
  approx: boolean;
  night: LoopStop | null;
  firstLeg: number;
  lastLeg: number;
};

/** A night ends the day at that stop; the final leg always returns home. */
export function loopDays(start: StartPoint, stops: LoopStop[], legs: LoopLeg[]): LoopDay[] {
  if (!stops.length || legs.length !== stops.length + 1) return [];
  const days: LoopDay[] = [];
  let names = [start.name];
  let firstLeg = 0;
  let km = 0;
  let min = 0;
  let approx = false;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const stop = stops[i];
    names.push(stop?.name ?? start.name);
    km += leg.km;
    min += leg.min;
    approx ||= leg.approx;
    if (stop?.nightHere || i === legs.length - 1) {
      days.push({ names, km, min, approx, night: stop?.nightHere ? stop : null, firstLeg, lastLeg: i });
      names = [stop?.name ?? start.name];
      firstLeg = i + 1;
      km = 0;
      min = 0;
      approx = false;
    }
  }
  return days;
}

export function loopDate(start: string, day: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day);
  return date.toISOString().slice(0, 10);
}
