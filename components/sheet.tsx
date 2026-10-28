"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

/** Bottom sheet with drag-to-dismiss. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 cursor-default bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
            className="pb-safe fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] max-w-[480px] overflow-y-auto rounded-t-[28px] border-t border-line-strong bg-surface px-4 pt-2"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            {title && <h3 className="mb-4 font-display text-xl font-bold">{title}</h3>}
            {children}
            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
