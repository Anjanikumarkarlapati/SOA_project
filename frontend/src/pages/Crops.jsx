import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { Empty, Loading, Status, relativeTime, statusColor } from '../components'
import { IconRefresh } from '../icons'
import { usePolling, useSession } from '../session'
import { useI18n } from '../i18n/react'

export default function Crops() {
  const { token } = useSession()
  const { t } = useI18n()
  const [reloadKey, setReloadKey] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)

  const { data, loading } = usePolling(
    async () => {
      const crops = await api.crops(token)
      const trends = await Promise.all(
        crops.map((c) =>
          api
            .cropMetrics(token, c.cropId, '7d')
            .then((m) => m.healthTrend)
            .catch(() => []),
        ),
      )
      return crops.map((crop, i) => ({ ...crop, trend: trends[i] }))
    },
    [token, reloadKey],
    30000,
  )

  const analyze = async () => {
    setAnalyzing(true)
    try {
      await api.analyze(token)
      setReloadKey((k) => k + 1)
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading && !data) return <Loading variant="cards" rows={4} />
  if (!data || data.length === 0) return <Empty title={t('crops.none')} />

  return (
    <>
      <div className="toolbar">
        <span className="muted" style={{ fontSize: 13 }}>
          {t('crops.monitored', { n: data.length })}
        </span>
        <div className="toolbar-right">
          <button type="button" className="btn" onClick={analyze} disabled={analyzing}>
            {analyzing ? <span className="spinner" /> : <IconRefresh />}
            {analyzing ? t('crops.analyzing') : t('crops.run')}
          </button>
        </div>
      </div>

      <div className="crop-grid">
        {data.map((crop) => (
          <article key={crop.cropId} className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">{crop.name}</h2>
                <div className="field-meta">
                  {crop.cropType}, {t('unit.ha', { n: crop.areaHectares })}
                </div>
              </div>
            </div>

            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div>
                  <div className="metric-label">{t('crops.health')}</div>
                  <div className="crop-score" style={{ color: statusColor(crop.status) }}>
                    {crop.healthScore ?? '--'}
                  </div>
                  <Status value={crop.status} className="" />
                </div>
                <div style={{ flex: 1, height: 56, minWidth: 0 }}>
                  <Sparkline trend={crop.trend} color={statusColor(crop.status)} />
                </div>
              </div>

              <div className="crop-metrics">
                <div>
                  <div className="metric-label">{t('metric.moisture')}</div>
                  <div
                    className="metric-value"
                    style={{ color: statusColor(crop.moistureStatus || 'NO_DATA') }}
                  >
                    {crop.soilMoisture == null ? '--' : `${crop.soilMoisture.toFixed(1)}%`}
                  </div>
                  <div className="field-meta mono">
                    {t('crops.optimal', { range: `${crop.optimal.moisture[0]}-${crop.optimal.moisture[1]}%` })}
                  </div>
                </div>
                <div>
                  <div className="metric-label">{t('metric.temperature')}</div>
                  <div
                    className="metric-value"
                    style={{ color: statusColor(crop.temperatureStatus || 'NO_DATA') }}
                  >
                    {crop.soilTemperature == null ? '--' : `${crop.soilTemperature.toFixed(1)} °C`}
                  </div>
                  <div className="field-meta mono">
                    {t('crops.optimal', { range: `${crop.optimal.temperature[0]}-${crop.optimal.temperature[1]} °C` })}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 16,
                  fontSize: 12,
                }}
              >
                <span className="muted mono">{t('crops.updated', { t: relativeTime(crop.lastUpdated) })}</span>
                <Link to={`/crops/${crop.cropId}`} style={{ marginLeft: 'auto' }}>
                  {t('crops.view')}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

/** 7-day health-score movement. Deliberately axis-free - it shows shape, not values. */
function Sparkline({ trend, color }) {
  const { t } = useI18n()
  if (!trend || trend.length < 2) {
    return <span className="field-meta">{t('crops.noTrend')}</span>
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
        <Line
          type="monotone"
          dataKey="healthScore"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
