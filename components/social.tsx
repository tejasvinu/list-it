"use client";

import { startTransition, useOptimistic, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Heart, Plus } from "lucide-react";
import { react, toggleIn } from "@/app/g/[slug]/actions";
import { REACTIONS } from "@/lib/config";
import type { RiderLite } from "@/lib/types";
import { AvatarStack } from "./avatar";

export type ReactionState = { mine: string | null; list: { emoji: string; rider: RiderLite }[] };

/** Optimistic reaction state shared by the button, the summary and double-tap. */
export function useReactions(slug: string, id: string, me: RiderLite, initial: ReactionState) {
  const [state, setOptimistic] = useOptimistic(initial, (_s, next: ReactionState) => next);
  const set = (emoji: string | null) => {
    const list = state.list.filter((r) => r.rider.id !== me.id);
    if (emoji) list.push({ emoji, rider: me });
    startTransition(async () => {
      setOptimistic({ mine: emoji, list });
      await react(slug, id, emoji);
    });
  };
  return { state, set };
}

export function ReactionButton({ mine, onPick }: { mine: string | null; onPick: (e: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.8 }}
        onClick={() => setOpen((o) => !o)}
        className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:text-text"
        aria-label={mine ? `Your reaction: ${mine}. Change it` : "React"}
        aria-expanded={open}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {mine ? (
            <motion.span
              key={mine}
              initial={{ scale: 0.3, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className="text-[22px] leading-none"
            >
              {mine}
            </motion.span>
          ) : (
            <motion.span key="none" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
              <Heart size={22} strokeWidth={1.9} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <button className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} aria-label="Close" />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 520, damping: 30 }}
              className="float absolute bottom-12 left-0 z-40 flex origin-bottom-left gap-0.5 rounded-full bg-surface p-1.5"
            >
              {REACTIONS.map((e, i) => (
                <motion.button
                  key={e}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.025, type: "spring", stiffness: 600, damping: 22 }}
                  whileHover={{ scale: 1.3, y: -4 }}
                  whileTap={{ scale: 1.5 }}
                  onClick={() => {
                    onPick(mine === e ? null : e);
                    setOpen(false);
                  }}
                  aria-label={`React ${e}`}
                  className={`grid h-11 w-11 place-items-center rounded-full text-[24px] ${mine === e ? "bg-accent-soft" : ""}`}
                >
                  {e}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ReactionSummary({ list, meId }: { list: ReactionState["list"]; meId: string }) {
  if (!list.length) return null;
  const counts = new Map<string, number>();
  for (const r of list) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const names = list.map((r) => (r.rider.id === meId ? "You" : r.rider.name));
  const first = names.includes("You") ? "You" : names[0];
  const rest = list.length - 1;
  return (
    <p className="flex items-center gap-1.5 text-[14px] text-muted">
      <span className="flex -space-x-0.5">
        {top.map(([e]) => (
          <span key={e} className="text-[15px]">
            {e}
          </span>
        ))}
      </span>
      <span>
        <span className="font-semibold text-text">{first}</span>
        {rest > 0 && ` and ${rest} other${rest === 1 ? "" : "s"}`}
      </span>
    </p>
  );
}

export function InButton({
  slug,
  id,
  me,
  imIn,
  interested,
  compact = false,
}: {
  slug: string;
  id: string;
  me: RiderLite;
  imIn: boolean;
  interested: RiderLite[];
  compact?: boolean;
}) {
  const [state, setOptimistic] = useOptimistic({ imIn, interested }, (_s, n: { imIn: boolean; interested: RiderLite[] }) => n);
  const toggle = () => {
    const next = !state.imIn;
    if (next && navigator.vibrate) navigator.vibrate(12);
    startTransition(async () => {
      setOptimistic({
        imIn: next,
        interested: next ? [...state.interested, me] : state.interested.filter((r) => r.id !== me.id),
      });
      await toggleIn(slug, id);
    });
  };
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={toggle}
      aria-pressed={state.imIn}
      className={`btn gap-2 pl-1.5 ${compact ? "pr-4" : "pr-5"} ${state.imIn ? "btn-accent" : "btn-ink"}`}
    >
      {state.interested.length > 0 ? (
        <AvatarStack riders={state.interested} max={3} size={30} />
      ) : (
        <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-inverse/15">
          <Plus size={16} strokeWidth={2.4} />
        </span>
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(state.imIn)}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          className="flex items-center gap-1.5"
        >
          {state.imIn && <Check size={16} strokeWidth={2.8} />}
          {state.imIn ? "I'm in" : "Count me in"}
          {state.interested.length > 0 && <span className="num opacity-70">{state.interested.length}</span>}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
