import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api'
import {
  Empty,
  Loading,
  RangeTabs,
  Status,
  clockTime,
  relativeTime,
  usePrefersReducedMotion,
} from '../components'
import { usePolling, useSession } from '../session'
import { useI18n } from '../i18n/react'

export default function SensorDetail() {
  const { deviceId } = useParams()
  const { token } = useSession()
  const { t, lang } = useI18n()
  const [range, setRange] = useState('24h')
  const reducedMotion = usePrefersReducedMotion()

  const { data, loading, error } = usePolling(
    async () => {
      const [device, readings] = await Promise.all([
        api.sensor(token, deviceId),
        api.telemetry(token, deviceId, range),
      ])
      return { device, readings }
    },
    [token, deviceId, range],
    20000,
  )

  if (loading && !data) return <Loading variant="detail" />
  if (error) return <Empty title={error.message} action={<Link to="/sensors">{t('sensor.back')}</Link>} />
  if (!data) return null

  const { device, readings } = data
  const chartData = readings.map((r) => ({
    time: clockTime(r.timestamp),
    moisture: r.soilMoisture,
    temperature: r.soilTemperature,
  }))

  return (
    <>
      <div className="toolbar">
        <Link to="/sensors" className="btn">
          {t('sensor.back')}
        </Link>
        <div className="toolbar-right">
          <RangeTabs value={range} onChange={setRange} options={['24h', '7d', '30d']} />
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="card-title mono">{device.deviceId}</h2>
          <span style={{ marginLeft: 'auto' }}>
            <Status value={device.health} />
          </span>
        </div>
        <div
          className="card-body grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
        >
          <Meta label={t('sensors.sensorType')} value={device.sensorType} />
          <Meta label={t('sensor.farm')} value={device.farmId} mono />
          <Meta label={t('sensors.field')} value={device.fieldId || t('sensors.unassigned')} mono />
          <Meta
            label={t('sensors.battery')}
            value={device.batteryPercent == null ? '--' : `${Math.round(device.batteryPercent)}%`}
            mono
          />
          <Meta label={t('sensors.lastReading')} value={relativeTime(device.lastReadingAt)} mono />
          <Meta
            label={t('sensor.location')}
            value={`${device.location.latitude.toFixed(4)}, ${device.location.longitude.toFixed(4)}`}
            mono
          />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="card-title">{t('sensor.telemetry')}</h2>
          <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
            {t('sensor.readingsN', { n: readings.length })}
          </span>
        </div>
        <div className="card-body">
          {chartData.length === 0 ? (
            <Empty title={t('sensor.noReadings')} />
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    stroke="var(--border)"
                    minTickGap={40}
                  />
                  <YAxis
                    yAxisId="moisture"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    stroke="var(--border)"
                    domain={[0, 100]}
                  />
                  <YAxis
                    yAxisId="temp"
                    orientation="right"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    stroke="var(--border)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                    }}
                  />
                  <Line
                    yAxisId="moisture"
                    type="monotone"
                    dataKey="moisture"
                    name={t('metric.moistureUnit')}
                    stroke="var(--accent)"
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={!reducedMotion}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="temperature"
                    name={t('metric.temperatureUnit')}
                    stroke="var(--status-info)"
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={!reducedMotion}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t('sensor.readings')}</h2>
        </div>
        <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>{t('sensor.timestamp')}</th>
                <th>{t('metric.moisture')}</th>
                <th>{t('metric.temperature')}</th>
                <th>{t('metric.ph')}</th>
              </tr>
            </thead>
            <tbody>
              {[...readings].reverse().slice(0, 100).map((r) => (
                <tr key={r.id}>
                  <td className="mono">{new Date(r.timestamp).toLocaleString(lang.locale)}</td>
                  <td className="mono">{r.soilMoisture.toFixed(1)}%</td>
                  <td className="mono">{r.soilTemperature.toFixed(1)} °C</td>
                  <td className="mono">{r.ph.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <div className={mono ? 'metric-value mono' : 'metric-value'} style={{ fontSize: 15 }}>
        {value}
      </div>
    </div>
  )
}
