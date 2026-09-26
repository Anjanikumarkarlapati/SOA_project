'use client'

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SimPoint } from '@/lib/farm/simulator'
import { useI18n } from '@/lib/i18n/react'
import { usePrefersReducedMotion } from '@/lib/session'

/**
 * Last 24 simulated hours: soil moisture (or paddy water depth) against air temperature, with
 * the automation's trigger and fill lines, and shading while the valve is open.
 */
export default function SimChart({
  data,
  unit,
  trigger,
  target,
}: {
  data: SimPoint[]
  unit: string
  trigger: number
  target: number
}) {
  const reducedMotion = usePrefersReducedMotion()
  const { t } = useI18n()
  if (data.length < 2) {
    return <p className="p-4 text-xs text-muted-foreground">{t('chart.press')}</p>
  }
  // Zoomed to the band the controller works in, so a one-percent swing is visible.
  const values = data.map((d) => d.moisture)
  const top = Math.ceil(Math.max(target, ...values) + 2)
  const bottom = Math.max(0, Math.floor(Math.min(trigger, ...values) - 2))
  const series = data.map((d) => ({ ...d, valve: d.irrigating ? top : bottom }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={series} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--brand-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} stroke="var(--brand-border)" minTickGap={40} tickLine={false} />
        <YAxis yAxisId="m" domain={[bottom, top]} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} stroke="var(--brand-border)" tickLine={false} width={44} />
        <YAxis yAxisId="t" orientation="right" domain={['dataMin - 3', 'dataMax + 3']} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} stroke="var(--brand-border)" tickLine={false} width={34} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--brand-border)',
            borderRadius: 8,
            fontFamily: 'var(--font-plex-mono)',
            fontSize: 12,
          }}
          formatter={(value, name, item) => {
            if (item.dataKey === 'valve') return [Number(value) > bottom ? t('common.yes') : t('common.no'), name]
            return [item.dataKey === 'temp' ? `${value} °C` : `${value} ${unit}`, name]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area yAxisId="m" type="step" dataKey="valve" name={t('chart.valveOpen')} fill="var(--status-info)" fillOpacity={0.12} stroke="none" isAnimationActive={false} />
        <ReferenceLine yAxisId="m" y={trigger} stroke="var(--status-warning)" strokeDasharray="4 4" label={{ value: t('chart.below'), fontSize: 10, fill: 'var(--status-warning)', position: 'insideBottomLeft' }} />
        <ReferenceLine yAxisId="m" y={target} stroke="var(--status-good)" strokeDasharray="4 4" label={{ value: t('chart.fill'), fontSize: 10, fill: 'var(--status-good)', position: 'insideTopLeft' }} />
        <Line yAxisId="m" type="monotone" dataKey="moisture" name={unit === '%' ? t('metric.moisture') : t('chart.depth')} stroke="var(--brand-accent)" strokeWidth={2} dot={false} isAnimationActive={!reducedMotion} />
        <Line yAxisId="t" type="monotone" dataKey="temp" name={t('chart.air')} stroke="var(--status-critical)" strokeWidth={1.5} dot={false} strokeDasharray="2 3" isAnimationActive={!reducedMotion} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
