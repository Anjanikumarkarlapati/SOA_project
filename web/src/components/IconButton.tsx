'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * The single icon-only control used across the product.
 *
 * Two things it exists to get right, both of which were wrong when each screen styled its own:
 *
 * 1. Shape. An icon-only button is a circle, not a rounded square. The header is otherwise all
 *    pills and circles (search pill, nav pill, avatar), so a boxy highlight popping up on click
 *    read as a different design language. The 44x44 hit target stays - only the visible
 *    highlight is a circle, so touch accessibility is unaffected.
 *
 * 2. Focus. Tailwind's reset leaves `outline-style: none`, so these had no keyboard focus
 *    indicator at all. A visible ring is not optional.
 */
const base = cn(
  'inline-grid size-11 flex-none place-items-center rounded-full',
  'text-muted-foreground transition-[background-color,color,transform] duration-150',
  'hover:bg-raised hover:text-foreground',
  'active:translate-y-px active:bg-brand-wash active:text-brand',
  // The ring sits inside the 44px box so neighbouring controls are never pushed around.
  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
  'disabled:pointer-events-none disabled:opacity-50',
)

export function IconButton({
  label,
  onClick,
  disabled,
  tone = 'default',
  className,
  children,
}: {
  /** Required: an icon alone tells a screen reader nothing. */
  label: string
  onClick?: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        base,
        tone === 'danger' && 'hover:bg-status-critical/10 hover:text-status-critical active:text-status-critical',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Same shape and states, but navigates. */
export function IconLink({
  label,
  href,
  className,
  children,
}: {
  label: string
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} aria-label={label} title={label} className={cn(base, className)}>
      {children}
    </Link>
  )
}
