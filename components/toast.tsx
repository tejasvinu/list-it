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
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[60] mx-auto flex max-w-[480px] flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="float rounded-full bg-text px-4 py-2.5 text-[15px] font-medium text-inverse"
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Calls a server action from the browser. A dropped connection, or a session signed out from another
 * phone, rejects the call; this turns that into a toast instead of a broken page. Undefined on failure.
 */
export async function attempt<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch {
    toast(navigator.onLine === false ? "No signal. Try again in a bit." : "That didn't go through. Reload and try again.");
    return undefined;
  }
}

/** Native share sheet on phones, with a clipboard or WhatsApp fallback. */
export async function shareLink(opts: { title: string; text?: string; url: string; whatsappFallback?: boolean }) {
  if (navigator.share) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  if (opts.whatsappFallback) {
    window.open(`https://wa.me/?text=${encodeURIComponent([opts.text, opts.url].filter(Boolean).join("\n"))}`, "_blank", "noopener,noreferrer");
  } else {
    await navigator.clipboard.writeText(opts.url);
    toast("Link copied");
  }
}
