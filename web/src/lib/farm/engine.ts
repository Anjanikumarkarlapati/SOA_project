/*
 * The farm assistant's automation engine. Pure functions, no React: given a farm profile and
 * a day's weather it works out how much water the crop needs, when to give it, and which
 * sensors the field should carry. The Assistant page drives these from a simulated clock.
 *
 * Water demand follows FAO-56: reference evapotranspiration (ET0) from live weather when we
 * have it, otherwise Hargreaves-Samani from temperature; crop demand ETc = Kc x ET0; net need
 * is ETc minus effective rain; gross need divides by the irrigation method's efficiency.
 * One millimetre over one square metre is one litre.
 */

import {
  ACRE_M2,
  CLIMATE,
  IRRIGATION,
  STATES,
  cropById,
  soilById,
  type CropProfile,
  type District,
  type IrrigationMethod,
  type SensorItem,
  type SoilProfile,
} from './india'
import { msg, tr, type Msg } from '../i18n/core'

/* ---------- Profile ---------- */

export interface FarmProfile {
  farmerName: string
  cropId: string
  sowingDate: string // yyyy-mm-dd
  state: string
  district: string
  lat: number
  lon: number
  areaAcres: number
  soilId: string
  irrigation: IrrigationMethod
  /** Pump discharge, litres per minute. A 5 HP borewell pump gives roughly 300-450. */
  pumpLpm: number
  createdAt: string
  /** Set when the field was also registered with the crop service. */
  backendCropId?: string
}

const PROFILE_KEY = (email: string) => `agritech.farm.${email.toLowerCase()}`

export function loadProfile(email: string): FarmProfile | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY(email)) || 'null')
  } catch {
    return null
  }
}

export function saveProfile(email: string, profile: FarmProfile) {
  try {
    localStorage.setItem(PROFILE_KEY(email), JSON.stringify(profile))
  } catch {
    // Private browsing: the wizard still works, it just asks again next visit.
  }
}

export function clearProfile(email: string) {
  try {
    localStorage.removeItem(PROFILE_KEY(email))
  } catch {
    // Nothing to clear.
  }
}

export function districtOf(profile: Pick<FarmProfile, 'state' | 'district'>): District | undefined {
  return STATES.find((s) => s.name === profile.state)?.districts.find((d) => d.name === profile.district)
}

/* ---------- Temperature bands ---------- */

export type TempBand = 'Cold' | 'Cool' | 'Mild' | 'Warm' | 'Hot' | 'Heatwave'

/** IMD calls a heatwave at 40 C and above in the plains; the rest are agronomic bands. */
export function tempBand(tmax: number): TempBand {
  if (tmax >= 40) return 'Heatwave'
  if (tmax >= 35) return 'Hot'
  if (tmax >= 28) return 'Warm'
  if (tmax >= 18) return 'Mild'
  if (tmax >= 10) return 'Cool'
  return 'Cold'
}

export const BAND_TONE: Record<TempBand, 'critical' | 'warning' | 'good' | 'info'> = {
  Heatwave: 'critical',
  Hot: 'warning',
  Warm: 'good',
  Mild: 'good',
  Cool: 'info',
  Cold: 'info',
}

/* ---------- Crop stage ---------- */

export interface StageInfo {
  day: number
  stage: 'Initial' | 'Development' | 'Mid-season' | 'Late season' | 'Harvest ready'
  kc: number
  /** 0..1 through the whole season. */
  progress: number
  /** Root depth today, metres - roots grow through the development stage. */
  rootDepth: number
}

export function cropStage(crop: CropProfile, sowingDate: string, on: Date = new Date()): StageInfo {
  const [ini, dev, mid, late] = crop.stages
  const total = ini + dev + mid + late
  let day = Math.max(0, Math.floor((on.getTime() - new Date(sowingDate).getTime()) / 86400000))
  // Orchards and cane repeat their cycle every year.
  if (crop.perennial) day = day % total
  const [kcIni, kcMid, kcEnd] = crop.kc
  const minRoot = Math.min(0.3, crop.rootDepth)
  const root = (f: number) => minRoot + (crop.rootDepth - minRoot) * Math.min(1, Math.max(0, f))

  if (day < ini) return { day, stage: 'Initial', kc: kcIni, progress: day / total, rootDepth: root(0) }
  if (day < ini + dev) {
    const f = (day - ini) / dev
    return { day, stage: 'Development', kc: kcIni + (kcMid - kcIni) * f, progress: day / total, rootDepth: root(f) }
  }
  if (day < ini + dev + mid) return { day, stage: 'Mid-season', kc: kcMid, progress: day / total, rootDepth: root(1) }
  if (day < total) {
    const f = (day - ini - dev - mid) / late
    return { day, stage: 'Late season', kc: kcMid + (kcEnd - kcMid) * f, progress: day / total, rootDepth: root(1) }
  }
  return { day, stage: 'Harvest ready', kc: kcEnd, progress: 1, rootDepth: root(1) }
}

/* ---------- Weather ---------- */

export interface DayWeather {
  date: string // yyyy-mm-dd
  tmax: number
  tmin: number
  rainMm: number
  humidity: number
  /** FAO-56 reference ET, mm/day; filled from Hargreaves when the source has none. */
  et0: number
  /** Hourly air temperature, 24 values, when the source had them. */
  hourlyTemp?: number[]
}

export type WeatherSource = 'live' | 'normals'

export type Scenario = 'normal' | 'heatwave' | 'monsoon' | 'coldwave'

export const SCENARIOS: Scenario[] = ['normal', 'heatwave', 'monsoon', 'coldwave']

/** FAO-56 eq. 21: extraterrestrial radiation, converted to mm/day of evaporation. */
function extraterrestrialMm(lat: number, dayOfYear: number) {
  const phi = (lat * Math.PI) / 180
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * dayOfYear) / 365)
  const delta = 0.409 * Math.sin((2 * Math.PI * dayOfYear) / 365 - 1.39)
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))))
  const ra =
    ((24 * 60) / Math.PI) *
    0.082 *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
  return ra * 0.408
}

export function hargreavesEt0(tmax: number, tmin: number, lat: number, date: Date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const doy = Math.floor((date.getTime() - start.getTime()) / 86400000)
  const tmean = (tmax + tmin) / 2
  const et0 = 0.0023 * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * extraterrestrialMm(lat, doy)
  return Math.max(0.5, Number(et0.toFixed(2)))
}

const isoDate = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Deterministic wobble so demo days differ but a reload shows the same week. */
function wobble(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Seven days from IMD climate normals for the district's zone, with day-to-day variation. */
export function normalsWeek(district: District, from: Date = new Date()): DayWeather[] {
  const zone = CLIMATE[district.zone]
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    const m = date.getMonth()
    const seed = date.getFullYear() * 400 + m * 32 + date.getDate() + Math.round(district.lat * 10)
    const jitter = (wobble(seed) - 0.5) * 3
    const tmax = zone.tmax[m] + jitter
    const tmin = zone.tmin[m] + jitter * 0.6
    // Monthly rain arrives on a few days, not spread evenly.
    const rainyDayChance = Math.min(0.85, zone.rain[m] / 250)
    const rains = wobble(seed + 7) < rainyDayChance
    const rainMm = rains ? Number(((zone.rain[m] / 30 / Math.max(rainyDayChance, 0.1)) * (0.4 + wobble(seed + 3))).toFixed(1)) : 0
    return {
      date: isoDate(date),
      tmax: Number(tmax.toFixed(1)),
      tmin: Number(tmin.toFixed(1)),
      rainMm,
      humidity: zone.rh[m],
      et0: hargreavesEt0(tmax, tmin, district.lat, date),
    }
  })
}

/**
 * Live 7-day forecast from Open-Meteo (free, no key, CORS enabled). Returns null on any
 * failure so the caller falls back to climate normals - the demo must never break offline.
 */
export async function fetchLiveWeek(lat: number, lon: number, signal?: AbortSignal): Promise<DayWeather[] | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,relative_humidity_2m_mean' +
    '&hourly=temperature_2m&timezone=Asia%2FKolkata&forecast_days=7'
  try {
    const response = await fetch(url, { signal })
    if (!response.ok) return null
    const data = await response.json()
    const daily = data.daily
    if (!daily?.time?.length) return null
    const hourly: number[] = data.hourly?.temperature_2m ?? []
    return daily.time.map((date: string, i: number) => {
      const tmax = daily.temperature_2m_max[i]
      const tmin = daily.temperature_2m_min[i]
      return {
        date,
        tmax,
        tmin,
        rainMm: daily.precipitation_sum?.[i] ?? 0,
        humidity: daily.relative_humidity_2m_mean?.[i] ?? 60,
        et0: daily.et0_fao_evapotranspiration?.[i] ?? hargreavesEt0(tmax, tmin, lat, new Date(date)),
        hourlyTemp: hourly.length >= (i + 1) * 24 ? hourly.slice(i * 24, i * 24 + 24) : undefined,
      } satisfies DayWeather
    })
  } catch {
    return null
  }
}

/** Bends a day's weather to a demo scenario so the engine's reaction is visible. */
export function applyScenario(day: DayWeather, scenario: Scenario, lat: number): DayWeather {
  if (scenario === 'normal') return day
  const date = new Date(day.date)
  let { tmax, tmin, rainMm, humidity } = day
  if (scenario === 'heatwave') {
    tmax = Math.max(tmax + 7, 42)
    tmin += 5
    rainMm = 0
    humidity = Math.max(15, humidity - 25)
  } else if (scenario === 'monsoon') {
    tmax -= 3
    tmin = Math.max(tmin, tmax - 6)
    rainMm = Math.max(rainMm, 45)
    humidity = 90
  } else if (scenario === 'coldwave') {
    tmax = Math.min(tmax - 9, 16)
    tmin = Math.min(tmin - 9, 2)
    rainMm = 0
  }
  // Heat and dry air push ET0 up beyond what temperature alone says; rain days are cloudy.
  let et0 = hargreavesEt0(tmax, tmin, lat, date)
  if (scenario === 'heatwave') et0 *= 1.15
  if (scenario === 'monsoon') et0 *= 0.6
  return { ...day, tmax, tmin, rainMm, humidity, et0: Number(et0.toFixed(2)), hourlyTemp: undefined }
}

/** Hourly air temperature: minimum near sunrise (06:00), maximum mid-afternoon (15:00). */
export function hourlyTemps(day: DayWeather): number[] {
  if (day.hourlyTemp?.length === 24) return day.hourlyTemp
  return Array.from({ length: 24 }, (_, h) => {
    const amp = (day.tmax - day.tmin) / 2
    const mean = (day.tmax + day.tmin) / 2
    // Cosine peaking at 15:00, trough at 03:00, then nudged so 06:00 sits at the minimum.
    const phase = h >= 6 && h <= 15 ? ((h - 6) / 9) * Math.PI : h > 15 ? Math.PI + ((h - 15) / 15) * Math.PI : Math.PI + ((h + 9) / 15) * Math.PI
    return Number((mean - amp * Math.cos(phase)).toFixed(1))
  })
}

/** Share of the day's evaporation in each hour: none at night, peaking just after noon. */
export function hourlyEtShare(): number[] {
  const raw = Array.from({ length: 24 }, (_, h) => (h >= 6 && h <= 18 ? Math.sin(((h - 6 + 0.5) / 13) * Math.PI) : 0))
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map((v) => v / sum)
}

/* ---------- Water plan ---------- */

export interface Pulse {
  /** Hour of day, fractional (5.5 = 05:30). */
  start: number
  litres: number
  minutes: number
  reason: Msg
}

export interface DayPlan {
  date: string
  band: TempBand
  weather: DayWeather
  kc: number
  etc: number // mm crop demand
  effectiveRain: number // mm
  netMm: number
  grossMm: number
  litres: number
  pumpMinutes: number
  pulses: Pulse[]
  skipped: Msg | null
  advisories: Msg[]
}

export interface FieldModel {
  crop: CropProfile
  soil: SoilProfile
  district: District
  areaM2: number
  efficiency: number
  zones: number
  /** Volumetric water content, percent. */
  fieldCapacity: number
  wiltingPoint: number
  /** Irrigate when soil moisture falls below this. */
  trigger: number
  /** Total and readily available water in the root zone today, mm. */
  taw: number
  raw: number
  stage: StageInfo
}

export function fieldModel(profile: FarmProfile, on: Date = new Date()): FieldModel | null {
  const crop = cropById(profile.cropId)
  const district = districtOf(profile)
  if (!crop || !district) return null
  const soil = soilById(profile.soilId)
  const stage = cropStage(crop, profile.sowingDate, on)
  const taw = ((soil.fieldCapacity - soil.wiltingPoint) / 100) * stage.rootDepth * 1000
  const method = IRRIGATION[profile.irrigation]
  return {
    crop,
    soil,
    district,
    areaM2: profile.areaAcres * ACRE_M2,
    efficiency: method.efficiency,
    zones: Math.max(1, Math.ceil(profile.areaAcres / method.acresPerZone)),
    fieldCapacity: soil.fieldCapacity,
    wiltingPoint: soil.wiltingPoint,
    trigger: Number((soil.fieldCapacity - crop.depletion * (soil.fieldCapacity - soil.wiltingPoint)).toFixed(1)),
    taw,
    raw: taw * crop.depletion,
    stage,
  }
}

/** Litres to mm over the field and back: 1 mm on 1 m2 is 1 litre. */
export const litresFor = (mm: number, areaM2: number) => mm * areaM2

export function planDay(profile: FarmProfile, model: FieldModel, weather: DayWeather): DayPlan {
  const { crop } = model
  const band = tempBand(weather.tmax)
  const stage = cropStage(crop, profile.sowingDate, new Date(weather.date))
  const etc = stage.kc * weather.et0
  // USDA-style rule of thumb: light showers mostly evaporate, heavy ones partly run off.
  const effectiveRain = weather.rainMm < 5 ? 0 : Math.min(weather.rainMm * 0.8, weather.rainMm - 2)
  // Paddy also loses water to percolation and needs its standing water kept up.
  const extra = crop.ponded ? model.soil.percolation : 0
  const netMm = Math.max(0, etc + extra - effectiveRain)
  const grossMm = netMm / model.efficiency
  const litres = litresFor(grossMm, model.areaM2)
  const pumpMinutes = litres / profile.pumpLpm

  const advisories: Msg[] = []
  const [tLow, tHigh] = crop.temp
  const cropName = msg(`crop.${crop.id}`)
  if (band === 'Heatwave') advisories.push(msg('adv.heatwave', { t: weather.tmax.toFixed(0) }))
  if (weather.tmax > tHigh) advisories.push(msg('adv.above', { crop: cropName, lo: tLow, hi: tHigh }))
  if (weather.tmin <= 4) advisories.push(msg('adv.frost', { t: weather.tmin.toFixed(0) }))
  else if (weather.tmax < tLow) advisories.push(msg('adv.cool', { crop: cropName, lo: tLow, hi: tHigh }))
  if (crop.fungal && weather.humidity >= 80) advisories.push(msg('adv.fungal'))
  if (weather.rainMm >= 20) advisories.push(msg('adv.rain', { n: weather.rainMm.toFixed(0) }))

  let skipped: Msg | null = null
  let pulses: Pulse[] = []
  const minutes = (l: number) => Math.round(l / profile.pumpLpm)

  if (effectiveRain >= etc + extra && weather.rainMm > 0) {
    skipped = msg('skip.rain', { n: weather.rainMm.toFixed(0), d: (etc + extra).toFixed(1) })
  } else if (grossMm < 0.5) {
    skipped = msg('skip.small')
  } else if (band === 'Heatwave' || band === 'Hot') {
    // Split so the root zone never dries out through the hot afternoon.
    const morning = litres * 0.6
    pulses = [
      { start: 5.5, litres: morning, minutes: minutes(morning), reason: msg('pulse.predawn') },
      { start: 18, litres: litres - morning, minutes: minutes(litres - morning), reason: msg('pulse.evening') },
    ]
  } else if (band === 'Cold' || band === 'Cool') {
    // Cold mornings: water late morning so roots are not chilled; frost nights get a light evening run.
    if (weather.tmin <= 4) {
      const evening = litres * 0.3
      pulses = [
        { start: 10, litres: litres - evening, minutes: minutes(litres - evening), reason: msg('pulse.lateMorning') },
        { start: 17, litres: evening, minutes: minutes(evening), reason: msg('pulse.frost') },
      ]
    } else {
      pulses = [{ start: 9.5, litres, minutes: minutes(litres), reason: msg('pulse.midMorning') }]
    }
  } else {
    pulses = [{ start: 6, litres, minutes: minutes(litres), reason: msg('pulse.early') }]
  }

  return {
    date: weather.date,
    band,
    weather,
    kc: stage.kc,
    etc,
    effectiveRain,
    netMm,
    grossMm,
    litres,
    pumpMinutes,
    pulses,
    skipped,
    advisories,
  }
}

/** For flood irrigation farmers water every few days, not daily: how often and how much. */
export function floodInterval(model: FieldModel, plan: DayPlan) {
  if (model.crop.ponded) return { everyDays: 1, litresPerTurn: plan.litres }
  const daily = Math.max(plan.etc, 0.5)
  const everyDays = Math.max(1, Math.min(14, Math.floor(model.raw / daily)))
  return { everyDays, litresPerTurn: litresFor((daily * everyDays) / model.efficiency, model.areaM2) }
}

/* ---------- Sensor recommendation ---------- */

export function recommendSensors(profile: FarmProfile): SensorItem[] {
  const crop = cropById(profile.cropId)
  const district = districtOf(profile)
  if (!crop) return []
  const acres = profile.areaAcres
  const method = IRRIGATION[profile.irrigation]
  const methodName = msg(`method.${profile.irrigation}`)
  const zones = Math.max(1, Math.ceil(acres / method.acresPerZone))
  const per = (n: number) => Math.max(1, Math.ceil(acres / n))
  const zoneRain = district ? CLIMATE[district.zone].rain.reduce((a, b) => a + b, 0) : 800
  const text = (id: string, params?: Record<string, string | number | Msg>) => ({
    name: msg(`sensor.${id}.name`),
    measures: msg(`sensor.${id}.measures`),
    why: msg(`sensor.${id}.why`, params),
    placement: msg(`sensor.${id}.placement`),
  })

  const items: SensorItem[] = []

  if (crop.ponded) {
    items.push({ id: 'water-level', ...text('water-level'), unitPrice: 3200, quantity: zones, priority: 'Essential' })
  }
  items.push({
    id: 'soil-moisture',
    ...text('soil-moisture'),
    placement:
      crop.rootDepth >= 1
        ? msg('sensor.soil-moisture.placementDeep', {
            a: Math.round(crop.rootDepth * 30),
            b: Math.round(crop.rootDepth * 70),
            method: methodName,
          })
        : msg('sensor.soil-moisture.placement', { a: Math.round(crop.rootDepth * 50), method: methodName }),
    unitPrice: crop.rootDepth >= 1 ? 6500 : 4500,
    quantity: crop.ponded ? Math.max(1, Math.ceil(zones / 2)) : zones,
    priority: crop.ponded ? 'Recommended' : 'Essential',
  })
  items.push({ id: 'soil-temp', ...text('soil-temp'), unitPrice: 1800, quantity: per(5), priority: 'Recommended' })
  items.push({ id: 'weather', ...text('weather'), unitPrice: 18000, quantity: acres > 25 ? 2 : 1, priority: 'Essential' })
  items.push({
    id: 'rain',
    ...text('rain'),
    unitPrice: 4000,
    quantity: 1,
    priority: zoneRain > 600 ? 'Essential' : 'Recommended',
  })
  items.push({ id: 'npk', ...text('npk'), unitPrice: 9500, quantity: per(5), priority: 'Recommended' })
  if (crop.fungal) {
    items.push({
      id: 'leaf-wetness',
      ...text('leaf-wetness', { crop: msg(`crop.${crop.id}`) }),
      unitPrice: 3500,
      quantity: per(5),
      priority: 'Recommended',
    })
  }
  items.push({ id: 'flow', ...text('flow'), unitPrice: 2500, quantity: 1, priority: 'Essential' })
  if (profile.irrigation !== 'flood') {
    items.push({ id: 'pressure', ...text('pressure', { method: methodName }), unitPrice: 2200, quantity: 1, priority: 'Optional' })
  }
  items.push({
    id: 'valve',
    ...text('valve'),
    name: msg(profile.irrigation === 'flood' ? 'sensor.valve-flood.name' : 'sensor.valve.name'),
    unitPrice: profile.irrigation === 'flood' ? 9000 : 6500,
    quantity: zones,
    priority: 'Essential',
  })
  items.push({ id: 'pump', ...text('pump'), unitPrice: 7500, quantity: 1, priority: 'Essential' })
  items.push({ id: 'gateway', ...text('gateway'), unitPrice: 22000, quantity: 1, priority: 'Essential' })
  return items
}

export function sensorBudget(items: SensorItem[]) {
  const sum = (filter: (i: SensorItem) => boolean) =>
    items.filter(filter).reduce((total, i) => total + i.unitPrice * i.quantity, 0)
  return { essential: sum((i) => i.priority === 'Essential'), full: sum(() => true) }
}

/* ---------- Formatting ---------- */

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export const formatInr = (value: number) => inr.format(value)
export const formatLitres = (value: number) => `${num.format(Math.round(value))} L`
export const formatHour = (hour: number) => {
  const h = Math.floor(hour) % 24
  const m = Math.round((hour - Math.floor(hour)) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
/** Duration as a message, for text stored now and shown later in whatever language is active. */
export const minutesMsg = (minutes: number): Msg => {
  const m = Math.round(minutes)
  return m >= 60 ? msg('unit.hmin', { h: Math.floor(m / 60), m: m % 60 }) : msg('unit.min', { m })
}

export const formatMinutes = (minutes: number) => {
  const m = Math.round(minutes)
  return m >= 60 ? tr('unit.hmin', { h: Math.floor(m / 60), m: m % 60 }) : tr('unit.min', { m })
}
