"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { ButtonGroup } from "@astryxdesign/core/ButtonGroup";
import { Lightbox } from "@astryxdesign/core/Lightbox";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { Camera, RotateCcw, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  prepareImageForDiagnosis,
  validateImageFile,
  type PreparedImageResult,
} from "@/lib/image-prep";
import {
  detectCaptureCapabilities,
  getBrowserCaptureEnvironment,
  type CaptureCapabilities,
} from "@/lib/media-capabilities";
import { LiveCameraModal } from "@/components/media/LiveCameraModal";

export interface CropImagePickerProps {
  onImageReady: (result: PreparedImageResult) => void;
  onError?: (message: string) => void;
  onClear?: () => void;
  value?: PreparedImageResult | null;
  disabled?: boolean;
}

const DEFAULT_CAPABILITIES: CaptureCapabilities = {
  showTakePhotoCapture: true,
  showUploadFile: true,
  showLiveCamera: false,
  showDropAndPaste: false,
  canShareImageFiles: false,
  isStandalonePwa: false,
};

const subscribeClient = () => () => {};

export function CropImagePicker({
  onImageReady,
  onError,
  onClear,
  value,
  disabled = false,
}: CropImagePickerProps) {
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const isClient = useSyncExternalStore(
    subscribeClient,
    () => true,
    () => false
  );
  const capabilities = useMemo(
    () =>
      isClient
        ? detectCaptureCapabilities(getBrowserCaptureEnvironment())
        : DEFAULT_CAPABILITIES,
    [isClient]
  );

  const [cameraHidden, setCameraHidden] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localPrepared, setLocalPrepared] = useState<PreparedImageResult | null>(null);

  const activePrepared = value !== undefined ? value : localPrepared;

  const previewUrl = useMemo(() => {
    if (!isClient || !activePrepared?.blob) return null;
    return URL.createObjectURL(activePrepared.blob);
  }, [activePrepared, isClient]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSelectedBlob = useCallback(
    async (file: Blob & { name?: string }) => {
      if (disabled) return;
      setLocalError(null);
      const validation = validateImageFile({
        type: file.type,
        size: file.size,
        name: file.name,
      });
      if (!validation.ok) {
        setLocalError(validation.message);
        onError?.(validation.message);
        return;
      }

      setIsProcessing(true);
      try {
        const prepared = await prepareImageForDiagnosis(file, {
          maxEdge: 1568,
          quality: 0.82,
          maxBytes: 1_500_000,
        });
        setLocalPrepared(prepared);
        onImageReady(prepared);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not process selected crop photo.";
        setLocalError(message);
        onError?.(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [disabled, onError, onImageReady]
  );

  const handleInputFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      void handleSelectedBlob(file);
    }
  };

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled || !capabilities.showDropAndPaste) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const pasted = item.getAsFile();
          if (pasted) {
            event.preventDefault();
            void handleSelectedBlob(pasted);
            return;
          }
        }
      }
    },
    [capabilities.showDropAndPaste, disabled, handleSelectedBlob]
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !capabilities.showDropAndPaste) return;
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer?.files?.[0];
    if (dropped) {
      void handleSelectedBlob(dropped);
    }
  };

  const handleRetake = () => {
    setLightboxOpen(false);
    setLocalPrepared(null);
    setLocalError(null);
    onClear?.();
  };

  return (
    <VStack
      gap={3}
      onPaste={handlePaste}
      onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
        if (!capabilities.showDropAndPaste || disabled) return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`rounded-2xl border p-4 transition-colors ${
        isDragging
          ? "border-[var(--accent)] bg-[var(--accent-wash)]"
          : "border-[var(--border-default)] bg-[var(--bg-raised)]"
      }`}
    >
      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputFiles}
        className="sr-only"
        aria-label="Take leaf photo with device camera"
        disabled={disabled || isProcessing}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleInputFiles}
        className="sr-only"
        aria-label="Upload leaf photo from device"
        disabled={disabled || isProcessing}
      />

      {localError && (
        <Banner
          status="error"
          title="Photo could not be prepared"
          description={localError}
          isDismissable
          onDismiss={() => setLocalError(null)}
        />
      )}

      {activePrepared && previewUrl ? (
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Thumbnail
            src={previewUrl}
            alt="Prepared crop leaf photo"
            label="Prepared crop leaf photo"
            onClick={() => setLightboxOpen(true)}
            onRemove={disabled ? undefined : handleRetake}
            showRemoveOn="always"
            isLoading={isProcessing}
          />
          <VStack gap={1}>
            <Text type="label" weight="semibold">
              Leaf photo ready
            </Text>
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {Math.max(1, Math.round(activePrepared.compressedBytes / 1024))} KB ·{" "}
              {activePrepared.width > 0
                ? `${activePrepared.width}×${activePrepared.height}`
                : activePrepared.mimeType}
            </Text>
            <Button
              label="Retake"
              tooltip="Discard photo and capture a new leaf image"
              variant="outline"
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleRetake}
              disabled={disabled || isProcessing}
            />
          </VStack>
        </HStack>
      ) : (
        <VStack gap={3}>
          <HStack gap={2} wrap="wrap">
            {capabilities.showTakePhotoCapture && (
              <Button
                label={isProcessing ? "Preparing..." : "Take Photo"}
                tooltip="Capture leaf photo with device camera"
                variant="primary"
                size="md"
                icon={<Camera className="w-4 h-4" />}
                onClick={() => captureInputRef.current?.click()}
                disabled={disabled || isProcessing}
                loading={isProcessing}
              />
            )}
            {(capabilities.showUploadFile || (capabilities.showLiveCamera && !cameraHidden)) && (
              <ButtonGroup label="Additional photo capture options" size="md">
                {capabilities.showUploadFile && (
                  <Button
                    label="Upload Photo"
                    tooltip="Select a leaf photo from gallery or files"
                    variant="secondary"
                    size="md"
                    icon={<Upload className="w-4 h-4" />}
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={disabled || isProcessing}
                  />
                )}
                {capabilities.showLiveCamera && !cameraHidden && (
                  <Button
                    label="Live Camera"
                    tooltip="Open live device camera preview"
                    variant="outline"
                    size="md"
                    icon={<Video className="w-4 h-4" />}
                    onClick={() => setIsCameraOpen(true)}
                    disabled={disabled || isProcessing}
                  />
                )}
              </ButtonGroup>
            )}
          </HStack>
          <Text type="supporting" color="secondary">
            {capabilities.showDropAndPaste
              ? "Take a photo, upload JPEG/PNG/WebP/HEIC (up to 15 MB), or drag & paste an image here."
              : "Tap Take Photo for camera or Upload Photo from gallery (JPEG, PNG, WebP, HEIC up to 15 MB)."}
          </Text>
        </VStack>
      )}

      {activePrepared && previewUrl && lightboxOpen && (
        <Lightbox
          isOpen={lightboxOpen}
          onOpenChange={setLightboxOpen}
          media={{
            src: previewUrl,
            alt: "Prepared crop leaf photo",
          }}
          hasZoom
        />
      )}

      <LiveCameraModal
        isOpen={isCameraOpen}
        onOpenChange={setIsCameraOpen}
        onCapture={(blob) => {
          void handleSelectedBlob(
            Object.assign(blob, { name: `live-capture-${Date.now()}.jpg` })
          );
        }}
        onCameraNotFound={() => setCameraHidden(true)}
      />
    </VStack>
  );
}
