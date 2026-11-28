export const MAX_RAW_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_COMPRESSED_IMAGE_BYTES = 1_500_000;
export const MAX_RAW_HEIC_BYTES = 4 * 1024 * 1024;

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export type ImageValidationErrorCode = "UNSUPPORTED_TYPE" | "TOO_LARGE" | "EMPTY_FILE";

export type ImageValidationResult =
  | { ok: true; mimeType: string }
  | { ok: false; code: ImageValidationErrorCode; message: string };

function inferMimeFromName(name?: string): string {
  if (!name) return "";
  const lower = name.toLowerCase();
  for (const [ext, mime] of Object.entries(EXTENSION_TO_MIME)) {
    if (lower.endsWith(ext)) return mime;
  }
  return "";
}

export function validateImageFile(file: {
  type: string;
  size: number;
  name?: string;
}): ImageValidationResult {
  const rawType = file.type.trim().toLowerCase();
  const resolvedType = rawType || inferMimeFromName(file.name);

  if (!ALLOWED_IMAGE_MIMES.has(resolvedType)) {
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: "Please choose a JPEG, PNG, WebP, or HEIC leaf photo.",
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      code: "EMPTY_FILE",
      message: "Selected photo appears empty.",
    };
  }

  if (file.size > MAX_RAW_IMAGE_BYTES) {
    return {
      ok: false,
      code: "TOO_LARGE",
      message: "Photo exceeds 15 MB limit. Please capture or choose a smaller image.",
    };
  }

  return {
    ok: true,
    mimeType: resolvedType === "image/jpg" ? "image/jpeg" : resolvedType,
  };
}

export function computeTargetSize(
  width: number,
  height: number,
  maxEdge = 1568
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface PrepareImageOptions {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
}

export interface PreparedImageResult {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
}

function isHeicMime(mimeType: string, name?: string): boolean {
  const lower = mimeType.toLowerCase();
  if (lower === "image/heic" || lower === "image/heif") return true;
  const inferred = inferMimeFromName(name);
  return inferred === "image/heic" || inferred === "image/heif";
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas failed to encode JPEG image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

async function loadImageElement(file: Blob): Promise<{
  source: HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not decode image."));
      img.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

export async function prepareImageForDiagnosis(
  file: Blob & { name?: string },
  options: PrepareImageOptions = {}
): Promise<PreparedImageResult> {
  const maxEdge = options.maxEdge ?? 1568;
  const initialQuality = options.quality ?? 0.82;
  const maxBytes = options.maxBytes ?? MAX_COMPRESSED_IMAGE_BYTES;

  const validation = validateImageFile({
    type: file.type,
    size: file.size,
    name: file.name,
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  let source: CanvasImageSource;
  let sourceWidth = 0;
  let sourceHeight = 0;
  let cleanup = () => {};

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      source = bitmap;
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      cleanup = () => bitmap.close?.();
    } else {
      const loaded = await loadImageElement(file);
      source = loaded.source;
      sourceWidth = loaded.width;
      sourceHeight = loaded.height;
      cleanup = loaded.cleanup;
    }
  } catch (err) {
    if (isHeicMime(validation.mimeType, file.name) && file.size <= MAX_RAW_HEIC_BYTES) {
      return {
        blob: file,
        mimeType: validation.mimeType,
        width: 0,
        height: 0,
        originalBytes: file.size,
        compressedBytes: file.size,
      };
    }
    throw err instanceof Error ? err : new Error("Unable to decode selected image.");
  }

  try {
    const target = computeTargetSize(sourceWidth, sourceHeight, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }
    ctx.drawImage(source, 0, 0, target.width, target.height);

    const qualities = [initialQuality, 0.72, 0.62, 0.52].filter(
      (q, i, arr) => q > 0 && arr.indexOf(q) === i
    );
    let encoded = await canvasToJpegBlob(canvas, qualities[0]);
    for (let i = 1; i < qualities.length && encoded.size > maxBytes; i++) {
      encoded = await canvasToJpegBlob(canvas, qualities[i]);
    }

    return {
      blob: encoded,
      mimeType: "image/jpeg",
      width: target.width,
      height: target.height,
      originalBytes: file.size,
      compressedBytes: encoded.size,
    };
  } finally {
    cleanup();
  }
}
