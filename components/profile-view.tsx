"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, KeyRound, LogOut, Palette } from "lucide-react";
import { changePin, signOut, updateProfile } from "@/app/g/[slug]/actions";
import { AVATAR_COLORS, AVATAR_EMOJIS } from "@/lib/config";
import { km } from "@/lib/format";
import type { FeedItem } from "@/lib/data";
import type { RiderLite } from "@/lib/types";
import { Avatar } from "./avatar";
import { PinPad } from "./pin-pad";
import { RouteArt } from "./route-art";
import { Sheet } from "./sheet";
import { toast } from "./toast";

const TABS = [
  { key: "added", label: "Added" },
  { key: "in", label: "I'm in" },
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
}: {
  slug: string;
  rider: RiderLite;
  isMe: boolean;
  joinedAt: number;
  added: FeedItem[];
  imIn: FeedItem[];
  ridden: FeedItem[];
}) {
  const [tab, setTab] = useState<Tab>("added");
  const [styleOpen, setStyleOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const router = useRouter();
  const list = tab === "added" ? added : tab === "in" ? imIn : ridden;
  const riddenKm = ridden.reduce((s, d) => s + d.distanceKm, 0);

  return (
    <div>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/80 px-3 py-2.5 backdrop-blur-xl">
        {!isMe && (
          <button onClick={() => router.back()} className="grid h-10 w-10 place-items-center" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="flex-1 truncate px-1 font-display text-xl font-bold">{rider.name}</h1>
      </header>

      <section className="relative overflow-hidden px-4 pb-5 pt-6">
        <div
          className="absolute inset-x-0 top-0 h-40 opacity-40"
          style={{ background: `radial-gradient(60% 100% at 30% 0%, ${rider.color}55, transparent)` }}
        />
        <div className="relative flex items-center gap-5">
          <motion.div initial={{ scale: 0.8, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
            <Avatar rider={rider} size={84} />
          </motion.div>
          <div className="grid flex-1 grid-cols-3 text-center">
            <Count n={added.length} label="added" />
            <Count n={ridden.length} label="ridden" />
            <Count n={imIn.length} label="in for" />
          </div>
        </div>
        <p className="relative mt-4 font-display text-2xl font-bold">{rider.name}</p>
        <p className="relative text-sm text-muted" suppressHydrationWarning>
          Riding with the crew since {new Date(joinedAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
          {riddenKm > 0 && ` · ${km(riddenKm)} ridden`}
        </p>
        {isMe && (
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <SettingButton icon={<Palette size={16} />} onClick={() => setStyleOpen(true)}>
              Avatar
            </SettingButton>
            <SettingButton icon={<KeyRound size={16} />} onClick={() => setPinOpen(true)}>
              PIN
            </SettingButton>
            <SettingButton
              icon={<LogOut size={16} />}
              onClick={async () => {
                if (!confirm("Sign out on this phone? You'll need your PIN to get back in.")) return;
                await signOut(slug);
                router.refresh();
              }}
            >
              Sign out
            </SettingButton>
          </div>
        )}
      </section>

      <div className="sticky top-[61px] z-20 flex border-b border-line bg-bg/90 backdrop-blur-xl">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`relative flex-1 py-3 text-sm font-semibold ${tab === t.key ? "text-text" : "text-faint"}`}>
            {t.label}
            {tab === t.key && <motion.span layoutId="profile-tab" className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="px-8 py-16 text-center text-sm text-faint">
          {tab === "added"
            ? isMe
              ? "Nothing added yet. Hit + and drop a Maps link."
              : `${rider.name} hasn't added anything yet.`
            : tab === "in"
              ? "Not in for any ride yet."
              : "No rides logged yet."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {list.map((d, i) => (
            <motion.div key={d.id} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.025 }}>
              <Link href={`/g/${slug}/d/${d.id}`} className="relative block aspect-square overflow-hidden bg-surface">
                <RouteArt id={`p-${tab}-${d.id}`} route={d.route} category={d.category} width={160} height={160} labels={false} animate={false} map className="h-full w-full" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-6">
                  <p className="truncate text-[12px] font-bold leading-tight">{d.name}</p>
                  <p className="text-[10px] text-white/60">{km(d.distanceKm)}</p>
                </div>
                <span className="absolute right-1.5 top-1.5 text-sm">
                  {d.riddenBy.some((r) => r.rider.id === rider.id) ? "🏁" : d.status === "hailmary" ? "🙏" : d.status === "planned" ? "📅" : ""}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {isMe && (
        <>
          <StyleSheet open={styleOpen} onClose={() => setStyleOpen(false)} slug={slug} rider={rider} />
          <PinSheet open={pinOpen} onClose={() => setPinOpen(false)} slug={slug} />
        </>
      )}
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold leading-none">{n}</p>
      <p className="mt-1 text-[12px] text-faint">{label}</p>
    </div>
  );
}

function SettingButton({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 py-2.5 text-[13px] font-semibold">
      {icon}
      {children}
    </button>
  );
}

function StyleSheet({ open, onClose, slug, rider }: { open: boolean; onClose: () => void; slug: string; rider: RiderLite }) {
  const [emoji, setEmoji] = useState(rider.emoji);
  const [color, setColor] = useState(rider.color);
  const [busy, start] = useTransition();
  return (
    <Sheet open={open} onClose={onClose} title="Your look">
      <div className="mb-4 flex justify-center">
        <Avatar rider={{ name: rider.name, emoji, color }} size={80} />
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {AVATAR_EMOJIS.map((e) => (
          <button key={e} onClick={() => setEmoji(e)} className={`grid aspect-square place-items-center rounded-xl text-xl ${emoji === e ? "bg-surface-3 ring-2 ring-accent" : "bg-surface-2"}`}>
            {e}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-between">
        {AVATAR_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Colour ${c}`}
            className={`h-7 w-7 rounded-full ${color === c ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-surface" : ""}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <button
        disabled={busy}
        onClick={() =>
          start(async () => {
            await updateProfile(slug, { emoji, color });
            onClose();
            toast("Looking good");
          })
        }
        className="mt-5 w-full rounded-2xl bg-gradient-to-r from-accent to-accent-2 py-3.5 font-display font-bold text-black"
      >
        Save
      </button>
    </Sheet>
  );
}

function PinSheet({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const close = () => {
    setCurrent(null);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title={current ? "New PIN" : "Current PIN"}>
      <div className="pb-2">
        {current === null ? (
          <PinPad key="current" onComplete={async (pin) => void setCurrent(pin)} />
        ) : (
          <PinPad
            key="new"
            onComplete={async (pin) => {
              const res = await changePin(slug, current, pin);
              if (!res.ok) {
                setTimeout(() => setCurrent(null), 900);
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
