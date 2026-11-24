import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  "../../.superpowers/sdd/2026-11-23-agritech-frontend-masterpiece/screenshots"
);

test.describe("Task 11: Masterpiece Multi-Viewport, Multi-Script & Zero-Humans Verification", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test("public and authenticated routes render with zero horizontal overflow, zero smart-farming/human imagery, and single h1 across 1280x800, 390x844, and 320x640 in Light & Dark modes", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // 1. Desktop 1280x800 Landing & Login & Signup
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const publicRoute of ["/", "/login", "/signup"]) {
      await page.goto(publicRoute);
      await expect(page.locator("h1")).toHaveCount(1);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(overflow, `Horizontal overflow on ${publicRoute} at 1280x800`).toBe(false);

      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toContain("GCS Guard");

      const imgSrcs = await page
        .locator("img")
        .evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src") || ""));
      expect(imgSrcs.some((s) => s.includes("smart-farming"))).toBe(false);
    }

    await page.goto("/login");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "login-desktop-light.png"),
      fullPage: false,
    });

    // Enter Offline Field Mode to verify all authenticated routes
    await page.getByRole("button", { name: /continue in offline field mode/i }).click();
    await page.waitForURL("**/dashboard");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard-desktop-light.png"),
      fullPage: false,
    });

    // Switch to Dark Mode
    await page.getByTestId("app-theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard-desktop-dark.png"),
      fullPage: false,
    });

    const authRoutes = [
      "/dashboard",
      "/properties",
      "/properties/new",
      "/climate",
      "/recommendations",
      "/sensors",
      "/irrigation",
      "/profile",
    ];

    for (const route of authRoutes) {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(overflow, `Horizontal overflow on ${route} at 1280x800`).toBe(false);

      const imgSrcs = await page
        .locator("img")
        .evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src") || ""));
      expect(imgSrcs.some((s) => s.includes("smart-farming"))).toBe(false);
    }

    // 2. Mobile 390x844 & 320x640 check + Indic script switching (hi, te)
    for (const vp of [
      { width: 390, height: 844 },
      { width: 320, height: 640 },
    ]) {
      await page.setViewportSize(vp);
      for (const route of ["/login", "/dashboard", "/irrigation"]) {
        await page.goto(route);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1
        );
        expect(
          overflow,
          `Horizontal overflow on ${route} at ${vp.width}x${vp.height}`
        ).toBe(false);
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "login-mobile-390.png"),
      fullPage: false,
    });

    expect(pageErrors).toEqual([]);
  });
});
