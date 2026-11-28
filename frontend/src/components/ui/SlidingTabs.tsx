"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface SlidingTabOption<T extends string> {
  value: T;
  label: string;
  badge?: string | number;
}

export interface SlidingTabsProps<T extends string> {
  options: SlidingTabOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function SlidingTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = "View selector",
  className,
}: SlidingTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-bezel)] p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              active
                ? "bg-[var(--accent)] text-[var(--on-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--accent-wash)] hover:text-[var(--text-primary)]"
            )}
          >
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums",
                  active
                    ? "bg-black/20 text-[var(--on-accent)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
