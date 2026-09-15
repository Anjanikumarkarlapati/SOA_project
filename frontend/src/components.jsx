import { useEffect, useRef, useState } from 'react'
import { IconCritical, IconGood, IconInfo, IconOffline, IconRefresh, IconWarning } from './icons'

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
 * Dismiss-on-outside-click-or-Escape for the two disclosure surfaces in the top bar (the account
 * menu and the mobile nav drawer). Listeners only exist while the surface is open, so a closed
 * menu costs nothing.
 */
export function useClickAway(active, onDismiss) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active) return undefined

    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss()
    }
    const onKey = (event) => {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [active, onDismiss])

  return ref
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

/**
 * Destructive row actions used to go through window.confirm, which steals focus, ignores the
 * theme and cannot say what is about to be lost. This is the same arm-then-confirm shape the
 * irrigation emergency stop already uses, pulled out so both sites share it.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, children }) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <button
        type="button"
        className="btn btn-quiet btn-icon"
        aria-label={label}
        onClick={() => setArmed(true)}
      >
        {children}
      </button>
    )
  }

  return (
    <span className="confirm-inline" role="group" aria-label={label}>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        onClick={() => {
          setArmed(false)
          onConfirm()
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn btn-sm" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
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

export function Empty({ title, description, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {description ? <p className="empty-description">{description}</p> : null}
      {action}
    </div>
  )
}

/**
 * A screen with no data is nearly always a service that did not answer, not a farm with nothing
 * on it. Saying which, and offering the retry, beats a bare "unavailable" line that leaves the
 * operator with nothing to press.
 */
export function DataError({ what, onRetry }) {
  return (
    <section className="card">
      <div className="empty">
        <span className="empty-mark" aria-hidden="true">
          <IconOffline />
        </span>
        <p className="empty-title">Could not load {what}</p>
        <p className="empty-description">
          The service did not respond. This retries on its own every few seconds.
        </p>
        {onRetry ? (
          <button type="button" className="btn" onClick={onRetry}>
            <IconRefresh />
            Try again
          </button>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Polled data looks identical whether it arrived a second ago or ten minutes ago, so the age of
 * the reading is part of the reading.
 */
export function Freshness({ updatedAt, stale }) {
  const [, force] = useState(0)

  // The label is a relative time, so it has to re-render on its own between polls.
  useEffect(() => {
    const timer = setInterval(() => force((n) => n + 1), 15000)
    return () => clearInterval(timer)
  }, [])

  if (!updatedAt) return null
  return (
    <span className={`freshness${stale ? ' freshness-stale' : ''}`}>
      <span className="freshness-dot" aria-hidden="true" />
      {stale ? 'Reconnecting, showing last known data' : `Updated ${relativeTime(updatedAt)}`}
    </span>
  )
}

/**
 * Loading placeholders. Each variant mirrors the layout it stands in for, so nothing jumps
 * when the real data arrives.
 */
export function Loading({ rows = 4, variant = 'rows' }) {
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
