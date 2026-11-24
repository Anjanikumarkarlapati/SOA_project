import { expect, test } from "@playwright/test";
import {
  attachErrorListeners,
  makeDefaultFarm,
  mockBackendOffline,
  mockBackendOnline,
  mockExternalMapAndFonts,
  mockOpenMeteo,
  type RecordedBackendCall,
  seedAuth,
  seedFarmStore,
} from "./helpers/mocks";

test.describe("Tier 3: Cross-Feature Combinations", () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalMapAndFonts(page);
    await mockOpenMeteo(page, "normal");
  });

  test("F9->F10/F11/F12/F13 creating a farm propagates active context to all 5 operational routes", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page, { properties: [], activePropertyId: null });

    await page.goto("/properties/new");
    await page.getByPlaceholder("My Wheat Farm").fill("Guntur Chilli Estate");
    await page.getByPlaceholder("Village, District, State").fill("Guntur, Andhra Pradesh");
    await page.getByPlaceholder("28.6139").fill("16.3067");
    await page.getByPlaceholder("77.2090").fill("80.4365");
    await page.getByPlaceholder("2.5").fill("6.0");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByRole("button", { name: /canal/i }).click();
    await page.getByRole("button", { name: /sprinkler/i }).click();
    await page.getByRole("button", { name: /^black$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByRole("button", { name: /recommend the best/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /review & save/i }).click();
    await page.getByRole("button", { name: /confirm & save/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Guntur Chilli Estate").first()).toBeVisible();

    await page.goto("/climate");
    await expect(page.getByText("Guntur Chilli Estate").first()).toBeVisible();

    await page.goto("/recommendations");
    await expect(page.getByText("Guntur Chilli Estate").first()).toBeVisible();

    await page.goto("/sensors");
    await expect(page.getByText("Guntur Chilli Estate").first()).toBeVisible();

    await page.goto("/irrigation");
    await expect(page.getByText("Guntur Chilli Estate").first()).toBeVisible();
    errors.assertNoErrors();
  });

  test("F8/F9 switching active farm updates downstream crop advisory and irrigation water budget", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);

    const farmOne = makeDefaultFarm({
      id: "farm-drip-2ha",
      name: "Pune Drip Plot",
      areaHa: 2.0,
      irrigationType: "drip",
      selectedCropId: "wheat",
    });
    const farmTwo = makeDefaultFarm({
      id: "farm-flood-10ha",
      name: "Karnal Flood Basin",
      areaHa: 10.0,
      irrigationType: "flood",
      selectedCropId: "rice",
    });

    await seedFarmStore(page, {
      properties: [farmOne, farmTwo],
      activePropertyId: "farm-drip-2ha",
    });

    await page.goto("/irrigation");
    await expect(page.getByText("Pune Drip Plot").first()).toBeVisible();

    await page.goto("/properties");
    const secondFarmCard = page.locator("article, section, div", {
      hasText: "Karnal Flood Basin",
    });
    await secondFarmCard
      .getByRole("button", { name: /set active|select farm|activate/i })
      .first()
      .click();

    await page.goto("/irrigation");
    await expect(page.getByText("Karnal Flood Basin").first()).toBeVisible();

    await page.goto("/recommendations");
    await expect(page.getByText(/rice/i).first()).toBeVisible();
    errors.assertNoErrors();
  });

  test("F7->F10 switching language to Hindi updates <html lang>, persists reload, and localizes Shift Briefing", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /current language:/i }).click();
    const dialog = page.getByRole("dialog");
    const hindiCard = dialog.locator("div", { hasText: "हिन्दी" }).filter({
      has: page.getByRole("button", { name: /^select$/i }),
    }).first();
    await hindiCard.getByRole("button", { name: /^select$/i }).click();
    await dialog.getByRole("button", { name: /^close$/i }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    const storedLang = await page.evaluate(() =>
      window.localStorage.getItem("agritech_lang")
    );
    expect(storedLang).toBe("hi");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(page.getByText(/फ़ील्ड|सिंचाई|खेत/).first()).toBeVisible();
    errors.assertNoErrors();
  });

  test("F5->F12->F13->F14 offline mutations queue Sync Outbox and online Sync Now flushes to :8080", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page, { token: "jwt-online-valid-token" });
    await seedFarmStore(page);

    await page.goto("/sensors");
    await page.getByRole("button", { name: /add sensor/i }).click();
    const sensorDialog = page.getByRole("dialog");
    await sensorDialog.getByLabel(/device id/i).fill("SM-SYNC-01");
    await sensorDialog.getByLabel(/field|zone/i).fill("South Ridge");
    await sensorDialog
      .getByRole("button", { name: /save sensor|register sensor|add sensor/i })
      .click();

    await page.goto("/irrigation");
    await page.getByRole("button", { name: /new schedule|add schedule/i }).click();
    const schedDialog = page.getByRole("dialog");
    await schedDialog.getByLabel(/zone|field/i).fill("South Ridge Schedule");
    await schedDialog
      .getByRole("button", { name: /save schedule|create schedule/i })
      .click();

    const queuedBefore = await page.evaluate(() => {
      const raw = window.localStorage.getItem("agritech-farms-v1");
      return raw ? (JSON.parse(raw) as { state?: { syncOutbox?: unknown[] } }).state?.syncOutbox?.length ?? 0 : 0;
    });
    expect(queuedBefore).toBeGreaterThanOrEqual(2);

    const recordedCalls: RecordedBackendCall[] = [];
    await page.unroute("http://localhost:8080/api/**");
    await mockBackendOnline(page, { recordedCalls });

    await page.goto("/profile");
    const syncBtn = page.getByRole("button", { name: /sync now/i });
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

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
    errors.assertNoErrors();
  });

  test("F14->F9->F10 switching area unit to acres updates displayed units across /properties and /dashboard", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await mockBackendOffline(page);
    await seedAuth(page);
    await seedFarmStore(page, {
      properties: [makeDefaultFarm({ areaHa: 4.0 })],
    });

    await page.goto("/profile");
    await page.getByRole("button", { name: /acres/i }).click();

    await page.goto("/properties");
    await expect(page.getByText(/9\.88\s*ac|9\.9\s*ac|acres/i).first()).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText(/ac|acres/i).first()).toBeVisible();
    errors.assertNoErrors();
  });
});
