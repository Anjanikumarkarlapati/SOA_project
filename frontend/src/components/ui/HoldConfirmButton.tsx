"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface HoldConfirmButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  onConfirm: () => void;
  holdDurationMs?: number;
  label: string;
  holdingLabel?: string;
}

/**
 * Press-and-hold hardware confirmation button for destructive or irrigation override actions.
 * Animates via GPU-composited clip-path: inset(0 X% 0 0).
 */
export function HoldConfirmButton({
  onConfirm,
  holdDurationMs = 1200,
  label,
  holdingLabel = "Hold to confirm…",
  className,
  disabled,
  ...props
}: HoldConfirmButtonProps) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const cancelHold = () => {
    if (timerRef.current !== null) {
      window.cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
    setProgress(0);
  };

  const startHold = () => {
    if (disabled) return;
    setHolding(true);
    startRef.current = performance.now();

    const step = (now: number) => {
      const elapsed = now - startRef.current;
      const pct = Math.min(100, (elapsed / holdDurationMs) * 100);
      setProgress(pct);
      if (pct >= 100) {
        cancelHold();
        onConfirm();
      } else {
        timerRef.current = window.requestAnimationFrame(step);
      }
    };

    timerRef.current = window.requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.cancelAnimationFrame(timerRef.current);
      }
    };
  }, []);

  return (
    <button
      type="button"
      {...props}
      disabled={disabled}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onConfirm();
        }
      }}
      className={cn(
        "relative inline-flex min-h-[44px] select-none items-center justify-center overflow-hidden rounded-full border border-[var(--status-critical)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--status-critical)] transition-transform duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--status-critical)] disabled:opacity-50",
        className
      )}
    >
      <span className="relative z-10">{holding ? holdingLabel : label}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[var(--status-critical)] text-white"
        style={{
          clipPath: `inset(0 ${100 - progress}% 0 0)`,
        }}
      >
        {holding ? holdingLabel : label}
      </span>
    </button>
  );
}
