"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Banner } from "@astryxdesign/core/Banner";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface LiveCameraModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCapture: (blob: Blob) => void;
  onCameraNotFound?: () => void;
}

function mapCameraError(err: unknown): { message: string; notFound: boolean } {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      message: "Camera access is blocked. Use Take Photo or Upload Photo instead.",
      notFound: false,
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      message: "No camera found on this device. Please upload a leaf photo.",
      notFound: true,
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      message: "Camera is busy in another app. Close it or use Upload Photo.",
      notFound: false,
    };
  }
  return {
    message: "Unable to start live camera. Use Take Photo or Upload Photo instead.",
    notFound: false,
  };
}

export function LiveCameraModal({
  isOpen,
  onOpenChange,
  onCapture,
  onCameraNotFound,
}: LiveCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);

  const stopTracks = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopTracks();
      return;
    }

    let cancelled = false;

    async function connectCamera() {
      await Promise.resolve();
      if (cancelled) return;

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setErrorMsg("Live camera is unavailable in this browser. Use Upload Photo.");
        setIsStreamReady(false);
        return;
      }

      stopTracks();

      try {
        let stream: MediaStream;
        try {
          // Zero width/height/fps constraints to avoid cropping or OverconstrainedError on mobile sensors.
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false,
          });
        } catch (err) {
          if (err instanceof Error && err.name === "OverconstrainedError") {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } else {
            throw err;
          }
        }

        if (cancelled) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setErrorMsg(null);
        setIsStreamReady(true);
      } catch (err) {
        if (cancelled) return;
        const mapped = mapCameraError(err);
        setErrorMsg(mapped.message);
        setIsStreamReady(false);
        if (mapped.notFound) {
          onCameraNotFound?.();
        }
      }
    }

    void connectCamera();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopTracks();
        setErrorMsg(null);
        setIsStreamReady(false);
        onOpenChange(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      stopTracks();
    };
  }, [facingMode, isOpen, onCameraNotFound, onOpenChange, stopTracks]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setErrorMsg("Camera frame not ready yet. Please wait a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setErrorMsg("Unable to capture image frame.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorMsg("Failed to encode captured frame.");
          return;
        }
        stopTracks();
        setIsStreamReady(false);
        onCapture(blob);
        onOpenChange(false);
      },
      "image/jpeg",
      0.9
    );
  };

  const handleClose = () => {
    stopTracks();
    setErrorMsg(null);
    setIsStreamReady(false);
    onOpenChange(false);
  };

  const isStarting = isOpen && !isStreamReady && !errorMsg;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          stopTracks();
          setErrorMsg(null);
          setIsStreamReady(false);
        }
        onOpenChange(open);
      }}
      width={520}
      purpose="form"
    >
      <Layout
        header={
          <DialogHeader
            title="Live Crop Camera"
            subtitle="Hold leaf steady in daylight before capturing"
            onOpenChange={(open) => {
              if (!open) handleClose();
            }}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={3}>
              {errorMsg ? (
                <Banner status="error" title="Camera unavailable" description={errorMsg} />
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="block w-full aspect-[4/3] object-cover"
                  />
                </div>
              )}
              <Text type="supporting" color="secondary">
                {isStarting
                  ? "Starting camera viewfinder..."
                  : "No photo is stored until you confirm the preview."}
              </Text>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="between" width="100%" wrap="wrap">
              <Button
                label="Flip Camera"
                variant="outline"
                size="sm"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={() => {
                  setIsStreamReady(false);
                  setErrorMsg(null);
                  setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
                }}
                disabled={isStarting}
              />
              <HStack gap={2}>
                <Button label="Cancel" variant="ghost" size="sm" onClick={handleClose} />
                <Button
                  label="Capture"
                  variant="primary"
                  size="sm"
                  icon={<Camera className="w-4 h-4" />}
                  onClick={handleCapture}
                  disabled={isStarting || Boolean(errorMsg)}
                />
              </HStack>
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
