import Link from "next/link";
import { ChevronRight, LogOut, ShieldCheck } from "lucide-react";
import { cols, fromDoc, type Group } from "@/lib/db";
import { isAdmin, registrationOpen } from "@/lib/auth";
import { adminLogin, adminLogout, createGroup } from "./actions";
import { AdminLoginForm } from "@/components/admin-forms";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
        <div className="rounded-3xl border border-line bg-surface/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <span className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-accent/12 text-accent">
            <ShieldCheck size={22} />
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            list-it<span className="text-accent">.</span> admin
          </h1>
          <p className="mb-6 mt-1 text-sm text-muted">Create crews, manage riders and reset PINs.</p>
          <AdminLoginForm action={adminLogin} />
        </div>
        <Link href="/" className="mt-6 text-center text-sm text-faint hover:text-muted">
          Back to list-it
        </Link>
      </main>
    );
  }

  const c = await cols();
  const countBy = (rows: { _id: string; n: number }[]) => new Map(rows.map((r) => [r._id, r.n]));
  const [all, riderCounts, destCounts] = await Promise.all([
    c.groups.find().sort({ createdAt: -1 }).toArray().then((xs) => xs.map((x) => fromDoc<Group>(x))),
    c.riders
      .aggregate<{ _id: string; n: number }>([{ $match: { removedAt: null } }, { $group: { _id: "$groupId", n: { $sum: 1 } } }])
      .toArray(),
    c.destinations
      .aggregate<{ _id: string; n: number }>([{ $match: { deletedAt: null } }, { $group: { _id: "$groupId", n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const rc = countBy(riderCounts);
  const dc = countBy(destCounts);

  return (
    <main className="relative z-10 mx-auto min-h-dvh max-w-xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Crews</h1>
        <form action={adminLogout}>
          <button className="flex items-center gap-1.5 text-sm text-faint">
            <LogOut size={15} /> Log out
          </button>
        </form>
      </div>

      <form action={createGroup} className="mb-8 flex gap-2">
        <input
          name="name"
          required
          maxLength={60}
          placeholder="New crew name, e.g. Weekend Morning Rides"
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        <button className="rounded-xl btn-primary px-5 font-bold text-black">Create</button>
      </form>

      <ul className="space-y-2">
        {all.map((g) => (
          <li key={g.id}>
            <Link href={`/admin/g/${g.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong hover:bg-surface-2">
              <div className="flex-1">
                <p className="font-semibold">{g.name}</p>
                <p className="text-[13px] text-faint">
                  {rc.get(g.id) ?? 0} riders · {dc.get(g.id) ?? 0} rides ·{" "}
                  {registrationOpen(g) ? <span className="text-emerald-400">joining open</span> : "joining closed"}
                </p>
              </div>
              <ChevronRight size={18} className="text-faint" />
            </Link>
          </li>
        ))}
        {all.length === 0 && <p className="text-faint">No crews yet. Create one above.</p>}
      </ul>
    </main>
  );
}
