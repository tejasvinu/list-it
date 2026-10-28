import { RouteWeb } from "@/components/route-web";

const demo: { route: [number, number][]; category: string }[] = [
  { route: [[12.97, 77.59], [12.6, 77.9], [11.77, 78.21], [12.6, 77.9], [12.97, 77.59]], category: "day" },
  { route: [[12.97, 77.59], [13.2, 77.65], [13.37, 77.68], [13.2, 77.65], [12.97, 77.59]], category: "short" },
  { route: [[12.97, 77.59], [12.3, 76.9], [12.42, 75.74], [12.3, 76.9], [12.97, 77.59]], category: "day" },
  { route: [[12.97, 77.59], [11.6, 77.7], [10.23, 77.49], [11.6, 77.7], [12.97, 77.59]], category: "multi" },
  { route: [[12.97, 77.59], [13.3, 76.5], [13.32, 75.77], [13.3, 76.5], [12.97, 77.59]], category: "day" },
];

export default function Home() {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-[480px] flex-col px-6 py-10">
      <RouteWeb routes={demo} width={480} height={320} className="-mx-6 h-[320px] w-[calc(100%+3rem)]" />
      <h1 className="mt-4 font-display text-5xl font-bold tracking-tight">
        list-it<span className="text-accent">.</span>
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        The ride list for your crew. Paste a Maps link, see the route from Bengaluru, and get everyone saying &ldquo;I&apos;m in&rdquo;.
      </p>
      <p className="mt-auto pt-10 text-sm text-faint">
        Crews are private. If you&apos;re part of one, open the link someone shared in your group.
      </p>
    </main>
  );
}
