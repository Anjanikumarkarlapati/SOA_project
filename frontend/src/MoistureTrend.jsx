import { clockTime } from './components'
import { useI18n } from './i18n/react'

/**
 * Soil moisture over the last 24 hours as a stem-and-cap chart, drawn the way the reference draws
 * its analytics: no axis lines, no grid, one stem per reading over the hero photograph.
 *
 * Plain elements rather than a charting library: 24 stems need no scales or layout engine, and it
 * keeps recharts out of the dashboard's bundle entirely.
 */
export default function MoistureTrend({ series }) {
  const { t } = useI18n()
  if (!series || series.length < 2) {
    return <p className="hero-empty">{t('chart.notEnough')}</p>
  }

  const values = series.map((point) => point.soilMoisture)
  // Scaled to the day's own range with a little headroom, so a six-point swing reads as movement
  // instead of a flat row of stems pinned to a 0-100 axis. The exact figures live in the tooltips.
  const lo = Math.max(0, Math.min(...values) - 4)
  const hi = Math.min(100, Math.max(...values) + 4)
  const span = hi - lo || 1

  const last = series.length - 1
  const ticks = [0, Math.round(last / 3), Math.round((2 * last) / 3), last]

  return (
    <>
      <div className="hero-axis" aria-hidden="true">
        {ticks.map((i) => (
          <span key={i}>{clockTime(series[i].timestamp)}</span>
        ))}
      </div>
      <ol className="lollipops" aria-label="Soil moisture by reading, last 24 hours">
        {series.map((point, i) => (
          <li
            key={point.timestamp}
            className="lollipop"
            style={{ '--h': `${14 + ((point.soilMoisture - lo) / span) * 78}%`, '--i': i }}
          >
            <span className="lollipop-tip">
              {clockTime(point.timestamp)}, {point.soilMoisture}%
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}
