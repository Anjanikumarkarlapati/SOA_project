export interface CaptureEnvironment {
  hasMediaDevices: boolean;
  isSecureContext: boolean;
  hasFinePointer: boolean;
  canShareFiles: boolean;
  isStandalonePwa: boolean;
}

export interface CaptureCapabilities {
  showTakePhotoCapture: boolean;
  showUploadFile: boolean;
  showLiveCamera: boolean;
  showDropAndPaste: boolean;
  canShareImageFiles: boolean;
  isStandalonePwa: boolean;
}

export function detectCaptureCapabilities(env: CaptureEnvironment): CaptureCapabilities {
  return {
    showTakePhotoCapture: true,
    showUploadFile: true,
    showLiveCamera: Boolean(env.hasMediaDevices && env.isSecureContext),
    showDropAndPaste: Boolean(env.hasFinePointer),
    canShareImageFiles: Boolean(env.canShareFiles),
    isStandalonePwa: Boolean(env.isStandalonePwa),
  };
}

export function getBrowserCaptureEnvironment(): CaptureEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      hasMediaDevices: false,
      isSecureContext: false,
      hasFinePointer: false,
      canShareFiles: false,
      isStandalonePwa: false,
    };
  }

  const hasMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
  const isSecureContext = Boolean(window.isSecureContext);
  const hasFinePointer = Boolean(window.matchMedia?.("(pointer: fine)")?.matches);
  const isStandalonePwa = Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone
  );

  let canShareFiles = false;
  if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
    try {
      const probeFile = new File(["ok"], "probe.jpg", { type: "image/jpeg" });
      canShareFiles = navigator.canShare({ files: [probeFile] });
    } catch {
      canShareFiles = false;
    }
  }

  return {
    hasMediaDevices,
    isSecureContext,
    hasFinePointer,
    canShareFiles,
    isStandalonePwa,
  };
}
