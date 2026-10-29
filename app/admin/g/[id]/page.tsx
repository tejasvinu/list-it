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
  const input = "field !py-2.5";
  const quiet = "btn btn-quiet !min-h-11 !px-4 text-[14px]";

  return (
    <main className="mx-auto min-h-dvh max-w-2xl space-y-10 px-4 py-8 lg:py-14">
      <div>
        <Link href="/admin" className="mb-4 flex min-h-11 items-center gap-1.5 text-[15px] text-faint hover:text-text">
          <ArrowLeft size={15} /> All crews
        </Link>
        <form action={renameGroup.bind(null, id)} className="flex gap-2">
          <input name="name" defaultValue={group.name} aria-label="Crew name" className="display min-w-0 flex-1 rounded-[4px] bg-transparent text-[44px] outline-none" />
          <button className={quiet}>Rename</button>
        </form>
      </div>

      <section className="space-y-2">
        <h2 className="display text-[24px]">Share link</h2>
        <CopyLink url={url} />
        <a href={url} target="_blank" className="flex min-h-11 items-center gap-1.5 text-[15px] font-semibold underline decoration-line-strong underline-offset-4">
          Open crew <ExternalLink size={13} />
        </a>
      </section>

      <section className="space-y-2">
        <h2 className="display text-[24px]">Joining</h2>
        <div className="flex flex-col gap-3 rounded-panel bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px]">
            {open ? (
              <>
                <span className="font-semibold text-good">Open</span> until{" "}
                {group.registrationClosesAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
              </>
            ) : (
              <span className="font-semibold text-muted">Closed</span>
            )}
          </p>
          <div className="flex gap-2">
            <form action={setRegistration.bind(null, id, true)}>
              <button className={quiet}>{open ? "Extend 3 days" : "Reopen 3 days"}</button>
            </form>
            {open && (
              <form action={setRegistration.bind(null, id, false)}>
                <button className={quiet}>Close now</button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="display text-[24px]">Add a rider</h2>
        <MessageForm action={addRider.bind(null, id)} className="flex flex-wrap gap-2">
          <input name="name" required placeholder="Name" aria-label="Rider name" maxLength={24} className={`${input} min-w-0 flex-1`} />
          <input name="pin" required placeholder="PIN" inputMode="numeric" pattern="\d{4}" maxLength={4} aria-label="Their PIN" className={`${input} !w-24`} />
          <button className="btn btn-ink">Add rider</button>
        </MessageForm>
      </section>

      <section className="space-y-2">
        <h2 className="display text-[24px]">
          Riders <span className="num text-faint">{roster.length}</span>
        </h2>
        <ul className="divide-y divide-line rounded-panel bg-surface">
          {roster.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar rider={r} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold">{r.name}</p>
                  <p className="text-[14px] text-faint">
                    Joined {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {isLockedOut(r) && <span className="font-semibold text-danger">, locked out</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pl-12 sm:pl-0">
                <MessageForm action={resetPin.bind(null, r.id)} className="flex items-center gap-1.5">
                  <input name="pin" required placeholder="New PIN" aria-label={`New PIN for ${r.name}`} inputMode="numeric" pattern="\d{4}" maxLength={4} className={`${input} !w-28`} />
                  <button className={quiet}>Reset PIN</button>
                </MessageForm>
                <form action={removeRider.bind(null, r.id)} className="ml-auto">
                  <ConfirmButton message={`Remove ${r.name}? Their posts stay, they get signed out.`} className="btn !min-h-11 !px-3 text-[14px] text-danger hover:bg-surface-2">
                    Remove
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
          {roster.length === 0 && <li className="p-4 text-[15px] text-muted">Nobody yet. Share the link.</li>}
        </ul>
      </section>
    </main>
  );
}
