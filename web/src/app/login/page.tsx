'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeSlash, Gauge, Leaf, Plant, Robot, ShieldCheck, SignIn, UserPlus } from '@phosphor-icons/react'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n/react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

// Single-farm demo, so a self-serve signup does not ask for an id a new user cannot know.
const FARM_ID = 'FARM-001'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const router = useRouter()
  const { session, ready } = useSession()
  const { t } = useI18n()

  useEffect(() => {
    if (ready && session) router.replace('/')
  }, [ready, session, router])

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-56 h-[620px] w-[620px] rounded-full bg-brand/30 blur-[90px]" />
        <div className="absolute -bottom-60 -right-40 h-[560px] w-[560px] rounded-full bg-brand/20 blur-[90px]" />
      </div>

      <LanguageSwitcher className="absolute end-4 top-4 z-20" />

      <div className="relative z-10 grid w-full max-w-[860px] overflow-hidden rounded-3xl shadow-xl md:grid-cols-[minmax(0,440px)_minmax(0,380px)]">
        <section className="glass p-8 sm:p-10">
          <div className="mb-7 flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-brand text-white">
              <Plant size={18} />
            </span>
            <div>
              <div className="text-[15px] font-semibold leading-tight">{t('app.name')}</div>
              <div className="text-[11px] text-muted-foreground">{t('app.tagline')}</div>
            </div>
          </div>

          {mode === 'signin' ? (
            <SignInForm onCreateAccount={() => setMode('signup')} />
          ) : (
            <SignUpForm onSignIn={() => setMode('signin')} />
          )}
        </section>

        <aside
          aria-hidden
          className="hidden flex-col justify-center gap-7 bg-[linear-gradient(165deg,#2f6b3c,#1f4527)] p-10 text-white md:flex"
        >
          <span className="grid size-13 place-items-center rounded-2xl border border-white/30 bg-white/15">
            <Leaf size={26} />
          </span>
          <h2 className="text-[19px] font-semibold leading-snug tracking-tight">
            {t('login.visualWeb')}
          </h2>
          <div className="grid gap-4">
            <Feature
              icon={<Gauge size={18} />}
              title={t('login.f1')}
              body={t('login.f1Body')}
            />
            <Feature
              icon={<Leaf size={18} />}
              title={t('login.f2')}
              body={t('login.f2Body')}
            />
            <Feature
              icon={<ShieldCheck size={18} />}
              title={t('login.f3')}
              body={t('login.f3Body')}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 flex-none place-items-center rounded-[10px] bg-white/15">{icon}</span>
      <div>
        <div className="text-[13px] font-semibold">{title}</div>
        {/* 90% white keeps AA against the lighter end of the gradient. */}
        <div className="mt-0.5 text-xs leading-relaxed text-white/90">{body}</div>
      </div>
    </div>
  )
}

const inputClass =
  'min-h-10 w-full rounded-lg border border-input bg-surface px-3 outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-ring'
const labelClass = 'text-xs font-medium text-muted-foreground'
const primaryButton =
  'inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-brand-hover active:translate-y-px disabled:opacity-55'

function SignInForm({ onCreateAccount }: { onCreateAccount: () => void }) {
  const { signIn, signInDemo } = useSession()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (!email.trim()) errors.email = t('login.errEmail')
    if (!password) errors.password = t('login.errPassword')
    setFieldErrors(errors)
    setAuthError('')
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (error) {
      const err = error as { status?: number; message?: string }
      setAuthError(err.status === 401 ? t('login.incorrect') : err.message || t('login.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* A first-time visitor is told to create an account before trying to sign in. */}
      <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-brand/30 bg-brand/10 px-3.5 py-3">
        <p className="text-[13px]">{t('login.newTo')}</p>
        <button
          type="button"
          onClick={onCreateAccount}
          className="ml-auto inline-flex flex-none items-center gap-1 px-1 py-1.5 text-[13px] font-semibold text-brand hover:underline dark:text-[#7cc48a]"
        >
          {t('login.createAccount')}
          <ArrowRight size={14} className="rtl:rotate-180" />
        </button>
      </div>

      <h1 className="mb-1.5 text-[22px] font-semibold tracking-tight">{t('login.welcome')}</h1>
      <p className="mb-6 text-[13px] text-muted-foreground">{t('login.sub')}</p>

      <form onSubmit={submit} noValidate className="grid gap-3.5">
        {authError ? (
          <div role="alert" className="rounded-lg border border-status-critical bg-status-critical/10 px-3 py-2.5 text-[13px] text-status-critical">
            {authError}
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <label htmlFor="email" className={labelClass}>{t('login.email')}</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email ? <span className="text-xs text-status-critical">{fieldErrors.email}</span> : null}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="password" className={labelClass}>{t('login.password')}</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`${inputClass} pr-16`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 min-h-8 -translate-y-1/2 px-2 text-xs text-muted-foreground"
            >
              {showPassword ? t('login.hide') : t('login.show')}
            </button>
          </div>
          {fieldErrors.password ? <span className="text-xs text-status-critical">{fieldErrors.password}</span> : null}
        </div>

        <button type="submit" className={primaryButton} disabled={submitting}>
          <SignIn size={16} />
          {submitting ? t('login.signingIn') : t('login.signIn')}
        </button>
      </form>

      <div className="mt-5 rounded-lg border border-border bg-surface p-3.5">
        <p className="text-[13px] font-semibold">{t('login.demoTitle')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('login.demoBody')}</p>
        <button type="button" onClick={signInDemo} className={`${primaryButton} mt-3`} data-testid="demo-login">
          <Robot size={16} />
          {t('login.demoButton')}
        </button>
      </div>

      <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        <p className="mb-2 font-semibold text-foreground">{t('login.demoAccounts')}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="font-medium">{t('role.ADMIN')}</dt>
          <dd className="font-mono text-[11px]">admin@agritech.io / admin1234</dd>
          <dt className="font-medium">{t('role.FARMER')}</dt>
          <dd className="font-mono text-[11px]">farmer@agritech.io / farmer1234</dd>
        </dl>
      </div>
    </>
  )
}

function SignUpForm({ onSignIn }: { onSignIn: () => void }) {
  const { signUp } = useSession()
  const { t } = useI18n()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'FARMER',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (!form.firstName.trim()) errors.firstName = t('signup.required')
    if (!form.email.trim()) errors.email = t('login.errEmail')
    if (form.password.length < 8) errors.password = t('signup.min8')
    if (form.confirmPassword !== form.password) errors.confirmPassword = t('signup.mismatch')
    setFieldErrors(errors)
    setAuthError('')
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      await signUp({
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        farmId: FARM_ID,
        displayName: `${form.firstName} ${form.lastName}`.trim(),
      })
    } catch (error) {
      const err = error as { status?: number; message?: string }
      setAuthError(
        err.status === 409
          ? t('signup.exists')
          : err.message || t('signup.failed'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <p className="mb-5 text-[13px] text-muted-foreground">
        {t('signup.have')}{' '}
        <button type="button" onClick={onSignIn} className="font-medium text-brand hover:underline dark:text-[#7cc48a]">
          {t('login.signIn')}
        </button>
      </p>

      <h1 className="mb-1.5 text-[22px] font-semibold tracking-tight">{t('signup.title')}</h1>
      <p className="mb-6 text-[13px] text-muted-foreground">{t('signup.sub')}</p>

      <form onSubmit={submit} noValidate className="grid gap-3.5">
        {authError ? (
          <div role="alert" className="rounded-lg border border-status-critical bg-status-critical/10 px-3 py-2.5 text-[13px] text-status-critical">
            {authError}
          </div>
        ) : null}

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="firstName" className={labelClass}>{t('signup.first')}</label>
            <input id="firstName" className={inputClass} autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
            {fieldErrors.firstName ? <span className="text-xs text-status-critical">{fieldErrors.firstName}</span> : null}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="lastName" className={labelClass}>{t('signup.last')}</label>
            <input id="lastName" className={inputClass} autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="signupEmail" className={labelClass}>{t('signup.email')}</label>
          <input id="signupEmail" type="email" className={inputClass} autoComplete="username" value={form.email} onChange={set('email')} />
          {fieldErrors.email ? <span className="text-xs text-status-critical">{fieldErrors.email}</span> : null}
        </div>

        <div className="grid gap-1.5">
          <span className={labelClass} id="role-label">{t('signup.type')}</span>
          <div role="group" aria-labelledby="role-label" className="grid grid-cols-2 gap-1.5 rounded-lg border border-input p-1">
            {(['FARMER', 'ADMIN'] as const).map((role) => (
              <button
                key={role}
                type="button"
                aria-pressed={form.role === role}
                onClick={() => setForm((f) => ({ ...f, role }))}
                className={`min-h-8 rounded-md text-[13px] font-medium transition ${
                  form.role === role
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-raised'
                }`}
              >
                {t(`role.${role}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="signupPassword" className={labelClass}>{t('login.password')}</label>
            <input id="signupPassword" type={showPassword ? 'text' : 'password'} className={inputClass} autoComplete="new-password" value={form.password} onChange={set('password')} />
            {fieldErrors.password ? <span className="text-xs text-status-critical">{fieldErrors.password}</span> : null}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="confirmPassword" className={labelClass}>{t('signup.confirm')}</label>
            <input id="confirmPassword" type={showPassword ? 'text' : 'password'} className={inputClass} autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} />
            {fieldErrors.confirmPassword ? <span className="text-xs text-status-critical">{fieldErrors.confirmPassword}</span> : null}
          </div>
        </div>

        <p className="text-[11.5px] text-muted-foreground">
          {t('signup.helper')}
        </p>

        <label className="flex min-h-6 items-center gap-2 text-[13px]">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="size-4 accent-[var(--brand-accent)]" />
          {showPassword ? <EyeSlash size={14} /> : <Eye size={14} />}
          {t('signup.showPassword')}
        </label>

        <button type="submit" className={primaryButton} disabled={submitting}>
          <UserPlus size={16} />
          {submitting ? t('signup.creating') : t('login.createAccount')}
        </button>
      </form>
    </>
  )
}
