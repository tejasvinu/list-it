"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, X } from "lucide-react";
import { deletePhoto, uploadPhoto } from "@/app/g/[slug]/photo-actions";
import { PHOTO_MAX_BYTES } from "@/lib/validate";
import type { DestinationDetail } from "@/lib/data";
import type { Photo } from "@/lib/types";
import { attempt, toast } from "./toast";

type Upload = DestinationDetail["uploads"][number];

function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not resize photo")), mime, quality);
  });
}

async function resizePhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Could not read photo");
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not resize photo");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let mime = "image/webp";
    let photo = await canvasBlob(canvas, mime, 0.8);
    if (photo.type !== mime) {
      mime = "image/jpeg";
      photo = await canvasBlob(canvas, mime, 0.8);
    }
    for (const quality of [0.7, 0.6, 0.5, 0.4]) {
      if (photo.size <= 350 * 1024) break;
      photo = await canvasBlob(canvas, mime, quality);
    }
    if (photo.size > PHOTO_MAX_BYTES) throw new Error("Photo is still over 600 KB after resizing.");
    const small = document.createElement("canvas");
    const thumbScale = Math.min(1, 400 / Math.max(canvas.width, canvas.height));
    small.width = Math.max(1, Math.round(canvas.width * thumbScale));
    small.height = Math.max(1, Math.round(canvas.height * thumbScale));
    const smallContext = small.getContext("2d");
    if (!smallContext) throw new Error("Could not make thumbnail");
    smallContext.drawImage(canvas, 0, 0, small.width, small.height);
    const thumb = await canvasBlob(small, mime, 0.8);
    return { photo, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function RiderPhotos({ photos, commons = [], slug, destinationId, destinationName, ownerId, meId, allowUpload = false, compact = false }: {
  photos: Upload[];
  commons?: Photo[];
  slug: string;
  destinationId: string;
  destinationName: string;
  ownerId: string;
  meId: string;
  allowUpload?: boolean;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, start] = useTransition();
  const touchStart = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const selectedPhoto = selected === null ? null : photos[selected];
  const isOpen = selected !== null;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => previous?.focus();
  }, [isOpen]);
  useEffect(() => {
    if (selected === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
      if (event.key === "ArrowRight") setSelected((index) => index === null ? null : (index + 1) % photos.length);
      if (event.key === "ArrowLeft") setSelected((index) => index === null ? null : (index + photos.length - 1) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, photos.length]);

  function add(file: File) {
    start(async () => {
      try {
        const { photo, thumb } = await resizePhoto(file);
        const form = new FormData();
        form.set("photo", photo, "photo");
        form.set("thumb", thumb, "thumb");
        const result = await attempt(() => uploadPhoto(slug, destinationId, form));
        if (result) toast(result.ok ? "Photo added" : result.error);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Could not prepare photo.");
      }
    });
  }

  return <div>
    {allowUpload && <div className="mb-3 flex flex-wrap items-center gap-3">
      <input ref={input} type="file" accept="image/*" className="sr-only" aria-label="Choose a photo" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) add(file);
      }} />
      <button className="btn btn-line !min-h-10" disabled={busy} onClick={() => input.current?.click()}>
        <ImagePlus size={17} /> {busy ? "Adding photo…" : "Add a photo"}
      </button>
      {!compact && <span className="text-[14px] text-muted">Up to 6 per rider per ride, 400 per crew.</span>}
    </div>}
    {photos.length === 0 && !compact && <p className="text-[15px] text-muted">No rider photos yet. Add one from your ride.</p>}
    {(photos.length > 0 || commons.length > 0) && <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto">
      {photos.map((photo, index) => <button
        key={photo.id}
        className={`shrink-0 snap-start text-left ${compact ? "w-24" : "w-[260px]"}`}
        onClick={() => setSelected(index)}
        aria-label={`View photo by ${photo.rider.name}`}
      >
        <span className={`block overflow-hidden rounded-panel bg-surface-2 ${compact ? "h-20" : "h-[180px]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/g/${slug}/photo/${photo.id}?thumb=1`} alt={`Photo of ${destinationName} by ${photo.rider.name}, ${new Date(photo.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`} loading="lazy" className="h-full w-full object-cover" />
        </span>
        {!compact && <span className="mt-1.5 block truncate text-[12px] text-faint">
          {photo.rider.name}, {new Date(photo.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
        </span>}
      </button>)}
      {commons.map((photo) => <a key={photo.thumb} href={photo.page} target="_blank" rel="noreferrer" className="w-[260px] shrink-0 snap-start">
        <span className="block h-[180px] overflow-hidden rounded-panel bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.thumb} alt={photo.title} loading="lazy" className="h-full w-full object-cover" />
        </span>
        <span className="mt-1.5 block truncate text-[12px] text-faint">
          Photo: {photo.credit ?? "Wikimedia Commons"}{photo.license && `, ${photo.license}`}
        </span>
      </a>)}
    </div>}
    {selectedPhoto && selected !== null && <div
      role="dialog"
      aria-modal="true"
      aria-label="Rider photo"
      className="fixed inset-0 z-[70] flex flex-col bg-black text-white"
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const delta = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(delta) > 50) setSelected((selected + (delta < 0 ? 1 : photos.length - 1)) % photos.length);
        touchStart.current = null;
      }}
    >
      <div className="flex items-center justify-between gap-2 p-4">
        <p>{selectedPhoto.rider.name}, {new Date(selectedPhoto.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</p>
        <div className="flex gap-2">
          {(selectedPhoto.riderId === meId || ownerId === meId) && <button
            className="grid h-11 w-11 place-items-center"
            aria-label="Delete photo"
            disabled={busy}
            onClick={() => {
              if (!confirm("Delete this photo?")) return;
              start(async () => {
                const result = await attempt(() => deletePhoto(slug, selectedPhoto.id));
                if (result?.ok) setSelected(null);
                if (result) toast(result.ok ? "Photo deleted" : result.error);
              });
            }}
          ><Trash2 size={20} /></button>}
          <button ref={close} className="grid h-11 w-11 place-items-center" aria-label="Close photo" onClick={() => setSelected(null)}>
            <X size={22} />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {photos.length > 1 && <button className="grid h-11 w-11 shrink-0 place-items-center" aria-label="Previous photo" onClick={() => setSelected((selected + photos.length - 1) % photos.length)}>
          <ChevronLeft />
        </button>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/g/${slug}/photo/${selectedPhoto.id}`} alt={`Photo of ${destinationName} by ${selectedPhoto.rider.name}, ${new Date(selectedPhoto.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`} className="max-h-full min-w-0 max-w-full object-contain" />
        {photos.length > 1 && <button className="grid h-11 w-11 shrink-0 place-items-center" aria-label="Next photo" onClick={() => setSelected((selected + 1) % photos.length)}>
          <ChevronRight />
        </button>}
      </div>
      <p className="p-4 text-center text-sm">{selected + 1} / {photos.length}</p>
    </div>}
  </div>;
}
