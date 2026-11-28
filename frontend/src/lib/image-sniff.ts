export type SniffedImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/heic";

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "heif", "mif1"]);

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[start + i]);
  }
  return out;
}

/**
 * Sniffs true raster/HEIC image type from leading magic bytes.
 * Never trusts filename extensions or client-supplied Content-Type headers.
 */
export function sniffImageMime(bytes: Uint8Array): SniffedImageMime | null {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 3) {
    return null;
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF....WEBP
  if (
    bytes.byteLength >= 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }

  // HEIC/HEIF ISO BMFF: ....ftyp<brand>
  if (bytes.byteLength >= 12 && readAscii(bytes, 4, 4) === "ftyp") {
    const brand = readAscii(bytes, 8, 4).toLowerCase();
    if (HEIC_BRANDS.has(brand)) {
      return "image/heic";
    }
  }

  return null;
}
