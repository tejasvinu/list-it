"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (history.length > 1 ? router.back() : router.push(fallback))}
      className="grid h-10 w-10 place-items-center rounded-full"
      aria-label="Back"
    >
      <ArrowLeft size={20} />
    </button>
  );
}
