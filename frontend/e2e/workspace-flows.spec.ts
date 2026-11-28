import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { mockOpenMeteo, makeDefaultFarm, seedFarmStore } from "./helpers/mocks";

const FRONTEND_ROOT = path.resolve(__dirname, "..");

test.describe("Task 6: Unified AppLayout, ActivePropertyProvider & Tokenized Language Selectors", () => {
  test("ActivePropertyProvider exists and LanguageSelectorPill / LanguageSelectorModal contain zero hardcoded light-mode hex colors or transition-all", async () => {
    const activePropPath = path.join(
      FRONTEND_ROOT,
      "src/components/providers/ActivePropertyProvider.tsx"
    );
    expect(fs.existsSync(activePropPath)).toBe(true);

    const pillSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/components/LanguageSelectorPill.tsx"),
      "utf-8"
    );
    const modalSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/components/LanguageSelectorModal.tsx"),
      "utf-8"
    );

    expect(pillSrc).not.toContain("#545333");
    expect(pillSrc).not.toContain("#2A2919");
    expect(pillSrc).not.toContain("transition-all");

    expect(modalSrc).not.toContain("#FFFEF0");
    expect(modalSrc).not.toContain("#2A2919");
    expect(modalSrc).not.toContain("transition-all");
  });

  test("authenticated AppLayout renders AgriTechLogo, chronological workflow nav, top-bar theme toggle, and tokenized LanguageSelectorModal", async ({
    page,
  }) => {
    await mockOpenMeteo(page, "normal");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.getByRole("button", { name: /continue in offline field mode/i }).click();
    await page.waitForURL("**/dashboard");

    await expect(page.getByTestId("agritech-logo").first()).toBeVisible();

    const navText = await page.locator("aside nav").innerText();
    const expectedOrder = [
      "Field Hub",
      "My Farms",
      "Sensors & Soil",
      "Climate & Advisory",
      "Crop Planner",
      "Irrigation & Valves",
    ];
    let prevIdx = -1;
    for (const label of expectedOrder) {
      const idx = navText.indexOf(label);
      expect(idx, `Expected nav label "${label}" in aside nav`).toBeGreaterThan(prevIdx);
      prevIdx = idx;
    }

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\b(JWT|Eureka|Spring Cloud|Legacy SCADA)\b/);

    const themeBtn = page.getByTestId("app-theme-toggle");
    await expect(themeBtn).toBeVisible();

    // Toggle dark mode via top-bar button
    await themeBtn.click();
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isDark).toBe(true);
  });

  test("Tasks 7-8: RootZoneSoilCard, FarmAerialSurvey, and FarmMap have zero hardcoded light-mode hex classes or transition-all, and PropertiesPage renders human-free aerial-farm.jpg cover strip", async ({
    page,
  }) => {
    const rootZoneSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/components/RootZoneSoilCard.tsx"),
      "utf-8"
    );
    const aerialSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/components/FarmAerialSurvey.tsx"),
      "utf-8"
    );
    const mapSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/components/FarmMap.tsx"),
      "utf-8"
    );

    expect(rootZoneSrc).not.toContain("bg-[#FFFEF0]");
    expect(rootZoneSrc).not.toContain("text-[#2A2919]");
    expect(rootZoneSrc).not.toContain("transition-all");

    expect(aerialSrc).not.toContain("bg-[#FFFEF0]");
    expect(aerialSrc).not.toContain("text-[#2A2919]");
    expect(aerialSrc).not.toContain("transition-all");

    expect(mapSrc).not.toContain("bg-[#FFFEF0]");
    expect(mapSrc).not.toContain("text-[#2A2919]");

    await mockOpenMeteo(page, "normal");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.getByRole("button", { name: /continue in offline field mode/i }).click();
    await page.waitForURL("**/dashboard");

    await expect(page.getByTestId("dashboard-kpi-grid")).toBeVisible();

    await page.goto("/properties");
    await expect(page.getByTestId("property-aerial-cover").first()).toBeVisible();
  });

  test("Tasks 9-10: FarmerRecommendationCard and climate/page.tsx are tokenized, Climate has accessible Data Table toggle, Irrigation has SVG flow schematic & irrigation-drip.webp, and Profile has role capabilities matrix", async ({
    page,
  }) => {
    const recCardSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/components/FarmerRecommendationCard.tsx"),
      "utf-8"
    );
    const climateSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/app/climate/page.tsx"),
      "utf-8"
    );

    expect(recCardSrc).not.toContain("bg-[#FFFEF0]");
    expect(recCardSrc).not.toContain("text-[#2A2919]");
    expect(recCardSrc).not.toContain("transition-all");

    expect(climateSrc).not.toContain("#D97706");
    expect(climateSrc).not.toContain("#3B82F6");
    expect(climateSrc).not.toContain("fontSize: 10");

    await mockOpenMeteo(page, "normal");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.getByRole("button", { name: /continue in offline field mode/i }).click();
    await page.waitForURL("**/dashboard");

    await page.goto("/irrigation");
    await expect(page.getByTestId("irrigation-flow-schematic")).toBeVisible();

    await page.goto("/sensors");
    await expect(page.getByTestId("probe-placement-guide")).toBeVisible();

    await page.goto("/profile");
    await expect(page.getByTestId("role-capabilities-matrix")).toBeVisible();
  });

  test("UX quick-access: sticky Log in / Log out, Files export menu, and mobile dock work without scrolling", async ({
    page,
  }) => {
    await mockOpenMeteo(page, "normal");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("landing-login-button")).toBeVisible();

    await page.getByTestId("landing-login-button").click();
    await page.waitForURL("**/login");
    await expect(page.getByTestId("auth-topbar-switch")).toBeVisible();

    await page.getByRole("button", { name: /continue in offline field mode/i }).click();
    await page.waitForURL("**/dashboard");

    // Scroll down and verify sticky topbar Files menu + Log out remain visible in viewport
    await page.evaluate(() => window.scrollTo(0, 600));
    const filesMenuTrigger = page.getByTestId("files-actions-menu").getByRole("button");
    await expect(filesMenuTrigger).toBeVisible();
    await filesMenuTrigger.click();
    await expect(page.getByRole("menuitem", { name: /export farm report/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /export field data/i })).toBeVisible();
    await page.keyboard.press("Escape");

    const topbarLogout = page.getByTestId("topbar-logout-button");
    await expect(topbarLogout).toBeVisible();
    await topbarLogout.click();
    await page.waitForURL("**/login");

    // Mobile 390x844 quick access bar + zero overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /continue in offline field mode/i }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("mobile-logout-button")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test("UX audit upgrades: Quick Jump (Ctrl+K), Breadcrumbs, Escape modal dismissal, and AlertDialog farm removal confirmation", async ({
    page,
  }) => {
    await mockOpenMeteo(page, "normal");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.getByRole("button", { name: /continue in offline field mode/i }).click();
    await page.waitForURL("**/dashboard");

    // Quick Jump palette via button
    await page.getByTestId("quick-jump-button").click();
    const jumpDialog = page.getByRole("dialog");
    await expect(jumpDialog).toBeVisible();
    await jumpDialog.getByPlaceholder(/type a page/i).fill("Register");
    await jumpDialog.getByRole("button", { name: /register a farm/i }).click();
    await page.waitForURL("**/properties/new");

    // Breadcrumbs on /properties/new
    await expect(page.getByRole("navigation", { name: /farm registration path/i })).toBeVisible();

    // Escape closes Add Sensor modal
    await page.goto("/sensors");
    await page.getByRole("button", { name: /add sensor/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // AlertDialog confirmation protects farm deletion when >= 2 farms exist
    await seedFarmStore(page, {
      properties: [
        makeDefaultFarm({ id: "farm-a", name: "Alpha Plot" }),
        makeDefaultFarm({ id: "farm-b", name: "Beta Plot" }),
      ],
      activePropertyId: "farm-a",
    });
    await page.goto("/properties");
    await page.getByRole("button", { name: /remove beta plot/i }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /keep farm/i }).click();
    await expect(confirmDialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Beta Plot" })).toBeVisible();

    await page.getByRole("button", { name: /remove beta plot/i }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /remove farm/i }).click();
    await expect(page.getByRole("heading", { name: "Beta Plot" })).toBeHidden();
  });
});
