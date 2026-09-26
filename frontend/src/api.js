/* Every call goes through the API gateway; the dashboard never addresses a service directly. */

const TOKEN_KEY = 'agritech.session'

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveSession(session) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

let refreshing = null

/** Access tokens live 15 minutes: trade the refresh token for a new pair, once, shared by all callers. */
function refreshSession() {
  const current = loadSession()
  if (!current?.refreshToken) return Promise.resolve(null)
  refreshing ??= fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((next) => {
      if (!next?.token) return null
      saveSession({ ...current, ...next })
      return next.token
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function request(method, path, { body, token } = {}, retried = false) {
  // Components hold the token from login; a silent refresh may have replaced it since.
  if (token) token = loadSession()?.token || token
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && token && !retried) {
    const fresh = await refreshSession()
    if (fresh) return request(method, path, { body, token: fresh }, true)
  }

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error || 'request_failed',
      payload?.message || `Request failed with ${response.status}`,
    )
  }
  return payload
}

export const api = {
  login: (email, password) => request('POST', '/auth/login', { body: { email, password } }),
  google: (accessToken) => request('POST', '/auth/google', { body: { accessToken } }),
  register: (body) => request('POST', '/auth/register', { body }),
  logout: (token) => request('POST', '/auth/logout', { body: {}, token }),

  sensors: (token, params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString()
    return request('GET', `/sensors${query ? `?${query}` : ''}`, { token })
  },
  sensorSummary: (token) => request('GET', '/sensors/summary', { token }),
  sensor: (token, id) => request('GET', `/sensors/${id}`, { token }),
  registerSensor: (token, body) => request('POST', '/sensors/register', { body, token }),
  updateSensor: (token, id, body) => request('PUT', `/sensors/${id}`, { body, token }),
  deleteSensor: (token, id) => request('DELETE', `/sensors/${id}`, { token }),
  telemetry: (token, id, range) => request('GET', `/telemetry/${id}?range=${range}`, { token }),

  crops: (token) => request('GET', '/crops', { token }),
  crop: (token, id) => request('GET', `/crops/${id}`, { token }),
  cropMetrics: (token, id, range) => request('GET', `/crops/${id}/metrics?range=${range}`, { token }),
  cropSummary: (token) => request('GET', '/crops/summary', { token }),
  cropAlerts: (token) => request('GET', '/crops/alerts', { token }),
  analyze: (token, cropId) => request('POST', '/crops/analyze', { body: cropId ? { cropId } : {}, token }),

  schedules: (token) => request('GET', '/irrigation/schedules', { token }),
  createSchedule: (token, body) => request('POST', '/irrigation/schedules', { body, token }),
  updateSchedule: (token, id, body) => request('PUT', `/irrigation/schedules/${id}`, { body, token }),
  toggleSchedule: (token, id, active) =>
    request('PATCH', `/irrigation/schedules/${id}/active`, { body: { active }, token }),
  deleteSchedule: (token, id) => request('DELETE', `/irrigation/schedules/${id}`, { token }),
  irrigationEvents: (token) => request('GET', '/irrigation/events', { token }),

  valves: (token) => request('GET', '/valves', { token }),
  valveSummary: (token) => request('GET', '/valves/summary', { token }),
  openValve: (token, id, minutes) =>
    request('POST', `/valves/${id}/open?durationMinutes=${minutes}`, { token }),
  closeValve: (token, id) => request('POST', `/valves/${id}/close`, { token }),
  emergencyStop: (token) =>
    request('POST', '/valves/emergency-stop?reason=dashboard%20emergency%20stop', { token }),
}
