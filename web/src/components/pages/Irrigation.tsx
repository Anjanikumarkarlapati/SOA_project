'use client'

import { useEffect, useState } from 'react'
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { IconButton } from '@/components/IconButton'
import { Status, formatDuration, relativeTime } from '@/components/Status'
import { Field } from '@/components/pages/Sensors'
import { api, type Crop, type Schedule, type Valve } from '@/lib/api'
import { usePolling, useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n/react'

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

const control =
  'min-h-10 w-full rounded-lg border border-input bg-surface px-3 outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-ring'
const primaryBtn =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition hover:bg-brand-hover active:translate-y-px disabled:opacity-55'
const plainBtn =
  'inline-flex min-h-9 items-center rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium transition hover:bg-raised active:translate-y-px'

export default function Irrigation() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'schedules' | 'manual'>('schedules')

  return (
    <>
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">{t('irr.title')}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('irr.sub')}</p>
      </header>

      <div role="tablist" aria-label={t('irr.views')} className="mb-4 flex gap-1 border-b border-border">
        {(['schedules', 'manual'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-10 border-b-2 px-3.5 text-[13px] font-medium transition ${
              tab === key
                ? 'border-brand text-brand'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {key === 'schedules' ? t('irr.schedules') : t('irr.manual')}
          </button>
        ))}
      </div>

      {tab === 'schedules' ? <Schedules /> : <ManualControl />}
    </>
  )
}

function Schedules() {
  const { token, isAdmin } = useSession()
  const { t } = useI18n()
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')

  const refresh = () => setReloadKey((k) => k + 1)

  const { data, loading } = usePolling(
    async () => {
      if (!token) return null
      const [schedules, valves, crops] = await Promise.all([
        api.schedules(token),
        api.valves(token),
        api.crops(token),
      ])
      return { schedules, valves, crops }
    },
    [token, reloadKey],
    20000,
  )

  const act = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading && !data) return <div className="glass h-64 animate-pulse rounded-xl" />
  if (!data) return <p className="p-12 text-center text-sm text-muted-foreground">{t('irr.unavailable')}</p>

  return (
    <>
      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-status-critical bg-status-critical/10 px-3 py-2.5 text-[13px] text-status-critical">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-2">
        <span className="text-[13px] text-muted-foreground">
          {t('irr.active', { a: data.schedules.filter((s) => s.active).length, b: data.schedules.length })}
        </span>
        {isAdmin ? (
          <button type="button" onClick={() => setEditing(editing === 'new' ? null : 'new')} className={`ml-auto ${primaryBtn}`}>
            <Plus size={16} />
            {t('irr.new')}
          </button>
        ) : null}
      </div>

      {editing === 'new' ? (
        <ScheduleForm
          valves={data.valves}
          crops={data.crops}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      ) : null}

      {data.schedules.length === 0 ? (
        <section className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">
          {t('irr.none')}
        </section>
      ) : (
        <section className="glass overflow-hidden rounded-xl">
          {data.schedules.map((schedule) =>
            editing === schedule.scheduleId ? (
              <div key={schedule.scheduleId} className="border-b border-border last:border-b-0">
                <ScheduleForm
                  schedule={schedule}
                  valves={data.valves}
                  crops={data.crops}
                  onCancel={() => setEditing(null)}
                  onSaved={() => {
                    setEditing(null)
                    refresh()
                  }}
                />
              </div>
            ) : (
              /*
               * Identity + actions on one line, schedule detail on the next. The old rigid
               * 4-column grid squeezed zone names into two lines on tablet; stacking scales
               * across every width without per-breakpoint tuning.
               */
              <div key={schedule.scheduleId} className="grid gap-2 border-b border-border p-4 last:border-b-0">
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={schedule.active}
                    disabled={!isAdmin}
                    name={t('irr.activeLabel', { id: schedule.scheduleId })}
                    onChange={(next) => act(() => api.toggleSchedule(token!, schedule.scheduleId, next))}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{schedule.zoneName}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground tabular">
                      {schedule.scheduleId}
                    </div>
                  </div>
                  {isAdmin ? (
                    <div className="ml-auto flex flex-none gap-1">
                      <IconButton
                        label={t('irr.edit', { id: schedule.scheduleId })}
                        onClick={() => setEditing(schedule.scheduleId)}
                      >
                        <PencilSimple size={16} />
                      </IconButton>
                      <IconButton
                        label={t('irr.delete', { id: schedule.scheduleId })}
                        tone="danger"
                        onClick={() => {
                          if (window.confirm(t('irr.confirmDelete', { id: schedule.scheduleId }))) {
                            act(() => api.deleteSchedule(token!, schedule.scheduleId))
                          }
                        }}
                      >
                        <Trash size={16} />
                      </IconButton>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 pl-[52px] text-xs text-muted-foreground">
                  <span>
                    {schedule.recurrence === 'WEEKLY'
                      ? schedule.daysOfWeek.map((d) => t(`day.${d}`)).join(', ')
                      : t('irr.everyDay')}
                  </span>
                  <span className="font-mono tabular">
                    {t('irr.for', { time: schedule.startTime.slice(0, 5), n: schedule.durationMinutes })}
                  </span>
                  <span className="font-mono tabular">
                    {schedule.lastRunAt ? t('irr.lastRun', { t: relativeTime(schedule.lastRunAt) }) : t('irr.neverRun')}
                  </span>
                </div>
              </div>
            ),
          )}
        </section>
      )}
    </>
  )
}

function ScheduleForm({
  schedule,
  valves,
  crops,
  onCancel,
  onSaved,
}: {
  schedule?: Schedule
  valves: Valve[]
  crops: Crop[]
  onCancel: () => void
  onSaved: () => void
}) {
  const { token } = useSession()
  const { t } = useI18n()
  const [form, setForm] = useState({
    valveId: schedule?.valveId || valves[0]?.valveId || '',
    cropId: schedule?.cropId || crops[0]?.cropId || '',
    recurrence: schedule?.recurrence || 'DAILY',
    daysOfWeek: schedule?.daysOfWeek || ([] as string[]),
    startTime: (schedule?.startTime || '06:00:00').slice(0, 5),
    durationMinutes: schedule?.durationMinutes || 30,
    skipIfMoist: schedule?.skipIfMoist ?? true,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Selecting a zone selects the field it waters - they are one physical unit.
  useEffect(() => {
    const valve = valves.find((v) => v.valveId === form.valveId)
    if (valve && valve.cropId !== form.cropId) {
      setForm((f) => ({ ...f, cropId: valve.cropId }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.valveId])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!token) return
    setError('')
    setSaving(true)
    try {
      const body = { ...form, farmId: 'FARM-001' }
      if (schedule) await api.updateSchedule(token, schedule.scheduleId, body)
      else await api.createSchedule(token, body)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: string) =>
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day],
    }))

  return (
    <form onSubmit={submit} className="glass mb-4 rounded-xl p-4">
      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-status-critical bg-status-critical/10 px-3 py-2.5 text-[13px] text-status-critical">
          {error}
        </div>
      ) : null}

      <div className="mb-3.5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('irr.zone')} htmlFor="valveId">
          <select id="valveId" className={control} value={form.valveId} onChange={(e) => setForm((f) => ({ ...f, valveId: e.target.value }))}>
            {valves.map((v) => (
              <option key={v.valveId} value={v.valveId}>{v.zoneName} ({v.valveId})</option>
            ))}
          </select>
        </Field>
        <Field label={t('irr.recurrence')} htmlFor="recurrence">
          <select id="recurrence" className={control} value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as 'DAILY' | 'WEEKLY' }))}>
            <option value="DAILY">{t('irr.daily')}</option>
            <option value="WEEKLY">{t('irr.weekly')}</option>
          </select>
        </Field>
        <Field label={t('irr.start')} htmlFor="startTime">
          <input id="startTime" type="time" required className={`${control} font-mono`} value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        </Field>
        <Field label={t('irr.duration')} htmlFor="duration">
          <input id="duration" type="number" min="1" max="240" required className={`${control} font-mono`} value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} />
        </Field>
      </div>

      {form.recurrence === 'WEEKLY' ? (
        <fieldset className="mb-3.5">
          <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{t('irr.days')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={form.daysOfWeek.includes(day)}
                onClick={() => toggleDay(day)}
                className={`min-h-9 rounded-lg border px-3 text-[13px] font-medium transition ${
                  form.daysOfWeek.includes(day)
                    ? 'border-brand bg-brand-wash text-brand'
                    : 'border-hairline-strong bg-surface hover:bg-raised'
                }`}
              >
                {t(`day.${day}`)}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="mb-3.5">
        <Toggle
          checked={form.skipIfMoist}
          name={t('irr.skipName')}
          label={t('irr.skipLabel')}
          onChange={(next) => setForm((f) => ({ ...f, skipIfMoist: next }))}
        />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? t('irr.saving') : schedule ? t('irr.save') : t('irr.create')}
        </button>
        <button type="button" onClick={onCancel} className={plainBtn}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

function ManualControl() {
  const { token, isAdmin } = useSession()
  const { t } = useI18n()
  const [reloadKey, setReloadKey] = useState(0)
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [optimistic, setOptimistic] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [confirmStop, setConfirmStop] = useState(false)

  const { data, loading } = usePolling(
    () => (token ? api.valves(token) : Promise.resolve(null)),
    [token, reloadKey],
    10000,
  )

  const setValve = async (valve: Valve, open: boolean) => {
    if (!token) return
    setError('')
    setPending((p) => ({ ...p, [valve.valveId]: true }))
    setOptimistic((o) => ({ ...o, [valve.valveId]: open ? 'OPEN' : 'CLOSED' }))
    try {
      if (open) await api.openValve(token, valve.valveId, 15)
      else await api.closeValve(token, valve.valveId)
      setReloadKey((k) => k + 1)
    } catch (err) {
      // The device did not acknowledge - revert the optimistic state and say so inline.
      const e = err as { status?: number; message?: string }
      setError(
        e.status === 409
          ? `${valve.zoneName}: ${e.message}`
          : t('irr.noRespond', { zone: valve.zoneName }),
      )
    } finally {
      setPending((p) => {
        const next = { ...p }
        delete next[valve.valveId]
        return next
      })
      setOptimistic((o) => {
        const next = { ...o }
        delete next[valve.valveId]
        return next
      })
    }
  }

  const emergencyStop = async () => {
    if (!token) return
    setError('')
    try {
      await api.emergencyStop(token)
      setConfirmStop(false)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading && !data) return <div className="glass h-64 animate-pulse rounded-xl" />
  if (!data) return <p className="p-12 text-center text-sm text-muted-foreground">{t('irr.valvesUnavailable')}</p>

  return (
    <>
      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-status-critical bg-status-critical/10 px-3 py-2.5 text-[13px] text-status-critical">
          {error}
        </div>
      ) : null}

      {isAdmin ? (
        <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
          {confirmStop ? (
            <>
              <span className="text-xs text-muted-foreground">
                {t('irr.confirmStop')}
              </span>
              <button type="button" onClick={emergencyStop} className="inline-flex min-h-9 items-center rounded-lg border border-status-critical bg-transparent px-3.5 text-[13px] font-medium text-status-critical transition hover:bg-status-critical/10 active:translate-y-px">
                {t('irr.yesClose')}
              </button>
              <button type="button" onClick={() => setConfirmStop(false)} className={plainBtn}>{t('common.cancel')}</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setConfirmStop(true)} className="inline-flex min-h-9 items-center rounded-lg border border-status-critical bg-transparent px-3.5 text-[13px] font-medium text-status-critical transition hover:bg-status-critical/10 active:translate-y-px">
                {t('irr.closeAll')}
              </button>
              <span className="text-xs text-muted-foreground">
                {t('irr.stopHint')}
              </span>
            </>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((valve) => {
          const state = optimistic[valve.valveId] || valve.state
          const isOpen = state === 'OPEN'
          const remaining = formatDuration(valve.secondsRemaining)
          return (
            <article key={valve.valveId} className="glass rounded-xl">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold">{valve.zoneName}</h2>
                  <p className="truncate font-mono text-[11px] text-muted-foreground tabular">{valve.valveId}</p>
                </div>
                <span className="ml-auto flex-none"><Status value={state} /></span>
              </div>
              <div className="p-4">
                <Toggle
                  checked={isOpen}
                  disabled={!isAdmin || pending[valve.valveId]}
                  name={t('irr.valveName', { zone: valve.zoneName })}
                  label={isOpen ? t('status.OPEN') : t('status.CLOSED')}
                  onChange={(next) => setValve(valve, next)}
                />
                <div className="mt-3 grid gap-1">
                  {pending[valve.valveId] ? (
                    <span className="text-xs text-muted-foreground">{t('irr.syncing')}...</span>
                  ) : null}
                  <span className="font-mono text-[11px] text-muted-foreground tabular">
                    {isOpen
                      ? remaining
                        ? t('irr.flowRemaining', { f: valve.flowRateLpm, t: remaining })
                        : t('irr.flow', { f: valve.flowRateLpm })
                      : t('irr.rated', { f: valve.ratedFlowLpm })}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular">
                    {t('irr.lastChange', { t: relativeTime(valve.lastChangedAt) })}
                    {valve.runningScheduleId ? ` ${t('irr.by', { id: valve.runningScheduleId })}` : ''}
                  </span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  name,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
  name: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={name}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 items-center gap-2.5 disabled:opacity-55 active:translate-y-px"
    >
      <span
        className={`h-6 w-10 flex-none rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-hairline-strong'}`}
      >
        <span
          className={`m-[3px] block size-[18px] rounded-full bg-surface transition-transform ${checked ? 'translate-x-4' : ''}`}
        />
      </span>
      {label ? <span className="text-left text-[13px] font-medium">{label}</span> : null}
    </button>
  )
}
