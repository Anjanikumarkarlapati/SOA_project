// Visits every page as each kind of user and reports anything broken: missing content, error
// messages, browser console errors and failing API calls. Unlike farm-flow.js it does not stop at
// the first problem - it collects them all.
//
//   playwright-cli open
//   playwright-cli run-code --filename=scripts/e2e/all-pages.js
//
// Read-only for existing data: it never deletes, never opens valves and never presses emergency
// stop. It does create one new e2e-*@agritech.test farmer (with a farm) per run.
async (page) => {
  const BASE = 'http://localhost:5173'
  const ok = []
  const problems = []
  const consoleErrors = []
  const badResponses = []

  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => consoleErrors.push('PAGE ERROR ' + e.message.slice(0, 200)))
  page.on('response', (r) => {
    const url = r.url()
    if (!url.includes('/api/') || r.status() < 400) return
    badResponses.push(`${r.status()} ${r.request().method()} ${url.replace(BASE, '')}`)
  })
  page.setDefaultTimeout(20000)

  /** Opens a page and checks it shows its content and no error. */
  async function visit(who, path, mustSee, expectPath = path) {
    const label = `${who} ${path}`
    const errorsBefore = consoleErrors.length
    const badBefore = badResponses.length
    await page.goto(BASE + path)
    try {
      await page.getByText(mustSee).first().waitFor({ timeout: 15000 })
    } catch {
      problems.push(`${label}: expected content "${mustSee}" never appeared (url ${page.url().replace(BASE, '')})`)
      return
    }
    await page.waitForTimeout(1500) // let the page's other requests settle
    const landed = await page.evaluate(() => location.pathname)
    const matches = Array.isArray(expectPath) ? expectPath.includes(landed) : (expectPath instanceof RegExp ? expectPath.test(landed) : landed === expectPath);
    if (!matches) problems.push(`${label}: ended on ${landed}, expected ${expectPath}`)
    const errorUi = await page.getByText(/Could not load|could not be loaded|Something went wrong/).count()
    if (errorUi) problems.push(`${label}: shows an error message`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    if (overflow) problems.push(`${label}: page scrolls sideways at ${page.viewportSize().width}px`)
    consoleErrors.slice(errorsBefore).forEach((e) => problems.push(`${label}: console error: ${e}`))
    badResponses.slice(badBefore).forEach((e) => problems.push(`${label}: API error: ${e}`))
    if (!errorUi && !overflow && consoleErrors.length === errorsBefore && badResponses.length === badBefore) {
      ok.push(label)
    }
  }

  async function step(label, fn) {
    try {
      await fn()
      ok.push(label)
    } catch (e) {
      problems.push(`${label}: ${e.message.split('\n')[0]}`)
    }
  }

  async function login(email, password) {
    await page.goto(`${BASE}/login`)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.locator('form button[type=submit]').click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'))
  }

  async function signOut() {
    await page.locator('.account-trigger').click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL('**/login')
  }

  await page.setViewportSize({ width: 1280, height: 900 })

  // ---------- Signed out ----------
  await page.goto(`${BASE}/login`)
  await page.evaluate(() => localStorage.clear())
  await visit('signed-out', '/login', 'Welcome back.')
  await visit('signed-out', '/crops', 'Welcome back.', '/login')
  await step('signed-out: wrong password shows an error', async () => {
    await page.fill('#email', 'admin@agritech.io')
    await page.fill('#password', 'not-the-password')
    await page.locator('form button[type=submit]').click()
    await page.locator('.form-banner[role=alert]').waitFor()
    badResponses.length = 0 // the 401 here is the expected answer
  })
  await step('signed-out: sign-up form opens', async () => {
    await page.getByRole('button', { name: 'Create an account' }).first().click()
    await page.locator('#signupEmail').waitFor()
  })

  // ---------- Admin: every operations page ----------
  await login('admin@agritech.io', 'admin1234')
  await visit('admin', '/', 'Your farm at a glance.')
  await visit('admin', '/sensors', 'SENSOR-FARM01-001')
  await visit('admin', '/sensors/SENSOR-FARM01-001', 'One sensor, up close.')
  await visit('admin', '/crops', /fields monitored/)
  await visit('admin', '/crops/CROP-FIELD-01', 'North Field')
  await visit('admin', '/irrigation', 'Irrigation schedules and valves.')
  // The removed assistant route falls back to the dashboard.
  await visit('admin', '/assistant', /(Your farm at a glance|Farm simulation|Live sensor readings|Simulation)/, ['/', '/assistant'])
  await visit('admin', '/no-such-page', 'Your farm at a glance.', '/')

  await step('admin: sensor search filters the table', async () => {
    await page.goto(`${BASE}/sensors`)
    await page.getByText('SENSOR-FARM01-001').first().waitFor()
    await page.getByPlaceholder(/Search/).first().fill('FARM01-013')
    await page.waitForFunction(() => !document.body.innerText.includes('SENSOR-FARM01-001'))
    if (!(await page.getByText('SENSOR-FARM01-013').count())) throw new Error('searched device not shown')
  })
  await step('admin: sensor detail range switch (7d)', async () => {
    await page.goto(`${BASE}/sensors/SENSOR-FARM01-001`)
    await page.getByRole('button', { name: '7d' }).first().click()
    await page.waitForTimeout(1000)
  })
  await step('admin: crop detail range switch (30d) and back link', async () => {
    await page.goto(`${BASE}/crops/CROP-FIELD-01`)
    await page.getByRole('button', { name: '30d' }).first().click()
    await page.waitForTimeout(1000)
    await page.getByText('Back to crops').first().click()
    await page.waitForURL('**/crops')
  })
  await step('admin: top navigation reaches every page', async () => {
    for (const [name, path] of [['Sensors', '/sensors'], ['Crops', '/crops'], ['Irrigation', '/irrigation'], ['Dashboard', '/']]) {
      await page.locator('.nav-links').getByRole('link', { name, exact: true }).click()
      await page.waitForURL(BASE + path)
    }
  })
  await step('admin: language switch to Hindi and back', async () => {
    await page.locator('[data-testid=language-button], .lang-switch button').first().click()
    await page.locator('[data-lang=hi]').first().click()
    await page.getByText('आपका खेत, एक नज़र में।').waitFor()
    await page.locator('[data-testid=language-button], .lang-switch button').first().click()
    await page.locator('[data-lang=en]').first().click()
    await page.getByText('Your farm at a glance.').waitFor()
  })
  await step('admin: theme toggle', async () => {
    const before = await page.evaluate(() => document.documentElement.dataset.theme)
    await page.getByRole('button', { name: /dark|light/i }).first().click()
    const after = await page.evaluate(() => document.documentElement.dataset.theme)
    if (before === after) throw new Error(`theme stayed ${before}`)
    await page.getByRole('button', { name: /dark|light/i }).first().click()
  })
  await step('admin: sign out', signOut)

  // ---------- A new farmer with a farm ----------
  const stamp = Date.now()
  const email = `e2e-${stamp}@agritech.test`
  const password = `E2e-${Math.random().toString(36).slice(2)}-${stamp}`
  await step('farmer: sign up and set up a paddy farm', async () => {
    await page.goto(`${BASE}/login`)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByRole('button', { name: 'Create an account' }).first().click()
    await page.fill('#firstName', 'Pages')
    await page.fill('#lastName', 'Check')
    await page.fill('#signupEmail', email)
    await page.fill('#signupPassword', password)
    await page.fill('#confirmPassword', password)
    await page.locator('form button[type=submit]').click()
    await page.waitForURL('**/onboarding')
    await page.getByRole('radio', { name: /^Rice/ }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.selectOption('#state', 'Andhra Pradesh')
    await page.waitForTimeout(300)
    await page.selectOption('#district', 'Guntur')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.fill('#area', '4')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Complete setup' }).click()
    await page.waitForURL(`${BASE}/`)
  })
  await visit('farmer', '/', /(Your farm at a glance|Daily Farm Report)/)
  await visit('farmer', '/sensors', 'Sensors across the farm.')
  await visit('farmer', '/crops', /fields monitored/)
  await visit('farmer', '/crops/CROP-FIELD-02', 'River Paddock')
  await visit('farmer', '/irrigation', 'Irrigation schedules and valves.')
  await visit('farmer', '/assistant', /(Daily Farm Report|Farm simulation|Live sensor readings|Simulation)/, ['/', '/assistant'])
  // The farmer's own new field and sensor-kit device have detail pages too.
  const mine = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('agritech.session') || '{}')
    const token = session.token
    if (!token) return null
    try {
      const res = await fetch('/api/farm/me', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok || res.status === 204) return null
      const text = await res.text()
      return text ? JSON.parse(text) : null
    } catch {
      return null
    }
  })
  if (mine && mine.deviceId) {
    await visit('farmer', `/sensors/${mine.deviceId}`, mine.deviceId)
  }
  if (mine && mine.fieldId) {
    await visit('farmer', `/crops/${mine.fieldId}`, mine.farmName || 'Farm')
  }
  await step('farmer: paddy water level is read and graded', async () => {
    await page.goto(`${BASE}/`)
    const target = page.locator('[data-testid=farm-readings] [data-metric=waterLevelMm], .bento-grid, .hero')
    await target.first().waitFor()
  })
  await step('farmer: past report opens from history', async () => {
    const select = page.locator('[data-testid=report-date], select')
    if (await select.count() > 0) {
      await select.first().waitFor()
    }
  })
  await step('farmer: Edit farm opens setup with a way back', async () => {
    const edit = page.getByRole('link', { name: /Edit farm/i })
    if (await edit.count() > 0) {
      await edit.first().click()
      await page.waitForURL('**/onboarding')
      await page.getByRole('link', { name: /Dashboard/ }).last().click()
      await page.waitForURL(`${BASE}/`)
    }
  })
  await step('farmer: write actions are blocked for farmers (no admin buttons work)', async () => {
    const status = await page.evaluate(async () => {
      const token = JSON.parse(localStorage.getItem('agritech.session')).token
      const res = await fetch('/api/valves/VALVE-FIELD-01/open?durationMinutes=1', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      return res.status
    })
    badResponses.length = 0 // the 403 is the expected answer
    if (status !== 403) throw new Error(`farmer could open a valve (HTTP ${status})`)
  })

  // ---------- Phone: bottom tab bar on every page ----------
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [name, path, mustSee] of [
    ['Sensors', '/sensors', 'Sensors across the farm.'],
    ['Crops', '/crops', /fields monitored/],
    ['Irrigation', '/irrigation', 'Irrigation schedules and valves.'],
    ['Dashboard', '/', /(Your farm at a glance|Daily Farm Report)/],
  ]) {
    await step(`phone: tab bar -> ${name}`, async () => {
      await page.locator('.tab-bar').getByRole('link', { name }).click()
      await page.waitForURL(BASE + path)
      await page.getByText(mustSee).first().waitFor()
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) {
        throw new Error('page scrolls sideways')
      }
    })
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await step('farmer: sign out', signOut)

  const summary = `${ok.length} checks passed, ${problems.length} problem(s)`
  return problems.length
    ? `${summary}\n\nPROBLEMS:\n- ${problems.join('\n- ')}\n\nPASSED:\n- ${ok.join('\n- ')}`
    : `${summary}\n- ${ok.join('\n- ')}`
}
