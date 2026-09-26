'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { Status, relativeTime, statusColor } from '@/components/Status'
import { api, type Crop } from '@/lib/api'
import { usePolling, useSession } from '@/lib/session'

const Sparkline = dynamic(() => import('@/components/Sparkline'), { ssr: false })

type CropWithTrend = Crop & { trend: { timestamp: string; healthScore: number }[] }

export default function Crops() {
  const { token } = useSession()
  const [reloadKey, setReloadKey] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)

  const { data, loading } = usePolling<CropWithTrend[] | null>(
    async () => {
      if (!token) return null
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
    if (!token) return
    setAnalyzing(true)
    try {
      await api.analyze(token)
      setReloadKey((k) => k + 1)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Crop Monitoring</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Environmental health by field</p>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-[13px] text-muted-foreground">
          {data ? `${data.length} fields monitored` : 'Loading fields...'}
        </span>
        <button
          type="button"
          onClick={analyze}
          disabled={analyzing}
          className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium transition hover:bg-raised active:translate-y-px disabled:opacity-55"
        >
          <ArrowsClockwise size={16} />
          {analyzing ? 'Analyzing' : 'Run analysis'}
        </button>
      </div>

      <AddField onAdded={() => setReloadKey((k) => k + 1)} />

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="glass h-64 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <p className="p-12 text-center text-sm text-muted-foreground">No fields configured yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((crop) => (
            <article key={crop.cropId} className="glass rounded-xl">
              <div className="border-b border-border px-4 py-3.5">
                <h2 className="text-[15px] font-semibold">{crop.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {crop.cropType}, {crop.areaHectares} ha
                </p>
              </div>

              <div className="p-4">
                <div className="flex items-end gap-4">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Health score</div>
                    <div
                      className="font-mono text-[32px] font-bold leading-none tracking-tight tabular"
                      style={{ color: statusColor(crop.status) }}
                    >
                      {crop.healthScore ?? '--'}
                    </div>
                    <Status value={crop.status} />
                  </div>
                  <div className="h-14 min-w-0 flex-1">
                    <Sparkline trend={crop.trend} color={statusColor(crop.status)} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <Metric
                    label="Soil moisture"
                    value={crop.soilMoisture == null ? '--' : `${crop.soilMoisture.toFixed(1)}%`}
                    hint={`optimal ${crop.optimal.moisture[0]}-${crop.optimal.moisture[1]}%`}
                    tone={crop.moistureStatus}
                  />
                  <Metric
                    label="Soil temperature"
                    value={crop.soilTemperature == null ? '--' : `${crop.soilTemperature.toFixed(1)} C`}
                    hint={`optimal ${crop.optimal.temperature[0]}-${crop.optimal.temperature[1]} C`}
                    tone={crop.temperatureStatus}
                  />
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground tabular">
                    updated {relativeTime(crop.lastUpdated)}
                  </span>
                  <Link href={`/crops/${crop.cropId}`} className="ml-auto text-brand hover:underline">
                    View details
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

const CROP_TYPES = ['Maize', 'Wheat', 'Tomato', 'Soybean', 'Rice', 'Cotton', 'Sugarcane', 'Potato']

/** A farmer adds a field; the backend attaches a simulated sensor so readings appear right away. */
function AddField({ onAdded }: { onAdded: () => void }) {
  const { token } = useSession()
  const [form, setForm] = useState({ name: '', cropType: '', areaHectares: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    try {
      await api.createCrop(token, {
        name: form.name.trim(),
        cropType: form.cropType.trim(),
        areaHectares: form.areaHectares ? Number(form.areaHectares) : undefined,
      })
      setForm({ name: '', cropType: '', areaHectares: '' })
      onAdded()
    } catch (err) {
      setError((err as Error).message || 'Could not add the field')
    } finally {
      setSaving(false)
    }
  }

  const input =
    'min-h-9 rounded-lg border border-hairline-strong bg-surface px-3 text-[13px] outline-none focus:border-brand'

  return (
    <form onSubmit={submit} className="glass mb-4 flex flex-wrap items-end gap-2 rounded-xl p-4">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Field name
        <input required className={input} value={form.name} onChange={set('name')} placeholder="East Plot" />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Crop type
        <input
          required
          list="crop-types"
          className={input}
          value={form.cropType}
          onChange={set('cropType')}
          placeholder="Rice"
        />
        <datalist id="crop-types">
          {CROP_TYPES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Area (ha)
        <input
          type="number"
          min="0.1"
          step="0.1"
          className={`${input} w-24`}
          value={form.areaHectares}
          onChange={set('areaHectares')}
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-9 items-center rounded-lg bg-brand px-3.5 text-[13px] font-medium text-white transition active:translate-y-px disabled:opacity-55"
      >
        {saving ? 'Adding' : 'Add field'}
      </button>
      {error ? (
        <p role="alert" className="w-full text-xs text-status-critical">
          {error}
        </p>
      ) : null}
    </form>
  )
}

export function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: string | null
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className="mt-0.5 font-mono text-lg font-semibold tabular"
        style={tone ? { color: statusColor(tone) } : undefined}
      >
        {value}
      </div>
      {hint ? <div className="font-mono text-[11px] text-muted-foreground tabular">{hint}</div> : null}
    </div>
  )
}
