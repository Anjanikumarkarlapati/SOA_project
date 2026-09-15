'use client'

import { Circle, Info, Warning, WarningOctagon, WifiSlash } from '@phosphor-icons/react'

/**
 * Status is never colour alone: every state carries a shape and a text label
 * (AGRITECH_UI_UX.md 2.4, and the accessibility rule in section 6).
 */
const STATUS_MAP = {
  OPTIMAL: { tone: 'good', label: 'Optimal', Icon: Circle, fill: true },
  ONLINE: { tone: 'good', label: 'Online', Icon: Circle, fill: true },
  OPEN: { tone: 'good', label: 'Open', Icon: Circle, fill: true },
  INFO: { tone: 'info', label: 'Info', Icon: Info, fill: false },
  SCHEDULED: { tone: 'info', label: 'Scheduled', Icon: Info, fill: false },
  CLOSED: { tone: 'muted', label: 'Closed', Icon: Circle, fill: true },
  WARNING: { tone: 'warning', label: 'Attention needed', Icon: Warning, fill: false },
  LOW_BATTERY: { tone: 'warning', label: 'Low battery', Icon: Warning, fill: false },
  CRITICAL: { tone: 'critical', label: 'Critical', Icon: WarningOctagon, fill: false },
  OFFLINE: { tone: 'critical', label: 'Offline', Icon: WifiSlash, fill: false },
  DECOMMISSIONED: { tone: 'muted', label: 'Decommissioned', Icon: WifiSlash, fill: false },
  NO_DATA: { tone: 'muted', label: 'No data', Icon: WifiSlash, fill: false },
} as const

export type StatusKey = keyof typeof STATUS_MAP

const TONE_TEXT: Record<string, string> = {
  good: 'text-status-good',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
  info: 'text-status-info',
  muted: 'text-status-muted',
}

export function statusTone(value: string) {
  return (STATUS_MAP[value as StatusKey] ?? STATUS_MAP.NO_DATA).tone
}

/** For inline styles and chart strokes, where a Tailwind class will not do. */
export function statusColor(value: string) {
  return `var(--status-${statusTone(value)})`
}

export function statusTextClass(value: string) {
  return TONE_TEXT[statusTone(value)] ?? TONE_TEXT.muted
}

export function Status({ value, label }: { value: string; label?: string }) {
  const entry = STATUS_MAP[value as StatusKey] ?? STATUS_MAP.NO_DATA
  const { Icon, fill } = entry
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium ${statusTextClass(value)}`}
    >
      <Icon size={16} weight={fill ? 'fill' : 'regular'} className="flex-none" />
      {label ?? entry.label}
    </span>
  )
}

/* ---------- Formatting shared across screens ---------- */

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return 'never'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function clockTime(iso: string | null | undefined) {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
