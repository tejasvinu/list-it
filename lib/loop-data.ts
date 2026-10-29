import "server-only";
import { cols, fromDoc, type LoopComment } from "./db";
import type { Loop } from "./types";
import type { GroupContext } from "./data";

export async function getLoops(ctx: GroupContext) {
  const c = await cols();
  const rows = await c.loops.find({ groupId: ctx.group.id, deletedAt: null }).sort({ createdAt: -1 }).toArray();
  const interests = await c.loopInterests
    .find({ loopId: { $in: rows.map((r) => r._id) } })
    .sort({ createdAt: 1 })
    .toArray();
  const riders = new Map(ctx.riders.map((r) => [r.id, r]));
  return rows.map((row) => {
    const loop = fromDoc<Loop>(row);
    return {
      ...loop,
      owner: riders.get(loop.riderId) ?? null,
      interested: interests
        .filter((i) => i.loopId === loop.id)
        .flatMap((i) => {
          const rider = riders.get(i.riderId);
          return rider ? [rider] : [];
        }),
      imIn: interests.some((i) => i.loopId === loop.id && i.riderId === ctx.viewer?.id),
    };
  });
}

export async function getLoop(ctx: GroupContext, id: string) {
  const loop = (await getLoops(ctx)).find((item) => item.id === id);
  if (!loop) return null;
  const rows = await (await cols()).loopComments.find({ loopId: id, deletedAt: null }).sort({ createdAt: 1 }).toArray();
  const riders = new Map(ctx.riders.map((r) => [r.id, r]));
  return {
    ...loop,
    comments: rows.map((row) => {
      const comment = fromDoc<LoopComment>(row);
      return { ...comment, rider: riders.get(comment.riderId) ?? null };
    }),
  };
}
export type LoopItem = Awaited<ReturnType<typeof getLoops>>[number];
export type LoopDetail = NonNullable<Awaited<ReturnType<typeof getLoop>>>;
