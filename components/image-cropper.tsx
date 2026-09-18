"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { loadImageElement, cropImageToDataUrl } from "@/lib/image";

const CONTAINER = 260; // px, the on-screen crop circle's diameter
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * A lightweight, dependency-free profile-photo cropper: drag to reposition,
 * slider (or pinch, on touch) to zoom, all live inside a circular preview
 * so what you see is exactly what gets saved. Keeps profile-photo editing
 * smooth and fully adjustable without shipping a third-party library.
 */
export default function ImageCropper({
  open, imageDataUrl, onCancel, onConfirm,
}: {
  open: boolean;
  imageDataUrl: string | null;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  const pinchState = useRef<{ startDist: number; startZoom: number } | null>(null);

  const baseSize = useMemo(() => {
    if (!img) return 1;
    return CONTAINER / Math.min(img.naturalWidth, img.naturalHeight);
  }, [img]);

  const displayWidth = img ? img.naturalWidth * baseSize * zoom : 0;
  const displayHeight = img ? img.naturalHeight * baseSize * zoom : 0;

  function clamp(nextOffset: { x: number; y: number }, w = displayWidth, h = displayHeight) {
    const minX = CONTAINER - w;
    const minY = CONTAINER - h;
    return {
      x: Math.min(0, Math.max(minX, nextOffset.x)),
      y: Math.min(0, Math.max(minY, nextOffset.y)),
    };
  }

  useEffect(() => {
    if (!open || !imageDataUrl) {
      setImg(null);
      return;
    }
    let cancelled = false;
    loadImageElement(imageDataUrl).then((loaded) => {
      if (cancelled) return;
      setImg(loaded);
      setZoom(1);
      const w = loaded.naturalWidth * (CONTAINER / Math.min(loaded.naturalWidth, loaded.naturalHeight));
      const h = loaded.naturalHeight * (CONTAINER / Math.min(loaded.naturalWidth, loaded.naturalHeight));
      setOffset({ x: (CONTAINER - w) / 2, y: (CONTAINER - h) / 2 });
    });
    return () => { cancelled = true; };
  }, [open, imageDataUrl]);

  function changeZoom(nextZoom: number) {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    if (!img) { setZoom(z); return; }
    // Keep the point currently at the container's center anchored while
    // zooming, so zooming feels like it's centered on the photo, not the
    // corner -- this is what makes the slider feel smooth to use.
    setOffset((prev) => {
      const ratio = z / zoom;
      const nextW = displayWidth * ratio;
      const nextH = displayHeight * ratio;
      const next = {
        x: CONTAINER / 2 - (CONTAINER / 2 - prev.x) * ratio,
        y: CONTAINER / 2 - (CONTAINER / 2 - prev.y) * ratio,
      };
      return clamp(next, nextW, nextH);
    });
    setZoom(z);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, startOffsetX: offset.x, startOffsetY: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setOffset(clamp({ x: dragState.current.startOffsetX + dx, y: dragState.current.startOffsetY + dy }));
  }
  function onPointerUp() {
    dragState.current = null;
  }

  // Basic pinch-to-zoom for touch devices, alongside the slider.
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchState.current = { startDist: dist, startZoom: zoom };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchState.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / pinchState.current.startDist;
      changeZoom(pinchState.current.startZoom * ratio);
    }
  }
  function onTouchEnd() {
    pinchState.current = null;
  }

  async function confirm() {
    if (!img) return;
    setSaving(true);
    try {
      const cropped = cropImageToDataUrl(img, CONTAINER, offset.x, offset.y, zoom, 480);
      onConfirm(cropped);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust your photo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative touch-none select-none overflow-hidden rounded-full border-4 border-primary/20 bg-secondary"
            style={{ width: CONTAINER, height: CONTAINER, cursor: img ? "grab" : "default" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.src}
                alt="Crop preview"
                draggable={false}
                className="absolute max-w-none"
                style={{ width: displayWidth, height: displayHeight, left: offset.x, top: offset.y }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>

          <div className="flex w-full items-center gap-3">
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              disabled={!img}
              className="w-full accent-primary"
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">Drag to reposition, use the slider to zoom.</p>

          <div className="flex w-full gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button type="button" className="flex-1" onClick={confirm} disabled={!img || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Use Photo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
