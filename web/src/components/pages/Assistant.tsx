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
import { useI18n } from '@/lib/i18n/react'
import { LoadingChart } from '@/components/pages/SensorDetail'
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
  type TempBand,
  type WeatherSource,
} from '@/lib/farm/engine'
import { PADDY_HIGH, PADDY_LOW, initialState, readings, step, type SimState } from '@/lib/farm/simulator'

const SimChart = dynamic(() => import('@/components/SimChart'), {
  ssr: false,
  loading: () => <LoadingChart />,
})

/** Simulated minutes per real second. */
const SPEEDS = [10, 30, 60, 180]
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
  const { t } = useI18n()
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
    return <p className="p-12 text-center text-sm text-muted-foreground">{t('as.incomplete')}</p>
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Robot size={22} className="text-brand" />
            {t('as.title')}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('as.summary', {
              crop:
                t(`crop.${model.crop.id}`) === model.crop.name
                  ? `${model.crop.name} (${model.crop.local})`
                  : t(`crop.${model.crop.id}`),
              area: profile.areaAcres,
              district: profile.district,
              state: profile.state,
              method: t(`method.${profile.irrigation}`),
              soil: t(`soil.${model.soil.id}`),
            })}
          </p>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              source === 'live' ? 'bg-status-good/12 text-status-good' : 'bg-status-info/12 text-status-info'
            }`}
            data-testid="weather-source"
          >
            {source === 'loading' ? t('as.fetching') : source === 'live' ? t('as.live') : t('as.normals')}
          </span>
          <button type="button" className={plainBtn} onClick={() => router.push('/onboarding')}>
            <PencilSimple size={16} />
            {t('as.edit')}
          </button>
        </div>
      </header>

      {/* Demo controls */}
      <section className="glass mb-4 flex flex-wrap items-center gap-2 rounded-xl p-3" aria-label={t('as.controls')}>
        <span className="me-1 text-xs font-semibold">{t('as.demo')}</span>
        <button type="button" className={playing ? plainBtn : primaryBtn} onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? t('as.pause') : t('as.play')}
        </button>
        <button type="button" className={plainBtn} onClick={() => setRun((r) => r + 1)}>
          <ArrowCounterClockwise size={16} />
          {t('as.restart')}
        </button>
        <label className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{t('as.speed')}</span>
          <select className="min-h-9 rounded-lg border border-input bg-surface px-2 text-xs" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((value) => (
              <option key={value} value={value}>{t(`as.speed${value}`)}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5 sm:ms-auto" role="group" aria-label={t('as.scenario')}>
          {SCENARIOS.map((key) => {
            const Icon = SCENARIO_ICON[key]
            return (
              <button
                key={key}
                type="button"
                aria-pressed={scenario === key}
                data-scenario={key}
                title={t(`scen.${key}Hint`)}
                className={chip(scenario === key)}
                onClick={() => setScenario(key)}
              >
                <Icon size={14} />
                {t(`scen.${key}`)}
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
  const { t, tm, lang } = useI18n()
  const [sim, setSim] = useState<SimState>(() => initialState(model, plans))
  const simRef = useRef(sim)

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
  const low = ponded ? PADDY_LOW : model.trigger
  const high = ponded ? PADDY_HIGH : model.fieldCapacity
  const dayName = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(lang.locale, { weekday: 'short', day: 'numeric', month: 'short' })

  const nextAction = () => {
    if (plan.skipped) return t('as.noRun', { reason: plan.skipped })
    const upcoming = plan.pulses.find((p, i) => !sim.handled.includes(i) && p.start * 60 > sim.minute)
    return upcoming
      ? t('as.nextRun', { t: formatHour(upcoming.start), l: formatLitres(upcoming.litres) })
      : t('as.done')
  }

  return (
    <>
      {/* Headline tiles */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={t('as.dayOf', { d: sim.day + 1, date: dayName(plan.date) })}>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[28px] font-bold leading-none tabular" data-testid="sim-clock">
              {formatHour(sim.minute / 60)}
            </span>
            <span className="text-xs text-muted-foreground">{t('as.ist')}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <BandChip band={plan.band} />
            <span className="text-muted-foreground">
              {plan.weather.tmin.toFixed(0)}-{plan.weather.tmax.toFixed(0)} °C · {t('as.rain', { n: plan.weather.rainMm.toFixed(0) })}
            </span>
          </div>
        </Tile>

        <Tile label={t('as.water')}>
          <div className="font-mono text-[28px] font-bold leading-none tabular" data-testid="water-today">
            {plan.skipped ? '0 L' : formatLitres(plan.litres)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {plan.skipped
              ? tm(plan.skipped)
              : t('as.waterDetail', {
                  mm: plan.grossMm.toFixed(1),
                  t: formatMinutes(plan.pumpMinutes),
                  kc: plan.kc.toFixed(2),
                  et0: plan.weather.et0.toFixed(1),
                })}
          </p>
        </Tile>

        <Tile label={t('as.valve')}>
          <div className={`flex items-center gap-2 text-lg font-semibold ${sim.valveOpen ? 'text-status-good' : 'text-status-muted'}`} data-testid="valve-state">
            <span className={`size-3 rounded-full ${sim.valveOpen ? 'animate-pulse bg-status-good' : 'bg-status-muted'}`} />
            {sim.valveOpen ? t('as.open') : t('as.closed')}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {sim.valveOpen
              ? t('as.progress', {
                  a: formatLitres(sim.pulseDelivered),
                  b: formatLitres(sim.pulseTarget),
                  z: Math.min(model.zones, 1 + Math.floor((sim.pulseDelivered / Math.max(1, sim.pulseTarget)) * model.zones)),
                  n: model.zones,
                })
              : nextAction()}
          </p>
        </Tile>

        <Tile label={t('as.used')}>
          <div className="font-mono text-[28px] font-bold leading-none tabular">{formatLitres(sim.usedToday)}</div>
          <p className="mt-2 text-xs text-muted-foreground">{t('as.usedDetail', { n: formatLitres(sim.usedTotal) })}</p>
        </Tile>
      </div>

      {/* Live sensors */}
      <section className="glass mb-4 rounded-xl p-4" aria-label={t('as.readings')}>
        <h2 className="mb-3 text-sm font-semibold">
          {t('as.readings')} <span className="font-normal text-muted-foreground">({t('as.simulated')})</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Reading icon={<Drop size={16} />} label={ponded ? t('as.standing') : t('metric.moisture')} value={`${read.level} ${unit}`} tone={read.level < low ? 'critical' : read.level >= high - 1 ? 'good' : 'info'} testId="reading-moisture" />
          <Reading icon={<Thermometer size={16} />} label={t('as.air')} value={`${read.airTemp} °C`} tone={BAND_TONE[tempBand(read.airTemp)]} />
          <Reading icon={<Thermometer size={16} />} label={t('metric.temperature')} value={`${read.soilTemp} °C`} tone="info" />
          <Reading icon={<CloudRain size={16} />} label={t('as.humidity')} value={`${read.humidity}%`} tone="info" />
          <Reading icon={<Gauge size={16} />} label={t('as.flow')} value={`${read.flow} L/min`} tone={read.flow ? 'good' : 'info'} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {ponded
            ? t('as.paddyNote', { hi: PADDY_HIGH, lo: PADDY_LOW })
            : t('as.soilNote', {
                soil: t(`soil.${model.soil.id}`),
                fc: model.fieldCapacity,
                wp: model.wiltingPoint,
                crop: t(`crop.${model.crop.id}`),
                p: Math.round(model.crop.depletion * 100),
                tr: model.trigger,
              })}
        </p>
      </section>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold">{t('as.last24')}</h2>
          <p className="mb-2 text-xs text-muted-foreground">{t('as.chartNote')}</p>
          <div className="h-[260px]">
            <SimChart data={sim.history} unit={unit} trigger={low} target={high} />
          </div>
        </section>

        <section className="glass flex max-h-[340px] flex-col rounded-xl p-4" aria-label={t('as.log')}>
          <h2 className="mb-2 text-sm font-semibold">{t('as.log')}</h2>
          <ol className="grid flex-1 content-start gap-2 overflow-y-auto pe-1" data-testid="automation-log">
            {sim.log.map((entry) => (
              <li key={entry.id} className="flex gap-2 text-xs">
                <span className="flex-none font-mono text-muted-foreground tabular">
                  {t('as.dayShort', { n: entry.day + 1 })} {formatHour(entry.minute / 60)}
                </span>
                <span className={entry.tone === 'warning' ? 'text-status-warning' : entry.tone === 'critical' ? 'text-status-critical' : entry.tone === 'good' ? 'text-status-good' : ''}>
                  {tm(entry.text)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {plan.advisories.length || flood || plan.pumpMinutes > 480 ? (
        <section className="mb-4 grid gap-2" aria-label={t('as.advisories')}>
          {plan.advisories.map((a) => (
            <Advisory key={a.k} tone="warning" text={tm(a)} />
          ))}
          {flood ? (
            <Advisory
              tone="info"
              text={
                ponded
                  ? t('as.floodPaddy', { lo: PADDY_LOW, hi: PADDY_HIGH, l: formatLitres(flood.litresPerTurn) })
                  : t('as.flood', { l: formatLitres(flood.litresPerTurn), n: flood.everyDays, mm: model.raw.toFixed(0) })
              }
            />
          ) : null}
          {plan.pumpMinutes > 480 ? <Advisory tone="warning" text={t('as.pumpLong', { t: formatMinutes(plan.pumpMinutes) })} /> : null}
        </section>
      ) : null}

      {/* Hour by hour */}
      <section className="glass mb-4 overflow-hidden rounded-xl" aria-label={t('as.hourly')}>
        <div className="p-4 pb-2">
          <h2 className="text-sm font-semibold">{t('as.hourly')}</h2>
          <p className="text-xs text-muted-foreground">{t('as.hourlyNote')}</p>
        </div>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-start text-xs">
            <thead className="sticky top-0 bg-surface text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-start font-medium">{t('as.time')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('as.airShort')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('as.tempType')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('as.cropUse')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('as.automation')}</th>
              </tr>
            </thead>
            <tbody>
              <HourRows plan={plan} currentHour={hour} areaM2={model.areaM2} />
            </tbody>
          </table>
        </div>
      </section>

      {/* Week */}
      <section className="glass mb-4 overflow-hidden rounded-xl" aria-label={t('as.week')}>
        <div className="p-4 pb-2">
          <h2 className="text-sm font-semibold">{t('as.week')}</h2>
          <p className="text-xs text-muted-foreground">
            {source === 'live' ? t('as.fromLive') : t('as.fromNormals', { zone: t(`zone.${model.district.zone}`) })}
            {scenario !== 'normal' ? ` ${t('as.applied', { s: t(`scen.${scenario}`) })}` : ''}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-start text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-start font-medium">{t('as.day')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('as.temp')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('as.type')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('as.rainCol')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('as.cropUse')}</th>
                <th className="px-2 py-2 text-start font-medium">{t('as.give')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('as.when')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p, i) => (
                <tr key={p.date} className={`border-t border-border ${i === sim.day ? 'bg-brand-wash' : ''}`}>
                  <td className="px-4 py-2 font-medium">{dayName(p.date)}</td>
                  <td className="px-2 py-2 font-mono tabular">{p.weather.tmin.toFixed(0)}-{p.weather.tmax.toFixed(0)} °C</td>
                  <td className="px-2 py-2"><BandChip band={p.band} /></td>
                  <td className="px-2 py-2 font-mono tabular">{p.weather.rainMm.toFixed(0)} mm</td>
                  <td className="px-2 py-2 font-mono tabular">{p.etc.toFixed(1)} mm</td>
                  <td className="px-2 py-2 font-mono font-semibold tabular">{p.skipped ? t('as.skip') : formatLitres(p.litres)}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {p.skipped ? tm(p.skipped) : p.pulses.map((x) => `${formatHour(x.start)} (${formatMinutes(x.minutes)})`).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sensor kit */}
      <section className="glass rounded-xl p-4" aria-label={t('as.kit')}>
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Cpu size={16} /> {t('as.kit')}</h2>
          <span className="text-xs text-muted-foreground">
            {t('as.kitSummary', { n: model.zones, e: formatInr(budget.essential), f: formatInr(budget.full) })}
          </span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sensors.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-surface p-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="font-semibold">{tm(s.name)}</span>
                <span className="ms-auto flex-none font-mono tabular">×{s.quantity}</span>
              </div>
              <div className="mt-1 text-muted-foreground">{t(`prio.${s.priority}`)} · {tm(s.measures)}</div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function HourRows({ plan, currentHour, areaM2 }: { plan: DayPlan; currentHour: number; areaM2: number }) {
  const { t } = useI18n()
  const temps = hourlyTemps(plan.weather)
  const share = hourlyEtShare()
  return (
    <>
      {temps.map((temp, h) => {
        const pulse = plan.pulses.find((p) => Math.floor(p.start) === h)
        const useL = plan.etc * share[h] * areaM2
        return (
          <tr key={h} className={`border-t border-border ${h === currentHour ? 'bg-brand-wash font-medium' : ''}`} aria-current={h === currentHour ? 'time' : undefined}>
            <td className="px-4 py-1.5 font-mono tabular">{formatHour(h)}</td>
            <td className="px-2 py-1.5 font-mono tabular">{temp.toFixed(1)} °C</td>
            <td className="px-2 py-1.5"><BandChip band={tempBand(temp)} /></td>
            <td className="px-2 py-1.5 font-mono tabular">{useL >= 1 ? formatLitres(useL) : '-'}</td>
            <td className="px-4 py-1.5">
              {pulse ? (
                <span className="font-semibold text-status-good">{t('as.irrigate', { l: formatLitres(pulse.litres), t: formatMinutes(pulse.minutes) })}</span>
              ) : h >= 11 && h <= 16 && temp >= 35 ? (
                <span className="text-status-warning">{t('as.peakHeat')}</span>
              ) : (
                <span className="text-muted-foreground">{t('as.monitor')}</span>
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

function BandChip({ band }: { band: TempBand }) {
  const { t } = useI18n()
  const tone = BAND_TONE[band]
  return (
    <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: `var(--status-${tone})`, background: `color-mix(in srgb, var(--status-${tone}) 12%, transparent)` }}>
      {t(`band.${band}`)}
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
