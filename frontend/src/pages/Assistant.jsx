import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SimChart from '../SimChart'
import {
  IconChip,
  IconCold,
  IconDrop,
  IconEdit,
  IconFlow,
  IconHeat,
  IconInfo,
  IconPause,
  IconPlay,
  IconRain,
  IconRestart,
  IconSunSmall,
  IconThermometer,
  IconWarning,
} from '../icons'
import { useSession } from '../session'
import { useI18n } from '../i18n/react'
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
} from '../farm/engine'
import { PADDY_HIGH, PADDY_LOW, initialState, readings, step } from '../farm/simulator'

/** Simulated minutes per real second. */
const SPEEDS = [10, 30, 60, 180]
const TICK_MS = 250

const SCENARIO_ICON = { normal: IconSunSmall, heatwave: IconHeat, monsoon: IconRain, coldwave: IconCold }

export default function Assistant() {
  const navigate = useNavigate()
  const { session } = useSession()
  const profile = useMemo(() => loadProfile(session.email), [session])

  useEffect(() => {
    if (!profile) navigate('/onboarding', { replace: true })
  }, [profile, navigate])

  if (!profile) return null
  return <AssistantView profile={profile} />
}

function AssistantView({ profile }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const district = districtOf(profile)
  const [live, setLive] = useState(null)
  const [source, setSource] = useState('loading')
  const [scenario, setScenario] = useState('normal')
  const [speed, setSpeed] = useState(30)
  const [playing, setPlaying] = useState(true)
  // Bumped to restart the simulated field; it is also keyed on anything that changes its weather.
  const [run, setRun] = useState(0)

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
  const plans = useMemo(() => {
    if (!model || !district) return []
    const week = (live ?? normalsWeek(district)).map((day) => applyScenario(day, scenario, profile.lat))
    return week.map((w) => planDay(profile, model, w))
  }, [live, district, scenario, profile, model])

  if (!model) {
    return <p className="empty">{t('as.incomplete')}</p>
  }

  return (
    <>
      <div className="toolbar farm-summary">
        <span className="muted">
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
        </span>
        <div className="toolbar-right">
          <span className={`farm-pill farm-pill-${source === 'live' ? 'good' : 'info'}`} data-testid="weather-source">
            {source === 'loading' ? t('as.fetching') : source === 'live' ? t('as.live') : t('as.normals')}
          </span>
          <button type="button" className="btn btn-sm" onClick={() => navigate('/onboarding')}>
            <IconEdit />
            {t('as.edit')}
          </button>
        </div>
      </div>

      <section className="card farm-controls" aria-label={t('as.controls')}>
        <span className="hint-title farm-controls-label">{t('as.demo')}</span>
        <button type="button" className={`btn btn-sm${playing ? '' : ' btn-primary'}`} onClick={() => setPlaying((p) => !p)}>
          {playing ? <IconPause /> : <IconPlay />}
          {playing ? t('as.pause') : t('as.play')}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setRun((r) => r + 1)}>
          <IconRestart />
          {t('as.restart')}
        </button>
        <label className="farm-speed">
          <span className="muted">{t('as.speed')}</span>
          <select className="select" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((value) => (
              <option key={value} value={value}>{t(`as.speed${value}`)}</option>
            ))}
          </select>
        </label>
        <div className="farm-chips farm-scenarios" role="group" aria-label={t('as.scenario')}>
          {SCENARIOS.map((key) => {
            const Icon = SCENARIO_ICON[key]
            return (
              <button key={key} type="button" className="farm-chip" aria-pressed={scenario === key} data-scenario={key} title={t(`scen.${key}Hint`)} onClick={() => setScenario(key)}>
                <Icon />
                {t(`scen.${key}`)}
              </button>
            )
          })}
        </div>
      </section>

      {source === 'loading' || !plans.length ? (
        <div className="skeleton skeleton-card" style={{ height: 260 }} />
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
function FieldSim({ profile, model, plans, playing, speed, scenario, source }) {
  const { t, tm, lang } = useI18n()
  const [sim, setSim] = useState(() => initialState(model, plans))
  const simRef = useRef(sim)

  useEffect(() => {
    if (!playing) return undefined
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
  const dayName = (iso) =>
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
      <div className="farm-tiles">
        <Tile label={t('as.dayOf', { d: sim.day + 1, date: dayName(plan.date) })}>
          <div className="farm-figure-row">
            <span className="farm-hero" data-testid="sim-clock">{formatHour(sim.minute / 60)}</span>
            <span className="muted">{t('as.ist')}</span>
          </div>
          <div className="farm-tile-foot">
            <BandChip band={plan.band} />
            <span className="muted">
              {plan.weather.tmin.toFixed(0)}-{plan.weather.tmax.toFixed(0)} °C · {t('as.rain', { n: plan.weather.rainMm.toFixed(0) })}
            </span>
          </div>
        </Tile>

        <Tile label={t('as.water')}>
          <span className="farm-hero" data-testid="water-today">{plan.skipped ? '0 L' : formatLitres(plan.litres)}</span>
          <p className="muted farm-tile-foot">
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
          <span className={`status status-${sim.valveOpen ? 'good' : 'muted'} farm-valve`} data-testid="valve-state">
            <span className={`farm-dot${sim.valveOpen ? ' farm-dot-live' : ''}`} />
            {sim.valveOpen ? t('as.open') : t('as.closed')}
          </span>
          <p className="muted farm-tile-foot">
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
          <span className="farm-hero">{formatLitres(sim.usedToday)}</span>
          <p className="muted farm-tile-foot">{t('as.usedDetail', { n: formatLitres(sim.usedTotal) })}</p>
        </Tile>
      </div>

      <section className="card farm-section" aria-label={t('as.readings')}>
        <div className="card-head">
          <h2 className="card-title">{t('as.readings')}</h2>
          <span className="muted">{t('as.simulated')}</span>
        </div>
        <div className="card-body">
          <div className="farm-readings">
            <Reading icon={<IconDrop />} label={ponded ? t('as.standing') : t('metric.moisture')} value={`${read.level} ${unit}`} tone={read.level < low ? 'critical' : read.level >= high - 1 ? 'good' : 'info'} testId="reading-moisture" />
            <Reading icon={<IconThermometer />} label={t('as.air')} value={`${read.airTemp} °C`} tone={BAND_TONE[tempBand(read.airTemp)]} />
            <Reading icon={<IconThermometer />} label={t('metric.temperature')} value={`${read.soilTemp} °C`} tone="info" />
            <Reading icon={<IconRain />} label={t('as.humidity')} value={`${read.humidity}%`} tone="info" />
            <Reading icon={<IconFlow />} label={t('as.flow')} value={`${read.flow} L/min`} tone={read.flow ? 'good' : 'info'} />
          </div>
          <p className="muted farm-footnote">
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
        </div>
      </section>

      <div className="farm-split">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t('as.last24')}</h2>
          </div>
          <div className="card-body">
            <p className="muted farm-footnote farm-footnote-top">{t('as.chartNote')}</p>
            <div className="chart-box">
              <SimChart data={sim.history} unit={unit} trigger={low} target={high} />
            </div>
          </div>
        </section>

        <section className="card farm-log-card" aria-label={t('as.log')}>
          <div className="card-head">
            <h2 className="card-title">{t('as.log')}</h2>
          </div>
          <ol className="farm-log" data-testid="automation-log">
            {sim.log.map((entry) => (
              <li key={entry.id}>
                <span className="mono muted">{t('as.dayShort', { n: entry.day + 1 })} {formatHour(entry.minute / 60)}</span>
                <span className={entry.tone === 'info' ? '' : `status-${entry.tone}`}>{tm(entry.text)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {plan.advisories.length || flood || plan.pumpMinutes > 480 ? (
        <section className="farm-advisories" aria-label={t('as.advisories')}>
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
          {plan.pumpMinutes > 480 ? (
            <Advisory tone="warning" text={t('as.pumpLong', { t: formatMinutes(plan.pumpMinutes) })} />
          ) : null}
        </section>
      ) : null}

      <section className="card farm-section" aria-label={t('as.hourly')}>
        <div className="card-head">
          <div>
            <h2 className="card-title">{t('as.hourly')}</h2>
            <p className="muted farm-card-sub">{t('as.hourlyNote')}</p>
          </div>
        </div>
        <div className="table-wrap farm-table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>{t('as.time')}</th>
                <th>{t('as.airShort')}</th>
                <th>{t('as.tempType')}</th>
                <th>{t('as.cropUse')}</th>
                <th>{t('as.automation')}</th>
              </tr>
            </thead>
            <tbody>
              <HourRows plan={plan} currentHour={hour} areaM2={model.areaM2} />
            </tbody>
          </table>
        </div>
      </section>

      <section className="card farm-section" aria-label={t('as.week')}>
        <div className="card-head">
          <div>
            <h2 className="card-title">{t('as.week')}</h2>
            <p className="muted farm-card-sub">
              {source === 'live' ? t('as.fromLive') : t('as.fromNormals', { zone: t(`zone.${model.district.zone}`) })}
              {scenario !== 'normal' ? ` ${t('as.applied', { s: t(`scen.${scenario}`) })}` : ''}
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t('as.day')}</th>
                <th>{t('as.temp')}</th>
                <th>{t('as.type')}</th>
                <th>{t('as.rainCol')}</th>
                <th>{t('as.cropUse')}</th>
                <th>{t('as.give')}</th>
                <th>{t('as.when')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p, i) => (
                <tr key={p.date} className={i === sim.day ? 'farm-row-current' : undefined}>
                  <td>{dayName(p.date)}</td>
                  <td className="mono">{p.weather.tmin.toFixed(0)}-{p.weather.tmax.toFixed(0)} °C</td>
                  <td><BandChip band={p.band} /></td>
                  <td className="mono">{p.weather.rainMm.toFixed(0)} mm</td>
                  <td className="mono">{p.etc.toFixed(1)} mm</td>
                  <td className="mono"><strong>{p.skipped ? t('as.skip') : formatLitres(p.litres)}</strong></td>
                  <td className="muted">
                    {p.skipped ? tm(p.skipped) : p.pulses.map((x) => `${formatHour(x.start)} (${formatMinutes(x.minutes)})`).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card farm-section" aria-label={t('as.kit')}>
        <div className="card-head">
          <IconChip />
          <h2 className="card-title">{t('as.kit')}</h2>
          <span className="muted">
            {t('as.kitSummary', { n: model.zones, e: formatInr(budget.essential), f: formatInr(budget.full) })}
          </span>
        </div>
        <ul className="card-body farm-kit">
          {sensors.map((s) => (
            <li key={s.id} className="farm-panel">
              <div className="farm-sensor-head">
                <span className="farm-option-title">{tm(s.name)}</span>
                <span className="mono farm-sensor-qty">×{s.quantity}</span>
              </div>
              <p className="muted">{t(`prio.${s.priority}`)} · {tm(s.measures)}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function HourRows({ plan, currentHour, areaM2 }) {
  const { t } = useI18n()
  const temps = hourlyTemps(plan.weather)
  const share = hourlyEtShare()
  return temps.map((temp, h) => {
    const pulse = plan.pulses.find((p) => Math.floor(p.start) === h)
    const useL = plan.etc * share[h] * areaM2
    return (
      <tr key={h} className={h === currentHour ? 'farm-row-current' : undefined} aria-current={h === currentHour ? 'time' : undefined}>
        <td className="mono">{formatHour(h)}</td>
        <td className="mono">{temp.toFixed(1)} °C</td>
        <td><BandChip band={tempBand(temp)} /></td>
        <td className="mono">{useL >= 1 ? formatLitres(useL) : '-'}</td>
        <td>
          {pulse ? (
            <strong className="status-good">{t('as.irrigate', { l: formatLitres(pulse.litres), t: formatMinutes(pulse.minutes) })}</strong>
          ) : h >= 11 && h <= 16 && temp >= 35 ? (
            <span className="status-warning">{t('as.peakHeat')}</span>
          ) : (
            <span className="muted">{t('as.monitor')}</span>
          )}
        </td>
      </tr>
    )
  })
}

function Tile({ label, children }) {
  return (
    <section className="card farm-tile">
      <h2 className="metric-label">{label}</h2>
      {children}
    </section>
  )
}

function Reading({ icon, label, value, tone, testId }) {
  return (
    <div className="farm-panel">
      <div className="metric-label farm-reading-label">
        {icon}
        {label}
      </div>
      <div className={`metric-value status-${tone}`} data-testid={testId}>{value}</div>
    </div>
  )
}

function BandChip({ band }) {
  const { t } = useI18n()
  return <span className={`farm-pill farm-pill-${BAND_TONE[band]}`}>{t(`band.${band}`)}</span>
}

function Advisory({ tone, text }) {
  const Icon = tone === 'warning' ? IconWarning : IconInfo
  return (
    <div className={`farm-advisory farm-advisory-${tone}`}>
      <Icon className={`status-${tone}`} />
      <span>{text}</span>
    </div>
  )
}
