import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import {
  IconArrowLeft,
  IconArrowRight,
  IconAssistant,
  IconCheck,
  IconChip,
  IconLocate,
  IconMapPin,
  IconPlant,
  IconRuler,
  IconSearch,
} from '../icons'
import { useSession, useTheme } from '../session'
import { CLIMATE, CROPS, CROP_GROUPS, IRRIGATION, SOILS, STATES, cropById, nearestDistrict } from '../farm/india'
import {
  cropStage,
  districtOf,
  fieldModel,
  formatHour,
  formatInr,
  formatLitres,
  formatMinutes,
  normalsWeek,
  planDay,
  recommendSensors,
  saveProfile,
  sensorBudget,
} from '../farm/engine'

const STEPS = [
  { key: 'crop', label: 'Crop', Icon: IconPlant },
  { key: 'location', label: 'Location', Icon: IconMapPin },
  { key: 'field', label: 'Field', Icon: IconRuler },
  { key: 'sensors', label: 'Sensors', Icon: IconChip },
  { key: 'automate', label: 'Automate', Icon: IconAssistant },
]

/** The soil a zone mostly has, so the field step starts from a sensible guess. */
const ZONE_SOIL = {
  'north-plains': 'alluvial',
  'arid-west': 'sandy',
  central: 'black',
  'west-semiarid': 'black',
  deccan: 'red',
  'east-humid': 'alluvial',
  'coastal-south': 'red',
  'west-coast': 'laterite',
  northeast: 'alluvial',
  himalayan: 'mountain',
}

/** Typical discharge of Indian monoblock / submersible pumps at field head, litres per minute. */
const PUMPS = [
  { hp: 1, lpm: 100 },
  { hp: 2, lpm: 180 },
  { hp: 3, lpm: 250 },
  { hp: 5, lpm: 400 },
  { hp: 7.5, lpm: 550 },
  { hp: 10, lpm: 700 },
]

const HECTARE_ACRES = 2.47105

const isoDaysAgo = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function Onboarding() {
  useTheme()
  const navigate = useNavigate()
  const { session, token, isDemo } = useSession()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    farmerName: session.displayName || '',
    cropId: '',
    sowingDate: isoDaysAgo(35),
    state: '',
    district: '',
    lat: 0,
    lon: 0,
    areaAcres: 2,
    soilId: 'alluvial',
    irrigation: 'drip',
    pumpLpm: 400,
    createdAt: '',
  })
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const canNext = [
    Boolean(draft.cropId),
    Boolean(draft.state && draft.district),
    draft.areaAcres > 0 && draft.pumpLpm > 0 && Boolean(draft.sowingDate),
    true,
    true,
  ][step]

  const finish = async () => {
    setSaving(true)
    const profile = { ...draft, createdAt: new Date().toISOString() }
    // Register the field with the crop service too, so the operations screens see it. Best
    // effort: in the offline demo there is no backend and the assistant runs on its own.
    if (!isDemo) {
      try {
        const crop = cropById(draft.cropId)
        const created = await api.createCrop(token, {
          name: `${draft.farmerName || 'My'} - ${crop.name} (${draft.district})`,
          cropType: crop.id,
          areaHectares: Number((draft.areaAcres / HECTARE_ACRES).toFixed(2)),
        })
        profile.backendCropId = created.cropId
      } catch {
        // The assistant does not depend on it.
      }
    }
    saveProfile(session.email, profile)
    navigate('/assistant', { replace: true })
  }

  return (
    <div className="auth-page">
      <header className="auth-top">
        <span className="brand">AgriTech</span>
      </header>

      <main className="farm-setup" id="main-content">
        <div className="page-head">
          <h1 className="page-title">
            Namaste{draft.farmerName ? `, ${draft.farmerName.split(' ')[0]}` : ''}. Let&apos;s set up your farm.
          </h1>
          <p className="page-subtitle">
            Five quick steps. The assistant then works out how much water your crop needs, and when.
          </p>
        </div>

        <ol className="farm-steps" aria-label="Setup progress">
          {STEPS.map(({ key, label, Icon }, i) => (
            <li key={key}>
              <button
                type="button"
                className="farm-step"
                disabled={i > step}
                aria-current={i === step ? 'step' : undefined}
                data-done={i < step || undefined}
                onClick={() => setStep(i)}
              >
                {i < step ? <IconCheck /> : <Icon />}
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ol>

        <section className="card farm-card">
          {step === 0 ? <CropStep draft={draft} set={set} /> : null}
          {step === 1 ? <LocationStep draft={draft} set={set} /> : null}
          {step === 2 ? <FieldStep draft={draft} set={set} /> : null}
          {step === 3 ? <SensorStep draft={draft} /> : null}
          {step === 4 ? <AutomateStep draft={draft} /> : null}

          <div className="farm-actions">
            {step > 0 ? (
              <button type="button" className="btn" onClick={() => setStep(step - 1)}>
                <IconArrowLeft />
                Back
              </button>
            ) : null}
            <span className="muted farm-actions-count">
              Step {step + 1} of {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
                Continue
                <IconArrowRight />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={finish}>
                {saving ? <span className="spinner" /> : <IconAssistant width={16} height={16} />}
                {saving ? 'Starting' : 'Start automation'}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function StepHeader({ title, body }) {
  return (
    <header className="farm-step-head">
      <h2>{title}</h2>
      <p className="muted">{body}</p>
    </header>
  )
}

/* ---------- 1. Crop ---------- */

function CropStep({ draft, set }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CROPS.filter(
      (c) =>
        (group === 'All' || c.group === group) &&
        (!q || c.name.toLowerCase().includes(q) || c.local.includes(q) || c.id.includes(q)),
    )
  }, [query, group])

  return (
    <>
      <StepHeader
        title="Which crop are you growing?"
        body={`Pick from ${CROPS.length} crops grown across India. Water need, sensors and alerts are all tuned to it.`}
      />

      <label className="farm-search">
        <span className="sr-only">Search crops</span>
        <IconSearch />
        <input
          className="input"
          placeholder="Search - e.g. wheat, धान, cotton"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="farm-chips" role="group" aria-label="Crop group">
        {['All', ...CROP_GROUPS].map((g) => (
          <button key={g} type="button" className="farm-chip" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>

      <div className="farm-crop-grid" role="radiogroup" aria-label="Crop">
        {shown.map((crop) => {
          const selected = draft.cropId === crop.id
          return (
            <button
              key={crop.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-crop={crop.id}
              className="farm-option"
              onClick={() => set({ cropId: crop.id, irrigation: crop.ponded ? 'flood' : draft.irrigation })}
            >
              <span className="farm-option-title">
                {crop.name}
                {selected ? <IconCheck className="farm-option-check" /> : null}
              </span>
              <span className="farm-option-local">{crop.local}</span>
              <span className="farm-tags">
                {crop.seasons.map((s) => (
                  <span key={s} className="farm-tag">{s}</span>
                ))}
              </span>
            </button>
          )
        })}
        {shown.length === 0 ? <p className="muted farm-none">No crop matches.</p> : null}
      </div>
    </>
  )
}

/* ---------- 2. Location ---------- */

function LocationStep({ draft, set }) {
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')
  const state = STATES.find((s) => s.name === draft.state)
  const district = districtOf(draft)
  const month = new Date().getMonth()

  const choose = (stateName, districtName) => {
    const dist = STATES.find((s) => s.name === stateName)?.districts.find((d) => d.name === districtName)
    if (!dist) return set({ state: stateName, district: '' })
    set({ state: stateName, district: districtName, lat: dist.lat, lon: dist.lon, soilId: ZONE_SOIL[dist.zone] })
  }

  const locate = () => {
    setGeoError('')
    if (!navigator.geolocation) return setGeoError('Location is not available in this browser.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const found = nearestDistrict(pos.coords.latitude, pos.coords.longitude)
        choose(found.state, found.district.name)
        set({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setGeoError('Could not get your location - please choose from the list.')
        setLocating(false)
      },
      { timeout: 8000 },
    )
  }

  return (
    <>
      <StepHeader
        title="Where is your farm?"
        body="Your state and district set the climate: temperature, rainfall and humidity decide how much water the crop loses each day."
      />

      <button type="button" className="btn farm-locate" onClick={locate} disabled={locating}>
        {locating ? <span className="spinner" /> : <IconLocate />}
        {locating ? 'Finding you' : 'Use my current location'}
      </button>
      {geoError ? <p className="field-error">{geoError}</p> : null}

      <div className="auth-row">
        <div className="field">
          <label htmlFor="state">State / Union territory</label>
          <select id="state" className="select" value={draft.state} onChange={(e) => choose(e.target.value, '')}>
            <option value="">Select state</option>
            {STATES.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="district">District</label>
          <select id="district" className="select" value={draft.district} disabled={!state} onChange={(e) => choose(draft.state, e.target.value)}>
            <option value="">{state ? 'Select district' : 'Choose a state first'}</option>
            {state?.districts.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {district ? (
        <div className="farm-panel">
          <div className="farm-panel-title">{CLIMATE[district.zone].label}</div>
          <dl className="farm-stats">
            <Stat term="This month, day" value={`${CLIMATE[district.zone].tmax[month]} °C`} />
            <Stat term="This month, night" value={`${CLIMATE[district.zone].tmin[month]} °C`} />
            <Stat term="Monthly rain" value={`${CLIMATE[district.zone].rain[month]} mm`} />
            <Stat term="Coordinates" value={`${draft.lat.toFixed(2)}, ${draft.lon.toFixed(2)}`} />
          </dl>
        </div>
      ) : null}
    </>
  )
}

function Stat({ term, value }) {
  return (
    <div>
      <dt className="metric-label">{term}</dt>
      <dd className="metric-value">{value}</dd>
    </div>
  )
}

/* ---------- 3. Field ---------- */

function FieldStep({ draft, set }) {
  const [unit, setUnit] = useState('acre')
  const crop = cropById(draft.cropId)
  const shownArea = unit === 'acre' ? draft.areaAcres : Number((draft.areaAcres / HECTARE_ACRES).toFixed(2))
  const stage = crop && draft.sowingDate ? cropStage(crop, draft.sowingDate) : null

  return (
    <>
      <StepHeader
        title="Tell us about the field."
        body="Field size decides how many sensors and valves you need; soil and irrigation method decide how much water actually reaches the roots."
      />

      <div className="auth-row">
        <div className="field">
          <label htmlFor="area">Field area</label>
          <div className="farm-inline">
            <input
              id="area"
              type="number"
              min={0.1}
              step={0.1}
              className="input"
              value={shownArea || ''}
              onChange={(e) => {
                const v = Number(e.target.value)
                set({ areaAcres: unit === 'acre' ? v : Number((v * HECTARE_ACRES).toFixed(2)) })
              }}
            />
            <div className="range-tabs" role="group" aria-label="Area unit">
              {['acre', 'hectare'].map((u) => (
                <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>
                  {u === 'acre' ? 'Acres' : 'Hectares'}
                </button>
              ))}
            </div>
          </div>
          <span className="auth-helper farm-helper">1 hectare = 2.47 acres</span>
        </div>

        <div className="field">
          <label htmlFor="sowing">{crop?.perennial ? 'Planted / last pruned on' : 'Sowing / transplanting date'}</label>
          <input
            id="sowing"
            type="date"
            className="input"
            value={draft.sowingDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => set({ sowingDate: e.target.value })}
          />
          {stage ? (
            <span className="auth-helper farm-helper">
              Day {stage.day} - {stage.stage.toLowerCase()} stage
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="soil">Soil type</label>
          <select id="soil" className="select" value={draft.soilId} onChange={(e) => set({ soilId: e.target.value })}>
            {SOILS.map((s) => (
              <option key={s.id} value={s.id}>{s.name} - {s.hint}</option>
            ))}
          </select>
          <span className="auth-helper farm-helper">Pre-selected from your district. Change it if your Soil Health Card says otherwise.</span>
        </div>

        <div className="field">
          <label htmlFor="pump">Pump</label>
          <select id="pump" className="select" value={draft.pumpLpm} onChange={(e) => set({ pumpLpm: Number(e.target.value) })}>
            {PUMPS.map((p) => (
              <option key={p.hp} value={p.lpm}>{p.hp} HP - about {p.lpm} litres/min</option>
            ))}
          </select>
          <span className="auth-helper farm-helper">Used to turn litres into pump run time.</span>
        </div>
      </div>

      <fieldset className="farm-fieldset">
        <legend className="metric-label">Irrigation method</legend>
        <div className="farm-method-grid">
          {Object.keys(IRRIGATION).map((m) => (
            <button key={m} type="button" className="farm-option" aria-pressed={draft.irrigation === m} onClick={() => set({ irrigation: m })}>
              <span className="farm-option-title">{IRRIGATION[m].name}</span>
              <span className="farm-option-local">{IRRIGATION[m].hint}</span>
            </button>
          ))}
        </div>
        {crop?.ponded && draft.irrigation !== 'flood' ? (
          <p className="status status-warning farm-note">Paddy is normally grown ponded - flood irrigation is recommended.</p>
        ) : null}
      </fieldset>
    </>
  )
}

/* ---------- 4. Sensors ---------- */

const PRIORITY_TONE = { Essential: 'good', Recommended: 'info', Optional: 'muted' }

function SensorStep({ draft }) {
  const items = recommendSensors(draft)
  const budget = sensorBudget(items)
  const crop = cropById(draft.cropId)
  const method = IRRIGATION[draft.irrigation]
  const zones = Math.max(1, Math.ceil(draft.areaAcres / method.acresPerZone))

  return (
    <>
      <StepHeader
        title={`Sensors for your ${draft.areaAcres} acre ${crop?.name ?? ''} field.`}
        body={`We split the field into ${zones} ${method.name.toLowerCase()} zone${zones > 1 ? 's' : ''} of about ${method.acresPerZone} acre${method.acresPerZone > 1 ? 's' : ''} each. Every zone gets its own moisture reading and valve.`}
      />

      <div className="farm-budget">
        <div className="farm-panel">
          <div className="metric-label">Essential kit</div>
          <div className="farm-figure">{formatInr(budget.essential)}</div>
        </div>
        <div className="farm-panel">
          <div className="metric-label">Full recommended kit</div>
          <div className="farm-figure">{formatInr(budget.full)}</div>
        </div>
      </div>

      <ul className="farm-sensor-list" aria-label="Recommended sensors">
        {items.map((item) => (
          <li key={item.id} data-sensor={item.id} className="farm-panel">
            <div className="farm-sensor-head">
              <span className="farm-option-title">{item.name}</span>
              <span className={`farm-pill farm-pill-${PRIORITY_TONE[item.priority]}`}>{item.priority}</span>
              <span className="mono farm-sensor-qty">
                {item.quantity} × {formatInr(item.unitPrice)}
              </span>
            </div>
            <p><strong>Measures:</strong> {item.measures}</p>
            <p className="muted">{item.why}</p>
            <p className="muted"><strong>Placement:</strong> {item.placement}</p>
          </li>
        ))}
      </ul>

      <p className="farm-callout">
        Prices are indicative Indian market rates. Drip and sprinkler hardware may qualify for the PMKSY
        &ldquo;Per Drop More Crop&rdquo; subsidy (up to 55% for small and marginal farmers) - check with your
        district agriculture office.
      </p>
    </>
  )
}

/* ---------- 5. Automate ---------- */

function AutomateStep({ draft }) {
  const model = fieldModel(draft)
  const district = districtOf(draft)
  if (!model || !district) return <p className="muted">Complete the earlier steps first.</p>
  const today = normalsWeek(district)[0]
  const plan = planDay(draft, model, today)

  return (
    <>
      <StepHeader
        title="Your automation is ready."
        body="Here is what the assistant will do today. Start it and it runs every day on its own, adjusting to temperature and rain."
      />

      <dl className="farm-panel farm-stats farm-stats-3">
        <Stat term="Crop" value={model.crop.name} />
        <Stat term="Stage" value={`${model.stage.stage} (Kc ${model.stage.kc.toFixed(2)})`} />
        <Stat term="Location" value={`${draft.district}, ${draft.state}`} />
        <Stat term="Today" value={`${today.tmin.toFixed(0)}-${today.tmax.toFixed(0)} °C, ${plan.band}`} />
        <Stat term="Crop water use" value={`${plan.etc.toFixed(1)} mm/day`} />
        <Stat term="Water to give" value={plan.skipped ? 'None' : formatLitres(plan.litres)} />
      </dl>

      <h3 className="farm-subhead">Today&apos;s irrigation plan</h3>
      {plan.skipped ? (
        <p className="farm-panel">Skip today - {plan.skipped}.</p>
      ) : (
        <ul className="farm-pulses">
          {plan.pulses.map((p) => (
            <li key={p.start} className="farm-panel">
              <span className="mono farm-pulse-time">{formatHour(p.start)}</span>
              <span>{formatLitres(p.litres)}</span>
              <span className="muted">pump {formatMinutes(p.minutes)}</span>
              <span className="muted farm-pulse-reason">{p.reason}</span>
            </li>
          ))}
        </ul>
      )}
      {plan.advisories.map((a) => (
        <p key={a} className="status status-warning farm-note">{a}</p>
      ))}
    </>
  )
}
