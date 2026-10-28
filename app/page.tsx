import { RouteWeb } from "@/components/route-web";

const demo: { route: [number, number][]; category: string }[] = [
  { route: [[12.97, 77.59], [12.6, 77.9], [11.77, 78.21], [12.6, 77.9], [12.97, 77.59]], category: "day" },
  { route: [[12.97, 77.59], [13.2, 77.65], [13.37, 77.68], [13.2, 77.65], [12.97, 77.59]], category: "short" },
  { route: [[12.97, 77.59], [12.3, 76.9], [12.42, 75.74], [12.3, 76.9], [12.97, 77.59]], category: "day" },
  { route: [[12.97, 77.59], [11.6, 77.7], [10.23, 77.49], [11.6, 77.7], [12.97, 77.59]], category: "multi" },
  { route: [[12.97, 77.59], [13.3, 76.5], [13.32, 75.77], [13.3, 76.5], [12.97, 77.59]], category: "day" },
];

const features = [
  { icon: "🔗", title: "Paste a Maps link", body: "We draw the route from Bengaluru, round-trip km and riding time." },
  { icon: "🌀", title: "Know the road", body: "Hairpins, highway vs country roads, best season, stops on the way." },
  { icon: "🤘", title: "Get the crew in", body: "React, comment, tap “I’m in” and put a date on it." },
];

export default function Home() {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-[480px] flex-col px-6 py-10 lg:max-w-6xl lg:flex-row-reverse lg:items-center lg:gap-16 lg:px-10">
      <div className="lg:flex-1">
        <RouteWeb routes={demo} width={480} height={320} className="-mx-6 h-[320px] w-[calc(100%+3rem)] [mask-image:radial-gradient(closest-side,black_65%,transparent)] lg:mx-0 lg:h-[520px] lg:w-full" />
      </div>
      <div className="flex flex-1 flex-col lg:max-w-[520px] lg:flex-none">
        <h1 className="mt-4 font-display text-5xl font-bold tracking-tight lg:text-7xl">
          list-it<span className="text-accent">.</span>
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted lg:text-xl">
          The ride list for your crew. Paste a Maps link, see the route from Bengaluru, and get everyone saying &ldquo;I&apos;m in&rdquo;.
        </p>
        <ul className="mt-8 space-y-3">
          {features.map((f) => (
            <li key={f.title} className="flex gap-3.5 rounded-2xl border border-line bg-surface/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">{f.icon}</span>
              <span>
                <span className="block font-semibold">{f.title}</span>
                <span className="mt-0.5 block text-[14px] leading-snug text-muted">{f.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-auto flex items-start gap-2 pt-10 text-sm text-faint lg:mt-10 lg:pt-0">
          <span aria-hidden>🔒</span>
          Crews are private. If you&apos;re part of one, open the link someone shared in your group.
        </p>
      </div>
    </main>
  );
}
