"use client";

import { usePathname } from "next/navigation";

/**
 * Phone-width column on mobile. On desktop the map and ride pages go
 * full-bleed beside the sidebar; reading pages sit in a 720px column.
 */
export function ContentFrame({ slug, children }: { slug: string; children: React.ReactNode }) {
  const path = usePathname();
  const base = `/g/${slug}`;
  const flow = path.startsWith(`${base}/new`) || path.endsWith("/edit");
  const wide = path.startsWith(`${base}/map`) || (/\/d\/[^/]+$/.test(path) && !path.startsWith(`${base}/new`));
  // The ride list itself takes two columns of cards on desktop.
  const list = path === base;
  return (
    <div className={flow ? "" : "pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-[248px]"}>
      <div
        className={`mx-auto w-full ${wide ? "max-w-[520px] lg:max-w-none" : list ? "max-w-[520px] lg:max-w-[1160px] lg:px-10" : "max-w-[520px] lg:max-w-[720px] lg:px-6"}`}
      >
        {children}
      </div>
    </div>
  );
}
