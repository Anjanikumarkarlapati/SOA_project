import { beforeEach, describe, expect, it } from "vitest";
import {
  AGRISTACK_CHECKLIST_ITEMS,
  computePmfbyDeadline,
  estimatePmksySubsidy,
  getSchemesCatalog,
  loadPmfbyPacks,
  savePmfbyPack,
  type PmfbyLossEvidencePack,
} from "@/lib/schemes-data";

describe("schemes-data", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("estimates PMKSY subsidy with 55% base for small_marginal, 45% for other, and state top-ups", () => {
    const pbSmall = estimatePmksySubsidy(2, "small_marginal", "PB");
    expect(pbSmall.baseSystemCostInr).toBeGreaterThan(0);
    expect(pbSmall.centralSharePercent).toBe(55);
    expect(pbSmall.subsidyPercent).toBeGreaterThanOrEqual(55);
    expect(pbSmall.subsidyAmountInr + pbSmall.netFarmerCostInr).toBe(pbSmall.baseSystemCostInr);

    const pbOther = estimatePmksySubsidy(2, "other", "PB");
    expect(pbOther.centralSharePercent).toBe(45);
    expect(pbOther.subsidyPercent).toBeGreaterThanOrEqual(45);
    expect(pbSmall.subsidyPercent).toBeGreaterThan(pbOther.subsidyPercent);

    const apSmall = estimatePmksySubsidy(1.5, "small_marginal", "AP");
    expect(apSmall.stateTopUpPercent).toBeGreaterThan(0);
    expect(apSmall.subsidyPercent).toBe(apSmall.centralSharePercent + apSmall.stateTopUpPercent);
    expect(apSmall.subsidyPercent).toBeLessThanOrEqual(90);

    const zeroLand = estimatePmksySubsidy(0, "small_marginal", "OD");
    expect(zeroLand.baseSystemCostInr).toBe(0);
    expect(zeroLand.subsidyAmountInr).toBe(0);
    expect(zeroLand.netFarmerCostInr).toBe(0);
  });

  it("computes PMFBY 72-hour deadline, urgency under 24h, and expiry", () => {
    const incidentIso = "2026-11-28T06:00:00.000Z";
    const incidentMs = Date.parse(incidentIso);

    const early = computePmfbyDeadline(incidentIso, incidentMs + 12 * 3600_000);
    expect(early.deadlineIso).toBe("2026-12-01T06:00:00.000Z");
    expect(early.remainingHours).toBe(60);
    expect(early.isExpired).toBe(false);
    expect(early.isUrgent).toBe(false);

    const urgent = computePmfbyDeadline(incidentIso, incidentMs + 54 * 3600_000);
    expect(urgent.remainingHours).toBe(18);
    expect(urgent.isExpired).toBe(false);
    expect(urgent.isUrgent).toBe(true);

    const expired = computePmfbyDeadline(incidentIso, incidentMs + 75 * 3600_000);
    expect(expired.remainingMs).toBe(0);
    expect(expired.remainingHours).toBe(0);
    expect(expired.isExpired).toBe(true);
    expect(expired.isUrgent).toBe(false);
  });

  it("persists PMFBY evidence metadata and mediaIds only (never binary blobs) in localStorage", () => {
    const pack: PmfbyLossEvidencePack = {
      id: "PMFBY-101",
      farmId: "farm-1",
      cropName: "Paddy",
      lossCause: "Inundation / Flood",
      incidentIso: "2026-11-28T06:00:00.000Z",
      lat: 20.4625,
      lon: 85.883,
      mediaIds: ["media-123"],
      notes: "Standing water in north plot",
      createdAt: "2026-11-28T08:00:00.000Z",
      synced: false,
    };

    savePmfbyPack(pack);
    const loaded = loadPmfbyPacks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("PMFBY-101");
    expect(loaded[0].mediaIds).toEqual(["media-123"]);

    const raw = window.localStorage.getItem("agritech-pmfby-v1") ?? "";
    expect(raw).not.toContain("data:image");
  });

  it("provides AgriStack 11-digit checklist items and state+central scheme catalog", () => {
    expect(AGRISTACK_CHECKLIST_ITEMS.length).toBeGreaterThanOrEqual(4);
    expect(AGRISTACK_CHECKLIST_ITEMS.some((i) => i.title.includes("11-digit"))).toBe(true);

    const odCatalog = getSchemesCatalog("OD");
    expect(odCatalog.some((s) => s.id === "pm-kisan")).toBe(true);
    expect(odCatalog.some((s) => s.id === "pmfby")).toBe(true);
    expect(odCatalog.some((s) => s.id === "pmksy")).toBe(true);
    expect(odCatalog.some((s) => s.scope === "state" && s.stateCode === "OD")).toBe(true);
  });
});
