'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Status, relativeTime } from '@/components/Status'
import { api } from '@/lib/api'
import { usePolling, useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n/react'

const TelemetryChart = dynamic(() => import('@/components/TelemetryChart'), {
  ssr: false,
  loading: () => <LoadingChart />,
})

export function LoadingChart() {
  const { t } = useI18n()
  return <p className="p-4 text-xs text-muted-foreground">{t('common.loadingChart')}</p>
}

export default function SensorDetail({ deviceId }: { deviceId: string }) {
  const { token } = useSession()
  const { t, lang } = useI18n()
  const [range, setRange] = useState('24h')

  const { data, loading, error } = usePolling(
    async () => {
      if (!token) return null
      const [device, readings] = await Promise.all([
        api.sensor(token, deviceId),
        api.telemetry(token, deviceId, range),
      ])
      return { device, readings }
    },
    [token, deviceId, range],
    20000,
  )

  if (loading && !data) return <div className="glass h-64 animate-pulse rounded-xl" />
  if (error) {
    return (
      <p className="p-12 text-center text-sm text-muted-foreground">
        {error.message}{' '}
        <Link href="/sensors" className="text-brand hover:underline">{t('sensor.back')}</Link>
      </p>
    )
  }
  if (!data) return null

  const { device, readings } = data

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/sensors"
          className="inline-flex min-h-9 items-center rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium transition hover:bg-raised active:translate-y-px"
        >
          {t('sensor.back')}
        </Link>
        <RangeTabs value={range} onChange={setRange} options={['24h', '7d', '30d']} />
      </div>

      <section className="glass mb-4 rounded-xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <h1 className="font-mono text-[15px] font-semibold">{device.deviceId}</h1>
          <span className="ml-auto"><Status value={device.health} /></span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <section className="glass mb-4 rounded-xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <h2 className="text-[15px] font-semibold">{t('sensor.telemetry')}</h2>
          <span className="ml-auto text-xs text-muted-foreground">{t('sensor.readingsN', { n: readings.length })}</span>
        </div>
        <div className="h-[260px] p-4">
          {readings.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('sensor.noReadings')}</p>
          ) : (
            <TelemetryChart readings={readings} />
          )}
        </div>
      </section>

      <section className="glass overflow-hidden rounded-xl">
        <h2 className="border-b border-border px-4 py-3.5 text-[15px] font-semibold">{t('sensor.readings')}</h2>
        <div className="max-h-90 overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['sensor.timestamp', 'metric.moisture', 'metric.temperature', 'metric.ph'].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 whitespace-nowrap border-b border-border bg-[rgba(var(--glass-rgb),0.96)] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur"
                  >
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...readings].reverse().slice(0, 100).map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2.5 font-mono tabular">{new Date(r.timestamp).toLocaleString(lang.locale)}</td>
                  <td className="px-3 py-2.5 font-mono tabular">{r.soilMoisture.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 font-mono tabular">{r.soilTemperature.toFixed(1)} °C</td>
                  <td className="px-3 py-2.5 font-mono tabular">{r.ph.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[15px] font-semibold ${mono ? 'font-mono tabular' : ''}`}>{value}</div>
    </div>
  )
}

export function RangeTabs({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  const { t } = useI18n()
  return (
    <div role="group" aria-label={t('common.timeRange')} className="ml-auto inline-flex overflow-hidden rounded-lg border border-hairline-strong">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`min-h-8 border-l border-border px-3 text-xs font-medium transition first:border-l-0 ${
            value === option ? 'bg-brand-wash text-brand' : 'bg-surface text-muted-foreground hover:bg-raised'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
