"use client";

import { useState, useRef, useCallback } from "react";

type DraggableImageProps = {
  src: string;
  alt: string;
  objectPosition?: string;
  onPositionChange: (pos: string) => void;
  onRefresh?: () => void;
  className?: string;
};

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function parsePosition(pos: string | undefined): [number, number] {
  if (!pos) return [50, 50];
  const parts = pos.split("%").map((s) => parseFloat(s.trim()));
  return [parts[0] ?? 50, parts[1] ?? 50];
}

export function DraggableImage({
  src,
  alt,
  objectPosition,
  onPositionChange,
  onRefresh,
  className,
}: DraggableImageProps) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const [livePosition, setLivePosition] = useState<string | undefined>(undefined);

  const currentPosition = livePosition ?? objectPosition;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!src) return;
      e.preventDefault();
      const [posX, posY] = parsePosition(currentPosition);
      dragStart.current = { x: e.clientX, y: e.clientY, posX, posY };
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [src, currentPosition],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !dragStart.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPct = ((e.clientX - dragStart.current.x) / rect.width) * 100;
      const deltaYPct = ((e.clientY - dragStart.current.y) / rect.height) * 100;
      const newX = clamp(dragStart.current.posX - deltaXPct, 0, 100);
      const newY = clamp(dragStart.current.posY - deltaYPct, 0, 100);
      setLivePosition(`${Math.round(newX)}% ${Math.round(newY)}%`);
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    dragStart.current = null;
    if (livePosition) {
      onPositionChange(livePosition);
      setLivePosition(undefined);
    }
  }, [dragging, livePosition, onPositionChange]);

  if (!src) {
    return (
      <div
        className={className}
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="text-[10px] text-zinc-600">No image</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", cursor: dragging ? "grabbing" : hovered ? "grab" : "default" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!dragging) setHovered(false); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="w-full h-full"
        style={{
          objectFit: "cover",
          objectPosition: currentPosition ?? "50% 50%",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      {/* Hover overlay — hidden while dragging */}
      {hovered && !dragging && (
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 select-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ opacity: 0.8 }}>
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" />
          </svg>
          <span className="text-white text-[8px] font-semibold uppercase tracking-wide">Reposition</span>
        </div>
      )}

      {/* Refresh button — top-right corner on hover */}
      {hovered && !dragging && onRefresh && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded flex items-center justify-center cursor-pointer hover:bg-black/80 transition-colors"
          aria-label="Refresh image"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      )}
    </div>
  );
}
