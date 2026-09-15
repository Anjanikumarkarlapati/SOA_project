import { useState } from 'react'
import {
  IconArrowRight,
  IconCrop,
  IconEye,
  IconEyeSlash,
  IconGauge,
  IconLeaf,
  IconShield,
  IconSignIn,
  IconUserPlus,
} from '../icons'
import { useSession, useTheme } from '../session'
import rollingHills from '../assets/rolling-hills.svg'

// Single-farm demo (see the seeded pilot farm in sensor-service) - a self-serve signup does not
// need to ask a new user to type an id they cannot know yet.
const FARM_ID = 'FARM-001'

export default function Login() {
  const [mode, setMode] = useState('signin')
  useTheme()

  return (
    <div className="auth-page">
      <div className="auth-blobs" aria-hidden="true" />
      <div className="auth-shell">
        <section className="auth-card">
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true">
              <IconCrop width={18} height={18} />
            </span>
            <div>
              <div className="brand-name" style={{ fontWeight: 600 }}>
                AgriTech Sensing Solutions
              </div>
              <div className="brand-sub">Operations dashboard</div>
            </div>
          </div>

          {mode === 'signin' ? (
            <SignIn onCreateAccount={() => setMode('signup')} />
          ) : (
            <SignUp onSignIn={() => setMode('signin')} />
          )}
        </section>

        <aside className="auth-visual" aria-hidden="true">
          <img className="auth-visual-photo" src={rollingHills} alt="" />
          <span className="auth-visual-mark">
            <IconLeaf width={26} height={26} />
          </span>
          <h2>Real-time visibility across every field, sensor, and valve on the farm.</h2>
          <div className="auth-features">
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
          </div>
        </aside>
      </div>
    </div>
  )
}

function Feature({ icon, title, body }) {
  return (
    <div className="auth-feature">
      <span className="auth-feature-icon">{icon}</span>
      <div>
        <div className="auth-feature-title">{title}</div>
        <div className="auth-feature-body">{body}</div>
      </div>
    </div>
  )
}

function SignIn({ onCreateAccount }) {
  const { signIn } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

      <h1 className="auth-heading">Welcome back</h1>
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

        <p className="auth-foot">
          <a href="#forgot">Forgot password?</a>
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

      <h1 className="auth-heading">Create an account</h1>
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
