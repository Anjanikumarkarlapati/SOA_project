"use client";

import React, { useState, useSyncExternalStore } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/lib/auth";
import { useFarmStore } from "@/lib/property-store";

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function OnlineStatusBanner() {
  const isOffline = useSyncExternalStore(
    subscribeOnlineStatus,
    () => !navigator.onLine,
    () => false
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const pendingCount = useFarmStore((s) => s.syncOutbox.length);
  const flushOutbox = useFarmStore((s) => s.flushOutbox);
  const token = useAuthStore((s) => s.user?.token);

  if (!isOffline && pendingCount === 0) {
    return null;
  }

  const handleSync = async () => {
    if (isOffline || isSyncing) return;
    setIsSyncing(true);
    try {
      await flushOutbox(token);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Banner
      status={isOffline ? "warning" : "info"}
      container="card"
      title={
        isOffline
          ? "Offline Field Mode Active"
          : `${pendingCount} queued field update${pendingCount === 1 ? "" : "s"} waiting to sync`
      }
      description={
        isOffline
          ? pendingCount > 0
            ? `${pendingCount} item(s) saved safely on this phone and will sync once online.`
            : "6 AM spray verdicts, Mandi board cache, and Roznamcha stay available offline."
          : "Connection restored. Sync queued updates now."
      }
      endContent={
        !isOffline && pendingCount > 0 ? (
          <Button
            label={isSyncing ? "Flushing..." : "Flush Queue"}
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => void handleSync()}
            loading={isSyncing}
          />
        ) : undefined
      }
    />
  );
}
