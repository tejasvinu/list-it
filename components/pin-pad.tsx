"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useAnimationControls } from "motion/react";
import { Delete } from "lucide-react";

/**
 * Phone-unlock style PIN entry. Calls onComplete with 4 digits; the parent
 * resolves the promise with an error string to shake and clear.
 */
export function PinPad({
  onComplete,
  busy = false,
  label,
}: {
  onComplete: (pin: string) => Promise<string | null | void>;
  busy?: boolean;
  label?: string;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const controls = useAnimationControls();

  const submit = useCallback(
    async (value: string) => {
      const err = await onComplete(value);
      if (err) {
        setError(err);
        await controls.start({ x: [0, -14, 12, -8, 6, 0], transition: { duration: 0.4 } });
        setPin("");
      }
    },
    [onComplete, controls],
  );

  const press = useCallback(
    (digit: string) => {
      if (busy || pin.length >= 4) return;
      setError(null);
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        if (navigator.vibrate) navigator.vibrate(10);
        setTimeout(() => submit(next), 120);
      }
    },
    [busy, pin, submit],
  );

  const back = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, back]);

  return (
    <div className="flex flex-col items-center">
      {label && <p className="mb-5 text-[15px] font-medium text-text/90">{label}</p>}
      <motion.div animate={controls} className="mb-3 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            animate={{ scale: pin.length === i + 1 ? [1, 1.35, 1] : 1 }}
            transition={{ duration: 0.18 }}
            className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
              i < pin.length ? (error ? "border-danger bg-danger" : "border-accent bg-accent") : "border-white/30"
            }`}
          />
        ))}
      </motion.div>
      <p className={`mb-6 h-5 text-center text-sm ${error ? "text-danger" : "text-transparent"}`}>{error ?? "."}</p>
      <div className="grid grid-cols-3 gap-x-6 gap-y-3.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onPress={() => press(d)} disabled={busy}>
            {d}
          </Key>
        ))}
        <span />
        <Key onPress={() => press("0")} disabled={busy}>
          0
        </Key>
        <Key onPress={back} disabled={busy || !pin} ghost aria-label="Delete">
          <Delete size={24} />
        </Key>
      </div>
    </div>
  );
}

function Key({
  children,
  onPress,
  disabled,
  ghost,
  ...rest
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  ghost?: boolean;
  "aria-label"?: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={onPress}
      disabled={disabled}
      className={`grid h-[68px] w-[68px] place-items-center rounded-full font-display text-[28px] font-medium transition-colors disabled:opacity-40 ${
        ghost
          ? "text-text/80 hover:bg-surface-2 active:bg-surface-3"
          : "border border-line bg-surface-2 text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-surface-3 active:bg-surface-3"
      }`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
