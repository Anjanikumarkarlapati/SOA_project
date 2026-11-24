import { expect, test } from "@playwright/test";
import {
  attachErrorListeners,
  makeDefaultFarm,
  mockBackendOffline,
  mockBackendOnline,
  mockExternalMapAndFonts,
  mockOpenMeteo,
  seedAuth,
  seedCorruptAuth,
  seedCorruptFarmStore,
  seedExpiredAuth,
  seedFarmStore,
} from "./helpers/mocks";

test.describe("Tier 2: Boundary & Corner Cases", () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalMapAndFonts(page);
    await mockOpenMeteo(page, "normal");
  });

  test("F2 @m1 expired auth token in localStorage redirects protected route to /login", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await seedExpiredAuth(page);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: /sign in to your farm/i })
    ).toBeVisible();
    errors.assertNoErrors();
  });

  test("F2 @m1 corrupt agritech-auth JSON recovers safely and redirects to /login", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await seedCorruptAuth(page);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: /sign in to your farm/i })
    ).toBeVisible();
    errors.assertNoErrors();
  });

  test("F2 @m1 login validates malformed email and short password before network call", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await page.goto("/login");

    await page.getByLabel(/email address/i).fill("invalid-email");
    await page.getByLabel(/^password$/i).fill("123");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByText(/enter a valid email/i)).toBeVisible();
    await expect(
      page.getByText(/password must be at least 6 characters/i)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    errors.assertNoErrors();
  });

  test("F2 @m1 login displays 401 server error alert without offline fallback", async ({
    page,
  }) => {
    await mockBackendOnline(page, { rejectLogin: true });
    await page.goto("/login");

    await page.getByLabel(/email address/i).fill("farmer@agritech.test");
    await page.getByLabel(/^password$/i).fill("wrongpass");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /invalid email or password/i })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("F2 @m1 signup rejects short name, short password, and mismatched confirmation", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await page.goto("/signup");

    await page.getByLabel(/full name/i).fill("A");
    await page.getByLabel(/email address/i).fill("farmer@test.com");
    await page.getByLabel(/^password$/i).fill("short");
    await page.getByLabel(/^confirm password$/i).fill("different");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(
      page.getByText(/name must be at least 2 characters/i)
    ).toBeVisible();
    await expect(
      page.getByText(/password must be at least 8 characters/i)
    ).toBeVisible();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
    errors.assertNoErrors();
  });

  test("F5/F9 0-farm empty state on /dashboard and /properties guides user to register farm", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page, { properties: [], activePropertyId: null });

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /register farm/i })).toBeVisible();

    await page.goto("/properties");
    await expect(page.getByRole("link", { name: /register farm/i })).toBeVisible();
    errors.assertNoErrors();
  });

  test("F5 corrupt agritech-farms-v1 JSON recovers gracefully without crashing", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedCorruptFarmStore(page);

    await page.goto("/properties");
    await expect(page).toHaveURL(/\/properties/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    errors.assertNoErrors();
  });

  test("F9 /properties/new enforces required farm name, valid coordinates, and water source", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);

    await page.goto("/properties/new");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page.getByText(/enter a farm name/i)).toBeVisible();

    await page.getByPlaceholder("My Wheat Farm").fill("Boundary Check Farm");
    await page.getByPlaceholder("28.6139").fill("140");
    await page.getByPlaceholder("77.2090").fill("250");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page.getByText(/valid coordinates/i)).toBeVisible();

    await page.getByPlaceholder("28.6139").fill("30.9010");
    await page.getByPlaceholder("77.2090").fill("75.8570");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page.getByText(/select a water source/i)).toBeVisible();
    errors.assertNoErrors();
  });

  test("F11 /climate handles Open-Meteo 503 outage gracefully", async ({ page }) => {
    await mockBackendOffline(page);
    await mockOpenMeteo(page, "error");
    await seedAuth(page);
    await seedFarmStore(page);

    await page.goto("/climate");
    await expect(page.getByText(/failed to load climate data/i)).toBeVisible();
  });

  test("F12 /sensors Add Sensor modal rejects empty device ID", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page);

    await page.goto("/sensors");
    await page.getByRole("button", { name: /add sensor/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /save sensor|register sensor|add sensor/i }).click();
    await expect(dialog).toBeVisible();
    errors.assertNoErrors();
  });

  test("F6/F13 Rain-Hold Interlock Defer 24h banks waterSavedLitres and persists across reload", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await mockOpenMeteo(page, "rain-hold");
    await seedAuth(page);
    await seedFarmStore(page, {
      properties: [makeDefaultFarm({ selectedCropId: "wheat" })],
      waterSavedLitres: 0,
    });

    await page.goto("/irrigation");
    await page.getByRole("button", { name: /open valve|start valve/i }).first().click();

    const interlockDialog = page.getByRole("dialog");
    await expect(interlockDialog).toBeVisible();
    await interlockDialog
      .getByRole("button", { name: /defer 24h & bank water saved/i })
      .click();

    await expect(interlockDialog).toBeHidden();
    await expect(page.getByText(/deferred_rain_hold|rain-hold deferred|water saved/i).first()).toBeVisible();

    const waterSaved = await page.evaluate(() => {
      const raw = window.localStorage.getItem("agritech-farms-v1");
      return raw ? (JSON.parse(raw) as { state?: { waterSavedLitres?: number } }).state?.waterSavedLitres ?? 0 : 0;
    });
    expect(waterSaved).toBeGreaterThan(0);

    await page.reload();
    const persistedWaterSaved = await page.evaluate(() => {
      const raw = window.localStorage.getItem("agritech-farms-v1");
      return raw ? (JSON.parse(raw) as { state?: { waterSavedLitres?: number } }).state?.waterSavedLitres ?? 0 : 0;
    });
    expect(persistedWaterSaved).toBe(waterSaved);
    errors.assertNoErrors();
  });

  test("F6/F13 Rain-Hold Interlock allows audited Override and logs event", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await mockOpenMeteo(page, "rain-hold");
    await seedAuth(page);
    await seedFarmStore(page, {
      properties: [makeDefaultFarm({ selectedCropId: "wheat" })],
    });

    await page.goto("/irrigation");
    await page.getByRole("button", { name: /open valve|start valve/i }).first().click();

    const interlockDialog = page.getByRole("dialog");
    await expect(interlockDialog).toBeVisible();
    const reasonChip = interlockDialog.getByRole("button", {
      name: /fertigation|transplant|dry pocket|manual check/i,
    });
    if ((await reasonChip.count()) > 0) {
      await reasonChip.first().click();
    }
    await interlockDialog
      .getByRole("button", { name: /override interlock & start valve/i })
      .click();

    await expect(interlockDialog).toBeHidden();
    await expect(page.getByText(/override/i).first()).toBeVisible();
    errors.assertNoErrors();
  });

  test("F6/F13 Saturated-Soil Interlock triggers when soil moisture exceeds crop optimum despite 0mm rain", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await mockOpenMeteo(page, "normal", {
      rainProbMax: 5,
      todayRainMm: 0,
      soilMoistureRatio: 0.88,
    });
    await seedAuth(page);
    await seedFarmStore(page, {
      properties: [makeDefaultFarm({ selectedCropId: "wheat" })],
    });

    await page.goto("/irrigation");
    await page.getByRole("button", { name: /open valve|start valve/i }).first().click();

    const interlockDialog = page.getByRole("dialog");
    await expect(interlockDialog).toBeVisible();
    await expect(interlockDialog.getByText(/moisture|saturat/i).first()).toBeVisible();
    errors.assertNoErrors();
  });

  test("F7 LanguageSelectorModal search displays 'No languages found' on unmatched query", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /current language:/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("klingon-xyz");
    await expect(dialog.getByText(/no languages found/i)).toBeVisible();
    await dialog.getByRole("button", { name: /clear/i }).click();
    await expect(dialog.getByText(/हिन्दी/)).toBeVisible();
    errors.assertNoErrors();
  });
});
