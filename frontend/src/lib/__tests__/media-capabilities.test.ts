import { describe, expect, it } from "vitest";
import { detectCaptureCapabilities, type CaptureEnvironment } from "@/lib/media-capabilities";

describe("media-capabilities", () => {
  it("disables live camera when mediaDevices is absent or context is insecure", () => {
    const insecureEnv: CaptureEnvironment = {
      hasMediaDevices: true,
      isSecureContext: false,
      hasFinePointer: false,
      canShareFiles: true,
      isStandalonePwa: false,
    };
    const insecureCaps = detectCaptureCapabilities(insecureEnv);
    expect(insecureCaps.showLiveCamera).toBe(false);
    expect(insecureCaps.showTakePhotoCapture).toBe(true);
    expect(insecureCaps.showUploadFile).toBe(true);

    const noDeviceCaps = detectCaptureCapabilities({
      ...insecureEnv,
      hasMediaDevices: false,
      isSecureContext: true,
    });
    expect(noDeviceCaps.showLiveCamera).toBe(false);
    expect(noDeviceCaps.showTakePhotoCapture).toBe(true);
    expect(noDeviceCaps.showUploadFile).toBe(true);
  });

  it("enables live camera and drop/paste on secure desktop environment", () => {
    const desktopCaps = detectCaptureCapabilities({
      hasMediaDevices: true,
      isSecureContext: true,
      hasFinePointer: true,
      canShareFiles: false,
      isStandalonePwa: true,
    });
    expect(desktopCaps).toEqual({
      showTakePhotoCapture: true,
      showUploadFile: true,
      showLiveCamera: true,
      showDropAndPaste: true,
      canShareImageFiles: false,
      isStandalonePwa: true,
    });
  });

  it("exposes share and PWA standalone flags faithfully on mobile", () => {
    const mobileCaps = detectCaptureCapabilities({
      hasMediaDevices: true,
      isSecureContext: true,
      hasFinePointer: false,
      canShareFiles: true,
      isStandalonePwa: true,
    });
    expect(mobileCaps.showDropAndPaste).toBe(false);
    expect(mobileCaps.canShareImageFiles).toBe(true);
    expect(mobileCaps.isStandalonePwa).toBe(true);
  });
});
