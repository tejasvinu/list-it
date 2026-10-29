"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Bell, Map, Plus, Rows3 } from "lucide-react";
import { Avatar } from "./avatar";
import { Wordmark } from "./wordmark";
import type { RiderLite } from "@/lib/types";

/** A plain bottom bar on phones; a sidebar with labels on desktop. */
export function BottomNav({ slug, me, unread, groupName }: { slug: string; me: RiderLite; unread: boolean; groupName: string }) {
  const path = usePathname();
  const base = `/g/${slug}`;
  // Full-screen flows hide the nav.
  if (path.startsWith(`${base}/new`) || path.endsWith("/edit")) return null;

  const items = [
    { href: base, icon: Rows3, label: "Rides", active: path === base || path.startsWith(`${base}/d/`) },
    { href: `${base}/map`, icon: Map, label: "Map", active: path.startsWith(`${base}/map`) },
    { href: `${base}/new`, icon: Plus, label: "Add a ride", plus: true },
    { href: `${base}/activity`, icon: Bell, label: "Activity", active: path.startsWith(`${base}/activity`), dot: unread },
    { href: `${base}/r/${me.id}`, label: "You", me: true, active: path.startsWith(`${base}/r/${me.id}`) },
  ];

  return (
    <nav
      aria-label="Crew"
      className="fixed inset-x-0 bottom-0 z-40 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line)]
        lg:inset-y-0 lg:right-auto lg:flex lg:w-[248px] lg:flex-col lg:bg-bg lg:px-4 lg:pb-6 lg:pt-7 lg:shadow-[1px_0_0_var(--line)]"
    >
      <Link href={base} className="mb-9 hidden px-2 lg:block">
        <Wordmark size={22} />
        <p className="mt-2 truncate text-[15px] text-muted">{groupName}</p>
      </Link>
      <ul className="mx-auto flex h-16 max-w-[480px] items-stretch justify-around lg:mx-0 lg:h-auto lg:max-w-none lg:flex-1 lg:flex-col lg:justify-start lg:gap-0.5">
        {items.map((item) => (
          <li key={item.label} className={`flex-1 lg:flex-none ${item.plus ? "lg:order-last lg:mt-6" : ""}`}>
            <Link
              href={item.href}
              aria-label={item.label}
              aria-current={item.active ? "page" : undefined}
              className={`group relative flex h-full flex-col items-center justify-center gap-1 transition-colors lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-full lg:px-3 ${
                item.plus ? "" : item.active ? "text-text lg:bg-surface-2" : "text-faint hover:text-text lg:hover:bg-surface-2/70"
              }`}
            >
              {item.plus ? (
                <motion.span
                  whileTap={{ scale: 0.92 }}
                  className="btn btn-ink h-11 w-11 !px-0 lg:w-full lg:!px-5"
                >
                  <Plus size={22} strokeWidth={2.4} />
                  <span className="hidden lg:inline">Add a ride</span>
                </motion.span>
              ) : item.me ? (
                <span className={`rounded-full p-[2px] ${item.active ? "bg-text" : ""}`}>
                  <Avatar rider={me} size={24} />
                </span>
              ) : (
                item.icon && <item.icon size={22} strokeWidth={item.active ? 2.3 : 1.8} />
              )}
              {!item.plus && (
                <span className={`text-[12px] font-semibold leading-none lg:text-[15px] lg:font-medium ${item.active ? "lg:font-semibold" : ""}`}>
                  <span className="lg:hidden">{item.label}</span>
                  <span className="hidden lg:inline">{item.me ? me.name : item.label}</span>
                </span>
              )}
              {item.dot && (
                <span
                  aria-label="New activity"
                  className="absolute left-1/2 top-2.5 ml-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface lg:left-7 lg:top-2 lg:ml-0 lg:ring-bg"
                />
              )}
              {item.active && !item.plus && (
                <motion.span layoutId="nav-mark" className="absolute top-0 h-[3px] w-8 rounded-b-full bg-accent lg:hidden" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
