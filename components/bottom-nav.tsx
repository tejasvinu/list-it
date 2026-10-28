"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Bell, Home, Map, Plus } from "lucide-react";
import { Avatar } from "./avatar";
import type { RiderLite } from "@/lib/types";

/** Floating dock on phones, a left rail with labels on desktop. */
export function BottomNav({ slug, me, unread, groupName }: { slug: string; me: RiderLite; unread: boolean; groupName: string }) {
  const path = usePathname();
  const base = `/g/${slug}`;
  // Full-screen flows hide the nav.
  if (path.startsWith(`${base}/new`) || path.endsWith("/edit")) return null;

  const items = [
    { href: base, icon: Home, label: "Feed", active: path === base },
    { href: `${base}/map`, icon: Map, label: "Map", active: path.startsWith(`${base}/map`) },
    { href: `${base}/new`, icon: Plus, label: "Add a ride", plus: true },
    { href: `${base}/activity`, icon: Bell, label: "Activity", active: path.startsWith(`${base}/activity`), dot: unread },
    { href: `${base}/r/${me.id}`, label: "You", me: true, active: path.startsWith(`${base}/r/${me.id}`) },
  ];

  return (
    <nav
      className="glass fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),12px)] z-40 mx-auto max-w-[400px] rounded-[26px]
        lg:inset-y-0 lg:left-0 lg:right-auto lg:m-0 lg:w-[232px] lg:max-w-none lg:rounded-none lg:border-y-0 lg:border-l-0 lg:bg-bg/60 lg:px-3 lg:py-6 lg:shadow-none"
    >
      <Link href={base} className="mb-8 hidden px-3 lg:block">
        <p className="font-display text-2xl font-bold tracking-tight">
          list-it<span className="text-accent">.</span>
        </p>
        <p className="mt-0.5 truncate text-[13px] text-faint">{groupName}</p>
      </Link>
      <ul className="flex h-[60px] items-center justify-around px-1.5 lg:h-auto lg:flex-col lg:items-stretch lg:gap-1 lg:px-0">
        {items.map((item) => (
          <li key={item.label} className={item.plus ? "lg:order-last lg:mt-4" : ""}>
            <Link
              href={item.href}
              aria-label={item.label}
              aria-current={item.active ? "page" : undefined}
              className={`relative grid h-12 w-14 place-items-center rounded-2xl transition-colors lg:flex lg:h-11 lg:w-full lg:items-center lg:gap-3 lg:px-3 ${
                item.plus ? "" : item.active ? "lg:bg-surface-2" : "lg:hover:bg-surface-2/60"
              }`}
            >
              {item.plus ? (
                <motion.span
                  whileTap={{ scale: 0.9 }}
                  className="btn-primary grid h-11 w-11 place-items-center rounded-full lg:flex lg:w-full lg:gap-2 lg:rounded-xl lg:font-display lg:font-bold"
                >
                  <Plus size={22} strokeWidth={2.6} />
                  <span className="hidden lg:inline">Add a ride</span>
                </motion.span>
              ) : item.me ? (
                <span className={`rounded-full p-[2px] ${item.active ? "bg-accent" : ""}`}>
                  <Avatar rider={me} size={26} />
                </span>
              ) : (
                item.icon && (
                  <item.icon
                    size={23}
                    strokeWidth={item.active ? 2.4 : 1.8}
                    className={item.active ? "text-text" : "text-faint"}
                  />
                )
              )}
              {!item.plus && (
                <span className={`hidden text-[15px] lg:inline ${item.active ? "font-semibold text-text" : "text-muted"}`}>
                  {item.me ? me.name : item.label}
                </span>
              )}
              {item.dot && (
                <span className="absolute right-3.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface lg:left-7 lg:right-auto lg:top-2.5" />
              )}
              {item.active && !item.me && !item.plus && (
                <motion.span layoutId="nav-dot" className="absolute bottom-1 h-1 w-4 rounded-full bg-accent lg:hidden" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
