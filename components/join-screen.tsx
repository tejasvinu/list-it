"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Lock, Search, Sparkles } from "lucide-react";
import { Avatar } from "./avatar";
import { PinPad } from "./pin-pad";
import { joinGroup, signIn } from "@/app/g/[slug]/actions";
import { AVATAR_COLORS, AVATAR_EMOJIS } from "@/lib/config";
import type { RiderLite } from "@/lib/types";

type Step =
  | { s: "home" }
  | { s: "pick" }
  | { s: "login"; rider: RiderLite }
  | { s: "name" }
  | { s: "pin" }
  | { s: "confirm"; pin: string };

function closesIn(ms: number) {
  const h = Math.max(0, Math.round(ms / 3600000));
  if (h < 1) return "in under an hour";
  if (h < 48) return `in ${h}h`;
  return `in ${Math.round(h / 24)} days`;
}

export function JoinScreen({
  slug,
  groupName,
  riders,
  destinationCount,
  open,
  closesAt,
  hero,
}: {
  slug: string;
  groupName: string;
  riders: RiderLite[];
  destinationCount: number;
  open: boolean;
  closesAt: number;
  hero: React.ReactNode;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ s: "home" });
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>(AVATAR_EMOJIS[0]);
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [pending, start] = useTransition();
  const [nameError, setNameError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [now] = useState(() => Date.now());

  const done = () => router.refresh();

  const login = (rider: RiderLite) => async (pin: string) => {
    const res = await signIn(slug, rider.id, pin);
    if (!res.ok) return res.error;
    done();
  };

  const confirm = (first: string) => async (pin: string) => {
    if (pin !== first) {
      setTimeout(() => setStep({ s: "pin" }), 900);
      return "PINs didn't match. Try again.";
    }
    const res = await joinGroup(slug, { name, emoji, color, pin });
    if (!res.ok) {
      setNameError(res.error);
      setStep({ s: "name" });
      return res.error;
    }
    done();
  };

  const back = (to: Step) => (
    <button
      onClick={() => setStep(to)}
      className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-muted"
      aria-label="Back"
    >
      <ArrowLeft size={18} />
    </button>
  );

  const slide = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
    transition: { type: "spring" as const, stiffness: 380, damping: 34 },
  };

  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-[480px] flex-col overflow-hidden px-6 pb-10 pt-6">
      <AnimatePresence mode="wait">
        {step.s === "home" && (
          <motion.section key="home" {...slide} className="flex flex-1 flex-col">
            <div className="relative -mx-6 mb-2 h-[300px]">{hero}</div>
            <p className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[12px] font-semibold text-accent-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> You&apos;re invited
            </p>
            <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-tight">{groupName}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              {destinationCount
                ? `${destinationCount} ride${destinationCount === 1 ? "" : "s"} on the list so far. Bengaluru and back, every time.`
                : "The crew's ride list starts here. Bengaluru and back, every time."}
            </p>
            {riders.length > 0 && (
              <div className="mt-5 flex items-center gap-3">
                <div className="flex">
                  {riders.slice(0, 7).map((r, i) => (
                    <Avatar key={r.id} rider={r} size={34} ring className={i ? "-ml-2.5" : ""} />
                  ))}
                </div>
                <span className="text-sm text-muted">
                  {riders.length} rider{riders.length === 1 ? "" : "s"} in
                </span>
              </div>
            )}
            <div className="mt-auto space-y-3 pt-10">
              {open ? (
                <>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep({ s: "name" })}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl btn-primary py-4 font-display text-lg font-bold text-black"
                  >
                    <Sparkles size={18} /> I&apos;m new here
                  </motion.button>
                  <p className="text-center text-xs text-faint">Joining closes {closesIn(closesAt - now)}</p>
                </>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
                  <Lock size={16} className="mt-0.5 shrink-0" />
                  <span>Joining is closed for this crew. If you&apos;re new, ask whoever shared the link to add you.</span>
                </div>
              )}
              {riders.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStep({ s: "pick" })}
                  className="w-full rounded-2xl border border-line-strong bg-surface py-4 font-display text-lg font-semibold"
                >
                  I&apos;m already in
                </motion.button>
              )}
            </div>
          </motion.section>
        )}

        {step.s === "pick" && (
          <motion.section key="pick" {...slide} className="flex flex-1 flex-col pt-16">
            {back({ s: "home" })}
            <h2 className="font-display text-3xl font-bold">Who&apos;s riding?</h2>
            <p className="mt-1 text-muted">Tap yourself, then your PIN.</p>
            {riders.length > 6 && (
              <label className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-accent">
                <Search size={16} className="text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find your name"
                  className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-faint"
                />
              </label>
            )}
            <div className="mt-8 grid grid-cols-3 gap-x-3 gap-y-6">
              {riders.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase())).map((r, i) => (
                <motion.button
                  key={r.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setStep({ s: "login", rider: r })}
                  className="flex flex-col items-center gap-2"
                >
                  <Avatar rider={r} size={68} />
                  <span className="max-w-full truncate text-sm font-medium">{r.name}</span>
                </motion.button>
              ))}
            </div>
          </motion.section>
        )}

        {step.s === "login" && (
          <motion.section key="login" {...slide} className="flex flex-1 flex-col items-center pt-14">
            {back({ s: "pick" })}
            <Avatar rider={step.rider} size={76} />
            <h2 className="mt-3 font-display text-2xl font-bold">Hey {step.rider.name}</h2>
            <div className="mt-6">
              <PinPad label="Enter your PIN" onComplete={login(step.rider)} />
            </div>
          </motion.section>
        )}

        {step.s === "name" && (
          <motion.section key="name" {...slide} className="flex flex-1 flex-col pt-16">
            {back({ s: "home" })}
            <h2 className="font-display text-3xl font-bold">What do we call you?</h2>
            <div className="mt-8 flex items-center gap-4">
              <motion.div key={emoji + color} initial={{ scale: 0.8, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}>
                <Avatar rider={{ name, emoji, color }} size={64} />
              </motion.div>
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                maxLength={24}
                placeholder="Your name"
                className="min-w-0 flex-1 border-b-2 border-line-strong bg-transparent py-2 font-display text-2xl font-semibold outline-none placeholder:text-faint focus:border-accent"
              />
            </div>
            {nameError && <p className="mt-3 text-sm text-danger">{nameError}</p>}
            <p className="mb-3 mt-8 section-label">Pick your vibe</p>
            <div className="grid grid-cols-7 gap-2">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  aria-label={`Avatar ${e}`}
                  aria-pressed={emoji === e}
                  className={`grid aspect-square min-h-11 place-items-center rounded-2xl text-2xl transition active:scale-90 ${
                    emoji === e ? "bg-surface-3 ring-2 ring-accent" : "border border-line bg-surface"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="mb-3 mt-6 section-label">Colour</p>
            <div className="grid grid-cols-5 justify-items-center gap-3 pb-8">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  aria-pressed={color === c}
                  className={`h-10 w-10 rounded-full transition active:scale-90 ${color === c ? "ring-2 ring-white ring-offset-[3px] ring-offset-bg" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={name.trim().length < 2 || pending}
              onClick={() => {
                if (riders.some((r) => r.name.toLowerCase() === name.trim().toLowerCase())) {
                  setNameError(`"${name.trim()}" is taken. If that's you, go back and pick "I'm already in".`);
                  return;
                }
                start(() => setStep({ s: "pin" }));
              }}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl btn-primary py-4 font-display text-lg font-bold text-black disabled:opacity-40"
            >
              Next <ArrowRight size={18} />
            </motion.button>
          </motion.section>
        )}

        {step.s === "pin" && (
          <motion.section key="pin" {...slide} className="flex flex-1 flex-col items-center pt-14">
            {back({ s: "name" })}
            <Avatar rider={{ name, emoji, color }} size={64} />
            <h2 className="mt-3 font-display text-2xl font-bold">Set a 4-digit PIN</h2>
            <p className="mt-1 max-w-[280px] text-center text-sm text-faint">
              You&apos;ll only need it on a new phone. This one remembers you.
            </p>
            <div className="mt-6">
              <PinPad
                onComplete={async (pin) => {
                  setStep({ s: "confirm", pin });
                }}
              />
            </div>
          </motion.section>
        )}

        {step.s === "confirm" && (
          <motion.section key="confirm" {...slide} className="flex flex-1 flex-col items-center pt-14">
            {back({ s: "pin" })}
            <Avatar rider={{ name, emoji, color }} size={64} />
            <h2 className="mt-3 font-display text-2xl font-bold">Once more</h2>
            <p className="mt-1 text-sm text-faint">Confirm your PIN</p>
            <div className="mt-6">
              <PinPad onComplete={confirm(step.pin)} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
