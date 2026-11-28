// End-to-end check of the new-farmer flow, run with playwright-cli against the local stack:
//
//   .\scripts\stack.ps1 start          (backend on :8080)
//   npm run dev --prefix frontend      (dashboard on :5173)
//   playwright-cli open
//   playwright-cli run-code --filename=scripts/e2e/farm-flow.js
//
// Each run signs up a brand-new farmer (unique throwaway e2e-*@agritech.test address and a
// generated password), so it always exercises first-login onboarding. Throws on the first
// failed check; returns the list of passed checks.
async (page) => {
  const BASE = 'http://localhost:5173'
  const passed = []
  const check = (ok, what) => {
    if (!ok) throw new Error(`FAILED: ${what}`)
    passed.push(what)
  }
  page.setDefaultTimeout(30000)

  // 1. A new user signs up (and is signed straight in).
  const stamp = Date.now()
  const email = `e2e-${stamp}@agritech.test`
  const password = `E2e-${Math.random().toString(36).slice(2)}-${stamp}`
  await page.goto(`${BASE}/login`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Create an account' }).first().click()
  await page.fill('#firstName', 'Asha')
  await page.fill('#lastName', 'Tester')
  await page.fill('#signupEmail', email)
  await page.fill('#signupPassword', password)
  await page.fill('#confirmPassword', password)
  await page.locator('form button[type=submit]').click()

  // 2. First login goes to farm setup, not the dashboard.
  await page.waitForURL('**/onboarding')
  check(true, '1-2. new user signed up and was sent to farm setup')

  // Crop: tomato (a vegetable prone to fungal disease, so humidity and light are recommended).
  await page.getByRole('radio', { name: /^Tomato/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Location.
  await page.selectOption('#state', 'Telangana')
  const district = await page.locator('#district option').nth(1).getAttribute('value')
  await page.selectOption('#district', district)
  await page.getByRole('button', { name: 'Continue' }).click()

  // 3. Land size, in hectares.
  await page.fill('#farmName', 'Asha E2E Farm')
  await page.getByRole('button', { name: 'Hectares' }).click()
  await page.fill('#area', '2')
  check((await page.inputValue('#area')) === '2', '3. land size entered (2 hectares)')
  await page.getByRole('button', { name: 'Continue' }).click()

  // 5. Sensors: the crop's recommendations are pre-ticked; the farmer adjusts them.
  const box = (id) => page.locator(`input[name=sensor][value="${id}"]`)
  check(await page.locator('[data-sensor=soil] input').isChecked(), '5a. soil probe always included')
  check(await box('humidity').isChecked(), '5b. humidity recommended for tomato (fungal-prone)')
  check(!(await box('water-level').isChecked()), '5c. water level not pre-ticked for a non-paddy crop')
  await box('rainfall').uncheck()
  check((await page.textContent('[data-testid=sensor-count]')).includes('5 sensors'), '5d. sensor selection counted')
  await page.getByRole('button', { name: 'Continue' }).click()

  // 6-7. Save; the farm is stored and the dashboard opens.
  await page.getByRole('button', { name: 'Complete setup' }).click()
  await page.waitForURL(`${BASE}/`)
  await page.locator('[data-testid=my-farm]').waitFor()
  await page.waitForFunction(() =>
    ['soilMoisture', 'soilTemperature', 'ph', 'airTemperature', 'humidity', 'lightLux', 'nitrogen'].every((key) => {
      const value = document.querySelector(`[data-testid=farm-readings] [data-metric="${key}"] .myfarm-value`)?.textContent?.trim()
      return value && value !== '--'
    }),
  )
  check(true, '4,6-7. crop selected, farm saved, dashboard loaded with simulated readings')

  // 8-10. Simulated readings for exactly the chosen sensors, graded against tomato's ranges.
  const tile = (key) => page.locator(`[data-testid=farm-readings] [data-metric=${key}]`)
  for (const key of ['soilMoisture', 'soilTemperature', 'ph', 'airTemperature', 'humidity', 'lightLux', 'nitrogen']) {
    check((await tile(key).count()) === 1, `8. ${key} reading shown`)
    const value = await tile(key).locator('.myfarm-value').textContent()
    check(value && value !== '--', `9. ${key} has a value (${value})`)
  }
  check((await tile('rainfallMm').count()) === 0, '9. unselected rainfall sensor not shown')
  check((await tile('waterLevelMm').count()) === 0, '9. unselected water level sensor not shown')
  check((await tile('soilMoisture').textContent()).includes('Best for Tomato: 60-80%'), '10. tomato moisture range applied (60-80%)')
  check((await tile('soilMoisture').getAttribute('data-status')) !== '', '10. moisture graded')
  check(await page.locator('[data-testid=simulated-badge]').isVisible(), '8. data clearly labelled as simulated')

  // 11-12. Daily report with summary, sensor table, alerts and recommendations.
  const report = page.locator('[data-testid=daily-report]')
  await report.locator('[data-testid=report-summary]').waitFor()
  check((await report.locator('[data-testid=report-summary]').textContent()).startsWith('Tomato on Asha E2E Farm'), '11. daily report generated for this farm')
  check((await report.locator('[data-testid=report-sensors] tbody tr').count()) === 9, '11. report summarises the 9 configured readings (soil x3, air temp, humidity, light, N, P, K)')
  check(await report.locator('[data-testid=report-simulated]').isVisible(), '11. report marked simulated')
  check((await report.locator('[data-testid=report-alerts]').count()) === 1, '12. alerts section present')
  const recs = await report.locator('[data-testid=report-recommendations] li').allTextContents()
  check(recs.some((r) => r.startsWith('Irrigation')) && recs.some((r) => r.startsWith('Crop care')), `12. recommendations present (${recs.length})`)
  const days = await report.locator('[data-testid=report-date] option').count()
  check(days >= 2, `11. report history kept (${days} days: yesterday and today)`)

  // Persistence is server-side: wipe the browser's copy and reload - still the dashboard.
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('agritech.farm.')).forEach((k) => localStorage.removeItem(k)))
  await page.reload()
  await page.locator('[data-testid=my-farm]').waitFor()
  check(page.url() === `${BASE}/`, '6. farm persisted on the server (no re-onboarding after clearing the browser)')

  const api = await page.evaluate(async () => {
    const token = JSON.parse(localStorage.getItem('agritech.session')).token
    const res = await fetch('/api/farm/me', { headers: { Authorization: `Bearer ${token}` } })
    return res.json()
  })
  check(api.simulated === true && api.landUnit === 'HECTARES' && api.cropId === 'tomato', '6. API returns the saved farm, flagged simulated')

  // Sign in again as the existing account and confirm database-backed onboarding does not repeat.
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/login`)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${BASE}/`)
  await page.getByRole('heading', { name: 'My farm: Asha E2E Farm' }).waitFor()
  check(true, '6a. existing user can sign in again and their property reloads from the database')

  // 13. The retired assistant URL falls back to the dashboard.
  await page.goto(`${BASE}/assistant`)
  await page.waitForURL(`${BASE}/`)
  await page.getByTestId('daily-report').waitFor()
  check(true, '13. old assistant route redirects to the dashboard')

  // 14. Existing pages still work.
  await page.goto(`${BASE}/crops`)
  await page.getByText(/fields monitored/).waitFor()
  check((await page.getByText('Asha E2E Farm').count()) >= 1, '14. new field listed on Crops')
  await page.goto(`${BASE}/sensors`)
  await page.getByText(/SENSOR-CROP-/).first().waitFor()
  check(true, '14. farm sensor listed on Sensors')
  await page.goto(`${BASE}/irrigation`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  check(true, '14. Irrigation page loads')

  // Existing account registers a second property. The wizard starts blank and must preserve the first.
  await page.goto(`${BASE}/`)
  await page.locator('[data-testid=add-farm]').click()
  await page.waitForURL('**/onboarding?new=1')
  await page.getByRole('radio', { name: /^Rice/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  check((await page.inputValue('#state')) === '', '15. add-property setup starts without overwriting the selected property')
  await page.selectOption('#state', 'Telangana')
  const secondDistrict = await page.locator('#district option').nth(1).getAttribute('value')
  await page.selectOption('#district', secondDistrict)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.fill('#farmName', 'Asha Second E2E Farm')
  await page.fill('#area', '3')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Complete setup' }).click()
  await page.waitForURL(`${BASE}/`)
  await page.getByRole('heading', { name: 'My farm: Asha Second E2E Farm' }).waitFor()
  const propertyState = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('agritech.session'))
    const headers = { Authorization: `Bearer ${session.token}` }
    const properties = await (await fetch('/api/farm/properties', { headers })).json()
    const first = properties.find((item) => item.farmName === 'Asha E2E Farm')
    const saved = await (await fetch(`/api/farm/me?propertyId=${encodeURIComponent(first.propertyId)}`, { headers })).json()
    return { properties, first: saved, selected: localStorage.getItem(`agritech.selectedProperty.${session.email.toLowerCase()}`) }
  })
  check(propertyState.properties.length === 2, '15. both properties are saved to the account')
  check(propertyState.first.farmName === 'Asha E2E Farm' && propertyState.first.cropId === 'tomato', '15. registering the second property leaves the original property data intact')
  check(propertyState.selected === propertyState.properties.find((item) => item.farmName === 'Asha Second E2E Farm').propertyId, '15. the new property becomes active')
  const propertyPicker = page.locator('select[aria-label="Select property"]')
  check(await propertyPicker.locator('option').count() === 2, '15. the account can switch between both properties')
  await propertyPicker.selectOption(propertyState.properties.find((item) => item.farmName === 'Asha E2E Farm').propertyId)
  await page.getByRole('heading', { name: 'My farm: Asha E2E Farm' }).waitFor()
  check(true, '15. switching properties loads the original property again')
  await page.locator('select[aria-label="Select property"]').selectOption(propertyState.properties.find((item) => item.farmName === 'Asha Second E2E Farm').propertyId)
  await page.getByRole('heading', { name: 'My farm: Asha Second E2E Farm' }).waitFor()
  check(true, '15. switching back reloads the second property')

  return `ALL ${passed.length} CHECKS PASSED for ${email}\n- ` + passed.join('\n- ')
}
