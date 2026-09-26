// Shared with web/src/lib/farm - keep the two copies in step.
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

export const SCENARIOS: Record<Scenario, { label: string; hint: string }> = {
  normal: { label: 'As forecast', hint: 'Use the weather as it is' },
  heatwave: { label: 'Heatwave', hint: '+7 C, dry air - watch the engine add water' },
  monsoon: { label: 'Monsoon rain', hint: 'Heavy rain - watch the engine skip irrigation' },
  coldwave: { label: 'Cold wave', hint: '-9 C nights - frost protection kicks in' },
}

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
  reason: string
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
  skipped: string | null
  advisories: string[]
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

  const advisories: string[] = []
  const [tLow, tHigh] = crop.temp
  if (band === 'Heatwave') {
    advisories.push(`Heatwave (${weather.tmax.toFixed(0)} C): irrigate only in early morning and evening, never 11:00-16:00. Mulch to cut evaporation.`)
  }
  if (weather.tmax > tHigh) advisories.push(`Above ${crop.name}'s comfort range (${tLow}-${tHigh} C): heat stress likely at flowering.`)
  if (weather.tmin <= 4) advisories.push(`Frost risk tonight (min ${weather.tmin.toFixed(0)} C): a light evening irrigation keeps the soil warmer.`)
  else if (weather.tmax < tLow) advisories.push(`Cooler than ${crop.name} likes (${tLow}-${tHigh} C): growth slows, water need is lower.`)
  if (crop.fungal && weather.humidity >= 80) advisories.push('Humid day: fungal disease risk. Avoid overhead watering in the evening.')
  if (weather.rainMm >= 20) advisories.push(`Heavy rain expected (${weather.rainMm.toFixed(0)} mm): check field drainage.`)

  let skipped: string | null = null
  let pulses: Pulse[] = []
  const minutes = (l: number) => Math.round(l / profile.pumpLpm)

  if (effectiveRain >= etc + extra && weather.rainMm > 0) {
    skipped = `Rain (${weather.rainMm.toFixed(0)} mm) covers today's ${(etc + extra).toFixed(1)} mm demand`
  } else if (grossMm < 0.5) {
    skipped = 'Demand under 0.5 mm - soil reserve covers it'
  } else if (band === 'Heatwave' || band === 'Hot') {
    // Split so the root zone never dries out through the hot afternoon.
    const morning = litres * 0.6
    pulses = [
      { start: 5.5, litres: morning, minutes: minutes(morning), reason: 'Pre-dawn: lowest evaporation loss' },
      { start: 18, litres: litres - morning, minutes: minutes(litres - morning), reason: 'Evening top-up after peak heat' },
    ]
  } else if (band === 'Cold' || band === 'Cool') {
    // Cold mornings: water late morning so roots are not chilled; frost nights get a light evening run.
    if (weather.tmin <= 4) {
      const evening = litres * 0.3
      pulses = [
        { start: 10, litres: litres - evening, minutes: minutes(litres - evening), reason: 'Late morning once the soil has warmed' },
        { start: 17, litres: evening, minutes: minutes(evening), reason: 'Frost protection: wet soil holds heat overnight' },
      ]
    } else {
      pulses = [{ start: 9.5, litres, minutes: minutes(litres), reason: 'Mid-morning: soil warm, low evaporation' }]
    }
  } else {
    pulses = [{ start: 6, litres, minutes: minutes(litres), reason: 'Early morning: cool, calm, least evaporation' }]
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
  const zones = Math.max(1, Math.ceil(acres / method.acresPerZone))
  const per = (n: number) => Math.max(1, Math.ceil(acres / n))
  const zoneRain = district ? CLIMATE[district.zone].rain.reduce((a, b) => a + b, 0) : 800
  const depthNote =
    crop.rootDepth >= 1
      ? `Dual-depth probe at ${Math.round(crop.rootDepth * 30)} cm and ${Math.round(crop.rootDepth * 70)} cm (deep roots)`
      : `Single probe at ${Math.round(crop.rootDepth * 50)} cm, in the root zone`

  const items: SensorItem[] = []

  if (crop.ponded) {
    items.push({
      id: 'water-level',
      name: 'Field water level sensor (ultrasonic, AWD tube)',
      measures: 'Standing water depth, cm',
      why: 'Paddy is grown ponded. Alternate wetting and drying (AWD) saves 25-30% water without yield loss.',
      unitPrice: 3200,
      quantity: zones,
      priority: 'Essential',
      placement: 'One per irrigation block, in a perforated AWD pipe 15 cm into the soil',
    })
  }
  items.push({
    id: 'soil-moisture',
    name: 'Capacitive soil moisture probe',
    measures: 'Volumetric water content, %',
    why: 'Tells the controller when the root zone actually needs water. This drives the automation.',
    unitPrice: crop.rootDepth >= 1 ? 6500 : 4500,
    quantity: crop.ponded ? Math.max(1, Math.ceil(zones / 2)) : zones,
    priority: crop.ponded ? 'Recommended' : 'Essential',
    placement: `${depthNote}. One per ${method.name.toLowerCase()} zone, away from field edges.`,
  })
  items.push({
    id: 'soil-temp',
    name: 'Soil temperature probe',
    measures: 'Soil temperature, C',
    why: 'Germination, root activity and frost risk depend on soil temperature, not air.',
    unitPrice: 1800,
    quantity: per(5),
    priority: 'Recommended',
    placement: 'Beside a moisture probe at 10 cm depth',
  })
  items.push({
    id: 'weather',
    name: 'Micro weather station',
    measures: 'Air temperature, humidity, wind, solar radiation',
    why: 'On-farm temperature and humidity feed the water calculation (ET0) and heatwave alerts.',
    unitPrice: 18000,
    quantity: acres > 25 ? 2 : 1,
    priority: 'Essential',
    placement: 'Open ground, 2 m high, away from trees and buildings',
  })
  items.push({
    id: 'rain',
    name: 'Tipping-bucket rain gauge',
    measures: 'Rainfall, mm',
    why: 'Lets the automation skip irrigation after rain instead of wasting water and power.',
    unitPrice: 4000,
    quantity: 1,
    priority: zoneRain > 600 ? 'Essential' : 'Recommended',
    placement: 'Level mount on the weather station mast',
  })
  items.push({
    id: 'npk',
    name: 'Soil NPK + pH + EC sensor (7-in-1)',
    measures: 'Nitrogen, phosphorus, potassium, pH, salinity',
    why: 'Matches fertiliser to what the soil lacks - useful alongside the Soil Health Card.',
    unitPrice: 9500,
    quantity: per(5),
    priority: 'Recommended',
    placement: 'Root zone, one per 5 acres; reading once a week is enough',
  })
  if (crop.fungal) {
    items.push({
      id: 'leaf-wetness',
      name: 'Leaf wetness sensor',
      measures: 'Hours of leaf wetness',
      why: `${crop.name} is prone to fungal disease; long wet-leaf hours are the early warning.`,
      unitPrice: 3500,
      quantity: per(5),
      priority: 'Recommended',
      placement: 'At canopy height, facing north, angled 45 degrees',
    })
  }
  items.push({
    id: 'flow',
    name: 'Water flow meter (pulse output)',
    measures: 'Litres delivered, flow rate',
    why: 'Confirms the litres the plan asked for actually reached the field; spots leaks and dry-running.',
    unitPrice: 2500,
    quantity: 1,
    priority: 'Essential',
    placement: 'On the pump delivery pipe, after the filter',
  })
  if (profile.irrigation !== 'flood') {
    items.push({
      id: 'pressure',
      name: 'Line pressure sensor',
      measures: 'Pipe pressure, bar',
      why: `Detects clogged emitters or burst laterals in the ${method.name.toLowerCase()} system.`,
      unitPrice: 2200,
      quantity: 1,
      priority: 'Optional',
      placement: 'At the head of the mainline, after the filter',
    })
  }
  items.push({
    id: 'valve',
    name: profile.irrigation === 'flood' ? 'Motorised gate / channel valve' : 'Solenoid valve controller',
    measures: 'Opens and closes a zone',
    why: 'What the automation switches - one per zone so each block gets only what it needs.',
    unitPrice: profile.irrigation === 'flood' ? 9000 : 6500,
    quantity: zones,
    priority: 'Essential',
    placement: 'At the inlet of each zone',
  })
  items.push({
    id: 'pump',
    name: 'GSM / IoT pump starter',
    measures: 'Pump on/off, dry-run and voltage protection',
    why: 'Starts the borewell pump on schedule and protects the motor during low voltage - common on rural feeders.',
    unitPrice: 7500,
    quantity: 1,
    priority: 'Essential',
    placement: 'In the pump starter panel',
  })
  items.push({
    id: 'gateway',
    name: 'Solar LoRaWAN gateway with 4G',
    measures: 'Connects every sensor to the dashboard',
    why: 'One gateway covers 2-5 km, so sensors run for years on batteries with no Wi-Fi in the field.',
    unitPrice: 22000,
    quantity: 1,
    priority: 'Essential',
    placement: 'Highest point on the farm, e.g. the pump house roof',
  })
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
export const formatMinutes = (minutes: number) => {
  const m = Math.round(minutes)
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}
