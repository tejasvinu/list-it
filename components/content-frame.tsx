"use client";

import { usePathname } from "next/navigation";

/**
 * Phone-width column everywhere on mobile. On desktop the map and ride pages
 * go full-bleed beside the nav rail; reading pages stay in a centred column.
 */
export function ContentFrame({ slug, children }: { slug: string; children: React.ReactNode }) {
  const path = usePathname();
  const base = `/g/${slug}`;
  const flow = path.startsWith(`${base}/new`) || path.endsWith("/edit");
  const wide = path.startsWith(`${base}/map`) || (/\/d\/[^/]+$/.test(path) && !path.startsWith(`${base}/new`));
  return (
    <div className={flow ? "" : "pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-[232px]"}>
      <div className={`mx-auto w-full ${wide ? "max-w-[480px] lg:max-w-none" : "max-w-[480px] lg:max-w-[640px] lg:border-x lg:border-line"}`}>
        {children}
      </div>
    </div>
  );
}
