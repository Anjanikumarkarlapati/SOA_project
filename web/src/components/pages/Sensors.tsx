'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CaretRight, Plus, Trash } from '@phosphor-icons/react'
import { IconButton, IconLink } from '@/components/IconButton'
import { Status, relativeTime } from '@/components/Status'
import { api, type Crop, type Sensor } from '@/lib/api'
import { usePolling, useSession } from '@/lib/session'

const HEALTH_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'LOW_BATTERY', label: 'Low battery' },
]

const control =
  'min-h-9 rounded-lg border border-input bg-surface px-3 outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-ring'

export default function Sensors() {
  const { token, isAdmin } = useSession()
  const [query, setQuery] = useState('')
  const [health, setHealth] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState<{ tone: string; text: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const { data, loading } = usePolling(
    () => (token ? api.sensors(token, { q: query, health, fieldId, page, size: 20 }) : Promise.resolve(null)),
    [token, query, health, fieldId, page, reloadKey],
    15000,
  )

  const { data: crops } = usePolling(
    () => (token ? api.crops(token) : Promise.resolve(null)),
    [token],
    0,
  )

  const refresh = () => setReloadKey((k) => k + 1)

  const deregister = async (deviceId: string) => {
    if (!token || !window.confirm(`Deregister ${deviceId}? Its history is removed with it.`)) return
    try {
      await api.deleteSensor(token, deviceId)
      setNotice({ tone: '', text: `${deviceId} deregistered` })
      refresh()
    } catch (error) {
      setNotice({ tone: 'critical', text: (error as Error).message })
    }
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Sensor Management</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Registered IoT devices across the farm</p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search device ID"
          aria-label="Search by device ID"
          className={`${control} min-w-40 flex-1 sm:flex-none`}
          value={query}
          onChange={(e) => {
            setPage(0)
            setQuery(e.target.value)
          }}
        />
        <select
          aria-label="Filter by status"
          className={control}
          value={health}
          onChange={(e) => {
            setPage(0)
            setHealth(e.target.value)
          }}
        >
          {HEALTH_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select
          aria-label="Filter by field"
          className={control}
          value={fieldId}
          onChange={(e) => {
            setPage(0)
            setFieldId(e.target.value)
          }}
        >
          <option value="">All fields</option>
          {(crops ?? []).map((c: Crop) => (
            <option key={c.cropId} value={c.cropId}>{c.name}</option>
          ))}
        </select>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition hover:bg-brand-hover active:translate-y-px"
          >
            <Plus size={16} />
            Register device
          </button>
        ) : null}
      </div>

      {showForm ? (
        <RegisterForm
          crops={crops ?? []}
          onCancel={() => setShowForm(false)}
          onCreated={(deviceId) => {
            setShowForm(false)
            setNotice({ tone: '', text: `${deviceId} registered` })
            refresh()
          }}
        />
      ) : null}

      <section className="glass overflow-hidden rounded-xl">
        {loading && !data ? (
          <div className="grid gap-2.5 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-hairline" />
            ))}
          </div>
        ) : !data || data.content.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No sensors match this view.</p>
        ) : (
          <>
            {/* Table on desktop; each row becomes its own card under md. */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px] max-md:block">
                <thead className="max-md:hidden">
                  <tr>
                    {['Device ID', 'Type', 'Field', 'Status', 'Last reading', 'Battery', ''].map((h) => (
                      <th
                        key={h}
                        className="sticky top-0 whitespace-nowrap border-b border-border bg-[rgba(var(--glass-rgb),0.96)] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="max-md:block">
                  {data.content.map((device: Sensor) => (
                    <tr
                      key={device.deviceId}
                      className={`border-b border-border last:border-b-0 hover:bg-raised max-md:mb-3 max-md:block max-md:rounded-xl max-md:border max-md:p-2 ${
                        device.health === 'OFFLINE' ? 'max-md:opacity-80' : ''
                      }`}
                    >
                      <Cell label="Device ID">
                        <Link href={`/sensors/${device.deviceId}`} className="font-mono text-brand hover:underline">
                          {device.deviceId}
                        </Link>
                      </Cell>
                      <Cell label="Type" muted={device.health === 'OFFLINE'}>{device.sensorType}</Cell>
                      <Cell label="Field" muted={device.health === 'OFFLINE'}>{device.fieldId || '--'}</Cell>
                      <Cell label="Status"><Status value={device.health} /></Cell>
                      <Cell label="Last reading" muted={device.health === 'OFFLINE'}>
                        <span className="font-mono tabular">{relativeTime(device.lastReadingAt)}</span>
                      </Cell>
                      <Cell label="Battery" muted={device.health === 'OFFLINE'}>
                        <span className="font-mono tabular">
                          {device.batteryPercent == null ? '--' : `${Math.round(device.batteryPercent)}%`}
                        </span>
                      </Cell>
                      <Cell label="Actions">
                        <span className="flex justify-end gap-1">
                          <IconLink label={`View ${device.deviceId}`} href={`/sensors/${device.deviceId}`}>
                            <CaretRight size={16} />
                          </IconLink>
                          {isAdmin ? (
                            <IconButton
                              label={`Deregister ${device.deviceId}`}
                              tone="danger"
                              onClick={() => deregister(device.deviceId)}
                            >
                              <Trash size={16} />
                            </IconButton>
                          ) : null}
                        </span>
                      </Cell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
              <span className="text-xs text-muted-foreground">{data.totalElements} devices</span>
              <div className="ml-auto flex items-center gap-2">
                <PagerButton disabled={data.page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Previous
                </PagerButton>
                <span className="self-center font-mono text-xs text-muted-foreground tabular">
                  Page {data.page + 1} of {Math.max(data.totalPages, 1)}
                </span>
                <PagerButton
                  disabled={data.page + 1 >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </PagerButton>
              </div>
            </div>
          </>
        )}
      </section>

      {notice ? (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-30 max-w-sm rounded-lg border bg-surface px-3.5 py-3 text-[13px] shadow-lg ${
            notice.tone === 'critical' ? 'border-status-critical text-status-critical' : 'border-hairline-strong'
          }`}
        >
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} className="ml-2 text-muted-foreground underline">
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  )
}

/** One cell. Renders as a table cell on desktop, a labelled row inside a card under md. */
function Cell({ label, children, muted }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      className={`px-3 py-2.5 align-middle max-md:flex max-md:justify-between max-md:gap-4 max-md:px-3 max-md:py-1.5 ${
        muted ? 'text-muted-foreground' : ''
      }`}
    >
      <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground max-md:block">
        {label}
      </span>
      {children}
    </td>
  )
}

function PagerButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-9 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium transition hover:bg-raised active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
    >
      {children}
    </button>
  )
}

function RegisterForm({
  crops,
  onCancel,
  onCreated,
}: {
  crops: Crop[]
  onCancel: () => void
  onCreated: (deviceId: string) => void
}) {
  const { token } = useSession()
  const [form, setForm] = useState({
    deviceId: '',
    farmId: 'FARM-001',
    sensorType: 'soil-moisture-temperature',
    fieldId: crops[0]?.cropId || '',
    latitude: '',
    longitude: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!token) return
    setError('')
    setSaving(true)
    try {
      await api.registerSensor(token, {
        ...form,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      })
      onCreated(form.deviceId)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="glass mb-4 rounded-xl">
      <h2 className="border-b border-border px-4 py-3.5 text-[15px] font-semibold">Register a device</h2>
      <form onSubmit={submit} className="p-4">
        {error ? (
          <div role="alert" className="mb-4 rounded-lg border border-status-critical bg-status-critical/10 px-3 py-2.5 text-[13px] text-status-critical">
            {error}
          </div>
        ) : null}

        <div className="mb-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Device ID" htmlFor="deviceId">
            <input id="deviceId" required placeholder="SENSOR-FARM01-014" className={`${control} w-full font-mono`} value={form.deviceId} onChange={set('deviceId')} />
          </Field>
          <Field label="Farm ID" htmlFor="farmId">
            <input id="farmId" required className={`${control} w-full font-mono`} value={form.farmId} onChange={set('farmId')} />
          </Field>
          <Field label="Sensor type" htmlFor="sensorType">
            <select id="sensorType" className={`${control} w-full`} value={form.sensorType} onChange={set('sensorType')}>
              <option value="soil-moisture-temperature">soil-moisture-temperature</option>
              <option value="weather-station">weather-station</option>
              <option value="ph-probe">ph-probe</option>
            </select>
          </Field>
          <Field label="Field assignment" htmlFor="fieldId">
            <select id="fieldId" className={`${control} w-full`} value={form.fieldId} onChange={set('fieldId')}>
              <option value="">Unassigned</option>
              {crops.map((c) => (
                <option key={c.cropId} value={c.cropId}>{c.name} ({c.cropId})</option>
              ))}
            </select>
          </Field>
          <Field label="Latitude" htmlFor="latitude">
            <input id="latitude" type="number" step="any" className={`${control} w-full font-mono`} value={form.latitude} onChange={set('latitude')} />
          </Field>
          <Field label="Longitude" htmlFor="longitude">
            <input id="longitude" type="number" step="any" className={`${control} w-full font-mono`} value={form.longitude} onChange={set('longitude')} />
          </Field>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition hover:bg-brand-hover active:translate-y-px disabled:opacity-55">
            {saving ? 'Registering' : 'Register device'}
          </button>
          <button type="button" onClick={onCancel} className="min-h-9 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium transition hover:bg-raised active:translate-y-px">
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
