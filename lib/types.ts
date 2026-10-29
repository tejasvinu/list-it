export type Photo = {
  thumb: string;
  page: string;
  title: string;
  credit: string | null;
  license: string | null;
};

/** Kilometres per road class over the whole round trip */
export type RoadSplit = { city: number; nh: number; sh: number; other: number };

export type StartPoint = { name: string; lat: number; lng: number };
export type RiderLite = { id: string; name: string; emoji: string; color: string; start?: StartPoint | null };

export type LoopStop = { destinationId: string | null; name: string; lat: number; lng: number; nightHere: boolean };
export type LoopLeg = { km: number; min: number; approx: boolean; route: [number, number][] };
export type Loop = {
  id: string; groupId: string; riderId: string; name: string; notes: string | null;
  start: StartPoint; stops: LoopStop[]; startDate: string | null; legs: LoopLeg[];
  totalKm: number; totalMin: number; route: [number, number][];
  createdAt: Date; updatedAt: Date; deletedAt: Date | null;
};
