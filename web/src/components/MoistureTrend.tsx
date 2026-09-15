'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { clockTime } from '@/components/Status'
import { usePrefersReducedMotion } from '@/lib/session'

/**
 * Farm-wide soil moisture over 24 hours, averaged across every field.
 *
 * One series on purpose: each field has its own optimal band, so an averaged band would
 * mislead, and four coloured lines would break the single-accent rule. Per-field detail with
 * exact bands lives on the crop detail screen.
 */
export default function MoistureTrend({
  series,
}: {
  series: { timestamp: string; soilMoisture: number }[] | null
}) {
  const reducedMotion = usePrefersReducedMotion()

  if (!series || series.length < 2) {
    return <p className="p-4 text-xs text-muted-foreground">Not enough telemetry yet to plot a trend.</p>
  }

  const data = series.map((point) => ({
    time: clockTime(point.timestamp),
    moisture: point.soilMoisture,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="moistureFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--brand-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--brand-border)" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
          stroke="var(--brand-border)"
          minTickGap={44}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
          stroke="var(--brand-border)"
          tickLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--brand-border)',
            borderRadius: 8,
            fontFamily: 'var(--font-plex-mono)',
            fontSize: 12,
          }}
          formatter={(value) => [`${value}%`, 'Farm average']}
        />
        <Area
          type="monotone"
          dataKey="moisture"
          name="Farm average"
          stroke="var(--brand-accent)"
          strokeWidth={1.75}
          fill="url(#moistureFade)"
          isAnimationActive={!reducedMotion}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
