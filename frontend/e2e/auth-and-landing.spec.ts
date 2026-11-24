import { test, expect } from "@playwright/test";

test.describe("Task 5: Split-Screen Login, Signup & Editorial Landing", () => {
  test("login page renders split-screen AuthSplitShell, LiquidMetalLogo, preferred Google Auth above form, DemoAccountPicker, TactileButton, and zero hydration errors", async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /hydrat|did not match/i.test(msg.text())) {
        hydrationErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByTestId("auth-split-shell")).toBeVisible();
    await expect(page.getByTestId("liquid-metal-logo")).toBeVisible();
    await expect(page.getByTestId("demo-account-picker")).toBeVisible();

    // Preferred Google Auth must render visibly ahead of the email/password form
    const googleBtn = page.getByTestId("google-signin-button");
    await expect(googleBtn).toBeVisible();
    const googleBox = await googleBtn.boundingBox();
    const emailBox = await page.getByLabel(/email address/i).boundingBox();
    expect(googleBox).not.toBeNull();
    expect(emailBox).not.toBeNull();
    expect(googleBox!.height).toBeGreaterThanOrEqual(44);
    expect(googleBox!.y).toBeLessThan(emailBox!.y);

    // Verify password toggle hit target >= 44x44
    const toggleBox = await page
      .getByRole("button", { name: "Show password" })
      .boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(toggleBox!.width).toBeGreaterThanOrEqual(44);
    expect(toggleBox!.height).toBeGreaterThanOrEqual(44);

    // Click demo account picker to auto-fill farmer credentials
    await page.getByTestId("demo-fill-farmer").click();
    await expect(page.getByLabel(/email address/i)).toHaveValue("farmer@agritech.io");

    // Clear and submit empty to verify aria-describedby error linkage
    await page.getByLabel(/email address/i).fill("");
    await page.getByLabel("Password", { exact: true }).fill("");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByLabel(/email address/i)).toHaveAttribute(
      "aria-describedby",
      "email-error"
    );
    await expect(page.locator("#email-error")).toBeVisible();

    // Verify mobile layout (390x844) has no horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasOverflow).toBe(false);
    await expect(googleBtn).toBeVisible();
    expect(hydrationErrors).toEqual([]);
  });

  test("signup page renders human-free irrigation-drip.webp in split-screen shell and password strength meter", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/signup");

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByTestId("auth-split-shell")).toBeVisible();

    const imgSrcs = await page
      .locator("img")
      .evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src") || ""));
    expect(imgSrcs.some((s) => s.includes("irrigation-drip.webp"))).toBe(true);
    expect(imgSrcs.some((s) => s.includes("smart-farming"))).toBe(false);

    await page.getByLabel("Password", { exact: true }).fill("StrongPass123!");
    await expect(page.getByTestId("password-strength-meter")).toBeVisible();
  });

  test("editorial landing page (/) renders BrowserShowcaseFrame, LiquidMetalLogo, and human-free scroll story", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(page.getByTestId("browser-showcase-frame")).toBeVisible();
    await expect(page.getByTestId("landing-scroll-story")).toBeVisible();
    await expect(page.getByTestId("liquid-metal-logo").first()).toBeVisible();

    const imgSrcs = await page
      .locator("img")
      .evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src") || ""));
    expect(imgSrcs.some((s) => s.includes("smart-farming"))).toBe(false);
  });
});
