import React from "react";
import { Card } from "@astryxdesign/core/Card";
import { cn } from "@/lib/utils";

export interface BezelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  innerClassName?: string;
  elevated?: boolean;
}

/**
 * Area Editorial Card shell backed by @astryxdesign/core/Card:
 * Clean hairline container (--border-default) with crisp surface contrast and optional subtle bezel framing.
 */
export function BezelCard({
  children,
  className,
  innerClassName,
  elevated = false,
  ...props
}: BezelCardProps) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-bezel)]/45 p-1",
        elevated && "shadow-[0_12px_30px_-18px_rgba(16,24,6,0.12)]",
        className
      )}
    >
      <Card
        variant="default"
        elevation={elevated ? "low" : "none"}
        padding={0}
        className={cn(
          "h-full w-full rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6",
          innerClassName
        )}
      >
        {children}
      </Card>
    </div>
  );
}

/**
 * Signature Sage Backdrop Frame inspired by Area's #8E9C78 editorial slab.
 */
export function AuthSlabFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("slab-parent", className)}>
      <div className="slab-shadow" aria-hidden="true" />
      <div className="slab-content">{children}</div>
    </div>
  );
}
