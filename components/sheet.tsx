"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  // Portals need document.body, which only exists once we're in the browser.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const panel = useRef<HTMLDivElement>(null);
  // Callers pass a fresh onClose each render; keep the effect below from re-running (and re-focusing) on every keystroke.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  // Escape closes; Tab stays inside the sheet; focus goes in on open and back where it was on close.
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel.current)?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close.current();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!panel.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [open]);

  if (!mounted) return null;

  // Rendered at the end of <body> so a parent's stacking context (a z-index, a transform) can't put the
  // bottom nav on top of the sheet and swallow taps on its buttons.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-label="Close"
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 cursor-default bg-[var(--scrim)]"
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
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
            className="pb-safe float fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] max-w-[520px] overflow-y-auto rounded-t-[22px] bg-surface px-5 pt-2 outline-none lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-[10px] lg:px-6 lg:pt-6"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong lg:hidden" />
            {title && <h3 className="display mb-5 text-[26px]">{title}</h3>}
            {children}
            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
