import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { cols, fromDoc, type Group } from "@/lib/db";
import { isAdmin, registrationOpen } from "@/lib/auth";
import { adminLogin, adminLogout, createGroup } from "./actions";
import { AdminLoginForm } from "@/components/admin-forms";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
        <h1 className="mb-6 font-display text-3xl font-bold">list-it admin</h1>
        <AdminLoginForm action={adminLogin} />
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
        <button className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-5 font-bold text-black">Create</button>
      </form>

      <ul className="space-y-2">
        {all.map((g) => (
          <li key={g.id}>
            <Link href={`/admin/g/${g.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
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
