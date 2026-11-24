"use client";

import React from "react";
import type { ButtonHTMLAttributes } from "react";
import {
  Button as AstryxButton,
  type ButtonVariant as AstryxButtonVariant,
} from "@astryxdesign/core/Button";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "outline" | "brass";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  endContent?: React.ReactNode;
  href?: string;
  fullWidth?: boolean;
  elevation?: "none" | "low" | "med" | "high";
  tooltip?: string;
}

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  endContent,
  href,
  fullWidth = false,
  elevation,
  tooltip,
  type = "button",
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const mappedVariant: AstryxButtonVariant =
    variant === "outline"
      ? "secondary"
      : variant === "brass"
        ? "primary"
        : variant;

  const resolvedLabel =
    label ??
    props["aria-label"] ??
    (typeof children === "string" || typeof children === "number"
      ? String(children)
      : "Action");

  const resolvedChildren =
    typeof children === "string" || typeof children === "number"
      ? undefined
      : children;

  const resolvedElevation =
    elevation ?? (mappedVariant === "primary" ? "low" : "none");

  return (
    <AstryxButton
      label={resolvedLabel}
      variant={mappedVariant}
      size={size}
      elevation={resolvedElevation}
      isLoading={loading}
      isDisabled={disabled}
      icon={icon}
      endContent={endContent}
      href={href}
      width={fullWidth ? "100%" : undefined}
      tooltip={tooltip}
      type={type}
      onClick={onClick}
      className={cn(
        "rounded-full font-semibold transition-transform duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.985]",
        className
      )}
      {...props}
    >
      {resolvedChildren}
    </AstryxButton>
  );
}
