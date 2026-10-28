import type { Metadata } from "next";
import { cols } from "@/lib/db";
import { getGroupContext, hasUnread, lite } from "@/lib/data";
import { JoinScreen } from "@/components/join-screen";
import { BottomNav } from "@/components/bottom-nav";
import { RouteWeb } from "@/components/route-web";
import { Toaster } from "@/components/toast";

export async function generateMetadata({ params }: LayoutProps<"/g/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { group } = await getGroupContext(slug);
  return {
    title: { default: group.name, template: `%s · ${group.name}` },
    description: "Our ride list. Bengaluru and back.",
  };
}

export default async function GroupLayout({ children, params }: LayoutProps<"/g/[slug]">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);

  if (!ctx.viewer) {
    const rows = await (await cols()).destinations
      .find({ groupId: ctx.group.id, deletedAt: null }, { projection: { _id: 0, route: 1, category: 1 } })
      .toArray();
    return (
      <JoinScreen
        slug={slug}
        groupName={ctx.group.name}
        riders={ctx.riders}
        destinationCount={rows.length}
        open={ctx.registrationOpen}
        closesAt={ctx.group.registrationClosesAt.getTime()}
        hero={<RouteWeb routes={rows} width={480} height={300} className="h-full w-full" />}
      />
    );
  }

  const unread = await hasUnread(ctx);
  return (
    <div className="relative z-10 mx-auto min-h-dvh max-w-[480px] border-line pb-[calc(70px+env(safe-area-inset-bottom))] min-[481px]:border-x">
      <Toaster />
      {children}
      <BottomNav slug={slug} me={lite(ctx.viewer)} unread={unread} />
    </div>
  );
}
