import { useEffect, useState } from 'react'
import { api } from '../api'
import {
  ConfirmButton,
  DataError,
  Empty,
  Loading,
  Status,
  Toggle,
  formatDuration,
  relativeTime,
} from '../components'
import { IconEdit, IconPlus, IconTrash } from '../icons'
import { usePolling, useSession } from '../session'
import { useI18n } from '../i18n/react'

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export default function Irrigation() {
  const { t } = useI18n()
  const [tab, setTab] = useState('schedules')

  return (
    <>
      <div className="tabs" role="tablist" aria-label={t('irr.views')}>
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={tab === 'schedules'}
          onClick={() => setTab('schedules')}
        >
          {t('irr.schedules')}
        </button>
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={tab === 'manual'}
          onClick={() => setTab('manual')}
        >
          {t('irr.manual')}
        </button>
      </div>

      {tab === 'schedules' ? <Schedules /> : <ManualControl />}
    </>
  )
}

/* ---------------- Schedules ---------------- */

function Schedules() {
  const { token, isAdmin } = useSession()
  const { t } = useI18n()
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const refresh = () => setReloadKey((k) => k + 1)

  const { data, loading, refresh: retry } = usePolling(
    async () => {
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

  const act = async (fn) => {
    setError('')
    try {
      await fn()
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading && !data) return <Loading variant="rows" rows={4} />
  if (!data) return <DataError what="what.schedules" onRetry={retry} />

  return (
    <>
      {error ? (
        <div className="form-banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="toolbar">
        <span className="muted" style={{ fontSize: 13 }}>
          {t('irr.active', { a: data.schedules.filter((s) => s.active).length, b: data.schedules.length })}
        </span>
        {isAdmin ? (
          <div className="toolbar-right">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditing(editing === 'new' ? null : 'new')}
            >
              <IconPlus />
              {t('irr.new')}
            </button>
          </div>
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
        <section className="card">
          <Empty title={t('irr.none')} />
        </section>
      ) : (
        <section className="card">
          {data.schedules.map((schedule) =>
            editing === schedule.scheduleId ? (
              <div key={schedule.scheduleId} style={{ borderBottom: '1px solid var(--border)' }}>
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
              <div key={schedule.scheduleId} className="field-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Toggle
                    checked={schedule.active}
                    disabled={!isAdmin}
                    label={t('irr.activeLabel', { id: schedule.scheduleId })}
                    onChange={(next) =>
                      act(() => api.toggleSchedule(token, schedule.scheduleId, next))
                    }
                  />
                  <div>
                    <div className="field-name">{schedule.zoneName}</div>
                    <div className="field-meta mono">{schedule.scheduleId}</div>
                  </div>
                </div>
                <div className="field-meta">
                  {schedule.recurrence === 'WEEKLY'
                    ? schedule.daysOfWeek.map((d) => t(`day.${d}`)).join(', ')
                    : t('irr.everyDay')}
                </div>
                <div className="field-meta mono">
                  {t('irr.for', { time: schedule.startTime.slice(0, 5), n: schedule.durationMinutes })}
                  <div>
                    {schedule.lastRunAt ? t('irr.lastRun', { t: relativeTime(schedule.lastRunAt) }) : t('irr.neverRun')}
                  </div>
                </div>
                {isAdmin ? (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon"
                      aria-label={t('irr.edit', { id: schedule.scheduleId })}
                      onClick={() => setEditing(schedule.scheduleId)}
                    >
                      <IconEdit />
                    </button>
                    <ConfirmButton
                      label={t('irr.delete', { id: schedule.scheduleId })}
                      confirmLabel={t('irr.deleteBtn')}
                      onConfirm={() => act(() => api.deleteSchedule(token, schedule.scheduleId))}
                    >
                      <IconTrash />
                    </ConfirmButton>
                  </div>
                ) : (
                  <span />
                )}
              </div>
            ),
          )}
        </section>
      )}
    </>
  )
}

function ScheduleForm({ schedule, valves, crops, onCancel, onSaved }) {
  const { token } = useSession()
  const { t } = useI18n()
  const [form, setForm] = useState({
    valveId: schedule?.valveId || valves[0]?.valveId || '',
    cropId: schedule?.cropId || crops[0]?.cropId || '',
    recurrence: schedule?.recurrence || 'DAILY',
    daysOfWeek: schedule?.daysOfWeek || [],
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

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const body = { ...form, farmId: 'FARM-001' }
      if (schedule) await api.updateSchedule(token, schedule.scheduleId, body)
      else await api.createSchedule(token, body)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day) =>
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day],
    }))

  return (
    <form className="card-body" onSubmit={submit} style={{ background: 'var(--bg-raised)' }}>
      {error ? (
        <div className="form-banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="field">
          <label htmlFor="valveId">{t('irr.zone')}</label>
          <select
            id="valveId"
            className="select"
            value={form.valveId}
            onChange={(e) => setForm((f) => ({ ...f, valveId: e.target.value }))}
          >
            {valves.map((v) => (
              <option key={v.valveId} value={v.valveId}>
                {v.zoneName} ({v.valveId})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="recurrence">{t('irr.recurrence')}</label>
          <select
            id="recurrence"
            className="select"
            value={form.recurrence}
            onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}
          >
            <option value="DAILY">{t('irr.daily')}</option>
            <option value="WEEKLY">{t('irr.weekly')}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="startTime">{t('irr.start')}</label>
          <input
            id="startTime"
            className="input mono"
            type="time"
            required
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="duration">{t('irr.duration')}</label>
          <input
            id="duration"
            className="input mono"
            type="number"
            min="1"
            max="240"
            required
            value={form.durationMinutes}
            onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
          />
        </div>
      </div>

      {form.recurrence === 'WEEKLY' ? (
        <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
          <legend className="metric-label" style={{ padding: 0 }}>
            {t('irr.days')}
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                className="btn"
                aria-pressed={form.daysOfWeek.includes(day)}
                style={
                  form.daysOfWeek.includes(day)
                    ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-wash)' }
                    : undefined
                }
                onClick={() => toggleDay(day)}
              >
                {t(`day.${day}`)}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div style={{ marginBottom: 14 }}>
        <Toggle
          checked={form.skipIfMoist}
          label={t('irr.skipLabel')}
          onChange={(next) => setForm((f) => ({ ...f, skipIfMoist: next }))}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('irr.saving') : schedule ? t('irr.save') : t('irr.create')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

/* ---------------- Manual control ---------------- */

function ManualControl() {
  const { token, isAdmin } = useSession()
  const { t } = useI18n()
  const [reloadKey, setReloadKey] = useState(0)
  const [pending, setPending] = useState({})
  const [optimistic, setOptimistic] = useState({})
  const [error, setError] = useState('')
  const [confirmStop, setConfirmStop] = useState(false)

  const { data, loading, refresh: retry } = usePolling(
    () => api.valves(token),
    [token, reloadKey],
    10000,
  )

  const setValve = async (valve, open) => {
    setError('')
    setPending((p) => ({ ...p, [valve.valveId]: true }))
    setOptimistic((o) => ({ ...o, [valve.valveId]: open ? 'OPEN' : 'CLOSED' }))
    try {
      if (open) await api.openValve(token, valve.valveId, 15)
      else await api.closeValve(token, valve.valveId)
      setReloadKey((k) => k + 1)
    } catch (err) {
      // The device did not acknowledge - revert the optimistic state and say so inline.
      setOptimistic((o) => {
        const next = { ...o }
        delete next[valve.valveId]
        return next
      })
      setError(
        err.status === 409
          ? `${valve.zoneName}: ${err.message}`
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
    setError('')
    try {
      await api.emergencyStop(token)
      setConfirmStop(false)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading && !data) return <Loading variant="cards" rows={4} />
  if (!data) return <DataError what="what.valves" onRetry={retry} />

  return (
    <>
      {error ? (
        <div className="form-banner" role="alert">
          {error}
        </div>
      ) : null}

      {isAdmin ? (
        <div className="emergency-bar">
          {confirmStop ? (
            <>
              <span className="emergency-copy">
                {t('irr.confirmStop')}
              </span>
              <button type="button" className="btn btn-danger" onClick={emergencyStop}>
                {t('irr.yesClose')}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmStop(false)}>
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-danger" onClick={() => setConfirmStop(true)}>
                {t('irr.closeAll')}
              </button>
              <span className="emergency-copy">
                {t('irr.stopHint')}
              </span>
            </>
          )}
        </div>
      ) : null}

      <div className="valve-grid">
        {data.map((valve) => {
          const state = optimistic[valve.valveId] || valve.state
          const isOpen = state === 'OPEN'
          const remaining = formatDuration(valve.secondsRemaining)
          return (
            <article key={valve.valveId} className="card">
              <div className="card-head">
                <div>
                  <h2 className="card-title">{valve.zoneName}</h2>
                  <div className="field-meta mono">{valve.valveId}</div>
                </div>
                <span style={{ marginLeft: 'auto' }}>
                  <Status value={state} />
                </span>
              </div>
              <div className="card-body">
                <Toggle
                  checked={isOpen}
                  disabled={!isAdmin || pending[valve.valveId]}
                  name={t('irr.valveName', { zone: valve.zoneName })}
                  label={isOpen ? t('status.OPEN') : t('status.CLOSED')}
                  onChange={(next) => setValve(valve, next)}
                />

                <div style={{ marginTop: 12, display: 'grid', gap: 4 }}>
                  {pending[valve.valveId] ? (
                    <span className="valve-syncing">
                      <span className="spinner" />
                      {t('irr.syncing')}
                    </span>
                  ) : null}
                  <span className="field-meta mono">
                    {isOpen
                      ? remaining
                        ? t('irr.flowRemaining', { f: valve.flowRateLpm, t: remaining })
                        : t('irr.flow', { f: valve.flowRateLpm })
                      : t('irr.rated', { f: valve.ratedFlowLpm })}
                  </span>
                  <span className="field-meta mono">
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
