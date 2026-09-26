import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
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
  statusColor,
  usePrefersReducedMotion,
} from '../components'
import { usePolling, useSession } from '../session'
import { useI18n } from '../i18n/react'

export default function CropDetail() {
  const { cropId } = useParams()
  const { token, isAdmin } = useSession()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [range, setRange] = useState('7d')
  const reducedMotion = usePrefersReducedMotion()

  const { data, loading, error } = usePolling(
    async () => {
      const [crop, metrics] = await Promise.all([
        api.crop(token, cropId),
        api.cropMetrics(token, cropId, range),
      ])
      return { crop, metrics }
    },
    [token, cropId, range],
    30000,
  )

  if (loading && !data) return <Loading variant="detail" />
  if (error) return <Empty title={error.message} action={<Link to="/crops">{t('crop.back')}</Link>} />
  if (!data) return null

  const { crop, metrics } = data
  const [moistureMin, moistureMax] = metrics.optimal.moisture
  const [tempMin, tempMax] = metrics.optimal.temperature

  // The shaded band is drawn as a stacked area: an invisible floor plus the band's own height,
  // so deviation reads against the band instead of against remembered threshold numbers.
  const environment = metrics.environment.map((p) => ({
    time: clockTime(p.timestamp),
    moisture: p.soilMoisture,
    temperature: p.soilTemperature,
    moistureFloor: moistureMin,
    moistureBand: moistureMax - moistureMin,
    tempFloor: tempMin,
    tempBand: tempMax - tempMin,
  }))

  const healthTrend = metrics.healthTrend.map((p) => ({
    time: clockTime(p.timestamp),
    healthScore: p.healthScore,
  }))

  return (
    <>
      <div className="toolbar">
        <Link to="/crops" className="btn">
          {t('crop.back')}
        </Link>
        <div className="toolbar-right">
          <RangeTabs value={range} onChange={setRange} options={['24h', '7d', '30d', '90d']} />
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <h2 className="card-title">{crop.name}</h2>
            <div className="field-meta">{crop.cropType}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div className="crop-score" style={{ color: statusColor(crop.status) }}>
              {crop.healthScore ?? '--'}
            </div>
            <Status value={crop.status} />
          </div>
        </div>
        <div
          className="card-body grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
        >
          <Metric
            label={t('metric.moisture')}
            value={crop.soilMoisture == null ? '--' : `${crop.soilMoisture.toFixed(1)}%`}
            hint={t('crops.optimal', { range: `${moistureMin}-${moistureMax}%` })}
            tone={crop.moistureStatus}
          />
          <Metric
            label={t('metric.temperature')}
            value={crop.soilTemperature == null ? '--' : `${crop.soilTemperature.toFixed(1)} °C`}
            hint={t('crops.optimal', { range: `${tempMin}-${tempMax} °C` })}
            tone={crop.temperatureStatus}
          />
          <Metric
            label={t('crop.ph')}
            value={crop.ph == null ? '--' : crop.ph.toFixed(1)}
            hint={t('crops.optimal', { range: `${metrics.optimal.ph[0]}-${metrics.optimal.ph[1]}` })}
          />
          <Metric
            label={t('crop.forecast')}
            value={
              crop.hoursToIrrigation == null ? t('crop.notNeeded') : `${crop.hoursToIrrigation}h`
            }
            hint={t('crop.until')}
          />
          <Metric label={t('crop.area')} value={t('unit.ha', { n: crop.areaHectares })} />
          <Metric label={t('crop.planted')} value={crop.plantedOn} />
          <Metric label={t('crop.evaluated')} value={relativeTime(crop.lastUpdated)} />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="card-title">{t('crop.trend')}</h2>
        </div>
        <div className="card-body">
          {healthTrend.length < 2 ? (
            <Empty title={t('crop.noHistory')} />
          ) : (
            <div className="chart-box" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={healthTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    stroke="var(--border)"
                    minTickGap={40}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    stroke="var(--border)"
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="healthScore"
                    name={t('crops.health')}
                    stroke={statusColor(crop.status)}
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={!reducedMotion}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <BandChart
          title={t('metric.moisture')}
          data={environment}
          floorKey="moistureFloor"
          bandKey="moistureBand"
          lineKey="moisture"
          unit="%"
          domain={[0, 100]}
        />
        <BandChart
          title={t('metric.temperature')}
          data={environment}
          floorKey="tempFloor"
          bandKey="tempBand"
          lineKey="temperature"
          unit=" °C"
        />
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2 className="card-title">{t('crop.recommendations')}</h2>
          {isAdmin && crop.valveId ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={() => navigate('/irrigation')}
            >
              {t('crop.schedule')}
            </button>
          ) : null}
        </div>
        <div className="card-body">
          {crop.recommendations.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {t('crop.noAdvisories')}
            </p>
          ) : (
            <ul className="recommendations">
              {crop.recommendations.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}

const tooltipStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
}

function BandChart({ title, data, floorKey, bandKey, lineKey, unit, domain }) {
  const reducedMotion = usePrefersReducedMotion()
  const { t } = useI18n()
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{title}</h2>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {t('crop.band')}
        </span>
      </div>
      <div className="card-body">
        {data.length === 0 ? (
          <Empty title={t('crop.noTelemetry')} />
        ) : (
          <div className="chart-box" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  stroke="var(--border)"
                  minTickGap={40}
                />
                <YAxis
                  domain={domain || ['auto', 'auto']}
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  stroke="var(--border)"
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey={floorKey}
                  stackId="band"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                  legendType="none"
                  name={t('crop.optimalFloor')}
                />
                <Area
                  type="monotone"
                  dataKey={bandKey}
                  stackId="band"
                  stroke="none"
                  fill="var(--accent)"
                  fillOpacity={0.12}
                  isAnimationActive={false}
                  name={t('crop.optimalRange')}
                />
                <Line
                  type="monotone"
                  dataKey={lineKey}
                  name={`${title} (${unit.trim() || '%'})`}
                  stroke="var(--accent)"
                  strokeWidth={1.75}
                  dot={false}
                  isAnimationActive={!reducedMotion}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}

function Metric({ label, value, hint, tone }) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={tone ? { color: statusColor(tone) } : undefined}>
        {value}
      </div>
      {hint ? <div className="field-meta mono">{hint}</div> : null}
    </div>
  )
}
