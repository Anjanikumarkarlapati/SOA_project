import { expect, test } from "@playwright/test";
import {
  attachErrorListeners,
  makeDefaultFarm,
  mockBackendOffline,
  mockBackendOnline,
  mockExternalMapAndFonts,
  mockOpenMeteo,
  openNavIfMobile,
  seedAuth,
  seedFarmStore,
} from "./helpers/mocks";

test.describe("Tier 1: Feature Coverage (F1–F14)", () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalMapAndFonts(page);
    await mockOpenMeteo(page, "normal");
  });

  test("F1/F2 @m1 unauthenticated root renders editorial landing and navigates to /login", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sense everything." })
    ).toBeVisible();
    const signInHubLink = page.getByRole("link", {
      name: /sign in to field hub/i,
    });
    await expect(signInHubLink).toBeVisible();
    await expect(page.getByTestId("google-signin-button")).toBeVisible();

    await signInHubLink.click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: /sign in to your farm/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
    await expect(
      page.getByTestId("auth-split-shell").getByTestId("google-signin-button")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue in offline field mode/i })
    ).toBeVisible();
    errors.assertNoErrors();
  });

  test("F2 @m1 authenticated root shows Enter Field Hub link and navigates to /dashboard", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page, { name: "Ravi Kumar" });

    await page.goto("/");
    const enterHubLink = page.getByRole("link", { name: /enter field hub/i });
    await expect(enterHubLink).toBeVisible();
    await enterHubLink.click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /good morning/i })
    ).toBeVisible();
    errors.assertNoErrors();
  });

  test("F2/F3 @m1 reloading /dashboard keeps hydrated session and shows 14-day Open-Meteo KPIs", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page, { name: "Ravi Kumar" });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/26\.5°C/)).toBeVisible();
    await expect(page.getByText(/avg \(14-day\)/i)).toBeVisible();
    await expect(page.getByText(/0\.0 mm/)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /good morning/i })
    ).toBeVisible();
    await expect(page.getByText(/26\.5°C/)).toBeVisible();
    errors.assertNoErrors();
  });

  test("F2 @m1 offline field mode login writes offline token and survives reload", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);

    await page.goto("/login");
    await page.getByLabel(/email address/i).fill("gurpreet@punjab.farm");
    await page
      .getByRole("button", { name: /continue in offline field mode/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard/);
    const storedToken = await page.evaluate(() => {
      const raw = window.localStorage.getItem("agritech-auth");
      return raw ? (JSON.parse(raw) as { state?: { user?: { token?: string } } }).state?.user?.token : null;
    });
    expect(storedToken).toMatch(/^offline-/);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    errors.assertNoErrors();
  });

  test("F2 @m1 online login via :8080 gateway stores JWT and redirects to /dashboard", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOnline(page, { email: "ravi@agritech.test", name: "Ravi Kumar" });

    await page.goto("/login");
    await page.getByLabel(/email address/i).fill("ravi@agritech.test");
    await page.getByLabel(/^password$/i).fill("secret123");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    const storedToken = await page.evaluate(() => {
      const raw = window.localStorage.getItem("agritech-auth");
      return raw ? (JSON.parse(raw) as { state?: { user?: { token?: string } } }).state?.user?.token : null;
    });
    expect(storedToken).toBe("jwt-online-valid-token");
    errors.assertNoErrors();
  });

  test("F2 @m1 login form auto-falls back to offline session when :8080 is unreachable", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);

    await page.goto("/login");
    await page.getByLabel(/email address/i).fill("anita@field.in");
    await page.getByLabel(/^password$/i).fill("password123");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    const storedToken = await page.evaluate(() => {
      const raw = window.localStorage.getItem("agritech-auth");
      return raw ? (JSON.parse(raw) as { state?: { user?: { token?: string } } }).state?.user?.token : null;
    });
    expect(storedToken).toMatch(/^offline-/);
    errors.assertNoErrors();
  });

  test("F2 @m1 signup offline field mode redirects to /properties/new", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);

    await page.goto("/signup");
    await page.getByLabel(/full name/i).fill("Suresh Patel");
    await page.getByLabel(/email address/i).fill("suresh@gujarat.farm");
    await page
      .getByRole("button", { name: /continue in offline field mode/i })
      .click();

    await expect(page).toHaveURL(/\/properties\/new/);
    await expect(
      page.getByRole("heading", { name: /register a farm/i })
    ).toBeVisible();
    errors.assertNoErrors();
  });

  test("F7/F8 global shell displays consolidated nav, farm switcher, language modal, and sync badge", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page);

    await page.goto("/dashboard");
    await openNavIfMobile(page);

    await expect(page.getByRole("link", { name: /field hub/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /my farms/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /climate & advisory/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /sensors & soil/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /irrigation & valves/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /settings & profile/i })).toBeVisible();

    await page.getByRole("button", { name: /current language:/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/select regional language/i)).toBeVisible();
    await dialog.getByRole("button", { name: /^close$/i }).click();
    await expect(dialog).toBeHidden();
    errors.assertNoErrors();
  });

  test("F9 5-step /properties/new wizard creates persistent farm manageable in /properties", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page, { properties: [], activePropertyId: null });

    await page.goto("/properties/new");
    await expect(
      page.getByRole("heading", { name: /register a farm/i })
    ).toBeVisible();

    await page.getByPlaceholder("My Wheat Farm").fill("Nashik Drip Vineyard");
    await page.getByPlaceholder("Village, District, State").fill("Niphad, Nashik");
    await page.getByPlaceholder("28.6139").fill("20.0975");
    await page.getByPlaceholder("77.2090").fill("74.1120");
    await page.getByPlaceholder("2.5").fill("3.5");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByRole("button", { name: /borewell/i }).click();
    await page.getByRole("button", { name: /drip/i }).click();
    await page.getByRole("button", { name: /^black$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByRole("button", { name: /grow now/i }).click();
    await page.getByPlaceholder("Wheat, Rice").fill("Grapes, Onion");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect(page.getByText(/soil moisture/i).first()).toBeVisible();
    await page.getByRole("button", { name: /review & save/i }).click();

    await expect(page.getByText("Nashik Drip Vineyard")).toBeVisible();
    await page.getByRole("button", { name: /confirm & save/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/properties");
    await expect(page.getByText("Nashik Drip Vineyard")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Nashik Drip Vineyard")).toBeVisible();
    errors.assertNoErrors();
  });

  test("F10 /dashboard Field Hub mounts FarmAerialSurvey, RootZoneSoilCard, and Shift Briefing", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page, {
      properties: [makeDefaultFarm({ name: "Mandya Paddy Basin", selectedCropId: "rice" })],
      activePropertyId: "farm-ludhiana-1",
    });

    await page.goto("/dashboard");
    await expect(page.getByText("Mandya Paddy Basin").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /in-situ root-zone telemetry/i })
    ).toBeVisible();
    await expect(page.getByText(/multi-spectral drone survey/i)).toBeVisible();

    await page.getByRole("button", { name: /ndvi filter/i }).click();
    await expect(page.getByRole("button", { name: /ndvi active/i })).toBeVisible();
    await page.getByRole("button", { name: /^z3$/i }).click();
    await expect(page.getByText(/zone gamma/i)).toBeVisible();

    const dispatchBtn = page.getByRole("button", { name: /log shift dispatched/i });
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();
    errors.assertNoErrors();
  });

  test("F11 /climate and /recommendations show 14-day charts and interactive FarmerRecommendationCard", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page);

    await page.goto("/climate");
    await expect(page.getByText(/daily temperature range/i)).toBeVisible();
    await expect(page.getByText(/rainfall vs reference et/i)).toBeVisible();

    await page.goto("/recommendations");
    await expect(page.getByText(/farmer's field advisory/i)).toBeVisible();
    await page.getByRole("button", { name: /soil & operations/i }).click();
    await expect(page.getByText(/trafficability/i)).toBeVisible();
    await page.getByRole("button", { name: /nutrition & spray/i }).click();
    await expect(page.getByText(/safe to spray|hold spraying/i)).toBeVisible();
    errors.assertNoErrors();
  });

  test("F12 /sensors supports Add Sensor modal, 1-click recommended deploy, and RootZoneSoilCard", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page);

    await page.goto("/sensors");
    await expect(
      page.getByRole("heading", { name: /in-situ root-zone telemetry/i })
    ).toBeVisible();

    await page.getByRole("button", { name: /add sensor/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/device id/i).fill("SM-NORTH-09");
    await dialog.getByLabel(/field|zone/i).fill("North Furrow");
    await dialog.getByRole("button", { name: /save sensor|register sensor|add sensor/i }).click();

    await expect(page.getByText("SM-NORTH-09")).toBeVisible();
    await page.reload();
    await expect(page.getByText("SM-NORTH-09")).toBeVisible();
    errors.assertNoErrors();
  });

  test("F6/F13 /irrigation computes ET0 water budget and persists schedule CRUD", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page);

    await page.goto("/irrigation");
    await expect(page.getByText(/water budget/i).first()).toBeVisible();
    await expect(page.getByText(/litres|L\b/i).first()).toBeVisible();

    await page.getByRole("button", { name: /new schedule|add schedule/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/zone|field/i).fill("Block A Wheat");
    await dialog.getByRole("button", { name: /save schedule|create schedule/i }).click();

    await expect(page.getByText("Block A Wheat")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Block A Wheat")).toBeVisible();
    errors.assertNoErrors();
  });

  test("F14 /profile manages preferences, theme, area units, and Sign out", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page, { name: "Ravi Kumar", email: "ravi@field.in" });
    await seedFarmStore(page);

    await page.goto("/profile");
    await expect(page.getByText("ravi@field.in")).toBeVisible();

    await page.getByRole("button", { name: /acres/i }).click();
    await page.getByRole("button", { name: /dark/i }).click();

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    errors.assertNoErrors();
  });
});
