import { useEffect, useState } from 'react'
import { api } from '../api'
import { Empty, Loading, Status, Toggle, formatDuration, relativeTime } from '../components'
import { IconEdit, IconPlus, IconTrash } from '../icons'
import { usePolling, useSession } from '../session'

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export default function Irrigation() {
  const [tab, setTab] = useState('schedules')

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Irrigation views">
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={tab === 'schedules'}
          onClick={() => setTab('schedules')}
        >
          Schedules
        </button>
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={tab === 'manual'}
          onClick={() => setTab('manual')}
        >
          Manual Control
        </button>
      </div>

      {tab === 'schedules' ? <Schedules /> : <ManualControl />}
    </>
  )
}

/* ---------------- Schedules ---------------- */

function Schedules() {
  const { token, isAdmin } = useSession()
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const refresh = () => setReloadKey((k) => k + 1)

  const { data, loading } = usePolling(
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
  if (!data) return <Empty title="Schedules are unavailable" />

  return (
    <>
      {error ? (
        <div className="form-banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="toolbar">
        <span className="muted" style={{ fontSize: 13 }}>
          {data.schedules.filter((s) => s.active).length} of {data.schedules.length} schedules active
        </span>
        {isAdmin ? (
          <div className="toolbar-right">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditing(editing === 'new' ? null : 'new')}
            >
              <IconPlus />
              New schedule
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
          <Empty title="No irrigation schedules yet" />
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
              <div key={schedule.scheduleId} className="field-row" style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Toggle
                    checked={schedule.active}
                    disabled={!isAdmin}
                    label={`${schedule.scheduleId} active`}
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
                    ? schedule.daysOfWeek.map((d) => d.slice(0, 3)).join(', ')
                    : 'Every day'}
                </div>
                <div className="field-meta mono">
                  {schedule.startTime.slice(0, 5)} for {schedule.durationMinutes} min
                  <div>
                    {schedule.lastRunAt ? `last run ${relativeTime(schedule.lastRunAt)}` : 'never run'}
                  </div>
                </div>
                {isAdmin ? (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon"
                      aria-label={`Edit ${schedule.scheduleId}`}
                      onClick={() => setEditing(schedule.scheduleId)}
                    >
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon"
                      aria-label={`Delete ${schedule.scheduleId}`}
                      onClick={() => {
                        if (window.confirm(`Delete ${schedule.scheduleId}?`)) {
                          act(() => api.deleteSchedule(token, schedule.scheduleId))
                        }
                      }}
                    >
                      <IconTrash />
                    </button>
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
          <label htmlFor="valveId">Zone</label>
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
          <label htmlFor="recurrence">Recurrence</label>
          <select
            id="recurrence"
            className="select"
            value={form.recurrence}
            onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="startTime">Start time</label>
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
          <label htmlFor="duration">Duration (minutes)</label>
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
            Days
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
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div style={{ marginBottom: 14 }}>
        <Toggle
          checked={form.skipIfMoist}
          label="Skip the run when the field is already at or above optimal moisture"
          onChange={(next) => setForm((f) => ({ ...f, skipIfMoist: next }))}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving' : schedule ? 'Save changes' : 'Create schedule'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ---------------- Manual control ---------------- */

function ManualControl() {
  const { token, isAdmin } = useSession()
  const [reloadKey, setReloadKey] = useState(0)
  const [pending, setPending] = useState({})
  const [optimistic, setOptimistic] = useState({})
  const [error, setError] = useState('')
  const [confirmStop, setConfirmStop] = useState(false)

  const { data, loading } = usePolling(() => api.valves(token), [token, reloadKey], 10000)

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
          : `${valve.zoneName}: valve did not respond - try again`,
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
  if (!data) return <Empty title="Valve states are unavailable" />

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
                This closes every valve on the farm immediately. Continue?
              </span>
              <button type="button" className="btn btn-danger" onClick={emergencyStop}>
                Yes, close all valves
              </button>
              <button type="button" className="btn" onClick={() => setConfirmStop(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-danger" onClick={() => setConfirmStop(true)}>
                Close all valves
              </button>
              <span className="emergency-copy">
                Farm-wide emergency stop. Asks for confirmation before it runs.
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
                  name={`${valve.zoneName} valve`}
                  label={isOpen ? 'Open' : 'Closed'}
                  onChange={(next) => setValve(valve, next)}
                />

                <div style={{ marginTop: 12, display: 'grid', gap: 4 }}>
                  {pending[valve.valveId] ? (
                    <span className="valve-syncing">
                      <span className="spinner" />
                      syncing with the device
                    </span>
                  ) : null}
                  <span className="field-meta mono">
                    {isOpen
                      ? `${valve.flowRateLpm} L/min${remaining ? `, ${remaining} remaining` : ''}`
                      : `rated ${valve.ratedFlowLpm} L/min`}
                  </span>
                  <span className="field-meta mono">
                    last change {relativeTime(valve.lastChangedAt)}
                    {valve.runningScheduleId ? ` by ${valve.runningScheduleId}` : ''}
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
