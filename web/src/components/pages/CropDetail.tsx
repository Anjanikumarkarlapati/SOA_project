'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Status, relativeTime, statusColor } from '@/components/Status'
import { Metric } from '@/components/pages/Crops'
import { RangeTabs } from '@/components/pages/SensorDetail'
import { api } from '@/lib/api'
import { usePolling, useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n/react'
import { LoadingChart } from '@/components/pages/SensorDetail'

const HealthTrend = dynamic(() => import('@/components/HealthTrend'), {
  ssr: false,
  loading: () => <LoadingChart />,
})
const BandChart = dynamic(() => import('@/components/BandChart'), {
  ssr: false,
  loading: () => <LoadingChart />,
})

export default function CropDetail({ cropId }: { cropId: string }) {
  const { token, isAdmin } = useSession()
  const { t } = useI18n()
  const router = useRouter()
  const [range, setRange] = useState('7d')

  const { data, loading, error } = usePolling(
    async () => {
      if (!token) return null
      const [crop, metrics] = await Promise.all([
        api.crop(token, cropId),
        api.cropMetrics(token, cropId, range),
      ])
      return { crop, metrics }
    },
    [token, cropId, range],
    30000,
  )

  if (loading && !data) return <div className="glass h-64 animate-pulse rounded-xl" />
  if (error) {
    return (
      <p className="p-12 text-center text-sm text-muted-foreground">
        {error.message} <Link href="/crops" className="text-brand hover:underline">{t('crop.back')}</Link>
      </p>
    )
  }
  if (!data) return null

  const { crop, metrics } = data
  const [moistureMin, moistureMax] = metrics.optimal.moisture
  const [tempMin, tempMax] = metrics.optimal.temperature

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/crops"
          className="inline-flex min-h-9 items-center rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium transition hover:bg-raised active:translate-y-px"
        >
          {t('crop.back')}
        </Link>
        <RangeTabs value={range} onChange={setRange} options={['24h', '7d', '30d', '90d']} />
      </div>

      <section className="glass mb-4 rounded-xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <div>
            <h1 className="text-[15px] font-semibold">{crop.name}</h1>
            <p className="text-xs text-muted-foreground">{crop.cropType}</p>
          </div>
          <div className="ml-auto text-right">
            <div
              className="font-mono text-[32px] font-bold leading-none tracking-tight tabular"
              style={{ color: statusColor(crop.status) }}
            >
              {crop.healthScore ?? '--'}
            </div>
            <Status value={crop.status} />
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
            value={crop.hoursToIrrigation == null ? t('crop.notNeeded') : `${crop.hoursToIrrigation}h`}
            hint={t('crop.until')}
          />
          <Metric label={t('crop.area')} value={t('unit.ha', { n: crop.areaHectares })} />
          <Metric label={t('crop.planted')} value={crop.plantedOn ?? '--'} />
          <Metric label={t('crop.evaluated')} value={relativeTime(crop.lastUpdated)} />
        </div>
      </section>

      <section className="glass mb-4 rounded-xl">
        <h2 className="border-b border-border px-4 py-3.5 text-[15px] font-semibold">{t('crop.trend')}</h2>
        <div className="h-50 p-4">
          {metrics.healthTrend.length < 2 ? (
            <p className="text-xs text-muted-foreground">{t('crop.noHistory')}</p>
          ) : (
            <HealthTrend trend={metrics.healthTrend} color={statusColor(crop.status)} />
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BandChart
          title={t('metric.moisture')}
          environment={metrics.environment}
          metric="soilMoisture"
          band={metrics.optimal.moisture}
          domain={[0, 100]}
        />
        <BandChart
          title={t('metric.temperature')}
          environment={metrics.environment}
          metric="soilTemperature"
          band={metrics.optimal.temperature}
        />
      </div>

      <section className="glass mt-4 rounded-xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5">
          <h2 className="text-[15px] font-semibold">{t('crop.recommendations')}</h2>
          {isAdmin && crop.valveId ? (
            <button
              type="button"
              onClick={() => router.push('/irrigation')}
              className="ml-auto inline-flex min-h-9 items-center rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition hover:bg-brand-hover active:translate-y-px"
            >
              {t('crop.schedule')}
            </button>
          ) : null}
        </div>
        <div className="p-4">
          {crop.recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('crop.noAdvisories')}
            </p>
          ) : (
            <ul className="grid list-disc gap-1.5 pl-5">
              {crop.recommendations.map((note) => (
                <li key={note} className="text-[13px]">{note}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
