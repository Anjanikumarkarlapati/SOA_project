import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { ConfirmButton, DataError, Empty, Loading, Status, relativeTime } from '../components'
import { IconChevron, IconPlus, IconTrash } from '../icons'
import { usePolling, useSession } from '../session'
import { useI18n } from '../i18n/react'

const HEALTH_FILTERS = [
  { value: '', label: 'sensors.allStatuses' },
  { value: 'ONLINE', label: 'status.ONLINE' },
  { value: 'OFFLINE', label: 'status.OFFLINE' },
  { value: 'LOW_BATTERY', label: 'status.LOW_BATTERY' },
]

export default function Sensors() {
  const { token, isAdmin } = useSession()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [health, setHealth] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Typing a device ID used to fire a request per keystroke. Hold the query for a beat so a
  // search costs one call instead of one per character.
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Notices clear themselves after a few seconds; the close button is there for sooner.
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const { data, loading, error, refresh } = usePolling(
    () => api.sensors(token, { q: debouncedQuery, health, fieldId, page, size: 20 }),
    [token, debouncedQuery, health, fieldId, page, reloadKey],
    15000,
  )

  const { data: crops } = usePolling(() => api.crops(token), [token], 0)

  const reload = () => setReloadKey((k) => k + 1)

  const deregister = async (deviceId) => {
    try {
      await api.deleteSensor(token, deviceId)
      setNotice({ tone: '', text: t('sensors.deregistered', { id: deviceId }) })
      reload()
    } catch (err) {
      setNotice({ tone: 'toast-critical', text: err.message })
    }
  }

  return (
    <>
      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder={t('sensors.search')}
          aria-label={t('sensors.searchAria')}
          value={query}
          onChange={(e) => {
            setPage(0)
            setQuery(e.target.value)
          }}
        />
        <select
          className="select"
          aria-label={t('sensors.filterStatus')}
          value={health}
          onChange={(e) => {
            setPage(0)
            setHealth(e.target.value)
          }}
        >
          {HEALTH_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {t(f.label)}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label={t('sensors.filterField')}
          value={fieldId}
          onChange={(e) => {
            setPage(0)
            setFieldId(e.target.value)
          }}
        >
          <option value="">{t('sensors.allFields')}</option>
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
              {t('sensors.register')}
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
            setNotice({ tone: '', text: t('sensors.registered', { id: deviceId }) })
            reload()
          }}
        />
      ) : null}

      {!data && error ? <DataError what="what.devices" onRetry={refresh} /> : null}

      <section className="card" hidden={Boolean(!data && error)}>
        {loading && !data ? (
          <Loading rows={6} />
        ) : !data || data.content.length === 0 ? (
          <Empty
            title={t('sensors.none')}
            description={
              query || health || fieldId
                ? t('sensors.clear')
                : undefined
            }
            action={
              isAdmin ? (
                <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                  {t('sensors.registerSensor')}
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
                    <th>{t('sensors.deviceId')}</th>
                    <th>{t('sensors.type')}</th>
                    <th>{t('sensors.field')}</th>
                    <th>{t('sensors.status')}</th>
                    <th>{t('sensors.lastReading')}</th>
                    <th>{t('sensors.battery')}</th>
                    <th aria-label={t('sensors.actions')} />
                  </tr>
                </thead>
                <tbody>
                  {data.content.map((device) => (
                    <tr
                      key={device.deviceId}
                      className={device.health === 'OFFLINE' ? 'row-offline' : undefined}
                    >
                      <td data-label={t('sensors.deviceId')} className="mono">
                        <Link to={`/sensors/${device.deviceId}`}>{device.deviceId}</Link>
                      </td>
                      <td data-label={t('sensors.type')}>{device.sensorType}</td>
                      <td data-label={t('sensors.field')}>{device.fieldId || '--'}</td>
                      <td data-label={t('sensors.status')} className="col-status">
                        <Status value={device.health} />
                      </td>
                      <td data-label={t('sensors.lastReading')} className="mono">
                        {relativeTime(device.lastReadingAt)}
                      </td>
                      <td data-label={t('sensors.battery')} className="mono">
                        {device.batteryPercent == null
                          ? '--'
                          : `${Math.round(device.batteryPercent)}%`}
                      </td>
                      <td data-label={t('sensors.actions')}>
                        <div className="row-actions">
                          <Link
                            to={`/sensors/${device.deviceId}`}
                            className="btn btn-quiet btn-icon"
                            aria-label={t('sensors.view', { id: device.deviceId })}
                          >
                            <IconChevron className="flip-rtl" />
                          </Link>
                          {isAdmin ? (
                            <ConfirmButton
                              label={t('sensors.deregister', { id: device.deviceId })}
                              confirmLabel={t('sensors.deregisterBtn')}
                              onConfirm={() => deregister(device.deviceId)}
                            >
                              <IconTrash />
                            </ConfirmButton>
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
                {t('sensors.devices', { n: data.totalElements })}
              </span>
              <div className="toolbar-right">
                <button
                  type="button"
                  className="btn"
                  disabled={data.page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  {t('sensors.prev')}
                </button>
                <span className="mono muted" style={{ fontSize: 12, alignSelf: 'center' }}>
                  {t('sensors.page', { a: data.page + 1, b: Math.max(data.totalPages, 1) })}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={data.page + 1 >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('sensors.next')}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {notice ? (
        <div className={`toast ${notice.tone}`} role="status">
          {notice.text}
          <button
            type="button"
            className="btn btn-quiet"
            style={{ minHeight: 24, marginLeft: 8 }}
            onClick={() => setNotice(null)}
          >
            {t('common.dismiss')}
          </button>
        </div>
      ) : null}
    </>
  )
}

function RegisterForm({ crops, onCancel, onCreated }) {
  const { token } = useSession()
  const { t } = useI18n()
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
        <h2 className="card-title">{t('sensors.registerTitle')}</h2>
      </div>
      <form className="card-body" onSubmit={submit}>
        {error ? (
          <div className="form-banner" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="field">
            <label htmlFor="deviceId">{t('sensors.deviceId')}</label>
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
            <label htmlFor="farmId">{t('sensors.farmId')}</label>
            <input id="farmId" className="input mono" required value={form.farmId} onChange={set('farmId')} />
          </div>
          <div className="field">
            <label htmlFor="sensorType">{t('sensors.sensorType')}</label>
            <select id="sensorType" className="select" value={form.sensorType} onChange={set('sensorType')}>
              <option value="soil-moisture-temperature">soil-moisture-temperature</option>
              <option value="weather-station">weather-station</option>
              <option value="ph-probe">ph-probe</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="fieldId">{t('sensors.assign')}</label>
            <select id="fieldId" className="select" value={form.fieldId} onChange={set('fieldId')}>
              <option value="">{t('sensors.unassigned')}</option>
              {crops.map((c) => (
                <option key={c.cropId} value={c.cropId}>
                  {c.name} ({c.cropId})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="latitude">{t('sensors.lat')}</label>
            <input id="latitude" className="input mono" type="number" step="any" value={form.latitude} onChange={set('latitude')} />
          </div>
          <div className="field">
            <label htmlFor="longitude">{t('sensors.lon')}</label>
            <input id="longitude" className="input mono" type="number" step="any" value={form.longitude} onChange={set('longitude')} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('sensors.registering') : t('sensors.register')}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </section>
  )
}
