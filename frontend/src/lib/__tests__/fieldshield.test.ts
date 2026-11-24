import { describe, expect, it } from "vitest";
import {
  buildVernacularShiftBriefing,
  computeWaterBudget,
  evaluateValveInterlock,
} from "@/lib/fieldshield";
import { SUPPORTED_LANGUAGES, translate } from "@/lib/i18n";

describe("FieldShield computeWaterBudget", () => {
  it("computes ETc, gross demand, efficiency-adjusted net delivery, and runtime for drip irrigation", () => {
    const res = computeWaterBudget({
      areaHa: 2,
      todayEt0: 5,
      todayRainMm: 0,
      kc: 1.15,
      irrigationType: "drip",
      pumpFlowLpm: 120,
    });

    expect(res.etcMm).toBe(5.75);
    expect(res.grossLitres).toBe(115000);
    expect(res.effectiveRainCreditLitres).toBe(0);
    expect(res.efficiency).toBe(0.9);
    expect(res.netDeliveryLitres).toBe(Math.round(115000 / 0.9));
    expect(res.recommendedMinutes).toBe(Math.round(res.netDeliveryLitres / 120));
  });

  it("orders netDeliveryLitres by system efficiency: flood > sprinkler > drip > rainfed", () => {
    const base = { areaHa: 1, todayEt0: 4, todayRainMm: 0, kc: 1, pumpFlowLpm: 100 };
    const flood = computeWaterBudget({ ...base, irrigationType: "flood" });
    const sprinkler = computeWaterBudget({ ...base, irrigationType: "sprinkler" });
    const drip = computeWaterBudget({ ...base, irrigationType: "drip" });
    const rainfed = computeWaterBudget({ ...base, irrigationType: "rainfed" });

    expect(flood.efficiency).toBe(0.55);
    expect(sprinkler.efficiency).toBe(0.75);
    expect(drip.efficiency).toBe(0.9);
    expect(rainfed.efficiency).toBe(1);
    expect(flood.netDeliveryLitres).toBeGreaterThan(sprinkler.netDeliveryLitres);
    expect(sprinkler.netDeliveryLitres).toBeGreaterThan(drip.netDeliveryLitres);
    expect(drip.netDeliveryLitres).toBeGreaterThan(rainfed.netDeliveryLitres);
  });

  it("credits effective rain (>5mm * 0.8) and clamps net delivery at 0 when rain exceeds crop demand", () => {
    const lightRain = computeWaterBudget({
      areaHa: 1,
      todayEt0: 5,
      todayRainMm: 5,
      kc: 1,
      irrigationType: "drip",
      pumpFlowLpm: 100,
    });
    expect(lightRain.effectiveRainCreditLitres).toBe(0);

    const modRain = computeWaterBudget({
      areaHa: 1,
      todayEt0: 10,
      todayRainMm: 10,
      kc: 1,
      irrigationType: "drip",
      pumpFlowLpm: 100,
    });
    expect(modRain.effectiveRainCreditLitres).toBe(80000);
    expect(modRain.netDeliveryLitres).toBe(Math.round(20000 / 0.9));

    const heavyRain = computeWaterBudget({
      areaHa: 1,
      todayEt0: 5,
      todayRainMm: 20,
      kc: 1,
      irrigationType: "drip",
      pumpFlowLpm: 100,
    });
    expect(heavyRain.netDeliveryLitres).toBe(0);
    expect(heavyRain.recommendedMinutes).toBe(0);
  });

  it("handles 0 ha, negative inputs, and 0/NaN pumpFlowLpm safely without NaN or Infinity", () => {
    const zeroArea = computeWaterBudget({
      areaHa: 0,
      todayEt0: 5,
      todayRainMm: 0,
      kc: 1.1,
      irrigationType: "drip",
      pumpFlowLpm: 120,
    });
    expect(zeroArea).toMatchObject({
      grossLitres: 0,
      effectiveRainCreditLitres: 0,
      netDeliveryLitres: 0,
      recommendedMinutes: 0,
    });

    const badInputs = computeWaterBudget({
      areaHa: -2,
      todayEt0: -4,
      todayRainMm: -10,
      kc: 1,
      irrigationType: "drip",
      pumpFlowLpm: 0,
    });
    expect(Number.isFinite(badInputs.netDeliveryLitres)).toBe(true);
    expect(Number.isFinite(badInputs.recommendedMinutes)).toBe(true);
    expect(badInputs.netDeliveryLitres).toBe(0);
    expect(badInputs.recommendedMinutes).toBe(0);

    const zeroPump = computeWaterBudget({
      areaHa: 1,
      todayEt0: 4,
      todayRainMm: 0,
      kc: 1,
      irrigationType: "drip",
      pumpFlowLpm: Number.NaN,
    });
    expect(zeroPump.recommendedMinutes).toBe(0);
  });
});

describe("FieldShield evaluateValveInterlock", () => {
  it("returns ok with 0 waste under dry, calm, optimal moisture conditions", () => {
    const decision = evaluateValveInterlock({
      rainProbMax: 15,
      todayRainMm: 0,
      currentWindKmh: 8,
      soilMoisturePct: 55,
      optimalMoistureRange: [45, 70],
      waterBudgetLitres: 20000,
    });
    expect(decision).toEqual({
      triggered: false,
      severity: "ok",
      reasons: [],
      estimatedWasteLitres: 0,
    });
  });

  it("triggers hold independently for rain probability >= 50%, rain >= 10mm, or saturated soil", () => {
    const byProb = evaluateValveInterlock({
      rainProbMax: 50,
      todayRainMm: 0,
      currentWindKmh: 5,
      soilMoisturePct: 50,
      optimalMoistureRange: [45, 70],
      waterBudgetLitres: 20000,
    });
    expect(byProb.triggered).toBe(true);
    expect(byProb.severity).toBe("hold");
    expect(byProb.estimatedWasteLitres).toBe(20000);

    const byRain = evaluateValveInterlock({
      rainProbMax: 20,
      todayRainMm: 10,
      currentWindKmh: 5,
      soilMoisturePct: 50,
      optimalMoistureRange: [45, 70],
      waterBudgetLitres: 15000,
    });
    expect(byRain.severity).toBe("hold");

    const byMoisture = evaluateValveInterlock({
      rainProbMax: 10,
      todayRainMm: 0,
      currentWindKmh: 5,
      soilMoisturePct: 71,
      optimalMoistureRange: [45, 70],
      waterBudgetLitres: 12000,
    });
    expect(byMoisture.severity).toBe("hold");
  });

  it("triggers caution on high wind >= 20 km/h and gives hold precedence when combined", () => {
    const cautionOnly = evaluateValveInterlock({
      rainProbMax: 10,
      todayRainMm: 0,
      currentWindKmh: 20,
      soilMoisturePct: 55,
      optimalMoistureRange: [45, 70],
      waterBudgetLitres: 20000,
    });
    expect(cautionOnly.triggered).toBe(true);
    expect(cautionOnly.severity).toBe("caution");
    expect(cautionOnly.estimatedWasteLitres).toBe(5000);

    const combined = evaluateValveInterlock({
      rainProbMax: 75,
      todayRainMm: 0,
      currentWindKmh: 25,
      soilMoisturePct: 55,
      optimalMoistureRange: [45, 70],
      waterBudgetLitres: 20000,
    });
    expect(combined.severity).toBe("hold");
    expect(combined.reasons.length).toBeGreaterThanOrEqual(2);
  });
});

describe("FieldShield buildVernacularShiftBriefing", () => {
  it("builds a localized shift brief across all 11 supported languages using briefing.* i18n keys", () => {
    for (const meta of SUPPORTED_LANGUAGES) {
      const brief = buildVernacularShiftBriefing({
        farmName: "Kaveri Plot",
        cropName: "Paddy",
        priorityZone: "Zone Gamma",
        netLitres: 42000,
        recommendedMinutes: 35,
        spraySafe: true,
        topTasks: ["Check drip manifold", "Inspect leaf wetness"],
        language: meta.code,
        t: (k, fallback) => translate(meta.code, k, fallback),
      });

      expect(brief).toContain(`[${meta.code.toUpperCase()}]`);
      expect(brief).toContain("Kaveri Plot");
      expect(brief).toContain("Paddy");
      expect(brief).toContain("Zone Gamma");
      expect(brief).toContain("42,000 L");
      expect(brief).toContain("35 min");
      expect(brief).toContain("1. Check drip manifold");
      expect(brief).toContain("2. Inspect leaf wetness");
      expect(brief).toContain(translate(meta.code, "briefing.title"));
      expect(brief).toContain(translate(meta.code, "briefing.spraySafe"));
    }
  });

  it("formats rain-hold (netLitres <= 0) and empty tasks cleanly", () => {
    const brief = buildVernacularShiftBriefing({
      farmName: "Cuttack Farm",
      cropName: "Rice",
      priorityZone: "Zone Alpha",
      netLitres: 0,
      recommendedMinutes: 0,
      spraySafe: false,
      topTasks: [],
      language: "hi",
      t: (k, fallback) => translate("hi", k, fallback),
    });

    expect(brief).toContain(translate("hi", "briefing.irrigationHold"));
    expect(brief).toContain(translate("hi", "briefing.sprayHold"));
    expect(brief).toContain(translate("hi", "briefing.noTasks"));
  });
});
