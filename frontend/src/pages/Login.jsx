import { useEffect, useState } from 'react'
import farmland from '../assets/farmland.jpg'
import {
  IconArrowRight,
  IconEye,
  IconEyeSlash,
  IconGauge,
  IconLeaf,
  IconShield,
  IconSignIn,
  IconUserPlus,
} from '../icons'
import { useSession, useTheme } from '../session'
import { supabaseEnabled, onSupabaseSignIn } from '../supabase'

// Single-farm demo (see the seeded pilot farm in sensor-service) - a self-serve signup does not
// need to ask a new user to type an id they cannot know yet.
const FARM_ID = 'FARM-001'

export default function Login() {
  const [mode, setMode] = useState('signin')
  useTheme()

  return (
    <div className="auth-page">
      <header className="auth-top">
        <span className="brand">AgriTech</span>
      </header>

      <div className="auth-shell">
        <section className="auth-card">
          {mode === 'signin' ? (
            <SignIn onCreateAccount={() => setMode('signup')} />
          ) : (
            <SignUp onSignIn={() => setMode('signin')} />
          )}
        </section>

        <aside className="auth-visual" aria-hidden="true">
          <div className="auth-photo" style={{ '--auth-img': `url(${farmland})` }}>
            <h2>Every field, sensor and valve on one screen.</h2>
            <ul className="auth-features">
              <Feature
                icon={<IconGauge width={18} height={18} />}
                title="Live crop health"
                body="Soil moisture, temperature and pH scored against each crop's optimal range."
              />
              <Feature
                icon={<IconLeaf width={18} height={18} />}
                title="Automated irrigation"
                body="Schedules that skip a run when the soil is already wet enough."
              />
              <Feature
                icon={<IconShield width={18} height={18} />}
                title="Role-based access"
                body="Farmers see the data; administrators control the hardware."
              />
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Feature({ icon, title, body }) {
  return (
    <li className="auth-feature">
      {icon}
      <div>
        <div className="auth-feature-title">{title}</div>
        <div className="auth-feature-body">{body}</div>
      </div>
    </li>
  )
}

function SignIn({ onCreateAccount }) {
  const { signIn, signInWithGoogle, exchangeSupabaseToken } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  // On return from the Google redirect, Supabase restores its session and hands us an access
  // token. It arrives asynchronously (in the URL hash), so we subscribe rather than poll once:
  // the first token delivered is traded for our app JWT, exactly once.
  useEffect(() => {
    if (!supabaseEnabled) return
    let exchanged = false
    const unsubscribe = onSupabaseSignIn(async (token) => {
      if (exchanged) return
      exchanged = true
      setGoogleBusy(true)
      try {
        await exchangeSupabaseToken(token)
      } catch (error) {
        exchanged = false
        setAuthError(error.message || 'Google sign-in failed')
      } finally {
        setGoogleBusy(false)
      }
    })
    return unsubscribe
  }, [exchangeSupabaseToken])

  const google = async () => {
    setAuthError('')
    setGoogleBusy(true)
    try {
      await signInWithGoogle() // redirects away; control returns via the effect above
    } catch (error) {
      setAuthError(error.message || 'Could not start Google sign-in')
      setGoogleBusy(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()

    const errors = {}
    if (!email.trim()) errors.email = 'Enter your email address'
    if (!password) errors.password = 'Enter your password'
    setFieldErrors(errors)
    setAuthError('')
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (error) {
      setAuthError(
        error.status === 401 ? 'Incorrect email or password' : error.message || 'Sign in failed',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="auth-switch-banner">
        <p>New to AgriTech Sensing Solutions?</p>
        <button type="button" onClick={onCreateAccount}>
          Create an account
          <IconArrowRight width={14} height={14} />
        </button>
      </div>

      <h1 className="auth-heading">Welcome back.</h1>
      <p className="auth-subheading">Sign in to the operations dashboard.</p>

      <form onSubmit={submit} noValidate>
        {authError ? (
          <div className="form-banner" role="alert">
            {authError}
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email ? (
            <span className="field-error" id="email-error">
              {fieldErrors.email}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="input-affix">
            <input
              id="password"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {fieldErrors.password ? (
            <span className="field-error" id="password-error">
              {fieldErrors.password}
            </span>
          ) : null}
        </div>

        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={submitting}>
          {submitting ? <span className="spinner" /> : <IconSignIn width={16} height={16} />}
          {submitting ? 'Signing in' : 'Sign in'}
        </button>

        {supabaseEnabled ? (
          <>
            <div className="auth-divider" role="separator">
              <span>or</span>
            </div>
            <button
              type="button"
              className="btn btn-block auth-google"
              onClick={google}
              disabled={googleBusy || submitting}
            >
              {googleBusy ? <span className="spinner" /> : <GoogleMark />}
              {googleBusy ? 'Connecting' : 'Continue with Google'}
            </button>
          </>
        ) : null}

        {/* Password reset is not built yet, so this says who to ask instead of dangling a link
            that goes nowhere. */}
        <p className="auth-foot">
          Lost your password? Ask your farm administrator to reset it.
        </p>
      </form>

      <div className="auth-hint">
        <p className="hint-title">Demo accounts</p>
        <dl className="hint-accounts">
          <dt>Administrator</dt>
          <dd className="mono">admin@agritech.io / admin1234</dd>
          <dt>Farmer</dt>
          <dd className="mono">farmer@agritech.io / farmer1234</dd>
        </dl>
      </div>
    </>
  )
}

function SignUp({ onSignIn }) {
  const { signUp } = useSession()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'FARMER',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (event) => {
    event.preventDefault()

    const errors = {}
    if (!form.firstName.trim()) errors.firstName = 'Required'
    if (!form.email.trim()) errors.email = 'Enter your email address'
    if (form.password.length < 8) errors.password = 'At least 8 characters'
    if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match'
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
      setAuthError(
        error.status === 409
          ? 'An account with that email already exists'
          : error.message || 'Could not create the account',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <p className="auth-subheading" style={{ marginBottom: 20 }}>
        Already have an account?{' '}
        <a
          href="#signin"
          onClick={(e) => {
            e.preventDefault()
            onSignIn()
          }}
        >
          Sign in
        </a>
      </p>

      <h1 className="auth-heading">Create your account.</h1>
      <p className="auth-subheading">Set up access to the operations dashboard.</p>

      <form onSubmit={submit} noValidate>
        {authError ? (
          <div className="form-banner" role="alert">
            {authError}
          </div>
        ) : null}

        <div className="auth-row">
          <div className="field">
            <label htmlFor="firstName">First name</label>
            <input
              id="firstName"
              className="input"
              autoComplete="given-name"
              value={form.firstName}
              onChange={set('firstName')}
              aria-invalid={Boolean(fieldErrors.firstName)}
            />
            {fieldErrors.firstName ? <span className="field-error">{fieldErrors.firstName}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="lastName">Last name</label>
            <input
              id="lastName"
              className="input"
              autoComplete="family-name"
              value={form.lastName}
              onChange={set('lastName')}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="signupEmail">Email address</label>
          <input
            id="signupEmail"
            className="input"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={set('email')}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email ? <span className="field-error">{fieldErrors.email}</span> : null}
        </div>

        <div className="field">
          <label id="role-label">Account type</label>
          <div className="auth-segment" role="group" aria-labelledby="role-label">
            <button
              type="button"
              aria-pressed={form.role === 'FARMER'}
              onClick={() => setForm((f) => ({ ...f, role: 'FARMER' }))}
            >
              Farmer
            </button>
            <button
              type="button"
              aria-pressed={form.role === 'ADMIN'}
              onClick={() => setForm((f) => ({ ...f, role: 'ADMIN' }))}
            >
              Administrator
            </button>
          </div>
        </div>

        <div className="auth-row">
          <div className="field">
            <label htmlFor="signupPassword">Password</label>
            <input
              id="signupPassword"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password ? <span className="field-error">{fieldErrors.password}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
            />
            {fieldErrors.confirmPassword ? (
              <span className="field-error">{fieldErrors.confirmPassword}</span>
            ) : null}
          </div>
        </div>

        <p className="auth-helper">Use 8 or more characters with a mix of letters and numbers.</p>

        <label className="auth-check">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />
          {showPassword ? <IconEyeSlash width={14} height={14} /> : <IconEye width={14} height={14} />}
          Show password
        </label>

        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={submitting}>
          {submitting ? <span className="spinner" /> : <IconUserPlus width={16} height={16} />}
          {submitting ? 'Creating account' : 'Create an account'}
        </button>
      </form>
    </>
  )
}


// Official Google 'G' brand mark. Decorative here - the button text names the action.
function GoogleMark() {
  return (
    <svg width={16} height={16} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}
