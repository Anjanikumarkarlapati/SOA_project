import { describe, expect, it } from "vitest";
import { buildDailyBriefing } from "@/lib/daily-briefing";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import type { FarmProperty } from "@/lib/property-store";

const SAMPLE_PROPERTY: FarmProperty = {
  id: "farm-ludhiana-1",
  name: "Ludhiana Wheat Parcel",
  lat: 30.901,
  lon: 75.857,
  address: "Ludhiana, Punjab",
  areaHa: 2.5,
  waterSource: "borewell",
  irrigationType: "drip",
  soilType: "loam",
  cropIntent: "GROW_NOW",
  selectedCropId: "wheat",
  previousCrops: ["Rice"],
  sensorRecs: [],
  createdAt: "2026-11-28T06:00:00.000Z",
  updatedAt: "2026-11-28T06:00:00.000Z",
  syncedToBackend: false,
};

function countSentences(text: string): number {
  const cleaned = text.trim();
  // Strip decimal points inside numbers before counting sentence terminators (. । ! ?)
  const withoutDecimals = cleaned.replace(/(\d)\.(\d)/g, "$1_$2");
  const parts = withoutDecimals
    .split(/[.।!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length;
}

describe("buildDailyBriefing", () => {
  it("computes SAFE irrigation and spray verdicts when moisture is moderate, rain is low, and wind is calm", () => {
    const briefing = buildDailyBriefing(
      SAMPLE_PROPERTY,
      {
        todayEt0: 4.5,
        todayRainMm: 0,
        rainProbMax: 10,
        currentWindKmh: 8,
        currentSoilMoisturePct: 54,
        pumpFlowLpm: 120,
      },
      {
        cropName: "Wheat",
        mandiName: "Khanna APMC",
        modalPriceInr: 2540,
        mspInr: 2425,
        verdict: "SELL_NOW",
      },
      "en"
    );

    expect(briefing.irrigationVerdict.action).toBe("IRRIGATE");
    expect(briefing.irrigationVerdict.netLitres).toBeGreaterThan(0);
    expect(briefing.irrigationVerdict.recommendedMinutes).toBeGreaterThan(0);
    expect(briefing.sprayWindow.status).toBe("SAFE");
    expect(briefing.sprayWindow.windKmh).toBe(8);
    expect(briefing.marketHeadline).toContain("Khanna APMC");
    expect(briefing.marketHeadline).toContain("2,540");
    expect(countSentences(briefing.kyunReason)).toBe(2);
    expect(briefing.kyunReason).toContain("54%");
    expect(briefing.kyunReason).toContain("10%");
    expect(briefing.kyunReason).toContain("8 km/h");
  });

  it("triggers HOLD via evaluateValveInterlock when rain probability >= 50% or rainfall >= 10mm or wind >= 20 km/h", () => {
    const briefing = buildDailyBriefing(
      SAMPLE_PROPERTY,
      {
        todayEt0: 4.0,
        todayRainMm: 14,
        rainProbMax: 78,
        currentWindKmh: 24,
        currentSoilMoisturePct: 68,
        pumpFlowLpm: 120,
      },
      null,
      "en"
    );

    expect(briefing.irrigationVerdict.action).toBe("HOLD");
    expect(briefing.irrigationVerdict.estimatedWasteLitres).toBeGreaterThan(0);
    expect(briefing.sprayWindow.status).toBe("HOLD");
    expect(briefing.sprayWindow.windKmh).toBe(24);
    expect(countSentences(briefing.kyunReason)).toBe(2);
    expect(briefing.kyunReason).toContain("68%");
    expect(briefing.kyunReason).toContain("78%");
    expect(briefing.kyunReason).toContain("14");
    expect(briefing.kyunReason).toContain("24");
  });

  it("returns CAUTION spray window when wind is 15-19 km/h and rain is below hold threshold", () => {
    const briefing = buildDailyBriefing(
      SAMPLE_PROPERTY,
      {
        todayEt0: 4.0,
        todayRainMm: 1,
        rainProbMax: 20,
        currentWindKmh: 17,
        currentSoilMoisturePct: 58,
      },
      null,
      "en"
    );

    expect(briefing.sprayWindow.status).toBe("CAUTION");
    expect(briefing.irrigationVerdict.action).toBe("IRRIGATE");
  });

  it("generates strictly 2 plain-language sentences in native script for all 11 supported languages", () => {
    const nonLatinRegex = /[\u0900-\u0D7F]/;
    for (const meta of SUPPORTED_LANGUAGES) {
      const briefing = buildDailyBriefing(
        SAMPLE_PROPERTY,
        {
          todayEt0: 4.2,
          todayRainMm: 2,
          rainProbMax: 15,
          currentWindKmh: 9,
          currentSoilMoisturePct: 60,
        },
        null,
        meta.code
      );

      expect(countSentences(briefing.kyunReason)).toBe(2);
      expect(briefing.kyunReason).toContain("60%");
      expect(briefing.kyunReason).toContain("15%");
      expect(briefing.kyunReason).toContain("9");
      expect(briefing.whatsappText.length).toBeGreaterThan(20);
      expect(briefing.spokenScript.length).toBeGreaterThan(20);

      if (meta.script !== "latin") {
        expect(nonLatinRegex.test(briefing.kyunReason)).toBe(true);
      }
    }
  });
});
