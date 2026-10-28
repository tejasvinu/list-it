import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { cols, fromDoc, type Group, type Rider } from "@/lib/db";
import { isAdmin, isLockedOut, registrationOpen } from "@/lib/auth";
import { siteOrigin } from "@/lib/origin";
import { Avatar } from "@/components/avatar";
import { ConfirmButton, CopyLink, MessageForm } from "@/components/admin-forms";
import { addRider, removeRider, renameGroup, resetPin, setRegistration } from "../../actions";

export const metadata = { title: "Admin · crew" };

export default async function AdminGroupPage({ params }: PageProps<"/admin/g/[id]">) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const c = await cols();
  const group = fromDoc<Group>(await c.groups.findOne({ _id: id }));
  if (!group) notFound();
  const roster = (await c.riders.find({ groupId: id, removedAt: null }).sort({ createdAt: 1 }).toArray()).map((r) =>
    fromDoc<Rider>(r),
  );
  const url = `${await siteOrigin()}/g/${group.slug}`;
  const open = registrationOpen(group);
  const input = "rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <main className="relative z-10 mx-auto min-h-dvh max-w-xl space-y-8 px-4 py-8">
      <div>
        <Link href="/admin" className="mb-4 flex items-center gap-1.5 text-sm text-faint">
          <ArrowLeft size={15} /> All crews
        </Link>
        <form action={renameGroup.bind(null, id)} className="flex gap-2">
          <input name="name" defaultValue={group.name} className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold outline-none" />
          <button className="text-sm text-faint">Rename</button>
        </form>
      </div>

      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-faint">Share link</h2>
        <CopyLink url={url} />
        <a href={url} target="_blank" className="flex items-center gap-1.5 text-sm text-accent-2">
          Open crew <ExternalLink size={13} />
        </a>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-faint">Joining</h2>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm">
            {open ? (
              <>
                <span className="font-semibold text-emerald-400">Open</span> until{" "}
                {group.registrationClosesAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
              </>
            ) : (
              <span className="font-semibold text-muted">Closed</span>
            )}
          </p>
          <div className="flex gap-2">
            <form action={setRegistration.bind(null, id, true)}>
              <button className="rounded-lg bg-surface-3 px-3 py-2 text-sm font-semibold">{open ? "Extend 3 days" : "Reopen 3 days"}</button>
            </form>
            {open && (
              <form action={setRegistration.bind(null, id, false)}>
                <button className="rounded-lg bg-surface-3 px-3 py-2 text-sm font-semibold">Close now</button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-faint">Add a rider</h2>
        <MessageForm action={addRider.bind(null, id)} className="flex flex-wrap gap-2">
          <input name="name" required placeholder="Name" maxLength={24} className={`${input} min-w-0 flex-1`} />
          <input name="pin" required placeholder="PIN" inputMode="numeric" pattern="\d{4}" maxLength={4} className={`${input} w-20`} />
          <button className="rounded-lg bg-text px-4 text-sm font-bold text-black">Add</button>
        </MessageForm>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-faint">Riders · {roster.length}</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {roster.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <Avatar rider={r} size={36} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-faint">
                  joined {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {isLockedOut(r) && <span className="text-danger"> · locked out</span>}
                </p>
              </div>
              <MessageForm action={resetPin.bind(null, r.id)} className="flex flex-wrap items-center gap-1.5">
                <input name="pin" required placeholder="New PIN" inputMode="numeric" pattern="\d{4}" maxLength={4} className={`${input} w-24`} />
                <button className="rounded-lg bg-surface-3 px-3 py-2 text-sm font-semibold">Reset</button>
              </MessageForm>
              <form action={removeRider.bind(null, r.id)}>
                <ConfirmButton message={`Remove ${r.name}? Their posts stay, they get signed out.`} className="rounded-lg px-2 py-2 text-sm text-danger">
                  Remove
                </ConfirmButton>
              </form>
            </li>
          ))}
          {roster.length === 0 && <li className="p-4 text-sm text-faint">Nobody yet. Share the link.</li>}
        </ul>
      </section>
    </main>
  );
}
