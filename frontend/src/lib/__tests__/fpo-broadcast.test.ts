import { describe, expect, it } from "vitest";
import {
  buildDemoFpoClusterParcels,
  buildFpoBroadcastSummary,
  MAX_FPO_PARCELS,
  type FpoParcelInput,
} from "@/lib/fpo-broadcast";

function makeParcel(idx: number, overrides: Partial<FpoParcelInput> = {}): FpoParcelInput {
  return {
    id: `P-${idx}`,
    farmerName: `Farmer ${idx}`,
    village: `Village ${idx}`,
    cropName: "Rice (Paddy)",
    areaHa: 1.5,
    waterSavedLitres: 1200,
    soilMoisturePct: 58,
    windKmh: 9,
    rainProbPct: 15,
    ...overrides,
  };
}

describe("fpo-broadcast", () => {
  it("pools water saved, counts SAFE/CAUTION/HOLD statuses, and extracts anomalies", () => {
    const parcels: FpoParcelInput[] = [
      makeParcel(1, { waterSavedLitres: 2400, soilMoisturePct: 60, windKmh: 8, rainProbPct: 10 }),
      makeParcel(2, {
        farmerName: "Sita Devi",
        waterSavedLitres: 3100,
        soilMoisturePct: 55,
        windKmh: 24,
        rainProbPct: 20,
      }),
      makeParcel(3, {
        farmerName: "Ramesh Das",
        waterSavedLitres: 4500,
        soilMoisturePct: 88,
        windKmh: 10,
        rainProbPct: 65,
      }),
    ];

    const summary = buildFpoBroadcastSummary(parcels, "en");

    expect(summary.parcelCount).toBe(3);
    expect(summary.totalWaterSavedLitres).toBe(10000);
    expect(summary.healthyCount).toBe(1);
    expect(summary.cautionCount).toBe(1);
    expect(summary.holdCount).toBe(1);
    expect(summary.anomalies).toHaveLength(2);
    expect(summary.anomalies.map((a) => a.farmerName)).toEqual(["Sita Devi", "Ramesh Das"]);
    expect(summary.whatsappBroadcastText).toContain("10,000");
    expect(summary.whatsappBroadcastText).toContain("3");
    expect(summary.whatsappBroadcastText).toContain("HOLD");
    expect(summary.whatsappBroadcastText).toContain("Ramesh Das");
  });

  it("caps pooled summary at MAX_FPO_PARCELS (50) member parcels", () => {
    const parcels = Array.from({ length: 65 }, (_, i) =>
      makeParcel(i + 1, { waterSavedLitres: 1000 })
    );

    const summary = buildFpoBroadcastSummary(parcels, "hi");

    expect(MAX_FPO_PARCELS).toBe(50);
    expect(summary.parcelCount).toBe(50);
    expect(summary.cappedCount).toBe(50);
    expect(summary.totalWaterSavedLitres).toBe(50000);
  });

  it("seeds up to 50 parcels from user properties plus deterministic FPO demo parcels", () => {
    const seeded = buildDemoFpoClusterParcels(
      [
        {
          id: "FARM-USER-1",
          name: "Mahanadi Plot A",
          selectedCropId: "rice",
          areaHa: 2.2,
          region: "Odisha",
          country: "Cuttack",
        },
      ],
      50
    );

    expect(seeded).toHaveLength(50);
    expect(seeded[0].id).toBe("FARM-USER-1");
    expect(seeded[0].farmerName).toBe("Mahanadi Plot A");
  });
});
