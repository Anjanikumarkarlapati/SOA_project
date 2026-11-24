import fs from "node:fs";
import path from "node:path";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AgriTechLogo } from "@/components/brand/AgriTechLogo";
import { DemoAccountPicker } from "@/components/auth/DemoAccountPicker";

const FRONTEND_ROOT = path.resolve(__dirname, "../../..");

describe("Area Figma Design System, Upgraded Logo & Astryx Button Integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("defines the Area Figma crisp white, deep olive (#485C11), sage (#DFECC6 / #8E9C78), and harmonized dark mode tokens in globals.css", () => {
    const css = fs.readFileSync(path.join(FRONTEND_ROOT, "src/app/globals.css"), "utf-8");

    expect(css).toContain("--bg-base: #FFFFFF");
    expect(css).toContain("--accent: #485C11");
    expect(css).toContain("--accent-wash: #DFECC6");
    expect(css).toContain("--block: #8E9C78");
    expect(css).toContain("--border-default: #E9E9E9");
    expect(css).toContain("--bg-base: #0E110B");
    expect(css).not.toMatch(/transition\s*:\s*all\b/);
  });

  it("renders the redesigned geometric botanical AgriTechLogo mark with stroke-dashoffset animation support", () => {
    render(<AgriTechLogo size="md" />);

    const logo = screen.getByTestId("agritech-logo");
    expect(logo).toBeTruthy();
    expect(logo.getAttribute("data-logo-variant")).toBe("geometric-botanical");
    expect(logo.textContent).toContain("AgriTech");
    expect(logo.innerHTML).toContain("stroke-dashoffset");
  });

  it("DemoAccountPicker populates real Spring Boot credentials (farmer1234 / admin1234)", () => {
    const onSelect = vi.fn();
    render(<DemoAccountPicker onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId("demo-fill-farmer"));
    expect(onSelect).toHaveBeenCalledWith({
      email: "farmer@agritech.io",
      password: "farmer1234",
    });

    fireEvent.click(screen.getByTestId("demo-fill-admin"));
    expect(onSelect).toHaveBeenCalledWith({
      email: "admin@agritech.io",
      password: "admin1234",
    });
  });

  it("wraps @astryxdesign/core/Button with farmer-friendly pill styling, loading state, and link mode", async () => {
    const { Button } = await import("@/components/ui/Button");
    const onClick = vi.fn();

    render(
      <div>
        <Button label="Sync Farms" variant="primary" elevation="low" onClick={onClick} />
        <Button label="Saving..." loading />
        <Button label="Open Planner" href="/recommendations" variant="secondary" />
      </div>
    );

    const syncBtn = screen.getByRole("button", { name: "Sync Farms" });
    expect(syncBtn.className).toContain("rounded-full");
    fireEvent.click(syncBtn);
    expect(onClick).toHaveBeenCalledTimes(1);

    const loadingBtn = screen.getByRole("button", { name: "Saving..." });
    expect(loadingBtn.getAttribute("aria-busy")).toBe("true");

    const linkBtn = screen.getByRole("link", { name: "Open Planner" });
    expect(linkBtn.getAttribute("href")).toBe("/recommendations");
  });

  it("contains zero pictographic emojis anywhere in frontend/src", () => {
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u2600-\u26FF]/u;
    const violations: string[] = [];

    function scan(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
          const text = fs.readFileSync(full, "utf-8");
          if (emojiRe.test(text)) {
            violations.push(path.relative(FRONTEND_ROOT, full));
          }
        }
      }
    }

    scan(path.join(FRONTEND_ROOT, "src"));
    expect(violations).toEqual([]);
  });

  it("uses @astryxdesign/core primitives across UI surfaces and removes developer JWT/Eureka/SCADA copy", () => {
    const bezelSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/components/ui/BezelCard.tsx"),
      "utf-8"
    );
    const buttonSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/components/ui/Button.tsx"),
      "utf-8"
    );
    const dashboardSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/app/dashboard/page.tsx"),
      "utf-8"
    );
    const profileSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/app/profile/page.tsx"),
      "utf-8"
    );

    expect(bezelSrc).toContain("@astryxdesign/core/Card");
    expect(buttonSrc).toContain("@astryxdesign/core/Button");
    expect(profileSrc).toContain("@astryxdesign/core/ButtonGroup");
    expect(dashboardSrc).toContain("@astryxdesign/core/Banner");
    expect(dashboardSrc).toContain("@astryxdesign/core/EmptyState");
    expect(
      fs.existsSync(path.join(FRONTEND_ROOT, "src/components/MicroservicesPipelineCard.tsx"))
    ).toBe(false);

    const uiFiles: string[] = [];
    for (const rootDir of ["src/app", "src/components"]) {
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== "__tests__") walk(full);
          } else if (/\.(ts|tsx)$/.test(entry.name)) {
            uiFiles.push(full);
          }
        }
      };
      walk(path.join(FRONTEND_ROOT, rootDir));
    }

    const forbidden = /\b(JWT|Eureka|Spring Cloud|Legacy SCADA)\b|:8080/i;
    const offending = uiFiles
      .filter((f) => forbidden.test(fs.readFileSync(f, "utf-8")))
      .map((f) => path.relative(FRONTEND_ROOT, f));

    expect(offending).toEqual([]);
  });
});
