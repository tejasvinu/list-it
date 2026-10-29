"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (history.length > 1 ? router.back() : router.push(fallback))}
      className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2"
      aria-label="Back"
    >
      <ArrowLeft size={20} />
    </button>
  );
}
