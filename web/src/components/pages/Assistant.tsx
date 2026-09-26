'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  CloudRain,
  Cpu,
  Drop,
  Fire,
  Gauge,
  Info,
  Pause,
  PencilSimple,
  Play,
  Robot,
  Snowflake,
  Sun,
  Thermometer,
  Warning,
} from '@phosphor-icons/react'
import { useSession } from '@/lib/session'
import { CLIMATE, IRRIGATION } from '@/lib/farm/india'
import {
  BAND_TONE,
  SCENARIOS,
  applyScenario,
  districtOf,
  fetchLiveWeek,
  fieldModel,
  floodInterval,
  formatHour,
  formatInr,
  formatLitres,
  formatMinutes,
  hourlyEtShare,
  hourlyTemps,
  loadProfile,
  normalsWeek,
  planDay,
  recommendSensors,
  sensorBudget,
  tempBand,
  type DayPlan,
  type DayWeather,
  type FarmProfile,
  type FieldModel,
  type Scenario,
  type WeatherSource,
} from '@/lib/farm/engine'
import { PADDY_HIGH, PADDY_LOW, initialState, readings, step, type SimState } from '@/lib/farm/simulator'

const SimChart = dynamic(() => import('@/components/SimChart'), {
  ssr: false,
  loading: () => <p className="p-4 text-xs text-muted-foreground">Loading chart...</p>,
})

/** Simulated minutes per real second. */
const SPEEDS = [
  { label: '10 min/s', value: 10 },
  { label: '30 min/s', value: 30 },
  { label: '1 h/s', value: 60 },
  { label: '3 h/s', value: 180 },
]
const TICK_MS = 250

const SCENARIO_ICON: Record<Scenario, typeof Sun> = { normal: Sun, heatwave: Fire, monsoon: CloudRain, coldwave: Snowflake }

const chip = (active: boolean) =>
  `inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
    active ? 'border-brand bg-primary text-primary-foreground' : 'border-border bg-surface hover:bg-raised'
  }`
const plainBtn =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium transition hover:bg-raised active:translate-y-px'
const primaryBtn =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition hover:bg-brand-hover active:translate-y-px'

const dayName = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

export default function Assistant() {
  const router = useRouter()
  const { session } = useSession()
  // AppShell renders its children only once the session is restored on the client, so
  // localStorage is safe to read here.
  const profile = useMemo(() => (session ? loadProfile(session.email) : null), [session])

  useEffect(() => {
    if (session && !profile) router.replace('/onboarding')
  }, [session, profile, router])

  if (!profile) return <div className="glass h-64 animate-pulse rounded-xl" />
  return <AssistantView profile={profile} />
}

function AssistantView({ profile }: { profile: FarmProfile }) {
  const router = useRouter()
  const district = districtOf(profile)!
  const [live, setLive] = useState<DayWeather[] | null>(null)
  const [source, setSource] = useState<WeatherSource | 'loading'>('loading')
  const [scenario, setScenario] = useState<Scenario>('normal')
  const [speed, setSpeed] = useState(30)
  const [playing, setPlaying] = useState(true)

  // Live forecast first; climate normals if the network or the API is unavailable.
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    fetchLiveWeek(profile.lat, profile.lon, controller.signal).then((week) => {
      clearTimeout(timeout)
      setLive(week)
      setSource(week ? 'live' : 'normals')
    })
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [profile.lat, profile.lon])

  const model = useMemo(() => fieldModel(profile), [profile])
  const week = useMemo(() => {
    const base = live ?? normalsWeek(district)
    return base.map((day) => applyScenario(day, scenario, profile.lat))
  }, [live, district, scenario, profile.lat])
  const plans = useMemo(() => (model ? week.map((w) => planDay(profile, model, w)) : []), [week, model, profile])

  // Bumped to restart the simulated field; also keyed on anything that changes its weather.
  const [run, setRun] = useState(0)

  if (!model) {
    return <p className="p-12 text-center text-sm text-muted-foreground">This farm profile is incomplete. Please run setup again.</p>
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Robot size={22} className="text-brand" />
            Farm Assistant
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {model.crop.name} ({model.crop.local}) · {profile.areaAcres} acres · {profile.district}, {profile.state} ·{' '}
            {IRRIGATION[profile.irrigation].name.toLowerCase()} irrigation · {model.soil.name.toLowerCase()}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              source === 'live' ? 'bg-status-good/12 text-status-good' : 'bg-status-info/12 text-status-info'
            }`}
            data-testid="weather-source"
          >
            {source === 'loading' ? 'Fetching weather...' : source === 'live' ? 'Live forecast (Open-Meteo)' : 'IMD climate normals (offline)'}
          </span>
          <button type="button" className={plainBtn} onClick={() => router.push('/onboarding')}>
            <PencilSimple size={16} />
            Edit farm
          </button>
        </div>
      </header>

      {/* Demo controls */}
      <section className="glass mb-4 flex flex-wrap items-center gap-2 rounded-xl p-3" aria-label="Demo controls">
        <span className="mr-1 text-xs font-semibold">Demo</span>
        <button type="button" className={playing ? plainBtn : primaryBtn} onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className={plainBtn}
          onClick={() => setRun((r) => r + 1)}
        >
          <ArrowCounterClockwise size={16} />
          Restart day
        </button>
        <label className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Speed</span>
          <select className="min-h-9 rounded-lg border border-input bg-surface px-2 text-xs" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto" role="group" aria-label="Weather scenario">
          {(Object.keys(SCENARIOS) as Scenario[]).map((key) => {
            const Icon = SCENARIO_ICON[key]
            return (
              <button key={key} type="button" aria-pressed={scenario === key} title={SCENARIOS[key].hint} className={chip(scenario === key)} onClick={() => setScenario(key)}>
                <Icon size={14} />
                {SCENARIOS[key].label}
              </button>
            )
          })}
        </div>
      </section>

      {source === 'loading' || !plans.length ? (
        <div className="glass h-64 animate-pulse rounded-xl" />
      ) : (
        <FieldSim
          key={`${run}-${scenario}-${source}`}
          profile={profile}
          model={model}
          plans={plans}
          playing={playing}
          speed={speed}
          scenario={scenario}
          source={source}
        />
      )}
    </>
  )
}

/** The simulated field. Keyed by its parent, so a new scenario or a restart starts it fresh. */
function FieldSim({
  profile,
  model,
  plans,
  playing,
  speed,
  scenario,
  source,
}: {
  profile: FarmProfile
  model: FieldModel
  plans: DayPlan[]
  playing: boolean
  speed: number
  scenario: Scenario
  source: WeatherSource
}) {
  const [sim, setSim] = useState<SimState>(() => initialState(model, plans))
  const simRef = useRef(sim)
  const district = model.district

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      const next = step(simRef.current, Math.max(1, Math.round((speed * TICK_MS) / 1000)), profile, model, plans)
      simRef.current = next
      setSim(next)
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [playing, speed, model, plans, profile])

  const ponded = Boolean(model.crop.ponded)
  const unit = ponded ? 'mm' : '%'
  const plan = plans[sim.day]
  const read = readings(sim, plan, profile)
  const hour = Math.floor(sim.minute / 60)
  const sensors = recommendSensors(profile)
  const budget = sensorBudget(sensors)
  const flood = profile.irrigation === 'flood' ? floodInterval(model, plan) : null


  return (
    <>
      {/* Headline tiles */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={`Day ${sim.day + 1} of 7 · ${dayName(plan.date)}`}>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[28px] font-bold leading-none tabular" data-testid="sim-clock">
              {formatHour(sim.minute / 60)}
            </span>
            <span className="text-xs text-muted-foreground">IST</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <BandChip band={plan.band} />
            <span className="text-muted-foreground">
              {plan.weather.tmin.toFixed(0)}-{plan.weather.tmax.toFixed(0)} C · rain {plan.weather.rainMm.toFixed(0)} mm
            </span>
          </div>
        </Tile>

        <Tile label="Water needed today">
          <div className="font-mono text-[28px] font-bold leading-none tabular" data-testid="water-today">
            {plan.skipped ? '0 L' : formatLitres(plan.litres)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {plan.skipped
              ? plan.skipped
              : `${plan.grossMm.toFixed(1)} mm · pump ${formatMinutes(plan.pumpMinutes)} · Kc ${plan.kc.toFixed(2)} x ET0 ${plan.weather.et0.toFixed(1)} mm`}
          </p>
        </Tile>

        <Tile label="Valve and pump">
          <div className={`flex items-center gap-2 text-lg font-semibold ${sim.valveOpen ? 'text-status-good' : 'text-status-muted'}`} data-testid="valve-state">
            <span className={`size-3 rounded-full ${sim.valveOpen ? 'animate-pulse bg-status-good' : 'bg-status-muted'}`} />
            {sim.valveOpen ? 'OPEN - irrigating' : 'CLOSED'}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {sim.valveOpen
              ? `${formatLitres(sim.pulseDelivered)} of ${formatLitres(sim.pulseTarget)} · zone ${Math.min(model.zones, 1 + Math.floor((sim.pulseDelivered / Math.max(1, sim.pulseTarget)) * model.zones))} of ${model.zones}`
              : nextAction(plan, sim)}
          </p>
        </Tile>

        <Tile label="Water used">
          <div className="font-mono text-[28px] font-bold leading-none tabular">{formatLitres(sim.usedToday)}</div>
          <p className="mt-2 text-xs text-muted-foreground">today · {formatLitres(sim.usedTotal)} since start</p>
        </Tile>
      </div>

      {/* Live sensors */}
      <section className="glass mb-4 rounded-xl p-4" aria-label="Live sensor readings">
        <h2 className="mb-3 text-sm font-semibold">Live sensor readings <span className="font-normal text-muted-foreground">(simulated field)</span></h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Reading icon={<Drop size={16} />} label={ponded ? 'Standing water' : 'Soil moisture'} value={`${read.level} ${unit}`} tone={read.level < (ponded ? PADDY_LOW : model.trigger) ? 'critical' : read.level >= (ponded ? PADDY_HIGH : model.fieldCapacity) - 1 ? 'good' : 'info'} testId="reading-moisture" />
          <Reading icon={<Thermometer size={16} />} label="Air temperature" value={`${read.airTemp} C`} tone={BAND_TONE[tempBand(read.airTemp)]} />
          <Reading icon={<Thermometer size={16} />} label="Soil temperature" value={`${read.soilTemp} C`} tone="info" />
          <Reading icon={<CloudRain size={16} />} label="Humidity" value={`${read.humidity}%`} tone="info" />
          <Reading icon={<Gauge size={16} />} label="Flow meter" value={`${read.flow} L/min`} tone={read.flow ? 'good' : 'info'} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {ponded
            ? `Paddy uses alternate wetting and drying: refill to ${PADDY_HIGH} mm when standing water drops below ${PADDY_LOW} mm.`
            : `${model.soil.name}: field capacity ${model.fieldCapacity}%, wilting point ${model.wiltingPoint}%. ${model.crop.name} can use ${Math.round(model.crop.depletion * 100)}% of available water before stress, so the controller irrigates below ${model.trigger}%.`}
        </p>
      </section>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold">Last 24 hours</h2>
          <p className="mb-2 text-xs text-muted-foreground">Moisture falls with the afternoon heat; shaded bands are automatic irrigation runs.</p>
          <div className="h-[260px]">
            <SimChart data={sim.history} unit={unit} trigger={ponded ? PADDY_LOW : model.trigger} target={ponded ? PADDY_HIGH : model.fieldCapacity} />
          </div>
        </section>

        <section className="glass flex max-h-[340px] flex-col rounded-xl p-4" aria-label="Automation log">
          <h2 className="mb-2 text-sm font-semibold">Automation log</h2>
          <ol className="grid flex-1 content-start gap-2 overflow-y-auto pr-1" data-testid="automation-log">
            {sim.log.map((entry) => (
              <li key={entry.id} className="flex gap-2 text-xs">
                <span className="flex-none font-mono text-muted-foreground tabular">
                  D{entry.day + 1} {formatHour(entry.minute / 60)}
                </span>
                <span className={entry.tone === 'warning' ? 'text-status-warning' : entry.tone === 'critical' ? 'text-status-critical' : entry.tone === 'good' ? 'text-status-good' : ''}>
                  {entry.text}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {plan.advisories.length || flood || plan.pumpMinutes > 480 ? (
        <section className="mb-4 grid gap-2" aria-label="Advisories">
          {plan.advisories.map((a) => (
            <Advisory key={a} tone="warning" text={a} />
          ))}
          {flood ? (
            <Advisory
              tone="info"
              text={
                model.crop.ponded
                  ? `Flood irrigation: keep ${PADDY_LOW}-${PADDY_HIGH} mm standing water; top up about ${formatLitres(flood.litresPerTurn)} a day in this weather.`
                  : `Flood irrigation: give about ${formatLitres(flood.litresPerTurn)} every ${flood.everyDays} day${flood.everyDays > 1 ? 's' : ''} instead of daily - the root zone holds ${model.raw.toFixed(0)} mm of easy water.`
              }
            />
          ) : null}
          {plan.pumpMinutes > 480 ? (
            <Advisory tone="warning" text={`The pump needs ${formatMinutes(plan.pumpMinutes)} a day for this field. Consider drip irrigation or a larger pump, and run on the farm feeder's power hours.`} />
          ) : null}
        </section>
      ) : null}

      {/* Hour by hour */}
      <section className="glass mb-4 overflow-hidden rounded-xl" aria-label="Hourly water plan">
        <div className="p-4 pb-2">
          <h2 className="text-sm font-semibold">Today hour by hour</h2>
          <p className="text-xs text-muted-foreground">How much water the crop uses each hour at that hour&apos;s temperature, and when the automation replaces it.</p>
        </div>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-2 py-2 font-medium">Air temp</th>
                <th className="px-2 py-2 font-medium">Temp type</th>
                <th className="px-2 py-2 font-medium">Crop use</th>
                <th className="px-4 py-2 font-medium">Automation</th>
              </tr>
            </thead>
            <tbody>
              <HourRows plan={plan} currentHour={hour} areaM2={model.areaM2} />
            </tbody>
          </table>
        </div>
      </section>

      {/* Week */}
      <section className="glass mb-4 overflow-hidden rounded-xl" aria-label="Seven day plan">
        <div className="p-4 pb-2">
          <h2 className="text-sm font-semibold">7-day irrigation plan</h2>
          <p className="text-xs text-muted-foreground">
            {source === 'live' ? 'From the live forecast for your coordinates.' : `From ${CLIMATE[district.zone].label.toLowerCase()} climate normals.`}
            {scenario !== 'normal' ? ` Scenario applied: ${SCENARIOS[scenario].label.toLowerCase()}.` : ''}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Day</th>
                <th className="px-2 py-2 font-medium">Temp</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Rain</th>
                <th className="px-2 py-2 font-medium">Crop use</th>
                <th className="px-2 py-2 font-medium">Water to give</th>
                <th className="px-4 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p, i) => (
                <tr key={p.date} className={`border-t border-border ${i === sim.day ? 'bg-brand-wash' : ''}`}>
                  <td className="px-4 py-2 font-medium">{dayName(p.date)}</td>
                  <td className="px-2 py-2 font-mono tabular">{p.weather.tmin.toFixed(0)}-{p.weather.tmax.toFixed(0)} C</td>
                  <td className="px-2 py-2"><BandChip band={p.band} /></td>
                  <td className="px-2 py-2 font-mono tabular">{p.weather.rainMm.toFixed(0)} mm</td>
                  <td className="px-2 py-2 font-mono tabular">{p.etc.toFixed(1)} mm</td>
                  <td className="px-2 py-2 font-mono font-semibold tabular">{p.skipped ? 'Skip' : formatLitres(p.litres)}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {p.skipped ? p.skipped : p.pulses.map((x) => `${formatHour(x.start)} (${formatMinutes(x.minutes)})`).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sensor kit */}
      <section className="glass rounded-xl p-4" aria-label="Your sensor kit">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Cpu size={16} /> Your sensor kit</h2>
          <span className="text-xs text-muted-foreground">
            {model.zones} zone{model.zones > 1 ? 's' : ''} · essential {formatInr(budget.essential)} · full {formatInr(budget.full)}
          </span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sensors.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-surface p-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="font-semibold">{s.name}</span>
                <span className="ml-auto flex-none font-mono tabular">x{s.quantity}</span>
              </div>
              <div className="mt-1 text-muted-foreground">{s.priority} · {s.measures}</div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function nextAction(plan: DayPlan, sim: SimState) {
  if (plan.skipped) return `No run today - ${plan.skipped.toLowerCase()}`
  const upcoming = plan.pulses.find((p, i) => !sim.handled.includes(i) && p.start * 60 > sim.minute)
  return upcoming ? `Next run ${formatHour(upcoming.start)} · ${formatLitres(upcoming.litres)}` : 'Today\'s runs are done - watching moisture'
}

function HourRows({ plan, currentHour, areaM2 }: { plan: DayPlan; currentHour: number; areaM2: number }) {
  const temps = hourlyTemps(plan.weather)
  const share = hourlyEtShare()
  return (
    <>
      {temps.map((t, h) => {
        const pulse = plan.pulses.find((p) => Math.floor(p.start) === h)
        const useL = plan.etc * share[h] * areaM2
        return (
          <tr key={h} className={`border-t border-border ${h === currentHour ? 'bg-brand-wash font-medium' : ''}`} aria-current={h === currentHour ? 'time' : undefined}>
            <td className="px-4 py-1.5 font-mono tabular">{formatHour(h)}</td>
            <td className="px-2 py-1.5 font-mono tabular">{t.toFixed(1)} C</td>
            <td className="px-2 py-1.5"><BandChip band={tempBand(t)} /></td>
            <td className="px-2 py-1.5 font-mono tabular">{useL >= 1 ? formatLitres(useL) : '-'}</td>
            <td className="px-4 py-1.5">
              {pulse ? (
                <span className="font-semibold text-status-good">Irrigate {formatLitres(pulse.litres)} ({formatMinutes(pulse.minutes)})</span>
              ) : h >= 11 && h <= 16 && t >= 35 ? (
                <span className="text-status-warning">No irrigation - peak heat</span>
              ) : (
                <span className="text-muted-foreground">Monitor</span>
              )}
            </td>
          </tr>
        )
      })}
    </>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-xl p-4">
      <h2 className="mb-2 text-xs font-medium text-muted-foreground">{label}</h2>
      {children}
    </section>
  )
}

function Reading({ icon, label, value, tone, testId }: { icon: React.ReactNode; label: string; value: string; tone: string; testId?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold tabular" style={{ color: `var(--status-${tone})` }} data-testid={testId}>
        {value}
      </div>
    </div>
  )
}

function BandChip({ band }: { band: ReturnType<typeof tempBand> }) {
  const tone = BAND_TONE[band]
  return (
    <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: `var(--status-${tone})`, background: `color-mix(in srgb, var(--status-${tone}) 12%, transparent)` }}>
      {band}
    </span>
  )
}

function Advisory({ tone, text }: { tone: 'warning' | 'info'; text: string }) {
  const Icon = tone === 'warning' ? Warning : Info
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${tone === 'warning' ? 'border-status-warning/40 bg-status-warning/10' : 'border-status-info/40 bg-status-info/10'}`}>
      <Icon size={16} className={`flex-none ${tone === 'warning' ? 'text-status-warning' : 'text-status-info'}`} />
      <span>{text}</span>
    </div>
  )
}
