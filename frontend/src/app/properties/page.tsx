"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Heading } from "@astryxdesign/core/Heading";
import {
  MapPin,
  Plus,
  CheckCircle2,
  Droplets,
  Sprout,
  Trash2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useFarmStore, getActiveProperty } from "@/lib/property-store";
import { isOfflineToken, useAuthStore } from "@/lib/auth";
import { getCropById } from "@/lib/crops";
import { MEDIA_MANIFEST } from "@/lib/media-manifest";
import { FarmMap } from "@/components/FarmMap";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import { EditorialPhotoFrame } from "@/components/ui/EditorialPhotoFrame";
import { toast } from "@/components/ui/Toaster";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Banner } from "@astryxdesign/core/Banner";

const PARCEL_GALLERY = [
  MEDIA_MANIFEST["aerial-farm"],
  MEDIA_MANIFEST["crop-canopy"],
  MEDIA_MANIFEST["soil-sensing"],
  MEDIA_MANIFEST["irrigation-drip"],
] as const;

export default function PropertiesPage() {
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const setActiveProperty = useFarmStore((s) => s.setActiveProperty);
  const updateProperty = useFarmStore((s) => s.updateProperty);
  const deleteProperty = useFarmStore((s) => s.deleteProperty);
  const syncPropertiesFromBackend = useFarmStore((s) => s.syncPropertiesFromBackend);
  const preferences = useFarmStore((s) => s.preferences);
  const token = useAuthStore((s) => s.user?.token ?? "");
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [farmToRemove, setFarmToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleConfirmRemove = async () => {
    if (!farmToRemove) return;
    setRemoving(true);
    setActionError(null);
    try {
      await deleteProperty(farmToRemove.id, token);
      toast(`Removed ${farmToRemove.name}`, "info");
      setFarmToRemove(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove farm");
      setFarmToRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  useEffect(() => {
    if (token && !isOfflineToken(token)) {
      void syncPropertiesFromBackend(token);
    }
  }, [token, syncPropertiesFromBackend]);

  const handleRefresh = async () => {
    if (!token || isOfflineToken(token)) return;
    setSyncing(true);
    setActionError(null);
    try {
      await syncPropertiesFromBackend(token);
    } finally {
      setSyncing(false);
    }
  };

  const activeFarm = getActiveProperty({ properties, activePropertyId });
  const aerialMedia = MEDIA_MANIFEST["aerial-farm"];

  const formatArea = (areaHa: number) => {
    if (preferences.areaUnit === "acres") {
      return `${(areaHa * 2.47105).toFixed(2)} acres`;
    }
    return `${areaHa.toFixed(1)} ha`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Heading level={1} weight="normal" textWrap="balance" className="type-page-title">
            My Farms &amp; Field Portfolio
          </Heading>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Select an active farm to drive climate analytics, soil telemetry, and irrigation schedules.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {token && !isOfflineToken(token) && (
            <Button
              label="Sync Farms"
              variant="secondary"
              size="sm"
              loading={syncing}
              disabled={syncing}
              icon={!syncing ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
              onClick={() => void handleRefresh()}
            />
          )}
          <Button
            label="Add Property"
            href="/properties/new"
            variant="primary"
            size="md"
            elevation="low"
            icon={<Plus className="w-4 h-4" />}
          />
        </div>
      </div>

      {actionError && (
        <Banner
          status="error"
          role="alert"
          title={actionError}
          isDismissable
          onDismiss={() => setActionError(null)}
        />
      )}

      {/* Empty state */}
      {properties.length === 0 ? (
        <BezelCard innerClassName="p-6 sm:p-8 text-center space-y-5">
          <EditorialPhotoFrame
            data-testid="property-aerial-cover"
            className="mx-auto max-w-xl"
            innerClassName="h-52 sm:h-56"
            lightbox={{
              src: aerialMedia.src,
              alt: aerialMedia.alt,
              caption: "Parcel aerial survey · 20.296°N · 85.825°E",
            }}
            caption={
              <>
                <span className="rounded-full border border-white/25 bg-black/65 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  Parcel aerial survey
                </span>
                <span className="rounded-full border border-white/25 bg-black/65 px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-[#DFECC6] backdrop-blur-sm">
                  20.296°N · 85.825°E
                </span>
              </>
            }
          >
            <Image
              src={aerialMedia.src}
              alt={aerialMedia.alt}
              fill
              sizes="(min-width: 768px) 560px, 100vw"
              className="object-cover photo-duotone"
            />
          </EditorialPhotoFrame>

          <div>
            <Heading level={2} weight="semibold" className="type-card-title mb-1">
              No properties yet
            </Heading>
            <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
              Register your first farm parcel to activate local climate models, soil probes, and irrigation rules.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              label="Register farm"
              href="/properties/new"
              variant="primary"
              size="md"
              elevation="low"
              icon={<Plus className="w-4 h-4" />}
            />
          </div>
        </BezelCard>
      ) : (
        <>
          {/* Farm cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {properties.map((farm, idx) => {
              const isActive = activeFarm?.id === farm.id;
              const crop = getCropById(farm.selectedCropId || "wheat");
              const parcelMedia = PARCEL_GALLERY[idx % PARCEL_GALLERY.length];
              return (
                <BezelCard
                  key={farm.id}
                  className={isActive ? "ring-1 ring-[var(--accent)]" : undefined}
                  innerClassName="p-4 sm:p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    {/* Human-free Editorial Parcel Specimen Frame */}
                    <EditorialPhotoFrame
                      data-testid="property-aerial-cover"
                      className="mb-4"
                      innerClassName="h-44 w-full"
                      lightbox={{
                        src: parcelMedia.src,
                        alt: parcelMedia.alt,
                        caption: `${farm.name} · ${crop.name} parcel (${farm.lat.toFixed(3)}°N · ${farm.lon.toFixed(3)}°E)`,
                      }}
                      caption={
                        <>
                          <span className="rounded-full border border-white/25 bg-black/65 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                            {crop.name} parcel
                          </span>
                          <span className="rounded-full border border-white/25 bg-black/65 px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-[#DFECC6] backdrop-blur-sm">
                            {farm.lat.toFixed(3)}°N · {farm.lon.toFixed(3)}°E
                          </span>
                        </>
                      }
                    >
                      <Image
                        src={parcelMedia.src}
                        alt={parcelMedia.alt}
                        fill
                        sizes="(min-width: 768px) 480px, 100vw"
                        className="object-cover photo-duotone"
                      />
                    </EditorialPhotoFrame>

                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <Heading level={2} weight="semibold" className="type-card-title !text-xl">
                          {farm.name}
                        </Heading>
                        <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-mono tabular-nums">
                            {farm.address || `${farm.lat.toFixed(4)}, ${farm.lon.toFixed(4)}`}
                          </span>
                        </div>
                      </div>
                      {isActive && (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
                          style={{ background: "var(--bg-raised)", color: "var(--accent)" }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active Farm
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 text-xs">
                      <div
                        className="rounded-lg px-3 py-2 border"
                        style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
                      >
                        <div style={{ color: "var(--text-secondary)" }}>Area</div>
                        <div className="font-semibold font-mono tabular-nums mt-0.5" style={{ color: "var(--text-primary)" }}>
                          {formatArea(farm.areaHa)}
                        </div>
                      </div>
                      <div
                        className="rounded-lg px-3 py-2 border"
                        style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
                      >
                        <div style={{ color: "var(--text-secondary)" }}>Water &amp; System</div>
                        <div className="font-semibold mt-0.5 capitalize" style={{ color: "var(--text-primary)" }}>
                          <Droplets className="w-3 h-3 inline mr-1" />
                          {farm.waterSource || "borewell"} · {farm.irrigationType || "drip"}
                        </div>
                      </div>
                      <div
                        className="rounded-lg px-3 py-2 border"
                        style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
                      >
                        <div style={{ color: "var(--text-secondary)" }}>Crop &amp; Soil</div>
                        <div className="font-semibold mt-0.5 capitalize" style={{ color: "var(--text-primary)" }}>
                          <Sprout className="w-3 h-3 inline mr-1" />
                          {crop.name} · {farm.soilType || "loam"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t flex-wrap" style={{ borderColor: "var(--border-default)" }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        label={isActive ? "Active Farm" : "Set Active"}
                        variant={isActive ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => {
                          setActiveProperty(farm.id);
                          toast(`Active farm set to ${farm.name}`, "success");
                        }}
                      />

                      <Button
                        label="Open Field Hub"
                        href="/dashboard"
                        variant="secondary"
                        size="sm"
                        endContent={<ArrowRight className="w-3.5 h-3.5" />}
                        onClick={() => setActiveProperty(farm.id)}
                      />
                    </div>

                    {properties.length > 1 && (
                      <Button
                        label="Remove"
                        variant="destructive"
                        size="sm"
                        aria-label={`Remove ${farm.name}`}
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={() => setFarmToRemove({ id: farm.id, name: farm.name })}
                      />
                    )}
                  </div>
                </BezelCard>
              );
            })}
          </div>

          {/* Interactive Spatial Map for Active Farm */}
          {activeFarm && (
            <div className="mt-6">
              <FarmMap
                lat={activeFarm.lat}
                lng={activeFarm.lon}
                farmName={activeFarm.name}
                cropName={getCropById(activeFarm.selectedCropId || "wheat").name}
                areaHectares={activeFarm.areaHa}
                onLocationChange={(loc) => {
                  setActionError(null);
                  void updateProperty(
                    activeFarm.id,
                    {
                      lat: loc.lat,
                      lon: loc.lng,
                      ...(loc.address ? { address: loc.address } : {}),
                    },
                    token
                  ).catch((err) =>
                    setActionError(err instanceof Error ? err.message : "Failed to update farm location")
                  );
                }}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2 border-t flex-wrap" style={{ borderColor: "var(--border-default)" }}>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Next workflow step: verify field soil moisture &amp; probe health for your active farm.
            </span>
            <Button
              label="Next: Sensors & Soil"
              href="/sensors"
              variant="primary"
              size="sm"
              endContent={<ArrowRight className="w-3.5 h-3.5" />}
            />
          </div>
        </>
      )}

      <AlertDialog
        isOpen={Boolean(farmToRemove)}
        onOpenChange={(open) => {
          if (!open && !removing) setFarmToRemove(null);
        }}
        title="Remove farm parcel?"
        description={
          farmToRemove
            ? `Removing "${farmToRemove.name}" will delete this parcel and its local sensor or schedule links from your portfolio.`
            : ""
        }
        actionLabel="Remove Farm"
        cancelLabel="Keep Farm"
        actionVariant="destructive"
        isActionLoading={removing}
        onAction={() => void handleConfirmRemove()}
      />
    </div>
  );
}
