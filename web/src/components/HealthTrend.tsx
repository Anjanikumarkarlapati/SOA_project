'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { clockTime } from '@/components/Status'
import { usePrefersReducedMotion } from '@/lib/session'
import { useI18n } from '@/lib/i18n/react'

export default function HealthTrend({
  trend,
  color,
}: {
  trend: { timestamp: string; healthScore: number }[]
  color: string
}) {
  const reducedMotion = usePrefersReducedMotion()
  const { t } = useI18n()
  const data = trend.map((p) => ({ time: clockTime(p.timestamp), healthScore: p.healthScore }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--brand-border)" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          stroke="var(--brand-border)"
          minTickGap={40}
        />
        <YAxis
          domain={[0, 100]}
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
        <Line
          type="monotone"
          dataKey="healthScore"
          name={t('crops.health')}
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={!reducedMotion}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
