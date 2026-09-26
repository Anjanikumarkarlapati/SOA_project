'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Cpu,
  Crosshair,
  MagnifyingGlass,
  MapPin,
  Plant,
  Robot,
  Ruler,
} from '@phosphor-icons/react'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import {
  CLIMATE,
  CROPS,
  CROP_GROUPS,
  IRRIGATION,
  SOILS,
  STATES,
  cropById,
  nearestDistrict,
  type ClimateZone,
  type CropGroup,
  type IrrigationMethod,
  type SensorPriority,
} from '@/lib/farm/india'
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
  type FarmProfile,
} from '@/lib/farm/engine'
import { isDemoSession } from '@/lib/farm/demo'
import { useI18n } from '@/lib/i18n/react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

const STEPS = [
  { key: 'crop', Icon: Plant },
  { key: 'location', Icon: MapPin },
  { key: 'field', Icon: Ruler },
  { key: 'sensors', Icon: Cpu },
  { key: 'automate', Icon: Robot },
] as const

/** The soil a zone mostly has, so the field step starts from a sensible guess. */
const ZONE_SOIL: Record<ClimateZone, string> = {
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

const control =
  'min-h-10 w-full rounded-lg border border-input bg-surface px-3 outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-ring'
const label = 'text-xs font-medium text-muted-foreground'
const primaryBtn =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-brand-hover active:translate-y-px disabled:opacity-55'
const plainBtn =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-hairline-strong bg-surface px-4 text-[13px] font-medium transition hover:bg-raised active:translate-y-px'

const isoDaysAgo = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function Onboarding() {
  const router = useRouter()
  const { session, ready, token } = useSession()
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [draft, setDraft] = useState<FarmProfile>({
    farmerName: '',
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
  const set = (patch: Partial<FarmProfile>) => setDraft((d) => ({ ...d, ...patch }))

  useEffect(() => {
    if (ready && !session) router.replace('/login')
  }, [ready, session, router])

  const farmerName = draft.farmerName || session?.displayName || ''

  const canNext = [
    Boolean(draft.cropId),
    Boolean(draft.state && draft.district),
    draft.areaAcres > 0 && draft.pumpLpm > 0 && Boolean(draft.sowingDate),
    true,
    true,
  ][step]

  const finish = async () => {
    if (!session) return
    setSaving(true)
    const profile: FarmProfile = { ...draft, farmerName, createdAt: new Date().toISOString() }
    // Register the field with the crop service too, so the operations screens see it. Best
    // effort: in the offline demo there is no backend and the assistant runs on its own.
    if (token && !isDemoSession(session)) {
      try {
        const crop = cropById(draft.cropId)!
        const created = await api.createCrop(token, {
          name: `${farmerName || 'My'} - ${crop.name} (${draft.district})`,
          cropType: crop.id,
          areaHectares: Number((draft.areaAcres / HECTARE_ACRES).toFixed(2)),
        })
        profile.backendCropId = created.cropId
      } catch {
        // The assistant does not depend on it.
      }
    }
    saveProfile(session.email, profile)
    router.replace('/assistant')
  }

  if (!ready || !session) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">{t('common.loading')}</div>
  }

  return (
    <div className="relative min-h-dvh bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-56 h-[620px] w-[620px] rounded-full bg-brand/20 blur-[90px]" />
        <div className="absolute -bottom-60 -right-40 h-[560px] w-[560px] rounded-full bg-brand/15 blur-[90px]" />
      </div>

      <main id="main" className="relative z-10 mx-auto w-full max-w-[920px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-brand text-white">
            <Plant size={20} />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight tracking-tight">
              {farmerName ? t('ob.greeting', { name: farmerName.split(' ')[0] }) : t('ob.greetingNoName')}{' '}
              {t('ob.title')}
            </h1>
            <p className="text-xs text-muted-foreground">{t('ob.sub')}</p>
          </div>
          <LanguageSwitcher className="ms-auto" />
        </div>

        <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label={t('ob.progress')}>
          {STEPS.map(({ key, Icon }, i) => (
            <li key={key}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                className={`flex w-full flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition sm:flex-row sm:justify-center sm:gap-2 sm:text-[13px] ${
                  i === step
                    ? 'border-brand bg-brand-wash text-brand'
                    : i < step
                      ? 'border-border bg-surface text-foreground hover:bg-raised'
                      : 'border-border bg-surface/60 text-muted-foreground'
                }`}
              >
                {i < step ? <CheckCircle size={16} weight="fill" className="text-status-good" /> : <Icon size={16} />}
                {t(`ob.step.${key}`)}
              </button>
            </li>
          ))}
        </ol>

        <section className="glass rounded-2xl p-5 sm:p-7">
          {step === 0 ? <CropStep draft={draft} set={set} /> : null}
          {step === 1 ? <LocationStep draft={draft} set={set} /> : null}
          {step === 2 ? <FieldStep draft={draft} set={set} /> : null}
          {step === 3 ? <SensorStep draft={draft} /> : null}
          {step === 4 ? <AutomateStep draft={draft} /> : null}

          <div className="mt-7 flex items-center gap-2 border-t border-border pt-5">
            {step > 0 ? (
              <button type="button" className={plainBtn} onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} className="rtl:rotate-180" />
                {t('common.back')}
              </button>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              {t('ob.stepOf', { a: step + 1, b: STEPS.length })}
            </span>
            {step < STEPS.length - 1 ? (
              <button type="button" className={primaryBtn} disabled={!canNext} onClick={() => setStep(step + 1)}>
                {t('ob.continue')}
                <ArrowRight size={16} className="rtl:rotate-180" />
              </button>
            ) : (
              <button type="button" className={primaryBtn} disabled={saving} onClick={finish}>
                <Robot size={16} />
                {saving ? t('ob.starting') : t('ob.start')}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

type StepProps = { draft: FarmProfile; set: (patch: Partial<FarmProfile>) => void }

function StepHeader({ title, body }: { title: string; body: string }) {
  return (
    <header className="mb-5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{body}</p>
    </header>
  )
}

/* ---------- 1. Crop ---------- */

function CropStep({ draft, set }: StepProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<CropGroup | 'All'>('All')

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

      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="relative">
          <span className="sr-only">{t('ob.crop.search')}</span>
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${control} pl-9`}
            placeholder={t('ob.crop.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t('ob.crop.group')}>
        {(['All', ...CROP_GROUPS] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
            className={`min-h-8 rounded-full border px-3 text-xs font-medium transition ${
              group === g ? 'border-brand bg-primary text-primary-foreground' : 'border-border bg-surface hover:bg-raised'
            }`}
          >
            {g === 'All' ? t('ob.crop.all') : t(`group.${g}`)}
          </button>
        ))}
      </div>

      <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label={t('ob.step.crop')}>
        {shown.map((crop) => {
          const selected = draft.cropId === crop.id
          return (
            <button
              key={crop.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-crop={crop.id}
              onClick={() => set({ cropId: crop.id, irrigation: crop.ponded ? 'flood' : draft.irrigation })}
              className={`rounded-xl border p-3 text-left transition ${
                selected ? 'border-brand bg-brand-wash ring-2 ring-brand/30' : 'border-border bg-surface hover:bg-raised'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-[13px] font-semibold leading-snug">{t(`crop.${crop.id}`)}</span>
                {selected ? <CheckCircle size={16} weight="fill" className="flex-none text-brand" /> : null}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t(`crop.${crop.id}`) === crop.name ? crop.local : crop.name}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {crop.seasons.map((s) => (
                  <span key={s} className="rounded bg-raised px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {t(`season.${s}`)}
                  </span>
                ))}
              </div>
            </button>
          )
        })}
        {shown.length === 0 ? <p className="col-span-full p-6 text-center text-sm text-muted-foreground">{t('ob.crop.none')}</p> : null}
      </div>
    </>
  )
}

/* ---------- 2. Location ---------- */

function LocationStep({ draft, set }: StepProps) {
  const { t } = useI18n()
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')
  const state = STATES.find((s) => s.name === draft.state)
  const district = districtOf(draft)
  const month = new Date().getMonth()

  const choose = (stateName: string, districtName: string) => {
    const dist = STATES.find((s) => s.name === stateName)?.districts.find((dd) => dd.name === districtName)
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

      <button type="button" className={`${plainBtn} mb-4`} onClick={locate} disabled={locating}>
        <Crosshair size={16} />
        {locating ? t('ob.loc.finding') : t('ob.loc.use')}
      </button>
      {geoError ? <p className="mb-3 text-xs text-status-warning">{geoError}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="state" className={label}>{t('ob.loc.state')}</label>
          <select id="state" className={control} value={draft.state} onChange={(e) => choose(e.target.value, '')}>
            <option value="">{t('ob.loc.selectState')}</option>
            {STATES.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="district" className={label}>{t('ob.loc.district')}</label>
          <select
            id="district"
            className={control}
            value={draft.district}
            disabled={!state}
            onChange={(e) => choose(draft.state, e.target.value)}
          >
            <option value="">{state ? t('ob.loc.selectDistrict') : t('ob.loc.stateFirst')}</option>
            {state?.districts.map((dd) => (
              <option key={dd.name} value={dd.name}>{dd.name}</option>
            ))}
          </select>
        </div>
      </div>

      {district ? (
        <div className="mt-5 rounded-xl border border-border bg-surface p-4">
          <div className="text-[13px] font-semibold">{t(`zone.${district.zone}`)}</div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
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

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 font-mono text-[15px] font-semibold tabular">{value}</dd>
    </div>
  )
}

/* ---------- 3. Field ---------- */

function FieldStep({ draft, set }: StepProps) {
  const { t } = useI18n()
  const [unit, setUnit] = useState<'acre' | 'hectare'>('acre')
  const crop = cropById(draft.cropId)
  const shownArea = unit === 'acre' ? draft.areaAcres : Number((draft.areaAcres / HECTARE_ACRES).toFixed(2))

  return (
    <>
      <StepHeader
        title={t('ob.field.title')}
        body={t('ob.field.body')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="area" className={label}>{t('ob.field.area')}</label>
          <div className="flex gap-1.5">
            <input
              id="area"
              type="number"
              min={0.1}
              step={0.1}
              className={control}
              value={shownArea || ''}
              onChange={(e) => {
                const v = Number(e.target.value)
                set({ areaAcres: unit === 'acre' ? v : Number((v * HECTARE_ACRES).toFixed(2)) })
              }}
            />
            <div className="flex flex-none rounded-lg border border-input p-0.5" role="group" aria-label={t('ob.field.unit')}>
              {(['acre', 'hectare'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  onClick={() => setUnit(u)}
                  className={`rounded-md px-2.5 text-xs font-medium ${unit === u ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  {u === 'acre' ? t('ob.field.acres') : t('ob.field.hectares')}
                </button>
              ))}
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">{t('ob.field.hectareNote')}</span>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="sowing" className={label}>{crop?.perennial ? t('ob.field.planted') : t('ob.field.sowing')}</label>
          <input id="sowing" type="date" className={control} value={draft.sowingDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ sowingDate: e.target.value })} />
          {crop && draft.sowingDate ? (
            <span className="text-[11px] text-muted-foreground">
              {t('ob.field.dayStage', {
                d: cropStage(crop, draft.sowingDate).day,
                stage: t(`stage.${cropStage(crop, draft.sowingDate).stage}`),
              })}
            </span>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="soil" className={label}>{t('ob.field.soil')}</label>
          <select id="soil" className={control} value={draft.soilId} onChange={(e) => set({ soilId: e.target.value })}>
            {SOILS.map((s) => (
              <option key={s.id} value={s.id}>{t(`soil.${s.id}`)} - {t(`soil.${s.id}.hint`)}</option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">{t('ob.field.soilNote')}</span>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="pump" className={label}>{t('ob.field.pump')}</label>
          <select
            id="pump"
            className={control}
            value={PUMPS.find((p) => p.lpm === draft.pumpLpm)?.lpm ?? ''}
            onChange={(e) => set({ pumpLpm: Number(e.target.value) })}
          >
            {PUMPS.map((p) => (
              <option key={p.hp} value={p.lpm}>{t('ob.field.pumpOption', { hp: p.hp, lpm: p.lpm })}</option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">{t('ob.field.pumpNote')}</span>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className={`${label} mb-1.5`}>{t('ob.field.method')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(IRRIGATION) as IrrigationMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={draft.irrigation === m}
              onClick={() => set({ irrigation: m })}
              className={`rounded-xl border p-3 text-left transition ${
                draft.irrigation === m ? 'border-brand bg-brand-wash ring-2 ring-brand/30' : 'border-border bg-surface hover:bg-raised'
              }`}
            >
              <div className="text-[13px] font-semibold">{t(`method.${m}`)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t(`method.${m}.hint`)}</div>
            </button>
          ))}
        </div>
        {crop?.ponded && draft.irrigation !== 'flood' ? (
          <p className="mt-2 text-xs text-status-warning">{t('ob.field.paddyNote')}</p>
        ) : null}
      </fieldset>
    </>
  )
}

/* ---------- 4. Sensors ---------- */

const PRIORITY_TONE: Record<SensorPriority, string> = {
  Essential: 'bg-status-good/12 text-status-good',
  Recommended: 'bg-status-info/12 text-status-info',
  Optional: 'bg-raised text-muted-foreground',
}

function SensorStep({ draft }: { draft: FarmProfile }) {
  const { t, tm } = useI18n()
  const items = recommendSensors(draft)
  const budget = sensorBudget(items)
  const crop = cropById(draft.cropId)
  const zones = Math.max(1, Math.ceil(draft.areaAcres / IRRIGATION[draft.irrigation].acresPerZone))

  return (
    <>
      <StepHeader
        title={t('ob.sens.title', { area: draft.areaAcres, crop: crop ? t(`crop.${crop.id}`) : '' })}
        body={t('ob.sens.body', {
          n: zones,
          method: t(`method.${draft.irrigation}`),
          size: IRRIGATION[draft.irrigation].acresPerZone,
        })}
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="text-xs text-muted-foreground">{t('ob.sens.essential')}</div>
          <div className="font-mono text-xl font-bold tabular">{formatInr(budget.essential)}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="text-xs text-muted-foreground">{t('ob.sens.full')}</div>
          <div className="font-mono text-xl font-bold tabular">{formatInr(budget.full)}</div>
        </div>
      </div>

      <ul className="grid gap-2" aria-label={t('ob.sens.list')}>
        {items.map((item) => (
          <li key={item.id} data-sensor={item.id} className="rounded-xl border border-border bg-surface p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold">{tm(item.name)}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_TONE[item.priority]}`}>{t(`prio.${item.priority}`)}</span>
              <span className="ml-auto font-mono text-[13px] tabular">
                {item.quantity} × {formatInr(item.unitPrice)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t('ob.sens.measures')}</span> {tm(item.measures)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{tm(item.why)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t('ob.sens.placement')}</span> {tm(item.placement)}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-lg border border-brand/30 bg-brand/10 px-3.5 py-3 text-xs">
        {t('ob.sens.subsidy')}
      </p>
    </>
  )
}

/* ---------- 5. Automate ---------- */

function AutomateStep({ draft }: { draft: FarmProfile }) {
  const { t, tm } = useI18n()
  const model = fieldModel(draft)
  const district = districtOf(draft)
  if (!model || !district) return <p className="text-sm text-muted-foreground">{t('ob.auto.incomplete')}</p>
  const today = normalsWeek(district)[0]
  const plan = planDay(draft, model, today)

  return (
    <>
      <StepHeader
        title={t('ob.auto.title')}
        body={t('ob.auto.body')}
      />

      <dl className="grid gap-3 rounded-xl border border-border bg-surface p-4 text-xs sm:grid-cols-3">
        <Stat term={t('ob.auto.crop')} value={t(`crop.${model.crop.id}`)} />
        <Stat term={t('ob.auto.stage')} value={`${t(`stage.${model.stage.stage}`)} (Kc ${model.stage.kc.toFixed(2)})`} />
        <Stat term={t('ob.auto.location')} value={`${draft.district}, ${draft.state}`} />
        <Stat term={t('ob.auto.today')} value={`${today.tmin.toFixed(0)}-${today.tmax.toFixed(0)} °C, ${t(`band.${plan.band}`)}`} />
        <Stat term={t('ob.auto.use')} value={t('ob.auto.mmDay', { n: plan.etc.toFixed(1) })} />
        <Stat term={t('ob.auto.give')} value={plan.skipped ? t('ob.auto.none') : formatLitres(plan.litres)} />
      </dl>

      <h3 className="mb-2 mt-5 text-[13px] font-semibold">{t('ob.auto.plan')}</h3>
      {plan.skipped ? (
        <p className="rounded-lg border border-border bg-surface p-3 text-[13px]">{t('ob.auto.skip', { reason: plan.skipped })}</p>
      ) : (
        <ul className="grid gap-2">
          {plan.pulses.map((p) => (
            <li key={p.start} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3 text-[13px]">
              <span className="font-mono font-semibold tabular">{formatHour(p.start)}</span>
              <span>{formatLitres(p.litres)}</span>
              <span className="text-muted-foreground">{t('ob.auto.pump', { t: formatMinutes(p.minutes) })}</span>
              <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">{tm(p.reason)}</span>
            </li>
          ))}
        </ul>
      )}
      {plan.advisories.length ? (
        <ul className="mt-3 grid gap-1.5">
          {plan.advisories.map((a) => (
            <li key={a.k} className="text-xs text-status-warning">{tm(a)}</li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
