"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const EVENT = "list-it-toast";

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, message: (e as CustomEvent<string>).detail }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2400);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-[480px] flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="rounded-full border border-line-strong bg-surface-2/95 px-4 py-2 text-sm font-medium shadow-xl backdrop-blur"
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Native share sheet on phones, clipboard elsewhere. */
export async function shareLink(opts: { title: string; text?: string; url: string }) {
  if (navigator.share) {
    try {
      await navigator.share(opts);
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(opts.url);
  toast("Link copied");
}
