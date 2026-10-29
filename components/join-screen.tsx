"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Lock, Search } from "lucide-react";
import { Avatar } from "./avatar";
import { PinPad } from "./pin-pad";
import { Wordmark } from "./wordmark";
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
  // After a good PIN the crew's pages still have to load; keep the pad saying so until they do.
  const [entering, enter] = useTransition();
  const [nameError, setNameError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [now] = useState(() => Date.now());

  const done = () => enter(() => router.refresh());

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
      className="absolute left-3 top-[max(env(safe-area-inset-top),12px)] grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
      aria-label="Back"
    >
      <ArrowLeft size={20} />
    </button>
  );

  const slide = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
    transition: { type: "spring" as const, stiffness: 380, damping: 34 },
  };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col overflow-hidden px-5 pb-8 pt-[max(env(safe-area-inset-top),20px)]">
      <AnimatePresence mode="wait">
        {step.s === "home" && (
          <motion.section key="home" {...slide} className="flex flex-1 flex-col">
            <Wordmark size={20} />
            <div className="relative -mx-5 mt-4 h-[300px] bg-surface">{hero}</div>
            <h1 className="display mt-7 text-[52px] leading-[0.9]">{groupName}</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              You&apos;re invited to the crew&apos;s ride list.{" "}
              {destinationCount
                ? `${destinationCount} ride${destinationCount === 1 ? "" : "s"} on it so far, every one Bengaluru and back.`
                : "Every ride on it starts and ends in Bengaluru."}
            </p>
            {riders.length > 0 && (
              <div className="mt-5 flex items-center gap-3">
                <div className="flex">
                  {riders.slice(0, 7).map((r, i) => (
                    <Avatar key={r.id} rider={r} size={36} ring className={i ? "-ml-2.5" : ""} />
                  ))}
                </div>
                <span className="text-[15px] text-muted">
                  {riders.length} rider{riders.length === 1 ? "" : "s"} in
                </span>
              </div>
            )}
            <div className="mt-auto space-y-3 pt-10">
              {open ? (
                <>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => setStep({ s: "name" })} className="btn btn-ink w-full !min-h-14 text-[17px]">
                    I&apos;m new here <ArrowRight size={18} />
                  </motion.button>
                  <p className="text-center text-[14px] text-faint">Joining closes {closesIn(closesAt - now)}</p>
                </>
              ) : (
                <div className="flex items-start gap-3 rounded-panel bg-surface p-4 text-[15px] text-muted">
                  <Lock size={17} className="mt-0.5 shrink-0" />
                  <span>Joining is closed for this crew. If you&apos;re new, ask whoever shared the link to add you.</span>
                </div>
              )}
              {riders.length > 0 && (
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => setStep({ s: "pick" })} className="btn btn-line w-full !min-h-14 text-[17px]">
                  I&apos;m already in
                </motion.button>
              )}
            </div>
          </motion.section>
        )}

        {step.s === "pick" && (
          <motion.section key="pick" {...slide} className="flex flex-1 flex-col pt-16">
            {back({ s: "home" })}
            <h2 className="display text-[40px]">Who&apos;s riding?</h2>
            <p className="mt-1 text-[16px] text-muted">Tap your name, then enter your PIN.</p>
            {riders.length > 6 && (
              <label className="field mt-6 flex items-center gap-2 !py-0">
                <Search size={17} className="text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find your name"
                  aria-label="Find your name"
                  className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-faint"
                />
              </label>
            )}
            <div className="mt-8 grid grid-cols-3 gap-x-3 gap-y-6">
              {riders
                .filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
                .map((r, i) => (
                  <motion.button
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setStep({ s: "login", rider: r })}
                    className="flex flex-col items-center gap-2 rounded-panel py-2 hover:bg-surface"
                  >
                    <Avatar rider={r} size={68} />
                    <span className="max-w-full truncate text-[15px] font-semibold">{r.name}</span>
                  </motion.button>
                ))}
            </div>
          </motion.section>
        )}

        {step.s === "login" && (
          <motion.section key="login" {...slide} className="flex flex-1 flex-col items-center pt-14">
            {back({ s: "pick" })}
            <Avatar rider={step.rider} size={76} />
            <h2 className="display mt-3 text-[32px]">Hey {step.rider.name}</h2>
            <div className="mt-6">
              <PinPad label="Enter your PIN" busy={entering} onComplete={login(step.rider)} />
            </div>
          </motion.section>
        )}

        {step.s === "name" && (
          <motion.section key="name" {...slide} className="flex flex-1 flex-col pt-16">
            {back({ s: "home" })}
            <h2 className="display text-[40px]">What do we call you?</h2>
            <div className="mt-8 flex items-center gap-4">
              <motion.div key={emoji + color} initial={{ scale: 0.85 }} animate={{ scale: 1 }}>
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
                aria-label="Your name"
                className="display min-w-0 flex-1 border-b-2 border-line-strong bg-transparent py-2 text-[32px] font-semibold outline-none placeholder:text-faint focus:border-text"
              />
            </div>
            {nameError && <p className="mt-3 text-[15px] text-danger">{nameError}</p>}
            <h3 className="mb-3 mt-8 text-[15px] font-semibold">Avatar</h3>
            <div className="grid grid-cols-7 gap-1.5">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  aria-label={`Avatar ${e}`}
                  aria-pressed={emoji === e}
                  className={`grid aspect-square min-h-11 place-items-center rounded-panel text-2xl transition active:scale-90 ${
                    emoji === e ? "bg-text" : "bg-surface hover:bg-surface-2"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <h3 className="mb-3 mt-6 text-[15px] font-semibold">Colour</h3>
            <div className="grid grid-cols-5 justify-items-center gap-3 pb-8">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  aria-pressed={color === c}
                  className={`h-11 w-11 rounded-full transition active:scale-90 ${color === c ? "ring-[3px] ring-text ring-offset-[3px] ring-offset-bg" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={name.trim().length < 2 || pending}
              onClick={() => {
                if (riders.some((r) => r.name.toLowerCase() === name.trim().toLowerCase())) {
                  setNameError(`"${name.trim()}" is taken. If that's you, go back and pick "I'm already in".`);
                  return;
                }
                start(() => setStep({ s: "pin" }));
              }}
              className="btn btn-ink mt-auto w-full !min-h-14 text-[17px]"
            >
              Next: set a PIN <ArrowRight size={18} />
            </motion.button>
          </motion.section>
        )}

        {step.s === "pin" && (
          <motion.section key="pin" {...slide} className="flex flex-1 flex-col items-center pt-14">
            {back({ s: "name" })}
            <Avatar rider={{ name, emoji, color }} size={64} />
            <h2 className="display mt-3 text-[32px]">Set a 4-digit PIN</h2>
            <p className="mt-1 max-w-[290px] text-center text-[15px] text-muted">You&apos;ll only need it on a new phone. This one remembers you.</p>
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
            <h2 className="display mt-3 text-[32px]">Once more</h2>
            <p className="mt-1 text-[15px] text-muted">Enter the same PIN to confirm</p>
            <div className="mt-6">
              <PinPad busy={entering} onComplete={confirm(step.pin)} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
