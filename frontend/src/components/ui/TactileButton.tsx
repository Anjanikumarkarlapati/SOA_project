"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type TactileButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "brass"
  | "destructive";

export interface TactileButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TactileButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_VARS: Record<
  TactileButtonVariant,
  { face: string; text: string; border: string; depth: string }
> = {
  primary: {
    face: "var(--accent)",
    text: "var(--on-accent)",
    border: "color-mix(in oklab, var(--accent) 82%, #1a2206)",
    depth: "2px",
  },
  secondary: {
    face: "var(--accent-wash)",
    text: "var(--text-primary)",
    border: "color-mix(in oklab, var(--accent) 22%, var(--border-default))",
    depth: "2px",
  },
  brass: {
    face: "var(--block)",
    text: "#FFFFFF",
    border: "color-mix(in oklab, var(--block) 78%, #1a2206)",
    depth: "2px",
  },
  destructive: {
    face: "var(--status-critical)",
    text: "#FFFFFF",
    border: "color-mix(in oklab, var(--status-critical) 75%, #1a0605)",
    depth: "2px",
  },
  ghost: {
    face: "transparent",
    text: "var(--text-secondary)",
    border: "transparent",
    depth: "0px",
  },
};

export function TactileButton({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className,
  children,
  disabled,
  style,
  ...props
}: TactileButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const v = VARIANT_VARS[variant];

  if (variant === "ghost") {
    return (
      <button
        type="button"
        {...props}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-wash)] active:scale-[0.985]",
          size === "sm" && "min-h-[38px] px-3.5 py-1.5 text-xs",
          size === "md" && "min-h-[44px] px-4 py-2 text-sm",
          size === "lg" && "min-h-[48px] px-6 py-2.5 text-base",
          fullWidth && "w-full",
          className
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          leadingIcon && <span className="inline-flex items-center">{leadingIcon}</span>
        )}
        <span>{children}</span>
        {trailingIcon && <span className="inline-flex items-center">{trailingIcon}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      {...props}
      disabled={isDisabled}
      style={
        {
          "--btn-face": v.face,
          "--btn-text": v.text,
          "--btn-border": v.border,
          "--btn-depth": v.depth,
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        "group relative inline-flex select-none items-center justify-center rounded-full p-0 text-left font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] disabled:opacity-55 disabled:cursor-not-allowed",
        size === "sm" && "min-h-[40px] text-xs",
        size === "md" && "min-h-[44px] text-sm",
        size === "lg" && "min-h-[48px] text-[15px]",
        fullWidth && "w-full",
        className
      )}
    >
      {/* Layer 1: Clean subtle extruded bottom lip */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          backgroundColor: "color-mix(in oklab, var(--btn-face) 74%, #101506)",
          border: "1px solid var(--btn-border)",
          boxShadow: "0 3px 10px -3px rgba(16, 24, 6, 0.22)",
        }}
      />

      {/* Layer 2: Crisp pill face */}
      <span
        className={cn(
          "relative z-10 inline-flex w-full items-center justify-center gap-2 rounded-full font-semibold transition-transform duration-150 [transition-timing-function:var(--ease-out)]",
          "-translate-y-[var(--btn-depth)] group-hover:not-disabled:-translate-y-[calc(var(--btn-depth)+1px)] group-active:not-disabled:translate-y-0 group-active:not-disabled:scale-[0.985] group-active:not-disabled:duration-75",
          size === "sm" && "min-h-[40px] px-4 py-1.5",
          size === "md" && "min-h-[44px] px-5 py-2",
          size === "lg" && "min-h-[48px] px-7 py-2.5"
        )}
        style={{
          backgroundColor: "var(--btn-face)",
          color: "var(--btn-text)",
          border: "1px solid var(--btn-border)",
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.24)",
        }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          leadingIcon && <span className="inline-flex shrink-0 items-center">{leadingIcon}</span>
        )}
        <span className="truncate">{children}</span>
        {trailingIcon && (
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform duration-150 [transition-timing-function:var(--ease-out)] group-hover:translate-x-0.5"
          >
            {trailingIcon}
          </span>
        )}
      </span>
    </button>
  );
}
