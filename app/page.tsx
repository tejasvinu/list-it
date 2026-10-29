import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { AvatarStack } from "@/components/avatar";
import { RideFacts } from "@/components/feed-card";
import { LandingRoutes, type SampleRide } from "@/components/landing-routes";
import { Milestone } from "@/components/milestone";
import { RoadSplitBar } from "@/components/road-split";
import { RouteArt } from "@/components/route-art";
import { Wordmark } from "@/components/wordmark";

// Sample rides for the page, shaped like a real crew's list. Numbers are what list-it's own router gives
// (round trips from the city centre), so they match what a crew sees after adding the same place.
const rides: SampleRide[] = [
  {
    name: "Nandi Hills",
    area: "Chikkaballapur",
    category: "short",
    distanceKm: 123,
    durationMin: 146,
    hairpins: null,
    split: { city: 48, nh: 30, sh: 20, other: 25 },
    route: [[12.97, 77.59], [13.2, 77.65], [13.37, 77.68], [13.2, 77.65], [12.97, 77.59]],
  },
  {
    name: "Yercaud",
    area: "Salem, Tamil Nadu",
    category: "day",
    distanceKm: 363,
    durationMin: 369,
    hairpins: 20,
    split: { city: 47, nh: 144, sh: 0, other: 171 },
    route: [[12.97, 77.59], [12.6, 77.9], [11.77, 78.21], [12.6, 77.9], [12.97, 77.59]],
  },
  {
    name: "Chikmagalur",
    area: "Western Ghats, Karnataka",
    category: "day",
    distanceKm: 502,
    durationMin: 377,
    hairpins: null,
    split: { city: 48, nh: 421, sh: 0, other: 32 },
    route: [[12.97, 77.59], [13.3, 76.5], [13.32, 75.77], [13.3, 76.5], [12.97, 77.59]],
  },
  {
    name: "Coorg",
    area: "Madikeri, Kodagu",
    category: "day",
    distanceKm: 512,
    durationMin: 407,
    hairpins: null,
    split: { city: 51, nh: 450, sh: 6, other: 5 },
    route: [[12.97, 77.59], [12.3, 76.9], [12.42, 75.74], [12.3, 76.9], [12.97, 77.59]],
  },
  {
    name: "Kodaikanal",
    area: "Palani Hills, Tamil Nadu",
    category: "multi",
    distanceKm: 815,
    durationMin: 734,
    hairpins: null,
    split: { city: 47, nh: 442, sh: 127, other: 199 },
    route: [[12.97, 77.59], [11.6, 77.7], [10.23, 77.49], [11.6, 77.7], [12.97, 77.59]],
  },
];

const crew = [
  { id: "a", name: "Karthik", emoji: "🐺", color: "#60a5fa" },
  { id: "b", name: "Meera", emoji: "🦅", color: "#f43f5e" },
  { id: "c", name: "Arjun", emoji: "🏔️", color: "#4ade80" },
];

const PHOTO = {
  src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Kilometre_sign_Sikar.jpg/960px-Kilometre_sign_Sikar.jpg",
  page: "https://commons.wikimedia.org/wiki/File:Kilometre_sign_Sikar.jpg",
  credit: "DorisAntony",
  license: "CC BY-SA 3.0",
};

export default function Home() {
  const yercaud = rides[1];
  return (
    <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
      <header className="flex h-20 items-center justify-between">
        <Wordmark size={22} />
        <nav className="flex items-center gap-1 sm:gap-2">
          <a href="#how" className="hidden min-h-11 items-center px-3 text-[15px] font-medium text-muted hover:text-text sm:flex">
            How it works
          </a>
          <Link href="/admin" className="btn btn-ink !min-h-10 !px-4 text-[14px]">
            Start a crew
          </Link>
        </nav>
      </header>

      {/* What it is */}
      <section className="grid gap-8 pb-24 pt-6 lg:min-h-[calc(100dvh-80px)] lg:grid-cols-12 lg:gap-10 lg:pb-16 lg:pt-4">
        <div className="flex flex-col justify-center lg:col-span-6 lg:pb-16">
          <h1 className="display rise text-[64px] font-extrabold leading-[0.88] sm:text-[88px] lg:text-[clamp(88px,8.4vw,128px)]">
            The ride list for your crew
          </h1>
          <p className="rise mt-8 max-w-[34ch] text-[19px] leading-relaxed text-muted [animation-delay:120ms] lg:text-[21px]">
            Paste a Google Maps link. list-it works out the round trip from Bengaluru, the riding time and the road mix, and the crew says who&apos;s in.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-4 [animation-delay:220ms]">
            <Link href="/admin" className="btn btn-ink !min-h-14 !px-7 text-[17px]">
              Start a crew <ArrowRight size={18} />
            </Link>
            <p className="max-w-[26ch] text-[15px] text-muted">Already riding with one? Open the link from your group chat.</p>
          </div>
        </div>
        <figure className="lg:col-span-6">
          <div className="relative h-[min(72vh,620px)] overflow-hidden rounded-panel bg-surface-2 lg:h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PHOTO.src} alt="A whitewashed kilometre stone with a yellow national-highway cap, on a dry roadside" className="drift h-full w-full object-cover object-[50%_40%]" />
          </div>
          <figcaption className="mt-2 text-[14px] text-faint">A national-highway kilometre stone near Sikar, Rajasthan. Every ride on list-it gets one.</figcaption>
        </figure>
      </section>

      {/* The live element */}
      <section className="pb-28 lg:pb-40">
        <h2 className="display max-w-[16ch] text-[44px] leading-[0.92] sm:text-[60px]">Every ride starts in Bengaluru</h2>
        <p className="mb-10 mt-5 max-w-[46ch] text-[18px] text-muted">
          The list is drawn as one map: each line is a round trip out of the city, coloured by how long it takes. Pick one to see its stone.
        </p>
        <LandingRoutes rides={rides} />
      </section>

      {/* What a link turns into */}
      <section id="how" className="grid scroll-mt-8 gap-10 pb-28 lg:grid-cols-12 lg:gap-10 lg:pb-40">
        <div className="lg:col-span-5 lg:pt-6">
          <h2 className="display text-[44px] leading-[0.92] sm:text-[60px]">One link in, a whole ride out</h2>
          <div className="mt-6 max-w-[44ch] space-y-4 text-[18px] leading-relaxed text-muted">
            <p>
              Share a place from Google Maps, or paste the whole WhatsApp message it came in. Plus codes and plain coordinates work too.
            </p>
            <p>
              list-it routes it from the city centre and back, then splits the kilometres the way the stones do: national highway, state highway, country roads. Openly licensed photos from near the place come with it.
            </p>
            <p>The crew reacts, adds breakfast stops and viewpoints, and taps &ldquo;Count me in&rdquo;.</p>
          </div>
        </div>
        <article data-ui className="rounded-panel bg-surface p-4 sm:p-6 lg:col-span-7">
          <div className="relative overflow-hidden rounded-[4px]">
            <RouteArt id="landing-yercaud" route={yercaud.route} category={yercaud.category} width={640} height={340} map animate={false} className="h-auto w-full" />
            <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-accent px-2.5 text-[13px] font-semibold text-on-accent">
              Planned, Sat 15 Nov
            </span>
          </div>
          <div className="flex items-start gap-4 pt-3">
            <div className="min-w-0 flex-1 pt-1">
              <h3 className="display text-[40px] leading-[0.95]">{yercaud.name}</h3>
              <p className="mt-1 text-[15px] text-muted">{yercaud.area}</p>
            </div>
            <Milestone name={yercaud.name} distanceKm={yercaud.distanceKm} split={yercaud.split} size={15} className="-mt-14" />
          </div>
          <RideFacts item={{ durationMin: yercaud.durationMin, hairpins: yercaud.hairpins, category: yercaud.category }} className="mt-3" />
          <div className="mt-6">
            <RoadSplitBar split={yercaud.split} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="btn btn-accent gap-2 pl-1.5 pr-5">
              <AvatarStack riders={crew} size={30} />
              <Check size={16} strokeWidth={2.8} /> I&apos;m in <span className="num opacity-70">3</span>
            </span>
            <span className="text-[15px] text-muted">Karthik, Meera and you are up for this.</span>
          </div>
        </article>
      </section>

      {/* How joining works */}
      <section className="-mx-4 bg-[light-dark(#121311,#1f201d)] px-4 py-20 text-[#f1f1ec] sm:-mx-6 sm:px-6 lg:-mx-10 lg:grid lg:grid-cols-12 lg:gap-10 lg:px-10 lg:py-28">
        <h2 className="display text-[44px] leading-[0.92] sm:text-[60px] lg:col-span-5">No accounts. A link and a PIN.</h2>
        <div className="mt-8 lg:col-span-7 lg:mt-0">
          <div className="flex gap-4" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-7 w-7 rounded-full bg-accent sm:h-9 sm:w-9" />
            ))}
          </div>
          <div className="mt-8 grid gap-8 text-[18px] leading-relaxed sm:grid-cols-2">
            <p>
              <span className="display block text-[28px]">A secret link per crew</span>
              <span className="mt-2 block opacity-75">Each crew lives at its own address. Nobody finds it without being sent it, and different crews never see each other.</span>
            </p>
            <p>
              <span className="display block text-[28px]">Three days to join</span>
              <span className="mt-2 block opacity-75">Riders pick a name, an avatar and a 4-digit PIN. After three days joining closes, and the admin adds anyone new.</span>
            </p>
          </div>
        </div>
      </section>

      <footer className="pb-10 pt-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <p className="display text-[clamp(96px,22vw,320px)] font-extrabold leading-[0.78]">list-it</p>
          <Link href="/admin" className="btn btn-line mb-3">
            Admin
          </Link>
        </div>
        <p className="mt-8 max-w-[70ch] text-[14px] text-faint">
          Bengaluru and back, every time. Photo of the kilometre stone by{" "}
          <a href={PHOTO.page} className="underline underline-offset-4 hover:text-text">
            {PHOTO.credit}
          </a>
          , {PHOTO.license}, via Wikimedia Commons. Maps &copy; OpenStreetMap contributors.
        </p>
      </footer>
    </div>
  );
}
