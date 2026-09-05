import { Link } from 'react-router-dom'
import { api } from '../api'
import { Empty, Loading, Status, formatDuration, relativeTime } from '../components'
import { IconCritical, IconInfo, IconWarning } from '../icons'
import { usePolling, useSession } from '../session'

const SEVERITY_ICON = { CRITICAL: IconCritical, WARNING: IconWarning, INFO: IconInfo }
const SEVERITY_TONE = { CRITICAL: 'critical', WARNING: 'warning', INFO: 'info' }
const SEVERITY_RANK = { CRITICAL: 3, WARNING: 2, INFO: 1 }

export default function Dashboard() {
  const { token } = useSession()

  const { data, loading } = usePolling(
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

  if (loading && !data) return <Loading variant="stats" />
  if (!data) return <Empty title="Dashboard data is unavailable" />

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
    .slice(0, 10)

  const openAlerts = [...data.cropAlerts, ...offlineAlerts]
  const worst = openAlerts.reduce(
    (acc, a) => (SEVERITY_RANK[a.severity] > SEVERITY_RANK[acc] ? a.severity : acc),
    'INFO',
  )

  const zones = data.valveList

  return (
    <>
      <div className="stat-strip">
        <div className="stat">
          <div className="stat-label">Sensors online</div>
          <div className="stat-value">
            {data.sensors.online} / {data.sensors.total}
          </div>
          <div className="stat-meta">
            {data.sensors.offline} offline, {data.sensors.lowBattery} low battery
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Fields at optimal health</div>
          <div className="stat-value">{data.crops.optimalPercent}%</div>
          <div className="stat-meta">
            {data.crops.optimalFields} of {data.crops.totalFields} fields
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Zones irrigating</div>
          <div className="stat-value">{data.valves.running}</div>
          <div className="stat-meta">of {data.valves.totalZones} zones</div>
        </div>
        <div className="stat">
          <div className="stat-label">Open alerts</div>
          <div
            className="stat-value"
            style={{ color: openAlerts.length ? `var(--status-${SEVERITY_TONE[worst]})` : undefined }}
          >
            {openAlerts.length}
          </div>
          <div className="stat-meta">
            {openAlerts.length ? `highest severity: ${worst.toLowerCase()}` : 'nothing needs attention'}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Fields</h2>
            <Link to="/crops" style={{ marginLeft: 'auto', fontSize: 13 }}>
              View all
            </Link>
          </div>
          {data.cropList.length === 0 ? (
            <Empty title="No fields configured yet" />
          ) : (
            data.cropList.map((crop) => (
              <Link key={crop.cropId} to={`/crops/${crop.cropId}`} className="field-row">
                <div>
                  <div className="field-name">{crop.name}</div>
                  <div className="field-meta mono">{crop.cropId}</div>
                </div>
                <div className="field-meta">{crop.cropType}</div>
                <Status value={crop.status} />
                <div className="field-meta mono">{relativeTime(crop.lastUpdated)}</div>
              </Link>
            ))
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Alert feed</h2>
          </div>
          {feed.length === 0 ? (
            <Empty title="No events in the last window" />
          ) : (
            <div className="alert-feed">
              {feed.map((alert) => {
                const Icon = SEVERITY_ICON[alert.severity] || IconInfo
                return (
                  <div key={alert.id} className="alert-item">
                    <span className={`status-${SEVERITY_TONE[alert.severity] || 'info'}`}>
                      <Icon />
                    </span>
                    <div>
                      <div className="alert-source">{alert.source}</div>
                      <div className="alert-message">{alert.message}</div>
                      <div className="alert-time">{relativeTime(alert.timestamp)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2 className="card-title">Irrigation zones today</h2>
          <Link to="/irrigation" style={{ marginLeft: 'auto', fontSize: 13 }}>
            Manage
          </Link>
        </div>
        {zones.length === 0 ? (
          <Empty title="No irrigation zones configured" />
        ) : (
          <div className="zone-rail">
            {zones.map((valve) => (
              <div key={valve.valveId} className="zone-chip">
                <div className="zone-name">{valve.zoneName}</div>
                <div className="field-meta mono" style={{ marginBottom: 8 }}>
                  {valve.valveId}
                </div>
                <Status value={valve.state} />
                <div className="field-meta mono" style={{ marginTop: 6 }}>
                  {valve.state === 'OPEN'
                    ? `${formatDuration(valve.secondsRemaining) ?? '--:--'} left, ${valve.flowRateLpm} L/min`
                    : `last change ${relativeTime(valve.lastChangedAt)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
