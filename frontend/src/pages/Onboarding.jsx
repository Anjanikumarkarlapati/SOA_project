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
import { useI18n } from '../i18n/react'
import LanguageSwitcher from '../i18n/LanguageSwitcher'

const STEPS = [
  { key: 'crop', Icon: IconPlant },
  { key: 'location', Icon: IconMapPin },
  { key: 'field', Icon: IconRuler },
  { key: 'sensors', Icon: IconChip },
  { key: 'automate', Icon: IconAssistant },
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
  const { t } = useI18n()
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
        <span className="brand">{t('app.brand')}</span>
        <LanguageSwitcher />
      </header>

      <main className="farm-setup" id="main-content">
        <div className="page-head">
          <h1 className="page-title">
            {draft.farmerName ? t('ob.greeting', { name: draft.farmerName.split(' ')[0] }) : t('ob.greetingNoName')}{' '}
            {t('ob.title')}
          </h1>
          <p className="page-subtitle">{t('ob.sub')}</p>
        </div>

        <ol className="farm-steps" aria-label={t('ob.progress')}>
          {STEPS.map(({ key, Icon }, i) => (
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
                <span>{t(`ob.step.${key}`)}</span>
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
                <IconArrowLeft className="flip-rtl" />
                {t('common.back')}
              </button>
            ) : null}
            <span className="muted farm-actions-count">
              {t('ob.stepOf', { a: step + 1, b: STEPS.length })}
            </span>
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
                {t('ob.continue')}
                <IconArrowRight className="flip-rtl" />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={finish}>
                {saving ? <span className="spinner" /> : <IconAssistant width={16} height={16} />}
                {saving ? t('ob.starting') : t('ob.start')}
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
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CROPS.filter(
      (c) =>
        (group === 'All' || c.group === group) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          c.local.includes(q) ||
          c.id.includes(q) ||
          t(`crop.${c.id}`).toLowerCase().includes(q)),
    )
  }, [query, group, t])

  return (
    <>
      <StepHeader
        title={t('ob.crop.title')}
        body={t('ob.crop.body', { n: CROPS.length })}
      />

      <label className="farm-search">
        <span className="sr-only">{t('ob.crop.search')}</span>
        <IconSearch />
        <input
          className="input"
          placeholder={t('ob.crop.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="farm-chips" role="group" aria-label={t('ob.crop.group')}>
        {['All', ...CROP_GROUPS].map((g) => (
          <button key={g} type="button" className="farm-chip" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {g === 'All' ? t('ob.crop.all') : t(`group.${g}`)}
          </button>
        ))}
      </div>

      <div className="farm-crop-grid" role="radiogroup" aria-label={t('ob.step.crop')}>
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
                {t(`crop.${crop.id}`)}
                {selected ? <IconCheck className="farm-option-check" /> : null}
              </span>
              <span className="farm-option-local">{t(`crop.${crop.id}`) === crop.name ? crop.local : crop.name}</span>
              <span className="farm-tags">
                {crop.seasons.map((s) => (
                  <span key={s} className="farm-tag">{t(`season.${s}`)}</span>
                ))}
              </span>
            </button>
          )
        })}
        {shown.length === 0 ? <p className="muted farm-none">{t('ob.crop.none')}</p> : null}
      </div>
    </>
  )
}

/* ---------- 2. Location ---------- */

function LocationStep({ draft, set }) {
  const { t } = useI18n()
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
    if (!navigator.geolocation) return setGeoError(t('ob.loc.na'))
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const found = nearestDistrict(pos.coords.latitude, pos.coords.longitude)
        choose(found.state, found.district.name)
        set({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setGeoError(t('ob.loc.fail'))
        setLocating(false)
      },
      { timeout: 8000 },
    )
  }

  return (
    <>
      <StepHeader
        title={t('ob.loc.title')}
        body={t('ob.loc.body')}
      />

      <button type="button" className="btn farm-locate" onClick={locate} disabled={locating}>
        {locating ? <span className="spinner" /> : <IconLocate />}
        {locating ? t('ob.loc.finding') : t('ob.loc.use')}
      </button>
      {geoError ? <p className="field-error">{geoError}</p> : null}

      <div className="auth-row">
        <div className="field">
          <label htmlFor="state">{t('ob.loc.state')}</label>
          <select id="state" className="select" value={draft.state} onChange={(e) => choose(e.target.value, '')}>
            <option value="">{t('ob.loc.selectState')}</option>
            {STATES.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="district">{t('ob.loc.district')}</label>
          <select id="district" className="select" value={draft.district} disabled={!state} onChange={(e) => choose(draft.state, e.target.value)}>
            <option value="">{state ? t('ob.loc.selectDistrict') : t('ob.loc.stateFirst')}</option>
            {state?.districts.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {district ? (
        <div className="farm-panel">
          <div className="farm-panel-title">{t(`zone.${district.zone}`)}</div>
          <dl className="farm-stats">
            <Stat term={t('ob.loc.day')} value={`${CLIMATE[district.zone].tmax[month]} °C`} />
            <Stat term={t('ob.loc.night')} value={`${CLIMATE[district.zone].tmin[month]} °C`} />
            <Stat term={t('ob.loc.rain')} value={`${CLIMATE[district.zone].rain[month]} mm`} />
            <Stat term={t('ob.loc.coords')} value={`${draft.lat.toFixed(2)}, ${draft.lon.toFixed(2)}`} />
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
  const { t } = useI18n()
  const [unit, setUnit] = useState('acre')
  const crop = cropById(draft.cropId)
  const shownArea = unit === 'acre' ? draft.areaAcres : Number((draft.areaAcres / HECTARE_ACRES).toFixed(2))
  const stage = crop && draft.sowingDate ? cropStage(crop, draft.sowingDate) : null

  return (
    <>
      <StepHeader
        title={t('ob.field.title')}
        body={t('ob.field.body')}
      />

      <div className="auth-row">
        <div className="field">
          <label htmlFor="area">{t('ob.field.area')}</label>
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
            <div className="range-tabs" role="group" aria-label={t('ob.field.unit')}>
              {['acre', 'hectare'].map((u) => (
                <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>
                  {u === 'acre' ? t('ob.field.acres') : t('ob.field.hectares')}
                </button>
              ))}
            </div>
          </div>
          <span className="auth-helper farm-helper">{t('ob.field.hectareNote')}</span>
        </div>

        <div className="field">
          <label htmlFor="sowing">{crop?.perennial ? t('ob.field.planted') : t('ob.field.sowing')}</label>
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
              {t('ob.field.dayStage', { d: stage.day, stage: t(`stage.${stage.stage}`) })}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="soil">{t('ob.field.soil')}</label>
          <select id="soil" className="select" value={draft.soilId} onChange={(e) => set({ soilId: e.target.value })}>
            {SOILS.map((s) => (
              <option key={s.id} value={s.id}>{t(`soil.${s.id}`)} - {t(`soil.${s.id}.hint`)}</option>
            ))}
          </select>
          <span className="auth-helper farm-helper">{t('ob.field.soilNote')}</span>
        </div>

        <div className="field">
          <label htmlFor="pump">{t('ob.field.pump')}</label>
          <select id="pump" className="select" value={draft.pumpLpm} onChange={(e) => set({ pumpLpm: Number(e.target.value) })}>
            {PUMPS.map((p) => (
              <option key={p.hp} value={p.lpm}>{t('ob.field.pumpOption', { hp: p.hp, lpm: p.lpm })}</option>
            ))}
          </select>
          <span className="auth-helper farm-helper">{t('ob.field.pumpNote')}</span>
        </div>
      </div>

      <fieldset className="farm-fieldset">
        <legend className="metric-label">{t('ob.field.method')}</legend>
        <div className="farm-method-grid">
          {Object.keys(IRRIGATION).map((m) => (
            <button key={m} type="button" className="farm-option" aria-pressed={draft.irrigation === m} onClick={() => set({ irrigation: m })}>
              <span className="farm-option-title">{t(`method.${m}`)}</span>
              <span className="farm-option-local">{t(`method.${m}.hint`)}</span>
            </button>
          ))}
        </div>
        {crop?.ponded && draft.irrigation !== 'flood' ? (
          <p className="status status-warning farm-note">{t('ob.field.paddyNote')}</p>
        ) : null}
      </fieldset>
    </>
  )
}

/* ---------- 4. Sensors ---------- */

const PRIORITY_TONE = { Essential: 'good', Recommended: 'info', Optional: 'muted' }

function SensorStep({ draft }) {
  const { t, tm } = useI18n()
  const items = recommendSensors(draft)
  const budget = sensorBudget(items)
  const crop = cropById(draft.cropId)
  const method = IRRIGATION[draft.irrigation]
  const zones = Math.max(1, Math.ceil(draft.areaAcres / method.acresPerZone))

  return (
    <>
      <StepHeader
        title={t('ob.sens.title', { area: draft.areaAcres, crop: crop ? t(`crop.${crop.id}`) : '' })}
        body={t('ob.sens.body', { n: zones, method: t(`method.${draft.irrigation}`), size: method.acresPerZone })}
      />

      <div className="farm-budget">
        <div className="farm-panel">
          <div className="metric-label">{t('ob.sens.essential')}</div>
          <div className="farm-figure">{formatInr(budget.essential)}</div>
        </div>
        <div className="farm-panel">
          <div className="metric-label">{t('ob.sens.full')}</div>
          <div className="farm-figure">{formatInr(budget.full)}</div>
        </div>
      </div>

      <ul className="farm-sensor-list" aria-label={t('ob.sens.list')}>
        {items.map((item) => (
          <li key={item.id} data-sensor={item.id} className="farm-panel">
            <div className="farm-sensor-head">
              <span className="farm-option-title">{tm(item.name)}</span>
              <span className={`farm-pill farm-pill-${PRIORITY_TONE[item.priority]}`}>{t(`prio.${item.priority}`)}</span>
              <span className="mono farm-sensor-qty">
                {item.quantity} × {formatInr(item.unitPrice)}
              </span>
            </div>
            <p><strong>{t('ob.sens.measures')}</strong> {tm(item.measures)}</p>
            <p className="muted">{tm(item.why)}</p>
            <p className="muted"><strong>{t('ob.sens.placement')}</strong> {tm(item.placement)}</p>
          </li>
        ))}
      </ul>

      <p className="farm-callout">
        {t('ob.sens.subsidy')}
      </p>
    </>
  )
}

/* ---------- 5. Automate ---------- */

function AutomateStep({ draft }) {
  const { t, tm } = useI18n()
  const model = fieldModel(draft)
  const district = districtOf(draft)
  if (!model || !district) return <p className="muted">{t('ob.auto.incomplete')}</p>
  const today = normalsWeek(district)[0]
  const plan = planDay(draft, model, today)

  return (
    <>
      <StepHeader
        title={t('ob.auto.title')}
        body={t('ob.auto.body')}
      />

      <dl className="farm-panel farm-stats farm-stats-3">
        <Stat term={t('ob.auto.crop')} value={t(`crop.${model.crop.id}`)} />
        <Stat term={t('ob.auto.stage')} value={`${t(`stage.${model.stage.stage}`)} (Kc ${model.stage.kc.toFixed(2)})`} />
        <Stat term={t('ob.auto.location')} value={`${draft.district}, ${draft.state}`} />
        <Stat term={t('ob.auto.today')} value={`${today.tmin.toFixed(0)}-${today.tmax.toFixed(0)} °C, ${t(`band.${plan.band}`)}`} />
        <Stat term={t('ob.auto.use')} value={t('ob.auto.mmDay', { n: plan.etc.toFixed(1) })} />
        <Stat term={t('ob.auto.give')} value={plan.skipped ? t('ob.auto.none') : formatLitres(plan.litres)} />
      </dl>

      <h3 className="farm-subhead">{t('ob.auto.plan')}</h3>
      {plan.skipped ? (
        <p className="farm-panel">{t('ob.auto.skip', { reason: plan.skipped })}</p>
      ) : (
        <ul className="farm-pulses">
          {plan.pulses.map((p) => (
            <li key={p.start} className="farm-panel">
              <span className="mono farm-pulse-time">{formatHour(p.start)}</span>
              <span>{formatLitres(p.litres)}</span>
              <span className="muted">{t('ob.auto.pump', { t: formatMinutes(p.minutes) })}</span>
              <span className="muted farm-pulse-reason">{tm(p.reason)}</span>
            </li>
          ))}
        </ul>
      )}
      {plan.advisories.map((a) => (
        <p key={a.k} className="status status-warning farm-note">{tm(a)}</p>
      ))}
    </>
  )
}
