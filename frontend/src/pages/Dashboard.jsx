import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { DataError, Freshness, Loading, Status, formatDuration, relativeTime } from '../components'
import { IconChevron, IconCritical, IconInfo, IconRefresh, IconWarning } from '../icons'
import { usePolling, useSession } from '../session'
import MoistureTrend from '../MoistureTrend'
import hills from '../assets/hills.jpg'
import hillsSmall from '../assets/hills-sm.jpg'

const SEVERITY_ICON = { CRITICAL: IconCritical, WARNING: IconWarning, INFO: IconInfo }
const SEVERITY_TONE = { CRITICAL: 'critical', WARNING: 'warning', INFO: 'info' }
const SEVERITY_RANK = { CRITICAL: 3, WARNING: 2, INFO: 1 }

export default function Dashboard() {
  const { token } = useSession()
  const [fieldId, setFieldId] = useState('all')

  // Operational state: polled fast, because valve and alert state is what people watch.
  const { data, loading, error, updatedAt, refresh } = usePolling(
    async () => {
      const [sensors, crops, valves, valveList, cropList, cropAlerts, events, sensorPage] =
        await Promise.all([
          api.sensorSummary(token),
          api.cropSummary(token),
          api.valveSummary(token),
          api.valves(token),
          api.crops(token),
          api.cropAlerts(token),
          api.irrigationEvents(token),
          api.sensors(token, { size: 200 }),
        ])
      return {
        sensors,
        crops,
        valves,
        valveList,
        cropList,
        cropAlerts,
        events,
        devices: sensorPage.content,
      }
    },
    [token],
    15000,
  )

  // The 24h trend moves slowly and costs one call per field, so it polls on its own slow timer.
  // Series stay per field so the hero's field filter switches between them without another round
  // trip; the farm average is derived from them on render.
  const { data: trendFields } = usePolling(
    async () => {
      const crops = await api.crops(token)
      return Promise.all(
        crops.map((crop) =>
          api
            .cropMetrics(token, crop.cropId, '24h')
            .then((m) => ({ cropId: crop.cropId, name: crop.name, series: m.environment }))
            .catch(() => ({ cropId: crop.cropId, name: crop.name, series: [] })),
        ),
      )
    },
    [token],
    60000,
  )

  if (loading && !data) return <Loading variant="cards" rows={5} />
  if (!data) return <DataError what="the dashboard" onRetry={refresh} />

  // The feed is assembled from each service's own events - no separate notification service.
  const offlineAlerts = data.devices
    .filter((d) => d.health === 'OFFLINE' || d.health === 'LOW_BATTERY')
    .map((d) => ({
      id: `sensor-${d.deviceId}`,
      severity: d.health === 'OFFLINE' ? 'CRITICAL' : 'WARNING',
      source: d.deviceId,
      message:
        d.health === 'OFFLINE'
          ? `Device stopped reporting (last reading ${relativeTime(d.lastReadingAt)})`
          : `Battery at ${Math.round(d.batteryPercent ?? 0)}% - schedule a replacement`,
      timestamp: d.lastReadingAt || new Date().toISOString(),
    }))

  const feed = [...data.cropAlerts, ...offlineAlerts, ...data.events]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 12)

  const openAlerts = [...data.cropAlerts, ...offlineAlerts]
  const worst = openAlerts.reduce(
    (acc, a) => (SEVERITY_RANK[a.severity] > SEVERITY_RANK[acc] ? a.severity : acc),
    'INFO',
  )

  return (
    <>
      <div className="content-meta">
        <Freshness updatedAt={updatedAt} stale={Boolean(error)} />
        <button type="button" className="btn btn-quiet btn-sm" onClick={refresh}>
          <IconRefresh />
          Refresh
        </button>
      </div>

      <MoistureHero fields={trendFields} fieldId={fieldId} onFieldChange={setFieldId} />

      <div className="bento-grid">
        <BentoCard
          title="Field health"
          description="Every field scored against its own optimal envelope."
          metric={`${data.crops.optimalPercent}%`}
          metricLabel={`${data.crops.optimalFields} of ${data.crops.totalFields} fields optimal`}
        >
          <div className="bento-list">
            {data.cropList.map((crop) => (
              <Link key={crop.cropId} to={`/crops/${crop.cropId}`} className="bento-row">
                <span className="bento-row-main">
                  <span className="bento-row-title">{crop.name}</span>
                  <span className="bento-row-sub">{crop.cropType}</span>
                </span>
                <Status value={crop.status} />
                <IconChevron className="bento-row-chevron" />
              </Link>
            ))}
          </div>
        </BentoCard>

        <BentoCard
          title="Sensor network"
          description="Devices reporting telemetry across the farm right now."
          metric={`${data.sensors.online} / ${data.sensors.total}`}
          metricLabel="devices online"
        >
          <SensorMix summary={data.sensors} />
        </BentoCard>

        <BentoCard
          title="Alert feed"
          description="Threshold breaches and device faults, newest first."
          metric={String(openAlerts.length)}
          metricLabel={openAlerts.length ? `highest severity: ${worst.toLowerCase()}` : 'all clear'}
          metricTone={openAlerts.length ? SEVERITY_TONE[worst] : undefined}
        >
          {feed.length === 0 ? (
            <p className="bento-empty">No events in the last window.</p>
          ) : (
            <div className="bento-list bento-list-scroll">
              {feed.map((alert) => {
                const Icon = SEVERITY_ICON[alert.severity] || IconInfo
                return (
                  <div key={alert.id} className="bento-alert">
                    <span className={`status-${SEVERITY_TONE[alert.severity] || 'info'}`}>
                      <Icon />
                    </span>
                    <span>
                      <span className="bento-row-title">{alert.source}</span>
                      <span className="bento-alert-message">{alert.message}</span>
                      <span className="bento-row-sub mono">{relativeTime(alert.timestamp)}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </BentoCard>

        <BentoCard
          title="Irrigation zones"
          description="Valve state per zone, with time left on any active run."
          metric={String(data.valves.running)}
          metricLabel={`of ${data.valves.totalZones} zones running`}
          action={{ to: '/irrigation', label: 'Manage' }}
        >
          <div className="bento-list">
            {data.valveList.map((valve) => (
              <div key={valve.valveId} className="bento-row">
                <span className="bento-row-main">
                  <span className="bento-row-title">{valve.zoneName}</span>
                  <span className="bento-row-sub mono">
                    {valve.state === 'OPEN'
                      ? `${formatDuration(valve.secondsRemaining) ?? '--:--'} left, ${valve.flowRateLpm} L/min`
                      : `last change ${relativeTime(valve.lastChangedAt)}`}
                  </span>
                </span>
                <Status value={valve.state} />
              </div>
            ))}
          </div>
        </BentoCard>
      </div>
    </>
  )
}

/**
 * The reference's hero composition, carrying the one reading that changes slowest and matters
 * most: context line, a large serif figure beside its label, a glass pill that filters by field,
 * a hairline, then the day's readings - all on a photograph over the sage block.
 */
function MoistureHero({ fields, fieldId, onFieldChange }) {
  const selected = fields?.find((field) => field.cropId === fieldId)
  const series = fields
    ? selected
      ? selected.series
      : averageMoisture(fields.map((field) => field.series))
    : null
  const latest = series?.length ? series[series.length - 1].soilMoisture : null

  return (
    <section className="hero-stage" aria-labelledby="hero-label">
      <div
        className="hero-panel"
        style={{ '--hero-img': `url(${hills})`, '--hero-img-sm': `url(${hillsSmall})` }}
      >
        <p className="hero-crumbs">
          Soil moisture
          <IconChevron width={12} height={12} aria-hidden="true" />
          <span className="hero-crumbs-current">{selected ? selected.name : 'All fields'}</span>
        </p>

        <div className="hero-head">
          <p className="hero-figure">
            <span className="hero-value">{latest == null ? '--' : `${latest}%`}</span>
            <span className="hero-label" id="hero-label">
              {selected ? 'Current soil moisture' : 'Average soil moisture'}
            </span>
          </p>

          {fields && fields.length > 1 ? (
            <label className="hero-filter">
              <span className="sr-only">Show field</span>
              <select
                value={selected ? fieldId : 'all'}
                onChange={(event) => onFieldChange(event.target.value)}
              >
                <option value="all">All fields ({fields.length})</option>
                {fields.map((field) => (
                  <option key={field.cropId} value={field.cropId}>
                    {field.name}
                  </option>
                ))}
              </select>
              <IconChevron width={12} height={12} aria-hidden="true" />
            </label>
          ) : null}
        </div>

        <hr className="hero-rule" />

        {series ? (
          <MoistureTrend series={series} />
        ) : (
          <p className="hero-empty">Loading the last 24 hours.</p>
        )}
      </div>
    </section>
  )
}

/**
 * One tile: a header that names the card and states its headline number, over a bordered
 * panel holding the live visual.
 */
function BentoCard({ title, description, metric, metricLabel, metricTone, action, children }) {
  return (
    <section className="bento-card">
      <div className="bento-head">
        <div className="bento-head-text">
          <h2 className="bento-title">{title}</h2>
          <p className="bento-description">{description}</p>
        </div>
        {action ? (
          <Link to={action.to} className="bento-action">
            {action.label}
          </Link>
        ) : null}
      </div>

      <div className="bento-metric">
        <span
          className="bento-metric-value"
          style={metricTone ? { color: `var(--status-${metricTone})` } : undefined}
        >
          {metric}
        </span>
        <span className="bento-metric-label">{metricLabel}</span>
      </div>

      <div className="bento-visual">{children}</div>
    </section>
  )
}

/** Proportional bar of online / low-battery / offline, with the counts spelled out beside it. */
function SensorMix({ summary }) {
  const total = Math.max(summary.total, 1)
  const segments = [
    { key: 'ONLINE', label: 'Online', count: summary.online, tone: 'good' },
    { key: 'LOW_BATTERY', label: 'Low battery', count: summary.lowBattery, tone: 'warning' },
    { key: 'OFFLINE', label: 'Offline', count: summary.offline, tone: 'critical' },
  ]

  return (
    <div className="sensor-mix">
      <div className="sensor-mix-bar" role="img" aria-label={segments.map((s) => `${s.count} ${s.label}`).join(', ')}>
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <span
              key={s.key}
              className={`sensor-mix-segment tone-${s.tone}`}
              style={{ width: `${(s.count / total) * 100}%` }}
            />
          ))}
      </div>
      <div className="bento-list">
        {segments.map((s) => (
          <div key={s.key} className="sensor-mix-legend">
            <Status value={s.key} />
            <span className="mono">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Averages each field's bucketed moisture series into one farm-wide series. */
function averageMoisture(seriesPerField) {
  const buckets = new Map()
  for (const series of seriesPerField) {
    for (const point of series) {
      const entry = buckets.get(point.timestamp) || { sum: 0, count: 0 }
      entry.sum += point.soilMoisture
      entry.count += 1
      buckets.set(point.timestamp, entry)
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([timestamp, { sum, count }]) => ({
      timestamp,
      soilMoisture: Math.round((sum / count) * 10) / 10,
    }))
}
