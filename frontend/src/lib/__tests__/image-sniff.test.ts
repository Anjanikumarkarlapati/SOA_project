import { describe, expect, it } from "vitest";
import { sniffImageMime } from "@/lib/image-sniff";

describe("sniffImageMime", () => {
  it("recognizes JPEG magic bytes (FF D8 FF)", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffImageMime(bytes)).toBe("image/jpeg");
  });

  it("recognizes PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(sniffImageMime(bytes)).toBe("image/png");
  });

  it("recognizes WebP magic bytes (RIFF....WEBP)", () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, // WEBP
      0x56, 0x50, 0x38, 0x20,
    ]);
    expect(sniffImageMime(bytes)).toBe("image/webp");
  });

  it("recognizes HEIC/HEIF ISO BMFF ftyp brands (heic, heix, hevc, heif, mif1)", () => {
    const brands = ["heic", "heix", "hevc", "heif", "mif1"];
    for (const brand of brands) {
      const b = brand.split("").map((ch) => ch.charCodeAt(0));
      const bytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x18,
        0x66, 0x74, 0x79, 0x70, // ftyp
        ...b,
        0x00, 0x00, 0x00, 0x00,
      ]);
      expect(sniffImageMime(bytes)).toBe("image/heic");
    }
  });

  it("rejects PDF, SVG/HTML text, GIF, short buffers, and arbitrary bytes", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\n");
    const gif = new TextEncoder().encode("GIF89a\x01\x00");
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const shortJpg = new Uint8Array([0xff, 0xd8]);
    const empty = new Uint8Array([]);
    const mp4 = new Uint8Array([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x69, 0x73, 0x6f, 0x6d, // isom (not heic)
    ]);

    expect(sniffImageMime(pdf)).toBeNull();
    expect(sniffImageMime(gif)).toBeNull();
    expect(sniffImageMime(svg)).toBeNull();
    expect(sniffImageMime(shortJpg)).toBeNull();
    expect(sniffImageMime(empty)).toBeNull();
    expect(sniffImageMime(mp4)).toBeNull();
  });
});
