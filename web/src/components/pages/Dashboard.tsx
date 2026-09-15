'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { CaretRight, Info, Warning, WarningOctagon } from '@phosphor-icons/react'
import { BentoCard } from '@/components/BentoCard'
import { Status, formatDuration, relativeTime, statusTextClass } from '@/components/Status'
import { api, type Alert, type Sensor } from '@/lib/api'
import { usePolling, useSession } from '@/lib/session'

// Recharts is large and only this one tile needs it, so the chart is client-only and
// code-split; the tile paints its frame immediately and the plot arrives a beat later.
const MoistureTrend = dynamic(() => import('@/components/MoistureTrend'), {
  ssr: false,
  loading: () => <p className="p-4 text-xs text-muted-foreground">Loading trend...</p>,
})

const SEVERITY_ICON = { CRITICAL: WarningOctagon, WARNING: Warning, INFO: Info }
const SEVERITY_TONE: Record<string, string> = { CRITICAL: 'critical', WARNING: 'warning', INFO: 'info' }
const SEVERITY_RANK: Record<string, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 }

export default function Dashboard() {
  const { token } = useSession()

  // Operational state: polled fast, because valve and alert state is what people watch.
  const { data, loading } = usePolling(
    async () => {
      if (!token) return null
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
      return { sensors, crops, valves, valveList, cropList, cropAlerts, events, devices: sensorPage.content }
    },
    [token],
    15000,
  )

  // The 24h trend moves slowly and costs one call per field, so it polls on its own slow timer.
  const { data: trend } = usePolling(
    async () => {
      if (!token) return null
      const crops = await api.crops(token)
      const metrics = await Promise.all(
        crops.map((crop) =>
          api
            .cropMetrics(token, crop.cropId, '24h')
            .then((m) => m.environment)
            .catch(() => []),
        ),
      )
      return averageMoisture(metrics)
    },
    [token],
    60000,
  )

  if (loading && !data) return <BentoSkeleton />
  if (!data) return <p className="p-8 text-center text-sm text-muted-foreground">Dashboard data is unavailable.</p>

  // The feed is assembled from each service's own events - no separate notification service.
  const offlineAlerts: Alert[] = data.devices
    .filter((d: Sensor) => d.health === 'OFFLINE' || d.health === 'LOW_BATTERY')
    .map((d: Sensor) => ({
      id: `sensor-${d.deviceId}`,
      severity: d.health === 'OFFLINE' ? ('CRITICAL' as const) : ('WARNING' as const),
      source: d.deviceId,
      message:
        d.health === 'OFFLINE'
          ? `Device stopped reporting (last reading ${relativeTime(d.lastReadingAt)})`
          : `Battery at ${Math.round(d.batteryPercent ?? 0)}% - schedule a replacement`,
      timestamp: d.lastReadingAt || new Date().toISOString(),
    }))

  const feed = [...data.cropAlerts, ...offlineAlerts, ...data.events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12)

  const openAlerts = [...data.cropAlerts, ...offlineAlerts]
  const worst = openAlerts.reduce(
    (acc, a) => (SEVERITY_RANK[a.severity] > SEVERITY_RANK[acc] ? a.severity : acc),
    'INFO' as Alert['severity'],
  )

  const needingAttention = data.cropList.filter((c) => c.status !== 'OPTIMAL').length
  const latestMoisture = trend?.length ? trend[trend.length - 1].soilMoisture : null

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <BentoCard
        title="Field health"
        description="Every field scored against its own optimal envelope."
        metric={`${data.crops.optimalPercent}%`}
        metricLabel={`${data.crops.optimalFields} of ${data.crops.totalFields} fields optimal`}
        index={0}
      >
        <div className="grid content-start">
          {data.cropList.map((crop) => (
            <Link
              key={crop.cropId}
              href={`/crops/${crop.cropId}`}
              className="flex min-h-11 items-center gap-2.5 border-b border-border px-2.5 py-2 last:border-b-0 hover:bg-raised"
            >
              <span className="mr-auto grid min-w-0">
                <span className="truncate text-[13px] font-semibold">{crop.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{crop.cropType}</span>
              </span>
              <Status value={crop.status} />
              <CaretRight size={16} className="flex-none text-muted-foreground" />
            </Link>
          ))}
        </div>
      </BentoCard>

      <BentoCard
        title="Sensor network"
        description="Devices reporting telemetry across the farm right now."
        metric={`${data.sensors.online} / ${data.sensors.total}`}
        metricLabel="devices online"
        index={1}
      >
        <SensorMix summary={data.sensors} />
      </BentoCard>

      <BentoCard
        title="Alert feed"
        description="Threshold breaches and device faults, newest first."
        metric={String(openAlerts.length)}
        metricLabel={openAlerts.length ? `highest severity: ${worst.toLowerCase()}` : 'all clear'}
        metricTone={openAlerts.length ? SEVERITY_TONE[worst] : undefined}
        index={2}
      >
        {feed.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No events in the last window.</p>
        ) : (
          <div className="grid max-h-full content-start overflow-y-auto">
            {feed.map((alert) => {
              const Icon = SEVERITY_ICON[alert.severity] ?? Info
              return (
                <div
                  key={alert.id}
                  className="grid grid-cols-[16px_1fr] gap-2.5 border-b border-border p-2.5 last:border-b-0"
                >
                  <Icon size={16} className={statusTextClass(alert.severity)} />
                  <span>
                    <span className="block text-[13px] font-semibold">{alert.source}</span>
                    <span className="my-0.5 block text-xs leading-snug text-muted-foreground">
                      {alert.message}
                    </span>
                    <span className="block font-mono text-[11px] text-muted-foreground tabular">
                      {relativeTime(alert.timestamp)}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </BentoCard>

      {/* The wide tile. On tablet it moves last so five tiles fill three rows with no hole. */}
      <BentoCard
        title="Soil moisture, last 24 hours"
        description="Farm-wide average across every reporting field."
        metric={latestMoisture == null ? '--' : `${latestMoisture}%`}
        metricLabel={
          needingAttention
            ? `${needingAttention} field${needingAttention > 1 ? 's' : ''} outside optimal`
            : 'all fields inside optimal'
        }
        metricTone={needingAttention ? 'warning' : undefined}
        index={3}
        className="order-last md:col-span-2 lg:order-none"
      >
        <MoistureTrend series={trend} />
      </BentoCard>

      <BentoCard
        title="Irrigation zones"
        description="Valve state per zone, with time left on any active run."
        metric={String(data.valves.running)}
        metricLabel={`of ${data.valves.totalZones} zones running`}
        action={{ href: '/irrigation', label: 'Manage' }}
        index={4}
      >
        <div className="grid content-start">
          {data.valveList.map((valve) => (
            <div
              key={valve.valveId}
              className="flex min-h-11 items-center gap-2.5 border-b border-border px-2.5 py-2 last:border-b-0"
            >
              <span className="mr-auto grid min-w-0">
                <span className="truncate text-[13px] font-semibold">{valve.zoneName}</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground tabular">
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
  )
}

/** Proportional bar of online / low-battery / offline, with the counts spelled out beside it. */
function SensorMix({
  summary,
}: {
  summary: { total: number; online: number; offline: number; lowBattery: number }
}) {
  const total = Math.max(summary.total, 1)
  const segments = [
    { key: 'ONLINE', count: summary.online, bg: 'bg-status-good' },
    { key: 'LOW_BATTERY', count: summary.lowBattery, bg: 'bg-status-warning' },
    { key: 'OFFLINE', count: summary.offline, bg: 'bg-status-critical' },
  ]

  return (
    <div className="grid h-full content-start gap-3 px-2.5 py-3">
      <div className="flex h-2 gap-[3px] overflow-hidden rounded-full">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <span
              key={s.key}
              className={`min-w-1 rounded-full ${s.bg}`}
              style={{ width: `${(s.count / total) * 100}%` }}
            />
          ))}
      </div>
      <div className="grid">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5 py-1 text-xs">
            <Status value={s.key} />
            <span className="ml-auto font-mono font-semibold tabular">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BentoSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`glass h-64 animate-pulse rounded-2xl ${i === 3 ? 'md:col-span-2' : ''}`} />
      ))}
    </div>
  )
}

/** Averages each field's bucketed moisture series into one farm-wide series. */
function averageMoisture(seriesPerField: { timestamp: string; soilMoisture: number }[][]) {
  const buckets = new Map<string, { sum: number; count: number }>()
  for (const series of seriesPerField) {
    for (const point of series) {
      const entry = buckets.get(point.timestamp) || { sum: 0, count: 0 }
      entry.sum += point.soilMoisture
      entry.count += 1
      buckets.set(point.timestamp, entry)
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([timestamp, { sum, count }]) => ({
      timestamp,
      soilMoisture: Math.round((sum / count) * 10) / 10,
    }))
}
