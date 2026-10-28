"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Bell, Home, Map, Plus } from "lucide-react";
import { Avatar } from "./avatar";
import type { RiderLite } from "@/lib/types";

export function BottomNav({ slug, me, unread }: { slug: string; me: RiderLite; unread: boolean }) {
  const path = usePathname();
  const base = `/g/${slug}`;
  // Full-screen flows hide the nav.
  if (path.startsWith(`${base}/new`) || path.endsWith("/edit")) return null;

  const items = [
    { href: base, icon: Home, label: "Feed", active: path === base },
    { href: `${base}/map`, icon: Map, label: "Map", active: path.startsWith(`${base}/map`) },
    { href: `${base}/new`, icon: Plus, label: "Add", plus: true },
    { href: `${base}/activity`, icon: Bell, label: "Activity", active: path.startsWith(`${base}/activity`), dot: unread },
    { href: `${base}/r/${me.id}`, label: "You", me: true, active: path.startsWith(`${base}/r/${me.id}`) },
  ];

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-line bg-bg/85 backdrop-blur-xl">
      <ul className="flex h-[58px] items-center justify-around px-2">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              aria-label={item.label}
              className="relative grid h-12 w-14 place-items-center"
            >
              {item.plus ? (
                <motion.span
                  whileTap={{ scale: 0.88, rotate: 90 }}
                  className="grid h-11 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-black shadow-[0_8px_24px_-6px_rgba(255,122,26,0.7)]"
                >
                  <Plus size={24} strokeWidth={2.6} />
                </motion.span>
              ) : item.me ? (
                <span className={`rounded-full p-[2px] ${item.active ? "bg-gradient-to-br from-accent to-accent-2" : ""}`}>
                  <Avatar rider={me} size={28} />
                </span>
              ) : (
                item.icon && (
                  <item.icon
                    size={25}
                    strokeWidth={item.active ? 2.5 : 1.8}
                    className={item.active ? "text-text" : "text-faint"}
                  />
                )
              )}
              {item.dot && (
                <span className="absolute right-3.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-bg" />
              )}
              {item.active && !item.me && !item.plus && (
                <motion.span layoutId="nav-dot" className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
