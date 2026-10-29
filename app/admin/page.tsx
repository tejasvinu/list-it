import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { cols, fromDoc, type Group } from "@/lib/db";
import { isAdmin, registrationOpen } from "@/lib/auth";
import { adminLogin, adminLogout, createGroup } from "./actions";
import { AdminLoginForm } from "@/components/admin-forms";
import { Wordmark } from "@/components/wordmark";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
        <Wordmark size={22} />
        <h1 className="display mt-8 text-[44px]">Admin</h1>
        <p className="mb-6 mt-2 text-[16px] text-muted">Create crews, add riders and reset PINs.</p>
        <AdminLoginForm action={adminLogin} />
        <Link href="/" className="mt-8 text-[15px] text-faint hover:text-text">
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
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8 lg:py-14">
      <Wordmark size={20} />
      <div className="mb-8 mt-8 flex items-center justify-between">
        <h1 className="display text-[44px]">Crews</h1>
        <form action={adminLogout}>
          <button className="flex min-h-11 items-center gap-1.5 text-[15px] text-faint hover:text-text">
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
          aria-label="New crew name"
          className="field min-w-0 flex-1"
        />
        <button className="btn btn-ink">Create crew</button>
      </form>

      <ul className="space-y-2">
        {all.map((g) => (
          <li key={g.id}>
            <Link href={`/admin/g/${g.id}`} className="flex items-center gap-3 rounded-panel bg-surface p-4 transition-colors hover:bg-surface-2">
              <div className="flex-1">
                <p className="display text-[22px]">{g.name}</p>
                <p className="num text-[14px] text-muted">
                  {rc.get(g.id) ?? 0} riders, {dc.get(g.id) ?? 0} rides,{" "}
                  {registrationOpen(g) ? <span className="font-semibold text-good">joining open</span> : "joining closed"}
                </p>
              </div>
              <ChevronRight size={18} className="text-faint" />
            </Link>
          </li>
        ))}
        {all.length === 0 && <p className="text-[16px] text-muted">No crews yet. Create one above.</p>}
      </ul>
    </main>
  );
}
