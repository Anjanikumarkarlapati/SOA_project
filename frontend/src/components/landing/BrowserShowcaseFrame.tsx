import React from "react";
import { cn } from "@/lib/utils";

export interface BrowserShowcaseFrameProps {
  url?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Editorial hero hardware showcase:
 * Wide sage-olive backdrop cradling a crisp dark tablet/mobile device bezel.
 */
export function BrowserShowcaseFrame({
  url = "agritech.field/hub/odisha-basin-01",
  title = "AgriTech Field Hub — Live Telemetry",
  children,
  className,
}: BrowserShowcaseFrameProps) {
  return (
    <div
      data-testid="browser-showcase-frame"
      aria-label={title}
      className={cn("relative mx-auto w-full pt-6 sm:pt-10", className)}
    >
      {/* Signature Sage-Olive Rounded Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 top-14 sm:top-20 rounded-[28px] sm:rounded-[34px] bg-[var(--block)]"
      />

      {/* Rising Hardware Bezel */}
      <div className="relative z-10 mx-auto w-[90%] sm:w-[82%] max-w-[920px] rounded-t-[26px] sm:rounded-t-[32px] border-[8px] sm:border-[12px] border-b-0 border-[#12140E] bg-[#12140E] shadow-[0_-8px_40px_-14px_rgba(16,24,6,0.28)]">
        {/* Minimal top camera/status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 text-[10px] font-mono text-white/65">
          <span className="truncate">{url}</span>
          <span className="hidden sm:inline uppercase tracking-wider">Field Hub · Live</span>
        </div>

        {/* Viewport Stage */}
        <div className="relative overflow-hidden rounded-t-[16px] sm:rounded-t-[20px] bg-[var(--bg-surface)]">
          {children}
        </div>
      </div>
    </div>
  );
}
