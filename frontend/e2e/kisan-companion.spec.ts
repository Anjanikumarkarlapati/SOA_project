import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import {
  attachErrorListeners,
  expectNoHorizontalOverflow,
  makeDefaultFarm,
  mockBackendOffline,
  mockExternalMapAndFonts,
  mockOpenMeteo,
  seedAuth,
  seedFarmStore,
} from "./helpers/mocks";

const LEAF_FIXTURE = path.resolve(__dirname, "fixtures", "leaf.jpg");

async function setupCompanionEnv(page: Page) {
  await mockBackendOffline(page);
  await mockOpenMeteo(page, "normal");
  await mockExternalMapAndFonts(page);
  await seedAuth(page, { name: "Ramesh Kumar" });
  await seedFarmStore(page, {
    properties: [makeDefaultFarm()],
  });
}

test.describe("Daily Kisan Companion E2E (Desktop 1280x800 & Mobile 390x844)", () => {
  test("Dashboard Simple/Full toggle, 6 AM Action Card, Kyun?, Roznamcha, Crop Doctor & FPO Broadcast", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile";
    const errors = attachErrorListeners(page);
    await setupCompanionEnv(page);

    await page.route("**/api/ai/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isHealthy: false,
          healthStatus: "NOT HEALTHY",
          confidencePercent: 88,
          summary: "Early brown spot lesions detected on lower leaf blade.",
          problems: ["Brown spot (Bipolaris oryzae) early lesion"],
          organicRemedies: ["Spray Trichoderma viride 5 g/L or Neem oil 3 ml/L at dusk"],
          recommendedMedicines: [
            {
              name: "Mancozeb 75% WP",
              dosagePerAcre: "400 g/acre in 200 L water",
              harvestWaitDays: 14,
            },
          ],
          spraySafetyNote: "Spray only when wind is below 15 km/h and no rain is expected for 6 hours.",
          kvkReferral: false,
          helpline: "1800-180-1551",
        }),
      });
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("daily-action-card")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    if (isMobile) {
      const thumbBar = page.getByTestId("mobile-thumb-bar");
      const stickyHeader = page.getByTestId("app-sticky-header");
      await expect(thumbBar).toBeVisible();
      await expect(stickyHeader).toBeVisible();

      const headerBox = await stickyHeader.boundingBox();
      const thumbBox = await thumbBar.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(thumbBox).not.toBeNull();
      const combinedChrome = (headerBox?.height ?? 0) + (thumbBox?.height ?? 0);
      expect(combinedChrome).toBeLessThanOrEqual(Math.floor(844 * 0.15));

      for (const tabName of [/today/i, /mandi/i, /updates/i, /schemes/i, /scan\/voice/i]) {
        await expect(thumbBar.getByText(tabName)).toBeVisible();
      }
    } else {
      await expect(page.getByText(/FPO 1-to-50 Broadcast Command Center/i)).toBeVisible();
    }

    // Toggle Simple Farmer Mode
    await page.getByRole("radio", { name: /^Simple$/i }).click();
    await expect(page.getByTestId("simple-farmer-home")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Expand "Kyun?" dialect explanation
    const kyunBtn = page.getByRole("button", { name: /kyun\?/i });
    await kyunBtn.click();
    await expect(page.getByRole("button", { name: /log brief to roznamcha/i })).toBeVisible();

    // Open Kisan Roznamcha & create a signed entry
    await page.getByRole("button", { name: /^Roznamcha$/i }).click();
    const titleInput = page.getByLabel(/entry title/i);
    await expect(titleInput).toBeVisible();
    await titleInput.fill("Morning drip valve check");
    await page.getByLabel(/field details/i).fill("Soil moisture 62%, 1200 L scheduled");
    await page.getByRole("button", { name: /add signed entry/i }).click();
    await expect(page.getByText("Morning drip valve check")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(titleInput).toBeHidden();

    // Open Crop Photo Doctor (via thumb bar sheet on mobile or tile on desktop)
    if (isMobile) {
      await page.getByTestId("mobile-camera-voice-tab").click();
      await page.getByRole("button", { name: /crop photo doctor/i }).last().click();
    } else {
      await page.getByTestId("sidebar-crop-doctor-button").click();
    }

    const doctorDialog = page.getByRole("dialog");
    await expect(doctorDialog).toBeVisible();
    await doctorDialog.getByLabel(/upload leaf photo from device/i).setInputFiles(LEAF_FIXTURE);
    await expect(doctorDialog.getByText(/leaf photo ready/i)).toBeVisible();
    await doctorDialog.getByRole("button", { name: /analyze leaf photo/i }).click();

    await expect(doctorDialog.getByText("NOT HEALTHY").first()).toBeVisible();
    await expect(doctorDialog.getByText(/Brown spot \(Bipolaris oryzae\)/i)).toBeVisible();
    await expect(doctorDialog.getByText("Mancozeb 75% WP")).toBeVisible();
    await expect(doctorDialog.getByText(/400 g\/acre in 200 L water/i)).toBeVisible();
    await expect(doctorDialog.getByText(/Spray only when wind is below 15 km\/h/i)).toBeVisible();

    await doctorDialog.getByRole("button", { name: /^Close$/i }).last().click();
    await expect(doctorDialog).toBeHidden();

    // Switch back to Full mode
    await page.getByRole("radio", { name: /^Full$/i }).click();
    await expect(page.getByText(/FPO 1-to-50 Broadcast Command Center/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    errors.assertNoErrors();
  });

  test("Updates State Agri-Pulse filter, Truth Shield verification & SSRF rejection", async ({
    page,
    request,
  }) => {
    const errors = attachErrorListeners(page);
    await setupCompanionEnv(page);

    // Direct API SSRF verification
    const ssrfRes = await request.post("/api/state-pulse/verify", {
      data: { url: "http://127.0.0.1:8080/actuator/health" },
    });
    expect(ssrfRes.status()).toBe(400);

    await page.route("**/api/state-pulse/verify", async (route) => {
      const reqBody = route.request().postDataJSON() as { url?: string };
      if (reqBody?.url?.includes("127.0.0.1")) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Private/local network URLs are blocked." }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          score: {
            totalPercent: 94,
            tierLabel: "VERIFIED_OFFICIAL",
            breakdown: {
              officialGovt: 50,
              crossSource: 18,
              recency: 14,
              groundSafety: 12,
            },
          },
          platform: "gov",
          scamRisk: false,
          warnings: [],
          fetchedTitle: "PM-KISAN Samman Nidhi Portal",
          fetchedDescription: "Official beneficiary e-KYC portal.",
          metadataSource: "opengraph",
          summary: "Verified official .gov.in portal with safe guidance.",
          citations: [{ title: "PM-KISAN Official Portal", url: "https://pmkisan.gov.in/" }],
          reportPayload: {
            title: "PM-KISAN Samman Nidhi Portal",
            checkedInput: "https://pmkisan.gov.in/",
            platform: "gov",
            locationLabel: "Ludhiana, Punjab",
            score: {
              totalPercent: 94,
              tierLabel: "VERIFIED_OFFICIAL",
              breakdown: {
                officialGovt: 50,
                crossSource: 18,
                recency: 14,
                groundSafety: 12,
              },
            },
            summary: "Verified official .gov.in portal with safe guidance.",
            citations: [{ title: "PM-KISAN Official Portal", url: "https://pmkisan.gov.in/" }],
            checkedAtIso: "2026-11-28T06:00:00.000Z",
          },
        }),
      });
    });

    await page.goto("/updates");
    await expect(page.getByText(/State Agri-Pulse Feed/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Filter feed to Official 85%+
    await page.getByRole("radio", { name: /Official 85%\+/i }).click();
    await expect(page.getByText(/State Agri-Pulse Feed/i)).toBeVisible();

    // Switch to Verify Link view and verify SSRF rejection in UI
    await page.getByRole("radio", { name: /Verify Link/i }).click();
    const urlInput = page.getByPlaceholder(/https:\/\/wa\.me/i);
    await urlInput.fill("http://127.0.0.1:8080/actuator/health");
    await page.getByRole("button", { name: /verify truth score/i }).click();
    await expect(page.getByText(/Blocked or Invalid Input/i)).toBeVisible();

    // Verify public official link -> ProgressBar + Share/Download PNG buttons
    await page.getByRole("button", { name: /test official link/i }).click();
    await page.getByRole("button", { name: /verify truth score/i }).click();

    const verifyResult = page.getByTestId("truth-verify-result");
    await expect(verifyResult).toBeVisible();
    await expect(verifyResult.getByRole("progressbar")).toBeVisible();
    await expect(verifyResult.getByText("94%").first()).toBeVisible();
    await expect(verifyResult.getByRole("button", { name: /share fact-check png/i })).toBeVisible();
    await expect(verifyResult.getByRole("button", { name: /download 1080x1080 report/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    errors.assertNoErrors();
  });

  test("Mandi & MSP Board live break-even calculation and APMC table", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await setupCompanionEnv(page);

    await page.goto("/mandi");
    await expect(page.getByRole("heading", { name: /Personal Break-Even Cost Bar/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const inputCostField = page.getByLabel(/input cost per acre/i);
    await inputCostField.fill("45000");
    await inputCostField.press("Tab");

    // 45,000 / 18 = ₹2,500/q break-even floor
    await expect(page.getByText("₹2,500/q").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    errors.assertNoErrors();
  });

  test("Schemes PMKSY 45%/55% estimator and 72-Hr PMFBY Loss Locker with photo", async ({
    page,
  }) => {
    const errors = attachErrorListeners(page);
    await setupCompanionEnv(page);

    await page.goto("/schemes");
    await expect(page.getByRole("heading", { name: /Schemes, Subsidy Estimator/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // PMKSY 45%/55% estimator tab
    await page.getByRole("tab", { name: /water & soil/i }).click();
    await expect(page.getByText(/PMKSY Drip & Sprinkler Subsidy Estimator/i)).toBeVisible();
    await expect(page.getByText(/55% Central \+ 20% State/i)).toBeVisible();
    await page.getByRole("radio", { name: /Other \(45%\)/i }).click();
    await expect(page.getByText(/45% Central \+ 15% State/i)).toBeVisible();

    // 72-Hr Loss Locker tab
    await page.getByRole("tab", { name: /72-hr loss locker/i }).click();
    await expect(page.getByText(/72-Hr PMFBY Localized Loss Evidence Locker/i)).toBeVisible();
    await expect(page.getByText(/remaining/i).first()).toBeVisible();

    const lockerPanel = page.locator("#panel-locker");
    await lockerPanel.getByLabel(/upload leaf photo from device/i).setInputFiles(LEAF_FIXTURE);
    await expect(lockerPanel.getByText(/leaf photo ready/i)).toBeVisible();
    await lockerPanel.getByLabel(/damage notes/i).fill("Standing flood water 20 cm in east bund");
    await lockerPanel.getByRole("button", { name: /lock 72-hr pmfby evidence pack/i }).click();

    await expect(page.getByText(/PMFBY loss evidence saved locally/i)).toBeVisible();
    await expect(page.getByText(/1 photo\(s\) in IndexedDB/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    errors.assertNoErrors();
  });
});
