"use client";

import { useActionState, useState } from "react";
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
        className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-text py-3 font-bold text-black disabled:opacity-50">
        Enter
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
      {message && <p className="mt-1.5 w-full text-xs text-accent-2">{message}</p>}
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
      className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-left text-[13px]"
    >
      <span className="min-w-0 flex-1 truncate font-mono text-muted">{url}</span>
      {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
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
