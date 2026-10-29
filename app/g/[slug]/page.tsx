import { Suspense } from "react";
import { forecast } from "@/lib/weather";
import { daysUntil, prettyDate } from "@/lib/format";
import { getFeed, getGroupContext, lite } from "@/lib/data";
import { FeedView } from "@/components/feed-view";

export default async function FeedPage({ params }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const ctx = await getGroupContext(slug);
  if (!ctx.viewer) return null;
  const items = await getFeed(ctx);
  return (
    <FeedView
      slug={slug}
      groupName={ctx.group.name}
      items={items}
      forecasts={Object.fromEntries(items.flatMap((item) => {
        if (item.status !== "planned" || !item.statusDate || daysUntil(item.statusDate) < 0 || daysUntil(item.statusDate) >= 16) return [];
        const weather = forecast(item).catch(() => null);
        return [[item.id, <Suspense key={item.id} fallback={null}><FeedForecast weather={weather} date={item.statusDate} /></Suspense>]];
      }))}
      riders={ctx.riders}
      me={lite(ctx.viewer)}
      inviteOpen={ctx.registrationOpen}
      closesAt={ctx.group.registrationClosesAt.getTime()}
    />
  );
}

async function FeedForecast({ weather, date }: { weather: ReturnType<typeof forecast>; date: string }) {
  const day = (await weather)?.find((item) => item.date === date);
  if (!day) return null;
  return <span className="num block text-[14px] text-muted">{prettyDate(date, { weekday: "short" })} · {Math.round(day.max)}° · {day.rainChance}% rain</span>;
}
