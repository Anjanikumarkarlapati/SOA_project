"use client";

import React from "react";

export interface AgriTechLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  subtitle?: string;
  animated?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 32, icon: 22, title: "text-[21px] tracking-[-0.025em]", sub: "text-[11px] tracking-[0.04em]" },
  md: { box: 36, icon: 24, title: "text-[24px] tracking-[-0.025em]", sub: "text-[11px] tracking-[0.04em]" },
  lg: { box: 44, icon: 30, title: "text-[28px] tracking-[-0.03em]", sub: "text-[12px] tracking-[0.04em]" },
};

/**
 * Crisp Swiss-geometric botanical-horizon logo tuned for the Area editorial aesthetic.
 */
export function AgriTechLogo({
  size = "md",
  showWordmark = true,
  subtitle = "",
  animated = true,
  className = "",
}: AgriTechLogoProps) {
  const dims = SIZE_MAP[size];

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      data-testid="agritech-logo"
      data-logo-variant="geometric-botanical"
    >
      <div
        className="relative flex shrink-0 items-center justify-center rounded-[12px] bg-[var(--accent)] text-[var(--on-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
        style={{ width: dims.box, height: dims.box }}
      >
        <svg
          width={dims.icon}
          height={dims.icon}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Terraced precision contour arc */}
          <path
            d="M10 36C17.5 30.8 30.5 30.8 38 36"
            stroke="var(--accent-wash)"
            strokeWidth="2.6"
            strokeLinecap="round"
            style={
              animated
                ? {
                    strokeDasharray: 48,
                    strokeDashoffset: 0,
                    transition: "stroke-dashoffset 600ms var(--ease-out)",
                  }
                : undefined
            }
          />
          {/* Left balanced cotyledon leaf */}
          <path
            d="M24 31C16.5 29.4 13.2 22.8 15.2 15C20.8 15.6 24 20 24 27.6Z"
            fill="var(--accent-wash)"
            fillOpacity="0.88"
          />
          {/* Right dominant ascending canopy leaf */}
          <path
            d="M24 29C32.2 27.2 35.8 19.6 33.6 10.6C27.6 11.4 24 16.6 24 25.4Z"
            fill="currentColor"
          />
          {/* Telemetry precision node */}
          <circle cx="24" cy="10.5" r="2.6" fill="var(--accent-wash)" />
        </svg>
      </div>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-sans font-semibold tracking-[-0.035em] text-[var(--text-primary)] ${dims.title}`}
          >
            AgriTech
          </span>
          {subtitle && (
            <span
              className={`mt-0.5 font-mono uppercase tracking-[0.14em] text-[var(--text-secondary)] ${dims.sub}`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
