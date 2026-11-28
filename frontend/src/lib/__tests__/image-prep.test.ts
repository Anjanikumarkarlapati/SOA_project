import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeTargetSize,
  prepareImageForDiagnosis,
  validateImageFile,
} from "@/lib/image-prep";

describe("image-prep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("validates supported MIME types, empty files, and 15 MB max size", () => {
    expect(validateImageFile({ type: "image/gif", size: 1024, name: "anim.gif" })).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_TYPE",
    });
    expect(
      validateImageFile({ type: "application/pdf", size: 1024, name: "doc.pdf" })
    ).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_TYPE",
    });
    expect(validateImageFile({ type: "image/jpeg", size: 0, name: "empty.jpg" })).toMatchObject({
      ok: false,
      code: "EMPTY_FILE",
    });
    expect(
      validateImageFile({ type: "image/jpeg", size: 15 * 1024 * 1024 + 1, name: "huge.jpg" })
    ).toMatchObject({
      ok: false,
      code: "TOO_LARGE",
    });

    expect(
      validateImageFile({ type: "image/jpeg", size: 500_000, name: "leaf.jpg" })
    ).toMatchObject({ ok: true, mimeType: "image/jpeg" });
    expect(validateImageFile({ type: "", size: 200_000, name: "photo.heic" })).toMatchObject({
      ok: true,
      mimeType: "image/heic",
    });
  });

  it("computes scaled target dimensions preserving aspect ratio without upscaling", () => {
    expect(computeTargetSize(4000, 3000, 1568)).toEqual({ width: 1568, height: 1176 });
    expect(computeTargetSize(3000, 4000, 1568)).toEqual({ width: 1176, height: 1568 });
    expect(computeTargetSize(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });

  it("decodes with from-image orientation, resizes on canvas, and exports compressed JPEG", async () => {
    const closeSpy = vi.fn();
    const createBitmapMock = vi.fn().mockResolvedValue({
      width: 4000,
      height: 3000,
      close: closeSpy,
    });
    vi.stubGlobal("createImageBitmap", createBitmapMock);

    const drawImage = vi.fn();
    const toBlob = vi.fn((cb: BlobCallback, mimeType?: string) => {
      cb(new Blob([new Uint8Array(120_000)], { type: mimeType ?? "image/jpeg" }));
    });
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob,
    } as unknown as HTMLCanvasElement;

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") return fakeCanvas;
      return origCreateElement(tag);
    });

    const inputFile = new File([new Uint8Array(2_000_000)], "leaf.jpg", { type: "image/jpeg" });
    const prepared = await prepareImageForDiagnosis(inputFile, {
      maxEdge: 1568,
      quality: 0.82,
      maxBytes: 1_500_000,
    });

    expect(createBitmapMock).toHaveBeenCalledWith(inputFile, { imageOrientation: "from-image" });
    expect(fakeCanvas.width).toBe(1568);
    expect(fakeCanvas.height).toBe(1176);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(prepared.mimeType).toBe("image/jpeg");
    expect(prepared.width).toBe(1568);
    expect(prepared.height).toBe(1176);
    expect(prepared.compressedBytes).toBeLessThanOrEqual(1_500_000);
  });

  it("passes raw HEIC through when undecodable and <= 4 MB", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("Unsupported HEIC")));
    const heicFile = new File([new Uint8Array(1_000_000)], "leaf.heic", { type: "image/heic" });
    const prepared = await prepareImageForDiagnosis(heicFile, {
      maxEdge: 1568,
      quality: 0.82,
      maxBytes: 1_500_000,
    });
    expect(prepared.mimeType).toBe("image/heic");
    expect(prepared.blob).toBe(heicFile);
    expect(prepared.compressedBytes).toBe(1_000_000);
  });
});
