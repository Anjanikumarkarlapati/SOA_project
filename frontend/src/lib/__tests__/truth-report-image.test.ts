import { describe, expect, it, vi, afterEach } from "vitest";
import { computeTruthScore } from "@/lib/truth-score";
import {
  buildTruthReportPayload,
  renderTruthReportPng,
  shareTruthReportToWhatsApp,
} from "@/lib/truth-report-image";

describe("truth-report-image", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a complete TruthReportCardData payload with WhatsApp summary", () => {
    const score = computeTruthScore({
      officialGovt: 50,
      crossSource: 20,
      recency: 15,
      groundSafety: 15,
    });

    const payload = buildTruthReportPayload({
      title: "PM-KISAN 19th Installment Official Portal",
      checkedInput: "https://pmkisan.gov.in/",
      platform: "gov",
      locationLabel: "Cuttack, Odisha",
      score,
      summary:
        "Verified against official Government of India portal pmkisan.gov.in. Safe to follow without paying any middleman fee.",
      citations: [{ title: "PM-KISAN Official Portal", url: "https://pmkisan.gov.in/" }],
      checkedAtIso: "2026-11-28T06:00:00.000Z",
    });

    expect(payload.score.totalPercent).toBe(100);
    expect(payload.score.tierLabel).toBe("VERIFIED_OFFICIAL");
    expect(payload.locationLabel).toBe("Cuttack, Odisha");
    expect(payload.whatsappSummaryText).toContain("100%");
    expect(payload.whatsappSummaryText).toContain("Cuttack, Odisha");
    expect(payload.whatsappSummaryText).toContain("https://pmkisan.gov.in/");
  });

  it("renders a valid PNG Blob even when canvas 2D is unavailable in jsdom", async () => {
    const score = computeTruthScore({
      officialGovt: 0,
      crossSource: 5,
      recency: 0,
      groundSafety: 15,
      scamSignal: true,
    });

    const report = buildTruthReportPayload({
      title: "Suspicious Kisan APK Forward",
      checkedInput: "https://pmkisan-yojana.com/app.apk",
      platform: "web",
      locationLabel: "Guntur, Andhra Pradesh",
      score,
      summary:
        "This link uses an unverified lookalike domain and distributes an APK file. Never install APKs or share OTPs from WhatsApp forwards.",
      citations: [{ title: "PM-KISAN Official", url: "https://pmkisan.gov.in/" }],
    });

    const blob = await renderTruthReportPng(report);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(8);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    // PNG magic signature: 89 50 4E 47 0D 0A 1A 0A
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("uses navigator.share when file sharing is supported", async () => {
    const score = computeTruthScore({
      officialGovt: 50,
      crossSource: 20,
      recency: 15,
      groundSafety: 15,
    });
    const report = buildTruthReportPayload({
      title: "Official Bulletin",
      checkedInput: "https://pmkisan.gov.in/",
      platform: "gov",
      locationLabel: "Cuttack, Odisha",
      score,
      summary: "Official notification verified.",
      citations: [{ title: "PM-KISAN", url: "https://pmkisan.gov.in/" }],
    });
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
      type: "image/png",
    });

    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "share", { value: shareMock, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: canShareMock, configurable: true });

    const mode = await shareTruthReportToWhatsApp(report, blob);
    expect(mode).toBe("shared");
    expect(shareMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to PNG download + wa.me link when Web Share with files is unsupported", async () => {
    const score = computeTruthScore({
      officialGovt: 20,
      crossSource: 10,
      recency: 15,
      groundSafety: 15,
    });
    const report = buildTruthReportPayload({
      title: "Mandi Arrival Rumour Check",
      checkedInput: "Local market forward",
      platform: "whatsapp",
      locationLabel: "Ludhiana, Punjab",
      score,
      summary: "Partially corroborated by state mandi arrivals.",
      citations: [{ title: "e-NAM", url: "https://enam.gov.in/" }],
    });
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
      type: "image/png",
    });

    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
    const createObjectUrlSpy = vi.fn().mockReturnValue("blob:http://localhost/report.png");
    const revokeObjectUrlSpy = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectUrlSpy, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectUrlSpy, configurable: true });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const mode = await shareTruthReportToWhatsApp(report, blob);
    expect(mode).toBe("fallback");
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/?text="),
      "_blank",
      "noopener,noreferrer"
    );
  });
});
