import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Empty, Loading, Status, relativeTime } from '../components'
import { IconChevron, IconPlus, IconTrash } from '../icons'
import { usePolling, useSession } from '../session'

const HEALTH_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'LOW_BATTERY', label: 'Low battery' },
]

export default function Sensors() {
  const { token, isAdmin } = useSession()
  const [query, setQuery] = useState('')
  const [health, setHealth] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const { data, loading } = usePolling(
    () => api.sensors(token, { q: query, health, fieldId, page, size: 20 }),
    [token, query, health, fieldId, page, reloadKey],
    15000,
  )

  const { data: crops } = usePolling(() => api.crops(token), [token], 0)

  const refresh = () => setReloadKey((k) => k + 1)

  const deregister = async (deviceId) => {
    if (!window.confirm(`Deregister ${deviceId}? Its history is removed with it.`)) return
    try {
      await api.deleteSensor(token, deviceId)
      setNotice({ tone: '', text: `${deviceId} deregistered` })
      refresh()
    } catch (error) {
      setNotice({ tone: 'toast-critical', text: error.message })
    }
  }

  return (
    <>
      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder="Search device ID"
          aria-label="Search by device ID"
          value={query}
          onChange={(e) => {
            setPage(0)
            setQuery(e.target.value)
          }}
        />
        <select
          className="select"
          aria-label="Filter by status"
          value={health}
          onChange={(e) => {
            setPage(0)
            setHealth(e.target.value)
          }}
        >
          {HEALTH_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label="Filter by field"
          value={fieldId}
          onChange={(e) => {
            setPage(0)
            setFieldId(e.target.value)
          }}
        >
          <option value="">All fields</option>
          {(crops || []).map((c) => (
            <option key={c.cropId} value={c.cropId}>
              {c.name}
            </option>
          ))}
        </select>

        {isAdmin ? (
          <div className="toolbar-right">
            <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              <IconPlus />
              Register device
            </button>
          </div>
        ) : null}
      </div>

      {showForm ? (
        <RegisterForm
          crops={crops || []}
          onCancel={() => setShowForm(false)}
          onCreated={(deviceId) => {
            setShowForm(false)
            setNotice({ tone: '', text: `${deviceId} registered` })
            refresh()
          }}
        />
      ) : null}

      <section className="card">
        {loading && !data ? (
          <Loading rows={6} />
        ) : !data || data.content.length === 0 ? (
          <Empty
            title="No sensors match this view"
            action={
              isAdmin ? (
                <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                  Register a sensor
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="table-wrap collapsible">
              <table className="data">
                <thead>
                  <tr>
                    <th>Device ID</th>
                    <th>Type</th>
                    <th>Field</th>
                    <th>Status</th>
                    <th>Last reading</th>
                    <th>Battery</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.content.map((device) => (
                    <tr
                      key={device.deviceId}
                      className={device.health === 'OFFLINE' ? 'row-offline' : undefined}
                    >
                      <td data-label="Device ID" className="mono">
                        <Link to={`/sensors/${device.deviceId}`}>{device.deviceId}</Link>
                      </td>
                      <td data-label="Type">{device.sensorType}</td>
                      <td data-label="Field">{device.fieldId || '--'}</td>
                      <td data-label="Status" className="col-status">
                        <Status value={device.health} />
                      </td>
                      <td data-label="Last reading" className="mono">
                        {relativeTime(device.lastReadingAt)}
                      </td>
                      <td data-label="Battery" className="mono">
                        {device.batteryPercent == null
                          ? '--'
                          : `${Math.round(device.batteryPercent)}%`}
                      </td>
                      <td data-label="Actions">
                        <div className="row-actions">
                          <Link
                            to={`/sensors/${device.deviceId}`}
                            className="btn btn-quiet btn-icon"
                            aria-label={`View ${device.deviceId}`}
                          >
                            <IconChevron />
                          </Link>
                          {isAdmin ? (
                            <button
                              type="button"
                              className="btn btn-quiet btn-icon"
                              aria-label={`Deregister ${device.deviceId}`}
                              onClick={() => deregister(device.deviceId)}
                            >
                              <IconTrash />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-head" style={{ borderBottom: 0, borderTop: '1px solid var(--border)' }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {data.totalElements} devices
              </span>
              <div className="toolbar-right">
                <button
                  type="button"
                  className="btn"
                  disabled={data.page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <span className="mono muted" style={{ fontSize: 12, alignSelf: 'center' }}>
                  Page {data.page + 1} of {Math.max(data.totalPages, 1)}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={data.page + 1 >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {notice ? (
        <div className={`toast ${notice.tone}`} role="status" onAnimationEnd={() => setNotice(null)}>
          {notice.text}
          <button
            type="button"
            className="btn btn-quiet"
            style={{ minHeight: 24, marginLeft: 8 }}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  )
}

function RegisterForm({ crops, onCancel, onCreated }) {
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

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (event) => {
    event.preventDefault()
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
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h2 className="card-title">Register a device</h2>
      </div>
      <form className="card-body" onSubmit={submit}>
        {error ? (
          <div className="form-banner" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="field">
            <label htmlFor="deviceId">Device ID</label>
            <input
              id="deviceId"
              className="input mono"
              required
              placeholder="SENSOR-FARM01-014"
              value={form.deviceId}
              onChange={set('deviceId')}
            />
          </div>
          <div className="field">
            <label htmlFor="farmId">Farm ID</label>
            <input id="farmId" className="input mono" required value={form.farmId} onChange={set('farmId')} />
          </div>
          <div className="field">
            <label htmlFor="sensorType">Sensor type</label>
            <select id="sensorType" className="select" value={form.sensorType} onChange={set('sensorType')}>
              <option value="soil-moisture-temperature">soil-moisture-temperature</option>
              <option value="weather-station">weather-station</option>
              <option value="ph-probe">ph-probe</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="fieldId">Field assignment</label>
            <select id="fieldId" className="select" value={form.fieldId} onChange={set('fieldId')}>
              <option value="">Unassigned</option>
              {crops.map((c) => (
                <option key={c.cropId} value={c.cropId}>
                  {c.name} ({c.cropId})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="latitude">Latitude</label>
            <input id="latitude" className="input mono" type="number" step="any" value={form.latitude} onChange={set('latitude')} />
          </div>
          <div className="field">
            <label htmlFor="longitude">Longitude</label>
            <input id="longitude" className="input mono" type="number" step="any" value={form.longitude} onChange={set('longitude')} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Registering' : 'Register device'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
