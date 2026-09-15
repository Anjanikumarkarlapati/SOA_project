'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { clockTime } from '@/components/Status'
import { usePrefersReducedMotion } from '@/lib/session'
import type { Reading } from '@/lib/api'

const tooltipStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--brand-border)',
  borderRadius: 8,
  fontFamily: 'var(--font-plex-mono)',
  fontSize: 12,
}

/** Dual-axis moisture and temperature, per the brief's sensor detail spec. */
export default function TelemetryChart({ readings }: { readings: Reading[] }) {
  const reducedMotion = usePrefersReducedMotion()

  const data = readings.map((r) => ({
    time: clockTime(r.timestamp),
    moisture: r.soilMoisture,
    temperature: r.soilTemperature,
  }))

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
          yAxisId="moisture"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          stroke="var(--brand-border)"
        />
        <YAxis
          yAxisId="temp"
          orientation="right"
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          stroke="var(--brand-border)"
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          yAxisId="moisture"
          type="monotone"
          dataKey="moisture"
          name="Soil moisture (%)"
          stroke="var(--brand-accent)"
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={!reducedMotion}
        />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="temperature"
          name="Soil temperature (C)"
          stroke="var(--status-info)"
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={!reducedMotion}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
