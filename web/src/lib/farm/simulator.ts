/*
 * Demo-mode field simulator. Advances a virtual clock minute by minute: the crop draws water
 * out of the root zone with the day's evaporation curve, rain tops it up, and the automation
 * controller opens and closes the valve from the day plan and the live moisture reading -
 * the same decisions the real irrigation service makes from real sensors.
 */

import {
  hourlyEtShare,
  hourlyTemps,
  formatHour,
  formatLitres,
  formatMinutes,
  type DayPlan,
  type FarmProfile,
  type FieldModel,
} from './engine'

export interface LogEntry {
  id: number
  day: number
  minute: number
  tone: 'good' | 'info' | 'warning' | 'critical'
  text: string
}

export interface SimPoint {
  label: string
  moisture: number
  temp: number
  irrigating: number
}

export interface SimState {
  day: number // index into the 7-day plan
  minute: number // minutes since midnight
  /** Soil volumetric water content %, or standing water mm for ponded rice. */
  level: number
  valveOpen: boolean
  pulseIndex: number | null
  pulseTarget: number
  pulseDelivered: number
  usedToday: number
  usedTotal: number
  /** Pulses already handled today, so each fires once. */
  handled: number[]
  history: SimPoint[]
  log: LogEntry[]
  seq: number
}

/** Ponded rice: refill at 20 mm standing water, fill to 50 mm (alternate wetting and drying). */
export const PADDY_LOW = 20
export const PADDY_HIGH = 50

export function initialState(model: FieldModel, plans: DayPlan[], startMinute = 4 * 60): SimState {
  const wet = plans[0]?.weather.rainMm >= 20
  const level = model.crop.ponded
    ? wet
      ? PADDY_HIGH
      : PADDY_LOW + 8
    : wet
      ? model.fieldCapacity
      : Number((model.trigger + 0.3 * (model.fieldCapacity - model.trigger)).toFixed(1))
  return {
    day: 0,
    minute: startMinute,
    level,
    valveOpen: false,
    pulseIndex: null,
    pulseTarget: 0,
    pulseDelivered: 0,
    usedToday: 0,
    usedTotal: 0,
    handled: [],
    history: [],
    log: [
      {
        id: 0,
        day: 0,
        minute: startMinute,
        tone: 'info',
        text: `Automation armed for ${model.crop.name}. ${model.crop.ponded ? `Refill below ${PADDY_LOW} mm standing water` : `Irrigate below ${model.trigger}% soil moisture, fill to ${model.fieldCapacity}%`}.`,
      },
    ],
    seq: 1,
  }
}

function push(state: SimState, tone: LogEntry['tone'], text: string) {
  state.log = [{ id: state.seq++, day: state.day, minute: state.minute, tone, text }, ...state.log].slice(0, 80)
}

/** Advance the simulation by `minutes`, one minute at a time. Returns a new state object. */
export function step(prev: SimState, minutes: number, profile: FarmProfile, model: FieldModel, plans: DayPlan[]): SimState {
  const s: SimState = { ...prev, handled: [...prev.handled] }
  const share = hourlyEtShare()
  const ponded = Boolean(model.crop.ponded)
  const rootMm = model.stage.rootDepth * 1000
  // Water that lands on the field: litres x efficiency spread over the area gives mm.
  const mmPerMinute = (profile.pumpLpm * model.efficiency) / model.areaM2
  const toLevel = (mm: number) => (ponded ? mm : (mm / rootMm) * 100)
  const ceiling = ponded ? PADDY_HIGH + 30 : model.fieldCapacity + 4
  const floor = ponded ? 0 : model.wiltingPoint

  for (let i = 0; i < minutes; i++) {
    const plan = plans[s.day % plans.length]
    const hour = s.minute / 60
    const h = Math.floor(hour)

    // 1. Crop water use and percolation.
    let lossMm = (plan.etc * share[h]) / 60
    if (ponded) lossMm += model.soil.percolation / 1440
    s.level -= toLevel(lossMm)

    // 2. Rain falls as an afternoon shower, 14:00-18:00.
    if (plan.effectiveRain > 0 && h >= 14 && h < 18) {
      if (s.minute === 14 * 60) push(s, 'info', `Rain started - ${plan.weather.rainMm.toFixed(0)} mm expected. Rain gauge reporting.`)
      s.level += toLevel(plan.effectiveRain / 240)
    }

    // 3. Controller: scheduled pulses.
    plan.pulses.forEach((pulse, index) => {
      if (s.handled.includes(index) || hour < pulse.start) return
      s.handled.push(index)
      const full = ponded ? s.level >= PADDY_HIGH - 5 : s.level >= model.fieldCapacity - 1
      if (full) {
        push(s, 'good', `${formatHour(pulse.start)} run skipped - soil already at ${s.level.toFixed(1)}${ponded ? ' mm' : '%'}, no water wasted.`)
        return
      }
      if (!s.valveOpen) {
        s.valveOpen = true
        s.pulseIndex = index
        s.pulseTarget = pulse.litres
        s.pulseDelivered = 0
        push(s, 'good', `Valve OPEN, pump ON - delivering ${formatLitres(pulse.litres)} (~${formatMinutes(pulse.minutes)}). ${pulse.reason}.`)
      }
    })

    // 4. Controller: protection when the crop is running dry between pulses.
    const dry = ponded ? s.level < PADDY_LOW : s.level < model.trigger
    if (dry && !s.valveOpen) {
      const refillMm = ponded ? PADDY_HIGH - s.level : ((model.fieldCapacity - s.level) / 100) * rootMm
      const litres = (refillMm * model.areaM2) / model.efficiency
      s.valveOpen = true
      s.pulseIndex = null
      s.pulseTarget = litres
      s.pulseDelivered = 0
      push(
        s,
        'warning',
        `${ponded ? `Standing water down to ${s.level.toFixed(0)} mm` : `Soil moisture ${s.level.toFixed(1)}% fell below ${model.trigger}%`} - automatic refill of ${formatLitres(litres)}.`,
      )
    }

    // 5. Water delivery and cut-out.
    if (s.valveOpen) {
      s.level += toLevel(mmPerMinute)
      s.pulseDelivered += profile.pumpLpm
      s.usedToday += profile.pumpLpm
      s.usedTotal += profile.pumpLpm
      const topped = ponded ? s.level >= PADDY_HIGH : s.level >= model.fieldCapacity
      if (s.pulseDelivered >= s.pulseTarget || topped) {
        s.valveOpen = false
        push(
          s,
          'info',
          `Valve CLOSED, pump OFF - ${formatLitres(s.pulseDelivered)} delivered${topped ? ' (moisture cut-out reached)' : ''}. Soil at ${s.level.toFixed(1)}${ponded ? ' mm' : '%'}.`,
        )
        s.pulseIndex = null
      }
    }

    s.level = Math.min(ceiling, Math.max(floor, s.level))
    // Above field capacity the surplus drains away within hours.
    if (!ponded && s.level > model.fieldCapacity) s.level -= (s.level - model.fieldCapacity) * 0.01

    // Chart sample every 15 minutes, last 24 hours.
    if (s.minute % 15 === 0) {
      const temps = hourlyTemps(plan.weather)
      s.history = [
        ...s.history,
        {
          label: formatHour(hour),
          moisture: Number(s.level.toFixed(1)),
          temp: temps[h],
          irrigating: s.valveOpen ? 1 : 0,
        },
      ].slice(-96)
    }

    // 6. Clock.
    s.minute += 1
    if (s.minute >= 1440) {
      push(s, 'info', `Day closed: ${formatLitres(s.usedToday)} used (plan was ${formatLitres(plan.skipped ? 0 : plan.litres)}).`)
      s.minute = 0
      s.day = (s.day + 1) % plans.length
      s.usedToday = 0
      s.handled = []
      const next = plans[s.day]
      push(
        s,
        next.skipped ? 'good' : 'info',
        next.skipped
          ? `New day: irrigation not needed - ${next.skipped}.`
          : `New day: ${next.band.toLowerCase()} (${next.weather.tmax.toFixed(0)} C). Plan ${formatLitres(next.litres)} in ${next.pulses.length} run${next.pulses.length > 1 ? 's' : ''}.`,
      )
    }
  }
  return s
}

/** Live sensor readings derived from the simulated field, with a little sensor noise. */
export function readings(s: SimState, plan: DayPlan, profile: FarmProfile) {
  const temps = hourlyTemps(plan.weather)
  const h = Math.floor(s.minute / 60)
  const next = temps[(h + 1) % 24]
  const air = temps[h] + ((next - temps[h]) * (s.minute % 60)) / 60
  const mean = (plan.weather.tmax + plan.weather.tmin) / 2
  const noise = Math.sin(s.minute * 0.7) * 0.3
  // Soil temperature lags and damps the air swing.
  const soilTemp = mean + (temps[(h + 21) % 24] - mean) * 0.35
  // Humidity runs opposite to temperature through the day.
  const span = Math.max(1, plan.weather.tmax - plan.weather.tmin)
  const humidity = Math.min(100, Math.max(10, plan.weather.humidity + ((mean - air) / span) * 30))
  return {
    level: Number((s.level + noise).toFixed(1)),
    airTemp: Number(air.toFixed(1)),
    soilTemp: Number(soilTemp.toFixed(1)),
    humidity: Math.round(humidity),
    flow: s.valveOpen ? profile.pumpLpm + Math.round(noise * 10) : 0,
  }
}
