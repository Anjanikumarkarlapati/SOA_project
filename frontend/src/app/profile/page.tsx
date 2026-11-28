"use client";
import React, { useEffect, useState } from "react";
import { Heading } from "@astryxdesign/core/Heading";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { isOfflineToken, useAuthStore } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { useFarmStore } from "@/lib/property-store";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { ButtonGroup } from "@astryxdesign/core/ButtonGroup";
import { Divider } from "@astryxdesign/core/Divider";
import {
  User,
  Mail,
  Shield,
  MapPin,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Sun,
  Moon,
  Ruler,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface FieldMemberInfo {
  email: string;
  role: string;
  farmId: string;
  displayName: string;
  expiresAt?: string;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { setTheme } = useTheme();
  const token = useAuthStore((s) => s.user?.token ?? "");
  const preferences = useFarmStore((s) => s.preferences);
  const setPreferences = useFarmStore((s) => s.setPreferences);
  const syncOutbox = useFarmStore((s) => s.syncOutbox);
  const flushOutbox = useFarmStore((s) => s.flushOutbox);
  const router = useRouter();

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [gatewayLookup, setGatewayLookup] = useState<{
    token: string;
    me: FieldMemberInfo | null;
    status: "verified" | "error";
  } | null>(null);

  const isOnline = Boolean(token && !isOfflineToken(token));
  const liveMe = isOnline && gatewayLookup?.token === token ? gatewayLookup.me : null;
  const sessionStatus: "idle" | "verified" | "offline" | "error" = !token
    ? "idle"
    : !isOnline
      ? "offline"
      : gatewayLookup?.token === token
        ? gatewayLookup.status
        : "idle";

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    authApi
      .me(token)
      .then((me) => {
        if (!cancelled) {
          setGatewayLookup({ token, me, status: "verified" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGatewayLookup({ token, me: null, status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, isOnline]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await flushOutbox(token);
      if (res.skipped) {
        setSyncResult(`Offline field token active — ${res.remaining} mutation(s) remain queued.`);
      } else {
        setSyncResult(`Synced ${res.flushed} item(s). ${res.remaining} remaining.`);
      }
    } finally {
      setSyncing(false);
    }
  };

  const rows = user
    ? [
        { icon: User, label: "Name", value: liveMe?.displayName || user.name || "—" },
        { icon: Mail, label: "Email", value: liveMe?.email ?? user.email },
        { icon: Shield, label: "Role", value: liveMe?.role ?? user.role },
        { icon: MapPin, label: "Farm", value: liveMe?.farmId ?? user.farmId ?? "—" },
      ]
    : [];

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap border-b border-[var(--border-default)] pb-5">
        <div>
          <Heading level={1} weight="normal" textWrap="balance" className="type-page-title">
            Profile &amp; Field Preferences
          </Heading>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Operator account details, display units, appearance, and FieldShield outbox synchronization.
          </p>
        </div>

        <Button
          label="Sign out"
          variant="destructive"
          size="md"
          icon={<LogOut className="w-4 h-4" />}
          onClick={handleLogout}
        />
      </div>

      {/* Account Card */}
      <div
        className="rounded-xl border p-6"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {user?.name ? user.name[0].toUpperCase() : user?.email?.[0].toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {liveMe?.displayName || user?.name || user?.email || "—"}
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge
                variant={(liveMe?.role ?? user?.role) === "ADMIN" ? "green" : "neutral"}
                label={liveMe?.role ?? user?.role ?? "FARMER"}
              />
              {sessionStatus === "verified" && (
                <Badge variant="green" label="Cloud Account Verified" />
              )}
              {sessionStatus === "offline" && (
                <Badge variant="yellow" label="Offline Field Mode" />
              )}
            </div>
          </div>
        </div>

        <Divider variant="subtle" />

        <div className="mt-4 space-y-3">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
              <span style={{ color: "var(--text-secondary)", minWidth: "4rem" }}>{label}</span>
              <span className="truncate" style={{ color: "var(--text-primary)" }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Field Preferences Card */}
      <div
        className="rounded-xl border p-6 space-y-5"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        <Heading level={2} weight="semibold" className="type-card-title">
          Display &amp; Unit Preferences
        </Heading>

        {/* Area Units */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Ruler className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span style={{ color: "var(--text-primary)" }}>Land Area Units</span>
          </div>
          <ButtonGroup label="Land Area Units" size="sm">
            <Button
              label="Hectares (ha)"
              variant={preferences.areaUnit === "ha" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setPreferences({ areaUnit: "ha" })}
            />
            <Button
              label="Acres"
              variant={preferences.areaUnit === "acres" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setPreferences({ areaUnit: "acres" })}
            />
          </ButtonGroup>
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            {preferences.theme === "dark" ? (
              <Moon className="w-4 h-4" style={{ color: "var(--accent)" }} />
            ) : (
              <Sun className="w-4 h-4" style={{ color: "var(--accent)" }} />
            )}
            <span style={{ color: "var(--text-primary)" }}>Color Theme</span>
          </div>
          <ButtonGroup label="Color Theme" size="sm">
            <Button
              label="Light"
              variant={preferences.theme === "light" ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setPreferences({ theme: "light" });
                setTheme("light");
              }}
            />
            <Button
              label="Dark"
              variant={preferences.theme === "dark" ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setPreferences({ theme: "dark" });
                setTheme("dark");
              }}
            />
          </ButtonGroup>
        </div>
      </div>

      {/* Organizer & Field Team Capabilities Matrix */}
      <BezelCard
        data-testid="role-capabilities-matrix"
        innerClassName="p-6 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <Heading level={2} weight="semibold" className="type-card-title">
            Organizer &amp; Field Team Capabilities
          </Heading>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-0.5 font-mono text-[11px] text-[var(--accent)]">
            {user?.role === "ADMIN" ? "ORGANIZER" : user?.role ?? "FARMER"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {[
            "Multi-Depth Dielectric Sensor Registration",
            "FAO-56 Solenoid Valve & Rain-Hold Actuation",
            "Offline FieldShield Ledger & Outbox Replay",
            "11-Script Vernacular Shift Brief Dispatch",
          ].map((cap) => (
            <div
              key={cap}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)]/60 px-3 py-2 text-[var(--text-primary)]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-good)] shrink-0" />
              <span>{cap}</span>
            </div>
          ))}
        </div>
      </BezelCard>

      {/* FieldShield Sync Outbox Inspector */}
      <div
        className="rounded-xl border p-6 space-y-4"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Heading level={2} weight="semibold" className="type-card-title">
              FieldShield Offline Sync Outbox
            </Heading>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {syncOutbox.length} queued field update(s) ready to sync to your farm workspace.
            </p>
          </div>

          <Button
            label="Sync Now"
            variant="primary"
            size="sm"
            elevation="low"
            loading={syncing}
            disabled={syncing}
            icon={!syncing ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
            onClick={() => void handleSyncNow()}
          />
        </div>

        {syncResult && (
          <div
            className="text-xs px-3 py-2 rounded-lg border flex items-center gap-1.5"
            style={{
              background: "var(--bg-raised)",
              borderColor: "var(--border-default)",
              color: "var(--status-good)",
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{syncResult}</span>
          </div>
        )}

        {syncOutbox.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {syncOutbox.map((item) => (
              <div
                key={item.id}
                className="text-xs px-3 py-2 rounded-lg border flex items-center justify-between gap-2"
                style={{
                  background: "var(--bg-raised)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                }}
              >
                <span className="font-mono font-medium" style={{ color: "var(--text-primary)" }}>
                  {item.kind}
                </span>
                <span className="truncate">{item.resourceId}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
