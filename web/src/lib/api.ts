/* Every call goes through the API gateway; the dashboard never addresses a service directly. */

const TOKEN_KEY = 'agritech.session'

export interface Session {
  token: string
  refreshToken: string
  expiresIn: number
  email: string
  role: 'ADMIN' | 'FARMER'
  farmId: string
  displayName: string
}

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let refreshing: Promise<string | null> | null = null

/** Access tokens live 15 minutes: trade the refresh token for a new pair, once, shared by all callers. */
function refreshSession(): Promise<string | null> {
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
      return next.token as string
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function request<T = unknown>(
  method: string,
  path: string,
  { body, token }: { body?: unknown; token?: string } = {},
  retried = false,
): Promise<T> {
  // Components hold the token from login; a silent refresh may have replaced it since.
  if (token) token = loadSession()?.token || token
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && token && !retried) {
    const fresh = await refreshSession()
    if (fresh) return request<T>(method, path, { body, token: fresh }, true)
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
  return payload as T
}

type Params = Record<string, string | number | undefined | null>

const query = (params: Params) => {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v != null)
  const q = new URLSearchParams(entries as [string, string][]).toString()
  return q ? `?${q}` : ''
}

export const api = {
  login: (email: string, password: string) =>
    request<Session>('POST', '/auth/login', { body: { email, password } }),
  register: (body: unknown) => request<Session>('POST', '/auth/register', { body }),
  logout: (token: string) => request('POST', '/auth/logout', { body: {}, token }),

  sensors: (token: string, params: Params = {}) =>
    request<{ content: Sensor[]; page: number; size: number; totalElements: number; totalPages: number }>(
      'GET',
      `/sensors${query(params)}`,
      { token },
    ),
  sensorSummary: (token: string) =>
    request<{ total: number; online: number; offline: number; lowBattery: number }>(
      'GET',
      '/sensors/summary',
      { token },
    ),
  sensor: (token: string, id: string) => request<Sensor>('GET', `/sensors/${id}`, { token }),
  registerSensor: (token: string, body: unknown) =>
    request<Sensor>('POST', '/sensors/register', { body, token }),
  updateSensor: (token: string, id: string, body: unknown) =>
    request<Sensor>('PUT', `/sensors/${id}`, { body, token }),
  deleteSensor: (token: string, id: string) => request('DELETE', `/sensors/${id}`, { token }),
  telemetry: (token: string, id: string, range: string) =>
    request<Reading[]>('GET', `/telemetry/${id}?range=${range}`, { token }),

  crops: (token: string) => request<Crop[]>('GET', '/crops', { token }),
  crop: (token: string, id: string) => request<Crop>('GET', `/crops/${id}`, { token }),
  createCrop: (token: string, body: { name: string; cropType: string; areaHectares?: number }) =>
    request<Crop>('POST', '/crops', { body, token }),
  cropMetrics: (token: string, id: string, range: string) =>
    request<CropMetrics>('GET', `/crops/${id}/metrics?range=${range}`, { token }),
  cropSummary: (token: string) =>
    request<{ totalFields: number; optimalFields: number; optimalPercent: number }>(
      'GET',
      '/crops/summary',
      { token },
    ),
  cropAlerts: (token: string) => request<Alert[]>('GET', '/crops/alerts', { token }),
  analyze: (token: string, cropId?: string) =>
    request('POST', '/crops/analyze', { body: cropId ? { cropId } : {}, token }),

  schedules: (token: string) => request<Schedule[]>('GET', '/irrigation/schedules', { token }),
  createSchedule: (token: string, body: unknown) =>
    request<Schedule>('POST', '/irrigation/schedules', { body, token }),
  updateSchedule: (token: string, id: string, body: unknown) =>
    request<Schedule>('PUT', `/irrigation/schedules/${id}`, { body, token }),
  toggleSchedule: (token: string, id: string, active: boolean) =>
    request<Schedule>('PATCH', `/irrigation/schedules/${id}/active`, { body: { active }, token }),
  deleteSchedule: (token: string, id: string) =>
    request('DELETE', `/irrigation/schedules/${id}`, { token }),
  irrigationEvents: (token: string) => request<Alert[]>('GET', '/irrigation/events', { token }),

  valves: (token: string) => request<Valve[]>('GET', '/valves', { token }),
  valveSummary: (token: string) =>
    request<{ totalZones: number; running: number }>('GET', '/valves/summary', { token }),
  openValve: (token: string, id: string, minutes: number) =>
    request<Valve>('POST', `/valves/${id}/open?durationMinutes=${minutes}`, { token }),
  closeValve: (token: string, id: string) => request<Valve>('POST', `/valves/${id}/close`, { token }),
  emergencyStop: (token: string) =>
    request<{ closed: number }>('POST', '/valves/emergency-stop?reason=dashboard%20emergency%20stop', {
      token,
    }),
}

/* ---------- Shapes returned by the services ---------- */

export type Health = 'ONLINE' | 'OFFLINE' | 'LOW_BATTERY' | 'DECOMMISSIONED'
export type CropStatus = 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'NO_DATA'

export interface Sensor {
  deviceId: string
  farmId: string
  sensorType: string
  fieldId: string | null
  location: { latitude: number; longitude: number }
  registered: string
  status: string
  health: Health
  batteryPercent: number | null
  lastReadingAt: string | null
}

export interface Reading {
  id: number
  deviceId: string
  timestamp: string
  soilMoisture: number
  soilTemperature: number
  ph: number
}

export interface Crop {
  cropId: string
  farmId: string
  name: string
  cropType: string
  valveId: string | null
  areaHectares: number
  plantedOn: string | null
  optimal: { moisture: number[]; temperature: number[]; ph: number[] }
  healthScore: number | null
  status: CropStatus
  moistureStatus: CropStatus | null
  temperatureStatus: CropStatus | null
  soilMoisture: number | null
  soilTemperature: number | null
  ph: number | null
  hoursToIrrigation: number | null
  lastUpdated: string | null
  recommendations: string[]
}

export interface CropMetrics {
  cropId: string
  range: string
  optimal: { moisture: number[]; temperature: number[]; ph: number[] }
  environment: { timestamp: string; soilMoisture: number; soilTemperature: number; ph: number }[]
  healthTrend: { timestamp: string; healthScore: number }[]
}

export interface Alert {
  id: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  source: string
  cropId?: string
  message: string
  timestamp: string
}

export interface Valve {
  valveId: string
  farmId: string
  cropId: string
  zoneName: string
  state: 'OPEN' | 'CLOSED'
  flowRateLpm: number
  ratedFlowLpm: number
  lastChangedAt: string
  openUntil: string | null
  secondsRemaining: number | null
  runningScheduleId: string | null
}

export interface Schedule {
  scheduleId: string
  farmId: string
  cropId: string
  valveId: string
  zoneName: string
  recurrence: 'DAILY' | 'WEEKLY'
  daysOfWeek: string[]
  startTime: string
  durationMinutes: number
  active: boolean
  skipIfMoist: boolean
  lastRunAt: string | null
}
