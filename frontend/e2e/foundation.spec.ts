import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");

function walkFiles(dir: string, exts = [".ts", ".tsx", ".css"]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

test.describe("Task 1: Foundation, CSS Cascade & Zero-Humans Media Manifest", () => {
  test("globals.css wraps universal box reset in @layer base and removes smart-farming & duplicate .pngs", async () => {
    const css = fs.readFileSync(path.join(FRONTEND_ROOT, "src/app/globals.css"), "utf-8");
    expect(css).toMatch(/@layer\s+base\s*\{[\s\S]*?\*\s*\{/);

    const bannedImages = [
      "smart-farming.jpg",
      "smart-farming.png",
      "hero-field.png",
      "aerial-farm.png",
      "soil-sensing.png",
    ];
    for (const file of bannedImages) {
      expect(fs.existsSync(path.join(FRONTEND_ROOT, "public/images", file)), `${file} must be removed`).toBe(false);
    }

    const srcFiles = walkFiles(path.join(FRONTEND_ROOT, "src"));
    for (const f of srcFiles) {
      const content = fs.readFileSync(f, "utf-8");
      expect(content, `No smart-farming in ${path.relative(FRONTEND_ROOT, f)}`).not.toContain("smart-farming");
      expect(content, `No GCS Guard in ${path.relative(FRONTEND_ROOT, f)}`).not.toContain("GCS Guard");
    }

    const manifestPath = path.join(FRONTEND_ROOT, "src/lib/media-manifest.ts");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const { MEDIA_MANIFEST } = await import("../src/lib/media-manifest");
    const keys = Object.keys(MEDIA_MANIFEST);
    expect(keys).toEqual(
      expect.arrayContaining(["hero-field", "aerial-farm", "soil-sensing", "crop-canopy", "irrigation-drip", "logo-mark"])
    );
    for (const item of Object.values(MEDIA_MANIFEST) as Array<{ src: string; containsHumans: boolean }>) {
      expect(item.containsHumans).toBe(false);
      expect(item.src).not.toContain("smart-farming");
      const diskPath = path.join(FRONTEND_ROOT, "public", item.src.replace(/^\//, ""));
      expect(fs.existsSync(diskPath), `Asset missing on disk: ${item.src}`).toBe(true);
    }
  });

  test("Tailwind v4 .p-6 padding is not clobbered by unlayered universal reset", async ({ page }) => {
    await page.goto("/login");
    const paddingPx = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "p-6";
      document.body.appendChild(probe);
      const pad = parseFloat(window.getComputedStyle(probe).paddingTop);
      probe.remove();
      return pad;
    });
    expect(paddingPx).toBeGreaterThanOrEqual(16);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("GCS Guard");
  });

  test("Task 2: theme tokens, Tier-4 surfaces, overflow-x clip, and zero transition:all in globals.css", async ({ page }) => {
    const css = fs.readFileSync(path.join(FRONTEND_ROOT, "src/app/globals.css"), "utf-8");
    expect(css).not.toMatch(/transition\s*:\s*all\b/);
    expect(css).toContain("--accent-brass");
    expect(css).toContain("--bg-bezel");
    expect(css).toContain("--ease-out");
    expect(css).toContain("--ease-drawer");
    expect(css).toContain(".bg-archival-grain");
    expect(css).toContain(".bg-topographic-field");
    expect(css).toContain(".bg-oklch-wash");

    expect(fs.existsSync(path.join(FRONTEND_ROOT, "src/components/providers/ThemeProvider.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(FRONTEND_ROOT, "src/components/providers/MotionProvider.tsx"))).toBe(true);

    await page.goto("/login");
    const tokens = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement);
      const bodyStyle = window.getComputedStyle(document.body);
      return {
        brass: style.getPropertyValue("--accent-brass").trim(),
        bezel: style.getPropertyValue("--bg-bezel").trim(),
        easeOut: style.getPropertyValue("--ease-out").trim(),
        overflowX: bodyStyle.overflowX,
      };
    });
    expect(tokens.brass).toBeTruthy();
    expect(tokens.bezel).toBeTruthy();
    expect(tokens.easeOut).toContain("cubic-bezier");
    expect(tokens.overflowX).toBe("clip");
  });

  test("Task 3: AgriTechLogo and LiquidMetalLogo exist with Furrow-Leaf SVG and WebGL/fallback shaders", async () => {
    const logoPath = path.join(FRONTEND_ROOT, "src/components/brand/AgriTechLogo.tsx");
    const liquidPath = path.join(FRONTEND_ROOT, "src/components/brand/LiquidMetalLogo.tsx");
    expect(fs.existsSync(logoPath)).toBe(true);
    expect(fs.existsSync(liquidPath)).toBe(true);

    const logoSrc = fs.readFileSync(logoPath, "utf-8");
    expect(logoSrc).toContain("stroke-dashoffset");
    expect(logoSrc).toContain("AgriTech");

    const liquidSrc = fs.readFileSync(liquidPath, "utf-8");
    expect(liquidSrc).toContain("/logo-mark.svg");
    expect(liquidSrc).toContain("IntersectionObserver");
  });

  test("Task 4: TactileButton, HoldConfirmButton, BezelCard, SlidingTabs, and accessible Form wiring exist", async () => {
    const tactilePath = path.join(FRONTEND_ROOT, "src/components/ui/TactileButton.tsx");
    const holdPath = path.join(FRONTEND_ROOT, "src/components/ui/HoldConfirmButton.tsx");
    const bezelPath = path.join(FRONTEND_ROOT, "src/components/ui/BezelCard.tsx");
    const tabsPath = path.join(FRONTEND_ROOT, "src/components/ui/SlidingTabs.tsx");
    const formPath = path.join(FRONTEND_ROOT, "src/components/ui/Form.tsx");

    expect(fs.existsSync(tactilePath)).toBe(true);
    expect(fs.existsSync(holdPath)).toBe(true);
    expect(fs.existsSync(bezelPath)).toBe(true);
    expect(fs.existsSync(tabsPath)).toBe(true);

    const tactileSrc = fs.readFileSync(tactilePath, "utf-8");
    expect(tactileSrc).toContain("color-mix(in oklab");
    expect(tactileSrc).toContain("min-h-[44px]");

    const holdSrc = fs.readFileSync(holdPath, "utf-8");
    expect(holdSrc).toContain("inset(0");

    const bezelSrc = fs.readFileSync(bezelPath, "utf-8");
    expect(bezelSrc).toContain("--bg-bezel");
    expect(bezelSrc).toContain("AuthSlabFrame");

    const formSrc = fs.readFileSync(formPath, "utf-8");
    expect(formSrc).toContain("aria-describedby");
    expect(formSrc).toContain("aria-invalid");
  });
});
