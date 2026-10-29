"use client";

import { useActionState, useState } from "react";
import { refreshRoutes } from "@/app/admin/actions";
import { attempt } from "./toast";
import { Check, Copy } from "lucide-react";

export function AdminLoginForm({ action }: { action: (prev: string | null, form: FormData) => Promise<string | null> }) {
  const [error, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="space-y-3">
      <input
        name="secret"
        type="password"
        autoFocus
        placeholder="Admin secret"
        aria-label="Admin secret"
        className="field"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={pending} className="btn btn-ink w-full !min-h-12">
        Sign in
      </button>
    </form>
  );
}

/** A small form whose server action returns a message string. */
export function MessageForm({
  action,
  children,
  className = "",
}: {
  action: (prev: string | null, form: FormData) => Promise<string | null>;
  children: React.ReactNode;
  className?: string;
}) {
  const [message, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {message && <p role="status" className="mt-1.5 w-full text-[14px] text-muted">{message}</p>}
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="field flex items-center gap-2 text-left text-[15px]"
    >
      <span className="min-w-0 flex-1 truncate text-muted">{url}</span>
      <span className="flex shrink-0 items-center gap-1.5 font-semibold">
        {copied ? <Check size={16} className="text-good" /> : <Copy size={16} />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

export function ConfirmButton({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function RefreshRoutes({ groupId, ids }: { groupId: string; ids: string[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const run = async () => {
    setBusy(true);
    let updated = 0;
    let processed = 0;
    for (let i = 0; i < ids.length; i += 3) {
      const batch = ids.slice(i, i + 3);
      const result = await attempt(() => refreshRoutes(groupId, batch));
      if (!result || !result.ok) {
        setMessage(result?.error ?? "Could not refresh routes. Try again.");
        setBusy(false);
        return;
      }
      updated += result.updated;
      processed += batch.length;
      setMessage(`${processed} of ${ids.length} checked · ${updated} refreshed`);
    }
    setMessage(`${updated} of ${ids.length} refreshed. Unavailable or changed rides were left as they were.`);
    setBusy(false);
  };
  return <div>
    <button className="btn btn-line" disabled={busy || !ids.length} onClick={run}>
      {busy ? "Refreshing routes…" : "Refresh routes"}
    </button>
    <p role="status" className="mt-2 text-muted">{message || (!ids.length ? "No rides to refresh." : "Recalculate routes in small batches.")}</p>
  </div>;
}
