import { useEffect, useState } from 'react'
import { IconCritical, IconGood, IconInfo, IconOffline, IconWarning } from './icons'

/**
 * The stylesheet collapses CSS transitions under prefers-reduced-motion, but the chart library
 * animates in JavaScript, so it needs to be told separately.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return undefined
    const onChange = (event) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Status is never colour alone: every state carries a shape and a text label
 * (doc section 2.4 / accessibility section 6).
 */
const STATUS_MAP = {
  OPTIMAL: { tone: 'good', label: 'Optimal', Icon: IconGood },
  ONLINE: { tone: 'good', label: 'Online', Icon: IconGood },
  OPEN: { tone: 'good', label: 'Open', Icon: IconGood },
  INFO: { tone: 'info', label: 'Info', Icon: IconInfo },
  SCHEDULED: { tone: 'info', label: 'Scheduled', Icon: IconInfo },
  CLOSED: { tone: 'muted', label: 'Closed', Icon: IconGood },
  WARNING: { tone: 'warning', label: 'Attention needed', Icon: IconWarning },
  LOW_BATTERY: { tone: 'warning', label: 'Low battery', Icon: IconWarning },
  CRITICAL: { tone: 'critical', label: 'Critical', Icon: IconCritical },
  OFFLINE: { tone: 'critical', label: 'Offline', Icon: IconOffline },
  DECOMMISSIONED: { tone: 'muted', label: 'Decommissioned', Icon: IconOffline },
  NO_DATA: { tone: 'muted', label: 'No data', Icon: IconOffline },
}

export function Status({ value, label, className = '' }) {
  const entry = STATUS_MAP[value] || STATUS_MAP.NO_DATA
  const { tone, Icon } = entry
  return (
    <span className={`status status-${tone} ${className}`}>
      <Icon />
      {label ?? entry.label}
    </span>
  )
}

export function statusTone(value) {
  return (STATUS_MAP[value] || STATUS_MAP.NO_DATA).tone
}

export function statusColor(value) {
  return `var(--status-${statusTone(value)})`
}

export function Toggle({ checked, onChange, label, name, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={name || label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track">
        <span className="switch-thumb" />
      </span>
      {label ? <span className="switch-label">{label}</span> : null}
    </button>
  )
}

export function RangeTabs({ value, onChange, options }) {
  return (
    <div className="range-tabs" role="group" aria-label="Time range">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function Empty({ title, action }) {
  return (
    <div className="empty">
      <p style={{ margin: 0 }}>{title}</p>
      {action}
    </div>
  )
}

/**
 * Loading placeholders. Each variant mirrors the layout it stands in for, so nothing jumps
 * when the real data arrives.
 */
export function Loading({ rows = 4, variant = 'rows' }) {
  if (variant === 'stats') {
    return (
      <div className="stat-strip" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton-stat">
            <div className="skeleton" style={{ width: '55%', height: 12 }} />
            <div className="skeleton" style={{ width: '40%', height: 28 }} />
            <div className="skeleton" style={{ width: '70%', height: 11 }} />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'cards') {
    return (
      <div className="crop-grid" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="card skeleton-card">
            <div className="skeleton" style={{ width: '45%', height: 16 }} />
            <div className="skeleton" style={{ width: '30%', height: 32 }} />
            <div className="skeleton" style={{ width: '100%', height: 48 }} />
            <div className="skeleton" style={{ width: '80%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'detail') {
    return (
      <div className="grid" aria-hidden="true">
        <div className="card skeleton-card">
          <div className="skeleton" style={{ width: '35%', height: 18 }} />
          <div className="skeleton" style={{ width: '60%' }} />
        </div>
        <div className="card skeleton-card">
          <div className="skeleton" style={{ width: '25%', height: 14 }} />
          <div className="skeleton" style={{ width: '100%', height: 220 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="card" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton" style={{ width: '70%' }} />
          <div className="skeleton" style={{ width: '50%' }} />
          <div className="skeleton" style={{ width: '60%' }} />
          <div className="skeleton" style={{ width: '100%' }} />
        </div>
      ))}
    </div>
  )
}

/** Relative timestamps keep the operational screens scannable. */
export function relativeTime(iso) {
  if (!iso) return 'never'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function clockTime(iso) {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(seconds) {
  if (seconds == null) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
