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
  clickAction?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  isInterruptible?: boolean;
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
  clickAction,
  isInterruptible,
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

  const variantClass =
    variant === "primary"
      ? "btn-tactile-primary"
      : variant === "secondary"
        ? "btn-tactile-secondary"
        : variant === "outline"
          ? "btn-tactile-outline"
          : variant === "brass"
            ? "btn-tactile-brass"
            : variant === "destructive"
              ? "btn-tactile-destructive"
              : "btn-tactile-ghost";

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
      clickAction={clickAction}
      isInterruptible={isInterruptible}
      type={type}
      onClick={onClick}
      className={cn("rounded-full btn-tactile", variantClass, className)}
      {...props}
    >
      {resolvedChildren}
    </AstryxButton>
  );
}
