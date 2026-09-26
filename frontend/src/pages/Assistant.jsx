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
import { CLIMATE, IRRIGATION } from '../farm/india'
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
const SPEEDS = [
  { label: '10 min/s', value: 10 },
  { label: '30 min/s', value: 30 },
  { label: '1 h/s', value: 60 },
  { label: '3 h/s', value: 180 },
]
const TICK_MS = 250

const SCENARIO_ICON = { normal: IconSunSmall, heatwave: IconHeat, monsoon: IconRain, coldwave: IconCold }

const dayName = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

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
    return <p className="empty">This farm profile is incomplete. Please run setup again.</p>
  }

  return (
    <>
      <div className="toolbar farm-summary">
        <span className="muted">
          {model.crop.name} ({model.crop.local}) · {profile.areaAcres} acres · {profile.district}, {profile.state} ·{' '}
          {IRRIGATION[profile.irrigation].name.toLowerCase()} irrigation · {model.soil.name.toLowerCase()}
        </span>
        <div className="toolbar-right">
          <span className={`farm-pill farm-pill-${source === 'live' ? 'good' : 'info'}`} data-testid="weather-source">
            {source === 'loading' ? 'Fetching weather' : source === 'live' ? 'Live forecast (Open-Meteo)' : 'IMD climate normals (offline)'}
          </span>
          <button type="button" className="btn btn-sm" onClick={() => navigate('/onboarding')}>
            <IconEdit />
            Edit farm
          </button>
        </div>
      </div>

      <section className="card farm-controls" aria-label="Demo controls">
        <span className="hint-title farm-controls-label">Demo</span>
        <button type="button" className={`btn btn-sm${playing ? '' : ' btn-primary'}`} onClick={() => setPlaying((p) => !p)}>
          {playing ? <IconPause /> : <IconPlay />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setRun((r) => r + 1)}>
          <IconRestart />
          Restart day
        </button>
        <label className="farm-speed">
          <span className="muted">Speed</span>
          <select className="select" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <div className="farm-chips farm-scenarios" role="group" aria-label="Weather scenario">
          {Object.keys(SCENARIOS).map((key) => {
            const Icon = SCENARIO_ICON[key]
            return (
              <button key={key} type="button" className="farm-chip" aria-pressed={scenario === key} title={SCENARIOS[key].hint} onClick={() => setScenario(key)}>
                <Icon />
                {SCENARIOS[key].label}
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

  return (
    <>
      <div className="farm-tiles">
        <Tile label={`Day ${sim.day + 1} of 7 · ${dayName(plan.date)}`}>
          <div className="farm-figure-row">
            <span className="farm-hero" data-testid="sim-clock">{formatHour(sim.minute / 60)}</span>
            <span className="muted">IST</span>
          </div>
          <div className="farm-tile-foot">
            <BandChip band={plan.band} />
            <span className="muted">
              {plan.weather.tmin.toFixed(0)}-{plan.weather.tmax.toFixed(0)} °C · rain {plan.weather.rainMm.toFixed(0)} mm
            </span>
          </div>
        </Tile>

        <Tile label="Water needed today">
          <span className="farm-hero" data-testid="water-today">{plan.skipped ? '0 L' : formatLitres(plan.litres)}</span>
          <p className="muted farm-tile-foot">
            {plan.skipped
              ? plan.skipped
              : `${plan.grossMm.toFixed(1)} mm · pump ${formatMinutes(plan.pumpMinutes)} · Kc ${plan.kc.toFixed(2)} × ET0 ${plan.weather.et0.toFixed(1)} mm`}
          </p>
        </Tile>

        <Tile label="Valve and pump">
          <span className={`status status-${sim.valveOpen ? 'good' : 'muted'} farm-valve`} data-testid="valve-state">
            <span className={`farm-dot${sim.valveOpen ? ' farm-dot-live' : ''}`} />
            {sim.valveOpen ? 'OPEN - irrigating' : 'CLOSED'}
          </span>
          <p className="muted farm-tile-foot">
            {sim.valveOpen
              ? `${formatLitres(sim.pulseDelivered)} of ${formatLitres(sim.pulseTarget)} · zone ${Math.min(model.zones, 1 + Math.floor((sim.pulseDelivered / Math.max(1, sim.pulseTarget)) * model.zones))} of ${model.zones}`
              : nextAction(plan, sim)}
          </p>
        </Tile>

        <Tile label="Water used">
          <span className="farm-hero">{formatLitres(sim.usedToday)}</span>
          <p className="muted farm-tile-foot">today · {formatLitres(sim.usedTotal)} since start</p>
        </Tile>
      </div>

      <section className="card farm-section" aria-label="Live sensor readings">
        <div className="card-head">
          <h2 className="card-title">Live sensor readings</h2>
          <span className="muted">simulated field</span>
        </div>
        <div className="card-body">
          <div className="farm-readings">
            <Reading icon={<IconDrop />} label={ponded ? 'Standing water' : 'Soil moisture'} value={`${read.level} ${unit}`} tone={read.level < low ? 'critical' : read.level >= high - 1 ? 'good' : 'info'} testId="reading-moisture" />
            <Reading icon={<IconThermometer />} label="Air temperature" value={`${read.airTemp} °C`} tone={BAND_TONE[tempBand(read.airTemp)]} />
            <Reading icon={<IconThermometer />} label="Soil temperature" value={`${read.soilTemp} °C`} tone="info" />
            <Reading icon={<IconRain />} label="Humidity" value={`${read.humidity}%`} tone="info" />
            <Reading icon={<IconFlow />} label="Flow meter" value={`${read.flow} L/min`} tone={read.flow ? 'good' : 'info'} />
          </div>
          <p className="muted farm-footnote">
            {ponded
              ? `Paddy uses alternate wetting and drying: refill to ${PADDY_HIGH} mm when standing water drops below ${PADDY_LOW} mm.`
              : `${model.soil.name}: field capacity ${model.fieldCapacity}%, wilting point ${model.wiltingPoint}%. ${model.crop.name} can use ${Math.round(model.crop.depletion * 100)}% of available water before stress, so the controller irrigates below ${model.trigger}%.`}
          </p>
        </div>
      </section>

      <div className="farm-split">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Last 24 hours</h2>
          </div>
          <div className="card-body">
            <p className="muted farm-footnote farm-footnote-top">Moisture falls with the afternoon heat; shaded bands are automatic irrigation runs.</p>
            <div className="chart-box">
              <SimChart data={sim.history} unit={unit} trigger={low} target={high} />
            </div>
          </div>
        </section>

        <section className="card farm-log-card" aria-label="Automation log">
          <div className="card-head">
            <h2 className="card-title">Automation log</h2>
          </div>
          <ol className="farm-log" data-testid="automation-log">
            {sim.log.map((entry) => (
              <li key={entry.id}>
                <span className="mono muted">D{entry.day + 1} {formatHour(entry.minute / 60)}</span>
                <span className={entry.tone === 'info' ? '' : `status-${entry.tone}`}>{entry.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {plan.advisories.length || flood || plan.pumpMinutes > 480 ? (
        <section className="farm-advisories" aria-label="Advisories">
          {plan.advisories.map((a) => (
            <Advisory key={a} tone="warning" text={a} />
          ))}
          {flood ? (
            <Advisory
              tone="info"
              text={
                ponded
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

      <section className="card farm-section" aria-label="Hourly water plan">
        <div className="card-head">
          <div>
            <h2 className="card-title">Today hour by hour</h2>
            <p className="muted farm-card-sub">How much water the crop uses each hour at that hour&apos;s temperature, and when the automation replaces it.</p>
          </div>
        </div>
        <div className="table-wrap farm-table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Time</th>
                <th>Air temp</th>
                <th>Temp type</th>
                <th>Crop use</th>
                <th>Automation</th>
              </tr>
            </thead>
            <tbody>
              <HourRows plan={plan} currentHour={hour} areaM2={model.areaM2} />
            </tbody>
          </table>
        </div>
      </section>

      <section className="card farm-section" aria-label="Seven day plan">
        <div className="card-head">
          <div>
            <h2 className="card-title">7-day irrigation plan</h2>
            <p className="muted farm-card-sub">
              {source === 'live' ? 'From the live forecast for your coordinates.' : `From ${CLIMATE[model.district.zone].label.toLowerCase()} climate normals.`}
              {scenario !== 'normal' ? ` Scenario applied: ${SCENARIOS[scenario].label.toLowerCase()}.` : ''}
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Day</th>
                <th>Temp</th>
                <th>Type</th>
                <th>Rain</th>
                <th>Crop use</th>
                <th>Water to give</th>
                <th>When</th>
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
                  <td className="mono"><strong>{p.skipped ? 'Skip' : formatLitres(p.litres)}</strong></td>
                  <td className="muted">
                    {p.skipped ? p.skipped : p.pulses.map((x) => `${formatHour(x.start)} (${formatMinutes(x.minutes)})`).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card farm-section" aria-label="Your sensor kit">
        <div className="card-head">
          <IconChip />
          <h2 className="card-title">Your sensor kit</h2>
          <span className="muted">
            {model.zones} zone{model.zones > 1 ? 's' : ''} · essential {formatInr(budget.essential)} · full {formatInr(budget.full)}
          </span>
        </div>
        <ul className="card-body farm-kit">
          {sensors.map((s) => (
            <li key={s.id} className="farm-panel">
              <div className="farm-sensor-head">
                <span className="farm-option-title">{s.name}</span>
                <span className="mono farm-sensor-qty">×{s.quantity}</span>
              </div>
              <p className="muted">{s.priority} · {s.measures}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function nextAction(plan, sim) {
  if (plan.skipped) return `No run today - ${plan.skipped.toLowerCase()}`
  const upcoming = plan.pulses.find((p, i) => !sim.handled.includes(i) && p.start * 60 > sim.minute)
  return upcoming ? `Next run ${formatHour(upcoming.start)} · ${formatLitres(upcoming.litres)}` : "Today's runs are done - watching moisture"
}

function HourRows({ plan, currentHour, areaM2 }) {
  const temps = hourlyTemps(plan.weather)
  const share = hourlyEtShare()
  return temps.map((t, h) => {
    const pulse = plan.pulses.find((p) => Math.floor(p.start) === h)
    const useL = plan.etc * share[h] * areaM2
    return (
      <tr key={h} className={h === currentHour ? 'farm-row-current' : undefined} aria-current={h === currentHour ? 'time' : undefined}>
        <td className="mono">{formatHour(h)}</td>
        <td className="mono">{t.toFixed(1)} °C</td>
        <td><BandChip band={tempBand(t)} /></td>
        <td className="mono">{useL >= 1 ? formatLitres(useL) : '-'}</td>
        <td>
          {pulse ? (
            <strong className="status-good">Irrigate {formatLitres(pulse.litres)} ({formatMinutes(pulse.minutes)})</strong>
          ) : h >= 11 && h <= 16 && t >= 35 ? (
            <span className="status-warning">No irrigation - peak heat</span>
          ) : (
            <span className="muted">Monitor</span>
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
  return <span className={`farm-pill farm-pill-${BAND_TONE[band]}`}>{band}</span>
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
