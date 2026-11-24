// lib/api.ts — typed fetch wrapper for the AgriTech backend on :8080
import { buildUser, isOfflineToken, useAuthStore } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function tryRefreshJwt(failedToken: string): Promise<string | null> {
  const current = useAuthStore.getState().user;
  if (!current?.refreshToken || current.token !== failedToken || isOfflineToken(failedToken)) {
    return null;
  }

  refreshInFlight ??= fetch(`${BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      if (!data?.token) return null;
      useAuthStore.getState().setUser(buildUser(data));
      return data.token;
    })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  retried = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (
    res.status === 401 &&
    !retried &&
    token &&
    !isOfflineToken(token) &&
    !path.startsWith("/api/auth/")
  ) {
    const freshToken = await tryRefreshJwt(token);
    if (freshToken) {
      return request<T>(path, options, freshToken, true);
    }
  }

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* empty */ }
    const msg =
      (body as { message?: string })?.message ||
      res.statusText ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, body);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginPayload { email: string; password: string }
export interface RegisterPayload {
  email: string;
  password: string;
  role?: "ADMIN" | "FARMER";
  name?: string;
  displayName?: string;
}
export interface AuthResponse {
  token: string;
  refreshToken?: string;
  email: string;
  role: string;
  farmId: string;
  expiresIn: number;
  name?: string;
  displayName?: string;
}

export const authApi = {
  login: (p: LoginPayload) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(p) }),
  google: (accessToken: string) =>
    request<AuthResponse>("/api/auth/google", { method: "POST", body: JSON.stringify({ accessToken }) }),
  refresh: (refreshToken: string) =>
    request<AuthResponse>("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  register: (p: RegisterPayload) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: p.email,
        password: p.password,
        role: p.role,
        displayName: p.displayName ?? p.name,
      }),
    }),
  me: (token: string) =>
    request<{ email: string; role: string; farmId: string; displayName: string; expiresAt?: string }>(
      "/api/auth/me",
      {},
      token
    ),
  logout: (token: string, refreshToken?: string) =>
    request<void>(
      "/api/auth/logout",
      {
        method: "POST",
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      },
      token
    ),
};

// ─── Sensors ──────────────────────────────────────────────────────────────────
export type SensorHealth = "ONLINE" | "OFFLINE" | "LOW_BATTERY" | "DECOMMISSIONED";

export interface Sensor {
  deviceId: string;
  farmId: string;
  sensorType: string;
  fieldId: string;
  status: string;
  health: SensorHealth | (string & {});
  batteryPercent: number;
  lastReadingAt: string;
  registered?: string;
  location?: { latitude: number; longitude: number };
  capabilities?: string[];
  simulated?: boolean;
}

export interface RegisterSensorPayload {
  deviceId: string;
  farmId: string;
  sensorType: string;
  fieldId?: string;
  latitude?: number;
  longitude?: number;
  location?: { latitude: number; longitude: number };
  capabilities?: string[];
}

export interface UpdateSensorPayload {
  sensorType?: string;
  fieldId?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  capabilities?: string[];
}

export interface SensorSummary { total: number; online: number; offline: number; lowBattery: number }

export const sensorApi = {
  list: (token: string, params?: string) =>
    request<{ content: Sensor[]; totalElements: number; totalPages?: number; page?: number; size?: number }>(
      `/api/sensors${params ? `?${params}` : ""}`,
      {},
      token
    ),
  get: (id: string, token: string) =>
    request<Sensor>(`/api/sensors/${encodeURIComponent(id)}`, {}, token),
  summary: (token: string) => request<SensorSummary>("/api/sensors/summary", {}, token),
  register: (body: RegisterSensorPayload | Partial<Sensor>, token: string) =>
    request<Sensor>("/api/sensors/register", { method: "POST", body: JSON.stringify(body) }, token),
  update: (id: string, body: UpdateSensorPayload | Partial<Sensor>, token: string) =>
    request<Sensor>(`/api/sensors/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }, token),
  remove: (id: string, token: string) =>
    request<{ deviceId: string; status: string }>(`/api/sensors/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
};

// ─── Crops ────────────────────────────────────────────────────────────────────
export interface CropField {
  cropId: string;
  farmId?: string;
  name: string;
  cropType: string;
  valveId: string;
  areaHectares: number;
  plantedOn?: string | null;
  healthScore: number | null;
  status: string;
  moistureStatus?: string | null;
  temperatureStatus?: string | null;
  soilMoisture: number | null;
  soilTemperature: number | null;
  ph: number | null;
  hoursToIrrigation: number | null;
  lastUpdated?: string | null;
  recommendations: string[];
  optimal: { moisture: [number, number]; temperature: [number, number]; ph: [number, number] };
}

export interface CropMetrics {
  cropId: string;
  range: string;
  optimal: { moisture: number[]; temperature: number[]; ph: number[] };
  environment: { timestamp: string; soilMoisture: number; soilTemperature: number; ph: number }[];
  healthTrend: { timestamp: string; healthScore: number }[];
}

export const cropApi = {
  list: (token: string, farmId?: string) =>
    request<CropField[]>(`/api/crops${farmId ? `?farmId=${encodeURIComponent(farmId)}` : ""}`, {}, token),
  get: (id: string, token: string) => request<CropField>(`/api/crops/${encodeURIComponent(id)}`, {}, token),
  health: (id: string, token: string) => request<CropField>(`/api/crops/${encodeURIComponent(id)}/health`, {}, token),
  metrics: (id: string, range: string, token: string) =>
    request<CropMetrics>(`/api/crops/${encodeURIComponent(id)}/metrics?range=${encodeURIComponent(range)}`, {}, token),
  create: (body: { name: string; cropType: string; areaHectares?: number }, token: string) =>
    request<CropField>("/api/crops", { method: "POST", body: JSON.stringify(body) }, token),
  update: (id: string, body: { name?: string; cropType?: string; areaHectares?: number }, token: string) =>
    request<CropField>(`/api/crops/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }, token),
  remove: (id: string, token: string) =>
    request<{ status: string; cropId: string }>(`/api/crops/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
  summary: (token: string) =>
    request<{ totalFields: number; optimalFields: number; optimalPercent: number }>("/api/crops/summary", {}, token),
  alerts: (token: string) =>
    request<{ id?: string; severity: string; cropId: string; source: string; message: string; timestamp: string }[]>(
      "/api/crops/alerts",
      {},
      token
    ),
  analyze: (token: string, cropId?: string) =>
    request<{ analyzed?: number; at?: string; timestamp?: string; results?: CropField[] }>(
      "/api/crops/analyze",
      { method: "POST", body: JSON.stringify(cropId ? { cropId } : {}) },
      token
    ),
};

// ─── Telemetry ────────────────────────────────────────────────────────────────
export interface TelemetryReading {
  id?: number;
  deviceId?: string;
  soilMoisture: number;
  soilTemperature: number;
  ph: number;
  batteryPercent: number | null;
  airTemperature?: number | null;
  humidity?: number | null;
  lightLux?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  rainfallMm?: number | null;
  waterLevelMm?: number | null;
  timestamp: string;
}

export interface FieldLatestTelemetry {
  fieldId: string;
  deviceCount: number;
  reportingDevices: number;
  soilMoisture?: number;
  soilTemperature?: number;
  ph?: number;
  timestamp?: string | null;
}

export const telemetryApi = {
  latest: (deviceId: string, token: string) =>
    request<TelemetryReading>(`/api/telemetry/${encodeURIComponent(deviceId)}/latest`, {}, token),
  history: (deviceId: string, range: string, token: string) =>
    request<TelemetryReading[]>(
      `/api/telemetry/${encodeURIComponent(deviceId)}?range=${encodeURIComponent(range)}`,
      {},
      token
    ),
  fieldLatest: (fieldId: string, token: string) =>
    request<FieldLatestTelemetry>(`/api/telemetry/field/${encodeURIComponent(fieldId)}/latest`, {}, token),
  fieldSeries: (fieldId: string, range: string, token: string) =>
    request<{ timestamp: string; soilMoisture: number; soilTemperature: number; ph: number }[]>(
      `/api/telemetry/field/${encodeURIComponent(fieldId)}/series?range=${encodeURIComponent(range)}`,
      {},
      token
    ),
  ingest: (
    readings: Array<{
      deviceId: string;
      soilMoisture: number;
      soilTemperature: number;
      ph: number;
      batteryPercent?: number;
      timestamp?: string;
    }>,
    token: string
  ) =>
    request<{ accepted: number; rejected: { deviceId: string; reason: string }[] }>(
      "/api/telemetry/ingest",
      { method: "POST", body: JSON.stringify({ readings }) },
      token
    ),
  stats: (token: string) =>
    request<{ readingsLastMinute: number; readingsLastHour: number; totalReadings: number }>(
      "/api/telemetry/stats",
      {},
      token
    ),
};

// ─── Irrigation ───────────────────────────────────────────────────────────────
export type ScheduleRecurrence = "DAILY" | "WEEKLY";

export interface IrrigationSchedule {
  scheduleId: string;
  farmId: string;
  cropId: string;
  valveId: string;
  zoneName: string;
  recurrence: ScheduleRecurrence | (string & {});
  daysOfWeek: string[];
  startTime: string;
  durationMinutes: number;
  active: boolean;
  skipIfMoist: boolean;
  lastRunAt: string | null;
}

export interface CreateIrrigationSchedulePayload {
  cropId: string;
  valveId: string;
  farmId?: string;
  recurrence?: ScheduleRecurrence;
  daysOfWeek?: string[];
  startTime: string;
  durationMinutes: number;
  skipIfMoist?: boolean;
  active?: boolean;
}

export type UpdateIrrigationSchedulePayload = Partial<CreateIrrigationSchedulePayload>;

export interface IrrigationEvent {
  id: string;
  severity: string;
  source: string;
  cropId: string;
  message: string;
  timestamp: string;
}

export const irrigationApi = {
  schedules: (token: string) =>
    request<IrrigationSchedule[]>("/api/irrigation/schedules", {}, token),
  getSchedule: (id: string, token: string) =>
    request<IrrigationSchedule>(`/api/irrigation/schedules/${encodeURIComponent(id)}`, {}, token),
  events: (token: string) =>
    request<IrrigationEvent[]>("/api/irrigation/events", {}, token),
  createSchedule: (body: CreateIrrigationSchedulePayload, token: string) =>
    request<IrrigationSchedule>("/api/irrigation/schedules", { method: "POST", body: JSON.stringify(body) }, token),
  updateSchedule: (id: string, body: UpdateIrrigationSchedulePayload, token: string) =>
    request<IrrigationSchedule>(
      `/api/irrigation/schedules/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(body) },
      token
    ),
  toggleSchedule: (id: string, active: boolean, token: string) =>
    request<IrrigationSchedule>(
      `/api/irrigation/schedules/${encodeURIComponent(id)}/active`,
      { method: "PATCH", body: JSON.stringify({ active }) },
      token
    ),
  deleteSchedule: (id: string, token: string) =>
    request<{ status: string; scheduleId: string }>(
      `/api/irrigation/schedules/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      token
    ),
};

// ─── Valves ───────────────────────────────────────────────────────────────────
export type ValveState = "OPEN" | "CLOSED";

export interface ValveStatus {
  valveId: string;
  farmId: string;
  cropId: string;
  zoneName: string;
  state: ValveState | (string & {});
  flowRateLpm: number;
  ratedFlowLpm: number;
  lastChangedAt: string;
  openUntil: string | null;
  secondsRemaining: number | null;
  runningScheduleId: string | null;
}

export interface ValveSummary {
  totalZones: number;
  running: number;
}

export const valveApi = {
  list: (token: string) => request<ValveStatus[]>("/api/valves", {}, token),
  status: (valveId: string, token: string) =>
    request<ValveStatus>(`/api/valves/${encodeURIComponent(valveId)}/status`, {}, token),
  summary: (token: string) => request<ValveSummary>("/api/valves/summary", {}, token),
  open: (valveId: string, token: string, durationMinutes = 15) => {
    const mins = Number.isFinite(durationMinutes)
      ? Math.min(240, Math.max(1, Math.round(durationMinutes)))
      : 15;
    return request<ValveStatus>(
      `/api/valves/${encodeURIComponent(valveId)}/open?durationMinutes=${mins}`,
      { method: "POST" },
      token
    );
  },
  close: (valveId: string, token: string) =>
    request<ValveStatus>(`/api/valves/${encodeURIComponent(valveId)}/close`, { method: "POST" }, token),
  emergencyStop: (token: string, reason = "manual emergency stop") =>
    request<{ closed: number; reason: string }>(
      `/api/valves/emergency-stop?reason=${encodeURIComponent(reason)}`,
      { method: "POST" },
      token
    ),
};

// ─── Climate & Recommendations (:8080 Gateway) ───────────────────────────────
export interface ClimateDistribution {
  count: number;
  mean: number | null;
  median: number | null;
  standardDeviation: number | null;
  p05: number | null;
  p25: number | null;
  p75: number | null;
  p95: number | null;
}

export interface ClimateStatisticsSummary {
  temperatureC: ClimateDistribution;
  rainfallMm: ClimateDistribution;
  temperatureTrendCPerDecade: number | null;
  rainfallTrendMmPerDecade: number | null;
  growingDegreeDays: number | null;
  referenceEvapotranspirationMm: number | null;
  waterBalanceMm: number | null;
  droughtRiskPercent: number | null;
  heatStressRiskPercent: number | null;
  extremeEventProbabilityPercent: number | null;
}

export interface ClimateAnnualPoint {
  year: number;
  meanTemperatureC: number | null;
  rainfallTotalMm: number | null;
  referenceEt0Mm: number | null;
  waterBalanceMm: number | null;
  growingDegreeDays: number | null;
}

export interface HistoricalClimateResponse {
  provider: string;
  attribution?: string;
  startDate: string;
  endDate: string;
  fallback: boolean;
  dataAvailable: boolean;
  dailyObservations: number;
  statistics: ClimateStatisticsSummary;
  annualSeries: ClimateAnnualPoint[];
  propertyId?: string;
}

export interface BackendRecommendationItem {
  cropId: string;
  crop: string;
  score: number;
  temperatureFit: number;
  waterFit: number;
  soilMatch: number;
  seasonFit: number;
  climateTrendFit: number;
  expectedWaterNeedMm: number;
  sowingWindow: string;
  harvestWindow: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | (string & {});
  explanation: string;
}

export interface BackendRecommendationResponse {
  propertyId?: string;
  intent?: string;
  provider?: string;
  fallback?: boolean;
  dataAvailable?: boolean;
  period?: { start: string; end: string };
  weights: {
    temperature: number;
    water: number;
    soil: number;
    season: number;
    trendRisk: number;
  };
  climate?: ClimateStatisticsSummary;
  recommendations: BackendRecommendationItem[];
  adaptations: string[];
}

export interface RecommendationScorePayload {
  climate: ClimateStatisticsSummary | null;
  soilType?: string | null;
  waterSource?: string | null;
  waterAvailability?: string | null;
  intent?: "GROW_NOW" | "PLAN_DATES" | "RECOMMEND_BEST";
  targetDate?: string | null;
  limit?: number;
}

export const climateApi = {
  history: (lat: number, lon: number, start: string, end: string, token: string) =>
    request<HistoricalClimateResponse>(
      `/api/climate/history?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      {},
      token
    ),
};

export const recommendationApi = {
  score: (body: RecommendationScorePayload, token: string) =>
    request<BackendRecommendationResponse>(
      "/api/recommendations/score",
      { method: "POST", body: JSON.stringify(body) },
      token
    ),
};

// ─── Farm Properties (/api/farm/properties) ──────────────────────────────────
export interface Property {
  id: string;
  userId: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  areaHa: number;
  waterSource: string;
  irrigationType: string;
  soilType: string;
  cropIntent: string;
  previousCrops: string[];
  createdAt: string;
  updatedAt: string;
  selectedCropId?: string;
  fieldId?: string;
  deviceId?: string;
  state?: string;
  district?: string;
  sensors?: string[];
  waterAvailability?: string;
  plannedSeason?: string;
  plannedDateStart?: string;
  plannedDateEnd?: string;
  defaultProperty?: boolean;
}

const BACKEND_CROP_IDS = new Set([
  "rice", "wheat", "maize", "barley", "jowar", "bajra", "ragi",
  "chana", "tur", "moong", "urad", "masoor",
  "groundnut", "mustard", "soybean", "sunflower", "sesame", "castor",
  "cotton", "sugarcane", "jute", "tobacco",
  "potato", "onion", "tomato", "brinjal", "chilli", "okra", "cabbage", "cauliflower", "cucumber", "peas",
  "banana", "mango", "grapes", "pomegranate", "citrus", "papaya", "guava",
  "turmeric", "ginger", "garlic", "cumin", "coriander",
  "coconut", "tea", "coffee", "pepper",
]);

const CROP_ID_ALIASES: Record<string, string> = {
  sorghum: "jowar",
  chickpea: "chana",
  beans: "moong",
  spinach: "coriander",
  watermelon: "cucumber",
  carrot: "potato",
};

const BACKEND_SENSORS = new Set([
  "air-temperature",
  "humidity",
  "light",
  "npk",
  "rainfall",
  "water-level",
]);

export function toBackendCropId(cropId?: string | null): string {
  const key = (cropId ?? "").trim().toLowerCase();
  if (BACKEND_CROP_IDS.has(key)) return key;
  if (key in CROP_ID_ALIASES) return CROP_ID_ALIASES[key];
  return "wheat";
}

export function toBackendCropIntent(intent?: string | null): "GROW_NOW" | "PLAN_DATES" | "RECOMMEND_BEST" {
  const norm = (intent ?? "").trim().toUpperCase();
  if (norm === "GROW_NOW") return "GROW_NOW";
  if (norm === "PLAN_SEASON" || norm === "PLAN_DATES") return "PLAN_DATES";
  return "RECOMMEND_BEST";
}

export function fromBackendCropIntent(intent?: string | null): string {
  const norm = (intent ?? "").trim().toUpperCase();
  if (norm === "PLAN_DATES" || norm === "PLAN_SEASON") return "PLAN_SEASON";
  if (norm === "GROW_NOW") return "GROW_NOW";
  if (norm === "RECOMMEND_BEST") return "RECOMMEND_BEST";
  return "";
}

function deriveWaterAvailability(input: Record<string, unknown>): string {
  if (typeof input.waterAvailability === "string" && input.waterAvailability.trim()) {
    return input.waterAvailability.trim();
  }
  const months = input.availabilityMonths;
  if (Array.isArray(months) && months.length > 0) {
    if (months.length >= 10) return "year-round";
    if (months.length >= 5) return "seasonal";
    return "limited";
  }
  const src = String(input.waterSource ?? "").toLowerCase();
  if (src === "rain-fed") return "seasonal";
  return "year-round";
}

function validBoundaryGeoJson(boundary: unknown): string | undefined {
  if (!boundary || typeof boundary !== "object") return undefined;
  const poly = boundary as { type?: unknown; coordinates?: unknown };
  if (poly.type !== "Polygon" || !Array.isArray(poly.coordinates) || !Array.isArray(poly.coordinates[0])) {
    return undefined;
  }
  const ring = poly.coordinates[0] as unknown[];
  if (ring.length < 4) return undefined;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (JSON.stringify(first) !== JSON.stringify(last)) return undefined;
  return JSON.stringify(boundary);
}

export function toSetupRequest(input: Partial<Property> & Record<string, unknown>): Record<string, unknown> {
  if (
    typeof input.farmName === "string" &&
    input.farmName.trim() &&
    typeof input.landSize === "number" &&
    typeof input.landUnit === "string" &&
    typeof input.cropId === "string" &&
    Array.isArray(input.sensors)
  ) {
    return input;
  }

  const farmName = String(input.farmName ?? input.name ?? "My Farm").trim().slice(0, 80) || "My Farm";
  const areaHa = Math.max(0.01, Number(input.landSize ?? input.areaHa ?? 1) || 1);
  const landUnit = input.landUnit === "ACRES" ? "ACRES" : "HECTARES";
  const cropId = toBackendCropId(
    String(input.cropId ?? input.selectedCropId ?? "wheat")
  );

  const rawSensors = Array.isArray(input.sensors)
    ? input.sensors.map(String).filter((s) => BACKEND_SENSORS.has(s))
    : [];
  const sensors =
    rawSensors.length > 0 ? rawSensors.slice(0, 10) : ["air-temperature", "humidity", "rainfall"];

  const profile: Record<string, unknown> = {};
  const lat = Number(input.lat ?? input.latitude);
  const lon = Number(input.lon ?? input.longitude);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  ) {
    profile.lat = lat;
    profile.lon = lon;
  }

  if (typeof input.address === "string" && input.address.trim()) {
    profile.address = input.address.trim().slice(0, 500);
  }
  if (typeof input.soilType === "string" && input.soilType.trim()) {
    profile.soilType = input.soilType.trim();
  }
  if (typeof input.waterSource === "string" && input.waterSource.trim()) {
    profile.waterSource = input.waterSource.trim();
  }
  profile.waterAvailability = deriveWaterAvailability(input);
  if (typeof input.irrigationType === "string" && input.irrigationType.trim()) {
    profile.irrigationType = input.irrigationType.trim();
  }
  profile.cropIntent = toBackendCropIntent(
    typeof input.cropIntent === "string" ? input.cropIntent : undefined
  );
  if (typeof input.plannedSeason === "string" && input.plannedSeason.trim()) {
    profile.intendedSeason = input.plannedSeason.trim();
  }
  if (typeof input.plannedDateStart === "string" && input.plannedDateStart.trim()) {
    profile.intentStartDate = input.plannedDateStart.trim();
  }
  if (typeof input.plannedDateEnd === "string" && input.plannedDateEnd.trim()) {
    profile.intentEndDate = input.plannedDateEnd.trim();
  }
  if (Array.isArray(input.previousCrops) && input.previousCrops.length > 0) {
    profile.previousCrops = input.previousCrops.map(String).filter(Boolean);
  }
  const boundaryJson = validBoundaryGeoJson(input.boundary);
  if (boundaryJson) {
    profile.boundaryGeoJson = boundaryJson;
  }

  const stateVal = typeof input.state === "string" ? input.state : typeof input.region === "string" ? input.region : undefined;
  const districtVal = typeof input.district === "string" ? input.district : undefined;

  return {
    farmName,
    landSize: Number(areaHa.toFixed(4)),
    landUnit,
    cropId,
    ...(stateVal && stateVal.trim() ? { state: stateVal.trim().slice(0, 60) } : {}),
    ...(districtVal && districtVal.trim() ? { district: districtVal.trim().slice(0, 60) } : {}),
    sensors,
    profile,
  };
}

export function fromBackendProperty(raw: Record<string, unknown>): Property {
  const waterObj =
    raw.water && typeof raw.water === "object" ? (raw.water as Record<string, unknown>) : {};
  const intentObj =
    raw.cropIntent && typeof raw.cropIntent === "object"
      ? (raw.cropIntent as Record<string, unknown>)
      : {};
  const profileObj =
    raw.profile && typeof raw.profile === "object" ? (raw.profile as Record<string, unknown>) : {};

  const landSize = Number(raw.landSize ?? raw.areaHa ?? 1) || 1;
  const landUnit = String(raw.landUnit ?? "HECTARES").toUpperCase();
  const areaHa =
    typeof raw.landHectares === "number"
      ? raw.landHectares
      : typeof raw.areaHa === "number"
        ? raw.areaHa
        : landUnit === "ACRES"
          ? Number((landSize / 2.47105).toFixed(2))
          : landSize;

  const rawPrev = intentObj.previousCrops ?? raw.previousCrops ?? profileObj.previousCrops;
  const previousCrops = Array.isArray(rawPrev)
    ? rawPrev.map(String).filter(Boolean)
    : typeof rawPrev === "string"
      ? rawPrev.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const lat = Number(raw.latitude ?? raw.lat ?? profileObj.lat ?? 20.46);
  const lon = Number(raw.longitude ?? raw.lon ?? profileObj.lon ?? 85.88);
  const now = new Date().toISOString();

  return {
    id: String(raw.propertyId ?? raw.id ?? ""),
    userId: String(raw.ownerEmail ?? raw.userId ?? ""),
    name: String(raw.farmName ?? raw.name ?? "Unnamed Farm"),
    lat: Number.isFinite(lat) ? lat : 20.46,
    lon: Number.isFinite(lon) ? lon : 85.88,
    address: String(raw.address ?? profileObj.address ?? ""),
    areaHa: Math.max(0.1, areaHa),
    waterSource: String(waterObj.waterSource ?? raw.waterSource ?? profileObj.waterSource ?? "borewell"),
    irrigationType: String(waterObj.irrigationType ?? raw.irrigationType ?? profileObj.irrigationType ?? "drip"),
    soilType: String(raw.soilType ?? profileObj.soilType ?? "loam"),
    cropIntent: fromBackendCropIntent(
      typeof intentObj.intent === "string"
        ? intentObj.intent
        : typeof raw.cropIntent === "string"
          ? raw.cropIntent
          : typeof profileObj.cropIntent === "string"
            ? profileObj.cropIntent
            : "RECOMMEND_BEST"
    ),
    previousCrops,
    createdAt: String(raw.createdAt ?? now),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? now),
    selectedCropId: typeof raw.cropId === "string" ? raw.cropId : typeof raw.selectedCropId === "string" ? raw.selectedCropId : "wheat",
    fieldId: typeof raw.fieldId === "string" ? raw.fieldId : undefined,
    deviceId: typeof raw.deviceId === "string" ? raw.deviceId : undefined,
    state: typeof raw.state === "string" ? raw.state : undefined,
    district: typeof raw.district === "string" ? raw.district : undefined,
    sensors: Array.isArray(raw.sensors) ? raw.sensors.map(String) : undefined,
    waterAvailability: typeof waterObj.availability === "string" ? waterObj.availability : undefined,
    plannedSeason: typeof intentObj.season === "string" ? intentObj.season : undefined,
    plannedDateStart: typeof intentObj.startDate === "string" ? intentObj.startDate : undefined,
    plannedDateEnd: typeof intentObj.endDate === "string" ? intentObj.endDate : undefined,
    defaultProperty: typeof raw.defaultProperty === "boolean" ? raw.defaultProperty : undefined,
  };
}

export const propertyApi = {
  list: async (token: string) => {
    const rows = await request<Record<string, unknown>[]>("/api/farm/properties", {}, token);
    return Array.isArray(rows) ? rows.map(fromBackendProperty) : [];
  },
  get: async (id: string, token: string) => {
    const row = await request<Record<string, unknown>>(
      `/api/farm/properties/${encodeURIComponent(id)}`,
      {},
      token
    );
    return fromBackendProperty(row ?? {});
  },
  create: async (body: Partial<Property> & Record<string, unknown>, token: string) => {
    const row = await request<Record<string, unknown>>(
      "/api/farm/properties",
      { method: "POST", body: JSON.stringify(toSetupRequest(body)) },
      token
    );
    return fromBackendProperty(row ?? {});
  },
  update: async (id: string, body: Partial<Property> & Record<string, unknown>, token: string) => {
    const row = await request<Record<string, unknown>>(
      `/api/farm/properties/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(toSetupRequest(body)) },
      token
    );
    return fromBackendProperty(row ?? {});
  },
  remove: (id: string, token: string) =>
    request<void>(`/api/farm/properties/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
};

export const farmApi = {
  me: (token: string, propertyId?: string) =>
    request<Record<string, unknown> | undefined>(
      `/api/farm/me${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ""}`,
      {},
      token
    ),
  setup: (body: Partial<Property> & Record<string, unknown>, token: string) =>
    request<Record<string, unknown>>(
      "/api/farm/me",
      { method: "PUT", body: JSON.stringify(toSetupRequest(body)) },
      token
    ),
  propertyClimate: (propertyId: string, token: string, start?: string, end?: string) => {
    const qs = new URLSearchParams();
    if (start) qs.set("start", start);
    if (end) qs.set("end", end);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<HistoricalClimateResponse>(
      `/api/farm/properties/${encodeURIComponent(propertyId)}/climate${suffix}`,
      {},
      token
    );
  },
  propertyRecommendations: (propertyId: string, token: string, start?: string, end?: string) => {
    const qs = new URLSearchParams();
    if (start) qs.set("start", start);
    if (end) qs.set("end", end);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<BackendRecommendationResponse>(
      `/api/farm/properties/${encodeURIComponent(propertyId)}/recommendations${suffix}`,
      {},
      token
    );
  },
  latestReport: (token: string, propertyId?: string) =>
    request<Record<string, unknown>>(
      `/api/farm/me/reports/latest${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ""}`,
      {},
      token
    ),
};

export { ApiError };

export function isBackendUnreachableError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 502 || err.status === 503 || err.status === 504;
  }
  if (err instanceof TypeError) return true;
  if (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") {
    return true;
  }
  return false;
}

export function isPropertyEndpointUnavailableError(err: unknown): boolean {
  if (isBackendUnreachableError(err)) return true;
  return err instanceof ApiError && err.status === 404;
}
