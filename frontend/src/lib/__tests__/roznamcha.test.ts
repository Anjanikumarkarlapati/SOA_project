import { beforeEach, describe, expect, it } from "vitest";
import {
  ROZNAMCHA_STORAGE_KEY,
  appendRoznamchaEntry,
  buildRoznamchaWhatsAppDigest,
  exportRoznamchaPrintHtml,
  loadRoznamchaEntries,
  verifyRoznamchaSignature,
} from "@/lib/roznamcha";

describe("Kisan Roznamcha ledger", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty and appends entries with deterministic offline integrity signature and ISO timestamp", () => {
    expect(loadRoznamchaEntries()).toEqual([]);

    const first = appendRoznamchaEntry({
      farmId: "farm-1",
      category: "irrigation",
      title: "Morning Drip Cycle",
      details: "Delivered 12,400 L across Block A",
      soilMoisturePct: 58,
      rainMm: 0,
      waterLitres: 12400,
    });

    expect(first.id).toMatch(/^RZ-/);
    expect(Number.isNaN(Date.parse(first.timestamp))).toBe(false);
    expect(first.sig).toMatch(/^SIG-[A-F0-9]{8}$/);
    expect(verifyRoznamchaSignature(first)).toBe(true);

    const raw = window.localStorage.getItem(ROZNAMCHA_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(loadRoznamchaEntries("farm-1")).toHaveLength(1);
    expect(loadRoznamchaEntries("farm-2")).toHaveLength(0);
  });

  it("detects tampering if entry fields are altered after signing", () => {
    const entry = appendRoznamchaEntry({
      farmId: "farm-1",
      category: "spray",
      title: "Neem Oil Spray",
      details: "Sprayed 06:30 AM at 7 km/h wind",
    });

    expect(verifyRoznamchaSignature(entry)).toBe(true);
    expect(verifyRoznamchaSignature({ ...entry, details: "Altered amount" })).toBe(false);
  });

  it("exports clean printable HTML with #111111 ink on #FFFFFF background and escapes HTML", () => {
    const entry = appendRoznamchaEntry({
      farmId: "farm-1",
      category: "weather",
      title: "Rain Hold <Alert>",
      details: "Saved 18,000 L due to 65% rain probability",
      waterLitres: 18000,
    });

    const html = exportRoznamchaPrintHtml([entry], {
      name: "Cuttack Paddy Hub",
      address: "Cuttack, Odisha",
      selectedCropId: "rice",
      areaHa: 2.0,
    });

    expect(html).toContain("#111111");
    expect(html).toContain("#FFFFFF");
    expect(html).toContain("Cuttack Paddy Hub");
    expect(html).toContain("Rain Hold &lt;Alert&gt;");
    expect(html).not.toContain("<Alert>");
    expect(html).toContain(entry.sig);
  });

  it("builds a concise WhatsApp digest including farm name, entry summary, and signature", () => {
    const entry = appendRoznamchaEntry({
      farmId: "farm-1",
      category: "irrigation",
      title: "Rain Hold Triggered",
      details: "Valve stayed closed; 15,000 L conserved",
      waterLitres: 15000,
    });

    const digest = buildRoznamchaWhatsAppDigest([entry], {
      name: "Guntur Chilli Farm",
      address: "Guntur, AP",
      selectedCropId: "chilli",
    });

    expect(digest).toContain("Guntur Chilli Farm");
    expect(digest).toContain("Rain Hold Triggered");
    expect(digest).toContain(entry.sig);
  });
});
