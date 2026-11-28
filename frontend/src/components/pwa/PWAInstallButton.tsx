"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const subscribeNoop = () => () => {};

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [wasInstalled, setWasInstalled] = useState(false);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);

  const isStandaloneDisplay = useSyncExternalStore(
    subscribeNoop,
    () =>
      Boolean(
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone
      ),
    () => false
  );

  const isIosBrowser = useSyncExternalStore(
    subscribeNoop,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false
  );

  const isStandalone = isStandaloneDisplay || wasInstalled;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setWasInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (isStandalone || (!deferredPrompt && (!isIosBrowser || isStandaloneDisplay))) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return;
    }
    setIosSheetOpen(true);
  };

  return (
    <>
      <Button
        label="Install App"
        variant="secondary"
        size="sm"
        icon={<Download className="w-4 h-4" />}
        onClick={() => void handleInstallClick()}
      />
      <BottomSheet
        isOpen={iosSheetOpen}
        onOpenChange={setIosSheetOpen}
        label="Install FieldShield on iPhone or iPad"
      >
        <VStack gap={3}>
          <Text type="large" weight="semibold">
            Add FieldShield to Home Screen
          </Text>
          <Text type="body" color="secondary">
            1. Tap the Share button at the bottom of Safari.
          </Text>
          <Text type="body" color="secondary">
            2. Scroll and tap &ldquo;Add to Home Screen&rdquo; for offline 6 AM alerts.
          </Text>
          <Button
            label="Got it"
            variant="primary"
            size="md"
            fullWidth
            onClick={() => setIosSheetOpen(false)}
          />
        </VStack>
      </BottomSheet>
    </>
  );
}
