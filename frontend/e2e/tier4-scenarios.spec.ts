import { expect, test } from "@playwright/test";
import {
  attachErrorListeners,
  expectNoHorizontalOverflow,
  makeDefaultFarm,
  mockBackendOffline,
  mockBackendOnline,
  mockExternalMapAndFonts,
  mockOpenMeteo,
  openNavIfMobile,
  type RecordedBackendCall,
  seedAuth,
  seedFarmStore,
} from "./helpers/mocks";

test.describe("Tier 4: Real-World Farmer Scenarios (Desktop 1280x800 & Mobile 390x844)", () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalMapAndFonts(page);
  });

  test("Scenario 1: Offline farmer full workday journey from login to vernacular shift briefing", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await mockOpenMeteo(page, "rain-hold");

    await page.goto("/login");
    await expectNoHorizontalOverflow(page);
    await page.getByLabel(/email address/i).fill("harpreet@ludhiana.farm");
    await page
      .getByRole("button", { name: /continue in offline field mode/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expectNoHorizontalOverflow(page);

    await page.goto("/properties/new");
    await expectNoHorizontalOverflow(page);
    await page.getByPlaceholder("My Wheat Farm").fill("Raikot Monsoon Plot");
    await page.getByPlaceholder("Village, District, State").fill("Raikot, Punjab");
    await page.getByPlaceholder("28.6139").fill("30.6500");
    await page.getByPlaceholder("77.2090").fill("75.6000");
    await page.getByPlaceholder("2.5").fill("5.0");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByRole("button", { name: /borewell/i }).click();
    await page.getByRole("button", { name: /drip/i }).click();
    await page.getByRole("button", { name: /^loam$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByRole("button", { name: /grow now/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /review & save/i }).click();
    await page.getByRole("button", { name: /confirm & save/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Raikot Monsoon Plot").first()).toBeVisible();

    await page.goto("/climate");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText(/daily temperature range/i)).toBeVisible();

    await page.goto("/sensors");
    await expectNoHorizontalOverflow(page);
    const quickDeploy = page.getByRole("button", { name: /deploy/i }).first();
    if (await quickDeploy.isVisible()) {
      await quickDeploy.click();
    } else {
      await page.getByRole("button", { name: /add sensor/i }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(/device id/i).fill("SM-RAIKOT-01");
      await dialog.getByLabel(/field|zone/i).fill("Zone Alpha");
      await dialog
        .getByRole("button", { name: /save sensor|register sensor|add sensor/i })
        .click();
    }

    await page.goto("/irrigation");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /open valve|start valve/i }).first().click();
    const interlock = page.getByRole("dialog");
    await expect(interlock).toBeVisible();
    await interlock
      .getByRole("button", { name: /defer 24h & bank water saved/i })
      .click();

    await page.goto("/dashboard");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /log shift dispatched/i }).click();
    errors.assertNoErrors();
  });

  test("Scenario 2: Monsoon rain-hold crisis — defer vs audited override and water-saved ledger", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await mockOpenMeteo(page, "rain-hold");
    await seedAuth(page);
    await seedFarmStore(page, {
      properties: [makeDefaultFarm({ name: "Monsoon Block", selectedCropId: "wheat" })],
    });

    await page.goto("/irrigation");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /open valve|start valve/i }).first().click();
    const firstDialog = page.getByRole("dialog");
    await expect(firstDialog).toBeVisible();
    await firstDialog
      .getByRole("button", { name: /defer 24h & bank water saved/i })
      .click();
    await expect(firstDialog).toBeHidden();

    await page.getByRole("button", { name: /open valve|start valve/i }).first().click();
    const secondDialog = page.getByRole("dialog");
    await expect(secondDialog).toBeVisible();
    const reasonChip = secondDialog.getByRole("button", {
      name: /fertigation|transplant|dry pocket|manual check/i,
    });
    if ((await reasonChip.count()) > 0) {
      await reasonChip.first().click();
    }
    await secondDialog
      .getByRole("button", { name: /override interlock & start valve/i })
      .click();

    await expect(page.getByText(/override/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    errors.assertNoErrors();
  });

  test("Scenario 3: Dry-season drip irrigation ET0 water budget and schedule management", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await mockOpenMeteo(page, "normal", {
      todayEt0: 6.4,
      todayRainMm: 0,
      rainProbMax: 5,
      soilMoistureRatio: 0.24,
    });
    await seedAuth(page);
    await seedFarmStore(page, {
      properties: [
        makeDefaultFarm({
          name: "Nashik Dry Drip",
          areaHa: 4.5,
          irrigationType: "drip",
          selectedCropId: "tomato",
        }),
      ],
    });

    await page.goto("/irrigation");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText(/water budget/i).first()).toBeVisible();

    await page.getByRole("button", { name: /new schedule|add schedule/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/zone|field/i).fill("Tomato Morning Drip");
    await dialog
      .getByRole("button", { name: /save schedule|create schedule/i })
      .click();
    await expect(page.getByText("Tomato Morning Drip")).toBeVisible();

    await page.getByRole("button", { name: /open valve|start valve/i }).first().click();
    await expectNoHorizontalOverflow(page);
    errors.assertNoErrors();
  });

  test("Scenario 4: Punjabi/Hindi mobile-friendly operator workflow via drawer navigation", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await mockOpenMeteo(page, "normal");
    await seedAuth(page, { name: "Balwinder Singh" });
    await seedFarmStore(page, {
      properties: [makeDefaultFarm({ name: "Amritsar Canal Field" })],
    });

    await page.goto("/dashboard");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /current language:/i }).click();
    const langDialog = page.getByRole("dialog");
    const punjabiCard = langDialog
      .locator("div", { hasText: "ਪੰਜਾਬੀ" })
      .filter({ has: page.getByRole("button", { name: /^select$/i }) })
      .first();
    await punjabiCard.getByRole("button", { name: /^select$/i }).click();
    await langDialog.getByRole("button", { name: /^close$/i }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "pa");
    await expectNoHorizontalOverflow(page);

    await openNavIfMobile(page);
    await page.getByRole("link", { name: /climate & advisory/i }).click();
    await expect(page).toHaveURL(/\/climate/);
    await expectNoHorizontalOverflow(page);

    await openNavIfMobile(page);
    await page.getByRole("link", { name: /field hub/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pa");
    errors.assertNoErrors();
  });

  test("Scenario 5: Offline-to-online reconnect, outbox flush on /profile, and sign out", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await mockOpenMeteo(page, "normal");
    await seedAuth(page, { token: "jwt-online-valid-token" });
    await seedFarmStore(page);

    await page.goto("/sensors");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /add sensor/i }).click();
    const sensorDialog = page.getByRole("dialog");
    await sensorDialog.getByLabel(/device id/i).fill("SM-RECONNECT-1");
    await sensorDialog.getByLabel(/field|zone/i).fill("East Plot");
    await sensorDialog
      .getByRole("button", { name: /save sensor|register sensor|add sensor/i })
      .click();

    const recordedCalls: RecordedBackendCall[] = [];
    await page.unroute("http://localhost:8080/api/**");
    await mockBackendOnline(page, { recordedCalls });

    await page.goto("/profile");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /sync now/i }).click();

    await expect
      .poll(async () => {
        const raw = await page.evaluate(() =>
          window.localStorage.getItem("agritech-farms-v1")
        );
        return raw
          ? (JSON.parse(raw) as { state?: { syncOutbox?: unknown[] } }).state
              ?.syncOutbox?.length ?? 0
          : -1;
      })
      .toBe(0);
    expect(recordedCalls.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    errors.assertNoErrors();
  });
});
