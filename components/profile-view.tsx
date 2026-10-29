"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, KeyRound, Loader2, LogOut, Pencil } from "lucide-react";
import { changePin, signOut, updateProfile } from "@/app/g/[slug]/actions";
import { AVATAR_COLORS, AVATAR_EMOJIS } from "@/lib/config";
import { duration } from "@/lib/format";
import type { FeedItem } from "@/lib/data";
import type { RiderLite } from "@/lib/types";
import { Avatar } from "./avatar";
import { CategoryLabel, StatusChip } from "./feed-card";
import { Milestone } from "./milestone";
import { PinPad } from "./pin-pad";
import { RouteArt } from "./route-art";
import { Sheet } from "./sheet";
import { StartPointControl } from "./start-point-control";
import { attempt, toast } from "./toast";

const TABS = [
  { key: "added", label: "Added" },
  { key: "in", label: "In for" },
  { key: "ridden", label: "Ridden" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function ProfileView({
  slug,
  rider,
  isMe,
  joinedAt,
  added,
  imIn,
  ridden,
  historyKm,
  rideIds,
}: {
  slug: string;
  rider: RiderLite;
  isMe: boolean;
  joinedAt: number;
  added: FeedItem[];
  imIn: FeedItem[];
  ridden: FeedItem[];
  historyKm: Record<string, number>;
  rideIds: string[];
}) {
  const [tab, setTab] = useState<Tab>("added");
  const [styleOpen, setStyleOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const router = useRouter();
  const list = tab === "added" ? added : tab === "in" ? imIn : ridden;
  const riddenKm = ridden.reduce((s, d) => s + historyKm[d.id], 0);
  const counts = { added: added.length, in: imIn.length, ridden: ridden.length };

  return (
    <div>
      <header className="topbar flex items-center gap-1 px-2 pb-2 pt-[max(env(safe-area-inset-top),10px)] lg:static lg:bg-transparent lg:px-0 lg:pt-8 lg:shadow-none">
        {!isMe && (
          <button onClick={() => router.back()} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        )}
        <p className="flex-1 truncate px-2 text-[15px] text-muted lg:px-0">{isMe ? "Your riding log" : "Riding log"}</p>
      </header>

      <section className="px-4 pt-4 lg:px-0">
        <div className="flex items-center gap-4">
          <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 16 }}>
            <Avatar rider={rider} size={72} />
          </motion.div>
          <div className="min-w-0">
            <h1 className="display truncate text-[40px] lg:text-[52px]">{rider.name}</h1>
            <p className="text-[15px] text-muted" suppressHydrationWarning>
              Riding with the crew since {new Date(joinedAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="num mt-7 flex items-end gap-8">
          <Figure value={Math.round(riddenKm).toLocaleString("en-IN")} label="km ridden" />
          <Figure value={String(ridden.length)} label={ridden.length === 1 ? "ride done" : "rides done"} />
          <Figure value={String(added.length)} label="added" />
        </div>

        {isMe && (
          <div className="mt-6 flex flex-wrap gap-2">
            <StartPointControl slug={slug} start={rider.start ?? null} rideIds={rideIds} />
            <button onClick={() => setStyleOpen(true)} className="btn btn-quiet !min-h-10 !px-4 text-[14px]">
              <Pencil size={15} /> Edit profile
            </button>
            <button onClick={() => setPinOpen(true)} className="btn btn-quiet !min-h-10 !px-4 text-[14px]">
              <KeyRound size={15} /> Change PIN
            </button>
            <button
              onClick={async () => {
                if (!confirm("Sign out on this phone? You'll need your PIN to get back in.")) return;
                await attempt(() => signOut(slug));
                router.refresh();
              }}
              className="btn !min-h-10 !px-4 text-[14px] text-muted hover:text-text"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
      </section>

      {ridden.length > 0 && <p className="mt-5 px-4 text-[15px] text-muted lg:px-0">Farthest: {([...ridden].sort((a, b) => historyKm[b.id] - historyKm[a.id])[0]).name} · {Math.max(...ridden.map(d => historyKm[d.id]))} km</p>}
      <div role="tablist" aria-label="Rides" className="topbar mt-8 flex gap-6 px-4 lg:top-0 lg:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex min-h-12 items-center gap-1.5 text-[16px] font-semibold ${tab === t.key ? "text-text" : "text-faint hover:text-text"}`}
          >
            {t.label}
            <span className="num font-medium text-faint">{counts[t.key]}</span>
            {tab === t.key && <motion.span layoutId="profile-tab" className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-text" />}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="px-4 py-14 text-[16px] text-muted lg:px-0">
          {tab === "added"
            ? isMe
              ? "Nothing added yet. Tap + and drop a Google Maps link."
              : `${rider.name} hasn't added a ride yet.`
            : tab === "in"
              ? `${isMe ? "You're" : `${rider.name} is`} not in for any ride yet.`
              : "No rides logged yet."}
        </p>
      ) : (
        <ul className="space-y-2 px-4 py-4 lg:px-0">
          {list.map((d, i) => (
            <motion.li key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
              {tab === "ridden" && (i === 0 || (d.riddenBy.find(r => r.rider.id === rider.id)?.date ?? "").slice(0, 7) !== (list[i - 1].riddenBy.find(r => r.rider.id === rider.id)?.date ?? "").slice(0, 7)) && <h2 className="display px-1 pb-2 pt-4 text-[22px]">{(() => { const date = d.riddenBy.find(r => r.rider.id === rider.id)?.date; return date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) : "Date unknown"; })()}</h2>}
              <Link href={`/g/${slug}/d/${d.id}`} className="flex items-center gap-4 rounded-panel bg-surface p-3 pr-4 transition-colors hover:bg-surface-2">
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[4px]">
                  <RouteArt id={`p-${tab}-${d.id}`} route={d.route} category={d.category} width={64} height={64} labels={false} animate={false} className="h-full w-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="display block truncate text-[23px]">{d.name}</span>
                  <span className="num mt-0.5 flex flex-wrap items-center gap-x-3 text-[14px] text-muted">
                    <span>{duration(d.durationMin)}</span>
                    <CategoryLabel category={d.category} />
                  </span>
                  <span className="mt-1.5 block">
                    <StatusChip status={d.status} date={d.statusDate} ridden={d.riddenBy.filter((r) => r.rider.id === rider.id)} />
                  </span>
                </span>
                <Milestone name={d.name} distanceKm={d.distanceKm} split={d.roadSplit} approx={d.approx} size={10} />
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      {isMe && (
        <>
          <ProfileSheet open={styleOpen} onClose={() => setStyleOpen(false)} slug={slug} rider={rider} />
          <PinSheet open={pinOpen} onClose={() => setPinOpen(false)} slug={slug} />
        </>
      )}
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <p>
      <span className="display block text-[40px] font-extrabold">{value}</span>
      <span className="mt-1 block text-[14px] text-muted">{label}</span>
    </p>
  );
}

function ProfileSheet({ open, onClose, slug, rider }: { open: boolean; onClose: () => void; slug: string; rider: RiderLite }) {
  const [name, setName] = useState(rider.name);
  const [emoji, setEmoji] = useState(rider.emoji);
  const [color, setColor] = useState(rider.color);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const trimmed = name.replace(/\s+/g, " ").trim();
  return (
    <Sheet open={open} onClose={onClose} title="Your profile">
      <div className="mb-5 flex justify-center">
        <Avatar rider={{ name: trimmed || rider.name, emoji, color }} size={84} />
      </div>
      <label htmlFor="profile-name" className="mb-1.5 block text-[14px] font-semibold">
        Name
      </label>
      <input
        id="profile-name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        maxLength={24}
        autoComplete="nickname"
        aria-describedby="profile-name-help"
        className="field"
      />
      <p id="profile-name-help" className={`mb-5 mt-1.5 text-[14px] ${error ? "text-danger" : "text-faint"}`}>
        {error ?? "What the crew sees on your rides, comments and stops."}
      </p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {AVATAR_EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            aria-label={`Avatar ${e}`}
            aria-pressed={emoji === e}
            className={`grid aspect-square min-h-11 place-items-center rounded-panel text-[22px] transition-colors ${emoji === e ? "bg-text" : "bg-surface-2 hover:bg-surface-3"}`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-5 justify-items-center gap-3 sm:grid-cols-10">
        {AVATAR_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Colour ${c}`}
            aria-pressed={color === c}
            className={`h-10 w-10 rounded-full transition-transform ${color === c ? "scale-110 ring-[3px] ring-text ring-offset-2 ring-offset-surface" : ""}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <button
        disabled={busy || trimmed.length < 2}
        onClick={() =>
          start(async () => {
            const res = await attempt(() => updateProfile(slug, { name: trimmed, emoji, color }));
            if (!res) return;
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            toast("Profile saved");
          })
        }
        className="btn btn-ink mt-6 w-full !min-h-12"
      >
        {busy && <Loader2 size={16} className="animate-spin" />} Save profile
      </button>
    </Sheet>
  );
}

function PinSheet({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  // Asked twice, as when joining: a typo here would lock the rider out of every other phone.
  const [next, setNext] = useState<string | null>(null);
  const close = () => {
    setCurrent(null);
    setNext(null);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={current === null ? "Current PIN" : next === null ? "New PIN" : "New PIN again"}>
      <div className="pb-2">
        {current === null ? (
          <PinPad key="current" onComplete={async (pin) => void setCurrent(pin)} />
        ) : next === null ? (
          <PinPad key="new" onComplete={async (pin) => void setNext(pin)} />
        ) : (
          <PinPad
            key="confirm"
            label="Enter the new PIN once more"
            onComplete={async (pin) => {
              if (pin !== next) {
                setTimeout(() => setNext(null), 900);
                return "PINs didn't match. Try again.";
              }
              const res = await changePin(slug, current, pin);
              if (!res.ok) {
                setTimeout(() => {
                  setCurrent(null);
                  setNext(null);
                }, 900);
                return res.error;
              }
              toast("PIN changed. Other phones are signed out.");
              close();
            }}
          />
        )}
      </div>
    </Sheet>
  );
}
