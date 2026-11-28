import { describe, expect, it } from "vitest";
import {
  MSP_BENCHMARKS_2025_26,
  calculateBreakEven,
  formatInr,
  getMandiRatesForLocation,
} from "@/lib/mandi-data";

describe("mandi-data", () => {
  it("formats INR values with ₹ prefix and Indian grouping", () => {
    expect(formatInr(2369)).toBe("₹2,369");
    expect(formatInr(125430.6)).toBe("₹1,25,431");
    expect(formatInr(-450)).toBe("-₹450");
    expect(formatInr(Number.NaN)).toBe("₹0");
  });

  it("calculates break-even, net modal, profit, margin, and SELL_NOW/WATCH/HOLD verdicts", () => {
    const profitable = calculateBreakEven(20_000, 20, 2500, 100);
    expect(profitable).toEqual({
      breakEvenPerQuintal: 1000,
      netModalPerQuintal: 2400,
      profitPerQuintal: 1400,
      marginPercent: 140,
      verdict: "SELL_NOW",
    });

    const thinMargin = calculateBreakEven(23_000, 10, 2480, 100);
    expect(thinMargin.breakEvenPerQuintal).toBe(2300);
    expect(thinMargin.netModalPerQuintal).toBe(2380);
    expect(thinMargin.profitPerQuintal).toBe(80);
    expect(thinMargin.verdict).toBe("WATCH");

    const loss = calculateBreakEven(30_000, 10, 2400, 150);
    expect(loss.breakEvenPerQuintal).toBe(3000);
    expect(loss.netModalPerQuintal).toBe(2250);
    expect(loss.profitPerQuintal).toBe(-750);
    expect(loss.verdict).toBe("HOLD");
  });

  it("handles zero or negative yield and non-finite inputs safely without NaN/Infinity", () => {
    const zeroYield = calculateBreakEven(20_000, 0, 2400, 100);
    expect(Number.isFinite(zeroYield.breakEvenPerQuintal)).toBe(true);
    expect(Number.isFinite(zeroYield.netModalPerQuintal)).toBe(true);
    expect(Number.isFinite(zeroYield.profitPerQuintal)).toBe(true);
    expect(Number.isFinite(zeroYield.marginPercent)).toBe(true);
    expect(zeroYield.breakEvenPerQuintal).toBe(0);
    expect(zeroYield.verdict).toBe("HOLD");

    const negYield = calculateBreakEven(15_000, -5, 2200, 50);
    expect(Number.isNaN(negYield.marginPercent)).toBe(false);
    expect(negYield.verdict).toBe("HOLD");
  });

  it("provides 2025-26 MSP benchmarks and location-filtered APMC & e-NAM rates across all 11 major crops", () => {
    const requiredCrops = [
      "Paddy",
      "Wheat",
      "Maize",
      "Mustard",
      "Cotton",
      "Groundnut",
      "Soybean",
      "Tur/Arhar",
      "Onion",
      "Tomato",
      "Potato",
    ];
    for (const crop of requiredCrops) {
      expect(MSP_BENCHMARKS_2025_26.some((b) => b.crop === crop)).toBe(true);
    }

    const odRates = getMandiRatesForLocation("OD", "Cuttack");
    expect(odRates.length).toBeGreaterThanOrEqual(6);
    expect(odRates.some((r) => r.districtName === "Cuttack")).toBe(true);
    expect(odRates.some((r) => r.source === "e-NAM")).toBe(true);

    const apRates = getMandiRatesForLocation("AP", "Guntur", "Cotton");
    expect(apRates.length).toBeGreaterThan(0);
    expect(apRates.every((r) => r.crop === "Cotton")).toBe(true);
    expect(apRates[0].minPriceInr).toBeLessThanOrEqual(apRates[0].modalPriceInr);
    expect(apRates[0].modalPriceInr).toBeLessThanOrEqual(apRates[0].maxPriceInr);
  });
});
