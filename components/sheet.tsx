"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

/** Bottom sheet with drag-to-dismiss on phones; a centred dialog on desktop. */
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
            className="fixed inset-0 z-50 cursor-default bg-[var(--scrim)]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
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
            className="pb-safe float fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] max-w-[520px] overflow-y-auto rounded-t-[22px] bg-surface px-5 pt-2 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-[10px] lg:px-6 lg:pt-6"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong lg:hidden" />
            {title && <h3 className="display mb-5 text-[26px]">{title}</h3>}
            {children}
            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
