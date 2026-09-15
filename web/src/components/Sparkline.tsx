'use client'

import { Line, LineChart, ResponsiveContainer } from 'recharts'

/** 7-day health-score movement. Deliberately axis-free - it shows shape, not values. */
export default function Sparkline({
  trend,
  color,
}: {
  trend: { timestamp: string; healthScore: number }[]
  color: string
}) {
  if (!trend || trend.length < 2) {
    return <span className="text-xs text-muted-foreground">no trend yet</span>
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
