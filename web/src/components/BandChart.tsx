'use client'

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { clockTime } from '@/components/Status'
import { usePrefersReducedMotion } from '@/lib/session'
import { useI18n } from '@/lib/i18n/react'
import type { CropMetrics } from '@/lib/api'

/**
 * A metric plotted against its crop's optimal band.
 *
 * The band is drawn as a stacked area - an invisible floor plus the band's own height - so
 * deviation reads against the shaded region instead of asking the viewer to remember the
 * threshold numbers.
 */
export default function BandChart({
  title,
  environment,
  metric,
  band,
  domain,
}: {
  title: string
  environment: CropMetrics['environment']
  metric: 'soilMoisture' | 'soilTemperature'
  band: number[]
  domain?: [number, number]
}) {
  const reducedMotion = usePrefersReducedMotion()
  const { t } = useI18n()
  const [min, max] = band

  const data = environment.map((p) => ({
    time: clockTime(p.timestamp),
    value: p[metric],
    floor: min,
    band: max - min,
  }))

  return (
    <section className="glass rounded-xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{t('crop.band')}</span>
      </div>
      <div className="h-55 p-4">
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('crop.noTelemetry')}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--brand-border)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                stroke="var(--brand-border)"
                minTickGap={40}
              />
              <YAxis
                domain={domain ?? ['auto', 'auto']}
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                stroke="var(--brand-border)"
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--brand-border)',
                  borderRadius: 8,
                  fontFamily: 'var(--font-plex-mono)',
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="floor"
                stackId="band"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                name={t('crop.optimalFloor')}
              />
              <Area
                type="monotone"
                dataKey="band"
                stackId="band"
                stroke="none"
                fill="var(--brand-accent)"
                fillOpacity={0.12}
                isAnimationActive={false}
                name={t('crop.optimalRange')}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={title}
                stroke="var(--brand-accent)"
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={!reducedMotion}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
