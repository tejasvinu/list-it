export type Photo = {
  thumb: string;
  page: string;
  title: string;
  credit: string | null;
  license: string | null;
};

/** Kilometres per road class over the whole round trip */
export type RoadSplit = { city: number; nh: number; sh: number; other: number };

export type RiderLite = { id: string; name: string; emoji: string; color: string };
