'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Tile shape borrowed from the VengeanceUI agent-bento-grid: a header naming the tile over a
 * bordered inset panel holding the visual. Extended with a headline metric, because on an
 * operations dashboard the number is the point, not decoration.
 */
export function BentoCard({
  title,
  description,
  metric,
  metricLabel,
  metricTone,
  action,
  index = 0,
  className,
  children,
}: {
  title: string
  description: string
  metric?: string
  metricLabel?: string
  metricTone?: string
  action?: { href: string; label: string }
  index?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'glass group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl p-[18px]',
        'shadow-[0_1px_2px_rgba(27,31,26,0.06)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.2)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {action ? (
          <Link href={action.href} className="ml-auto flex-none text-xs font-medium text-brand hover:underline">
            {action.label}
          </Link>
        ) : null}
      </div>

      {metric ? (
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className="font-mono text-[26px] font-bold leading-none tracking-tight tabular"
            style={metricTone ? { color: `var(--status-${metricTone})` } : undefined}
          >
            {metric}
          </span>
          <span className="text-xs text-muted-foreground">{metricLabel}</span>
        </div>
      ) : null}

      <div className="relative min-h-[168px] flex-1 overflow-hidden rounded-xl border border-border bg-[rgba(var(--glass-rgb),0.4)] p-1">
        {children}
      </div>
    </motion.section>
  )
}
