import { describe, expect, it } from "vitest";
import { computeTruthScore } from "@/lib/truth-score";

describe("computeTruthScore", () => {
  it("returns 100 and VERIFIED_OFFICIAL for maxed signals without scam", () => {
    const result = computeTruthScore({
      officialGovt: 50,
      crossSource: 20,
      recency: 15,
      groundSafety: 15,
    });
    expect(result.totalPercent).toBe(100);
    expect(result.tierLabel).toBe("VERIFIED_OFFICIAL");
    expect(result.scamWarning).toBeNull();
    expect(result.recycledWarning).toBeNull();
    expect(result.breakdown).toEqual({
      officialGovt: 50,
      crossSource: 20,
      recency: 15,
      groundSafety: 15,
    });
  });

  it("returns VERIFIED_OFFICIAL at exact boundary 85", () => {
    const result = computeTruthScore({
      officialGovt: 45,
      crossSource: 15,
      recency: 15,
      groundSafety: 10,
    });
    expect(result.totalPercent).toBe(85);
    expect(result.tierLabel).toBe("VERIFIED_OFFICIAL");
  });

  it("returns PARTIALLY_VERIFIED for scores in 55..84", () => {
    const low = computeTruthScore({
      officialGovt: 25,
      crossSource: 10,
      recency: 10,
      groundSafety: 10,
    });
    expect(low.totalPercent).toBe(55);
    expect(low.tierLabel).toBe("PARTIALLY_VERIFIED");

    const high = computeTruthScore({
      officialGovt: 40,
      crossSource: 14,
      recency: 15,
      groundSafety: 15,
    });
    expect(high.totalPercent).toBe(84);
    expect(high.tierLabel).toBe("PARTIALLY_VERIFIED");
  });

  it("returns UNVERIFIED_RUMOUR below 55", () => {
    const result = computeTruthScore({
      officialGovt: 10,
      crossSource: 10,
      recency: 15,
      groundSafety: 15,
    });
    expect(result.totalPercent).toBe(50);
    expect(result.tierLabel).toBe("UNVERIFIED_RUMOUR");
  });

  it("forces groundSafety to 0 and attaches scamWarning when scamSignal is true", () => {
    const result = computeTruthScore({
      officialGovt: 10,
      crossSource: 5,
      recency: 15,
      groundSafety: 15,
      scamSignal: true,
    });
    expect(result.breakdown.groundSafety).toBe(0);
    expect(result.totalPercent).toBe(30);
    expect(result.tierLabel).toBe("UNVERIFIED_RUMOUR");
    expect(result.scamWarning).toBeTruthy();
  });

  it("attaches recycledWarning when recency is 0", () => {
    const result = computeTruthScore({
      officialGovt: 30,
      crossSource: 15,
      recency: 0,
      groundSafety: 15,
    });
    expect(result.recycledWarning).toBeTruthy();
    expect(result.totalPercent).toBe(60);
    expect(result.tierLabel).toBe("PARTIALLY_VERIFIED");
  });

  it("clamps out-of-range inputs cleanly", () => {
    const result = computeTruthScore({
      officialGovt: 99,
      crossSource: -5,
      recency: 40,
      groundSafety: 30,
    });
    expect(result.breakdown).toEqual({
      officialGovt: 50,
      crossSource: 0,
      recency: 15,
      groundSafety: 15,
    });
    expect(result.totalPercent).toBe(80);
  });
});
