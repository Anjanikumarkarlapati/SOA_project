"use client";

import React, { useMemo, useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Leaf, PhoneCall, ShieldAlert, Sparkles } from "lucide-react";
import type { CropDiagnosisResponse } from "@/app/api/ai/diagnose/route";
import { CropImagePicker } from "@/components/media/CropImagePicker";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n";
import type { PreparedImageResult } from "@/lib/image-prep";
import { getDefaultMediaStore } from "@/lib/media-queue";
import { getActiveProperty, useFarmStore, type SyncOutboxItem } from "@/lib/property-store";

export interface CropDoctorModalProps {
  open: boolean;
  onClose: () => void;
  defaultCropName?: string;
  propertyId?: string;
}

function makeMediaId(): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `DIAG-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export function CropDoctorModal({
  open,
  onClose,
  defaultCropName,
  propertyId,
}: CropDoctorModalProps) {
  const { language, t } = useI18n();
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const activeProperty = useMemo(
    () =>
      (propertyId ? properties.find((p) => p.id === propertyId) : null) ??
      getActiveProperty({ properties, activePropertyId }),
    [activePropertyId, properties, propertyId]
  );

  const initialCrop = defaultCropName?.trim() || activeProperty?.selectedCropId || "Rice (Paddy)";

  const [cropNameOverride, setCropNameOverride] = useState<string | null>(null);
  const cropName = cropNameOverride ?? initialCrop;
  const [preparedImage, setPreparedImage] = useState<PreparedImageResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [queuedInfo, setQueuedInfo] = useState<{ mediaId: string; cropName: string } | null>(null);
  const [diagnosis, setDiagnosis] = useState<CropDiagnosisResponse | null>(null);

  const queueOfflineDiagnosis = async (image: PreparedImageResult, crop: string) => {
    const mediaId = makeMediaId();
    const farmId = propertyId || activeProperty?.id || "FARM-001";
    const safeSlug = crop.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "leaf";
    const fileName = `${safeSlug}.jpg`;

    await getDefaultMediaStore().put(mediaId, image.blob);

    const outboxItem: SyncOutboxItem = {
      id: `OUTBOX-${mediaId}`,
      kind: "crop_diagnosis",
      farmId,
      resourceId: mediaId,
      payload: {
        mediaId,
        cropName: crop,
        language,
        crop,
        locale: language,
        fileName,
      },
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    useFarmStore.setState((s) => ({
      syncOutbox: [...s.syncOutbox, outboxItem],
    }));

    setQueuedInfo({ mediaId, cropName: crop });
    setDiagnosis(null);
  };

  const handleAnalyze = async () => {
    if (!preparedImage) {
      setErrorMsg(t("doctor.noImage", "Please capture or upload a crop leaf photo first."));
      return;
    }

    const cleanCrop = cropName.trim() || "Crop leaf";
    setErrorMsg(null);
    setQueuedInfo(null);
    setIsSubmitting(true);

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueOfflineDiagnosis(preparedImage, cleanCrop);
        return;
      }

      const formData = new FormData();
      formData.append("image", preparedImage.blob, "leaf.jpg");
      formData.append("cropName", cleanCrop);
      formData.append("language", language);
      formData.append("propertyId", propertyId || activeProperty?.id || "FARM-001");

      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        body: formData,
      });

      if (res.status === 503) {
        await queueOfflineDiagnosis(preparedImage, cleanCrop);
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setErrorMsg(
          body.message ||
            (res.status === 413
              ? "Image is larger than 4 MB. Please retake a closer leaf photo."
              : res.status === 429
                ? "Too many scans in 1 minute. Please wait briefly and try again."
                : "Could not inspect this photo. Please try a clearer JPEG, PNG, WebP, or HEIC image.")
        );
        return;
      }

      const data = (await res.json()) as CropDiagnosisResponse;
      setDiagnosis(data);
    } catch {
      try {
        await queueOfflineDiagnosis(preparedImage, cleanCrop);
      } catch {
        setErrorMsg("Unable to save photo offline in IndexedDB. Please check browser storage.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCropNameOverride(null);
    setPreparedImage(null);
    setDiagnosis(null);
    setErrorMsg(null);
    setQueuedInfo(null);
  };

  const handleClose = () => {
    setCropNameOverride(null);
    onClose();
  };

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      width={620}
      maxHeight="86dvh"
      purpose="form"
    >
      <Layout
        header={
          <DialogHeader
            title={t("doctor.title", "Crop Photo Doctor")}
            subtitle={t(
              "doctor.subtitle",
              "Take or upload a leaf photo for organic + per-acre medicine guidance"
            )}
            onOpenChange={(next) => {
              if (!next) handleClose();
            }}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              <TextInput
                label={t("doctor.cropLabel", "Crop name")}
                placeholder="e.g. Rice (Paddy), Wheat, Chilli"
                value={cropName}
                onChange={setCropNameOverride}
                width="100%"
                isDisabled={isSubmitting}
              />

              <CropImagePicker
                value={preparedImage}
                onImageReady={(res) => {
                  setPreparedImage(res);
                  setErrorMsg(null);
                  setQueuedInfo(null);
                  setDiagnosis(null);
                }}
                onError={(msg) => setErrorMsg(msg)}
                onClear={handleReset}
                disabled={isSubmitting}
              />

              {errorMsg && (
                <Banner
                  status="error"
                  title={t("doctor.errorTitle", "Scan could not be completed")}
                  description={errorMsg}
                  isDismissable
                  onDismiss={() => setErrorMsg(null)}
                />
              )}

              {queuedInfo && (
                <Banner
                  status="warning"
                  title={t("doctor.queuedTitle", "Queued offline in FieldShield Outbox")}
                  description={`Photo ${queuedInfo.mediaId} for ${queuedInfo.cropName} is safely stored in IndexedDB and will auto-diagnose when connection and AI service return.`}
                />
              )}

              {diagnosis && (
                <VStack gap={3}>
                  <Section variant="muted" padding={3} className="rounded-2xl border border-[var(--border-default)]">
                    <VStack gap={2}>
                      <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
                        <HStack gap={2} vAlign="center">
                          <StatusDot
                            variant={diagnosis.isHealthy ? "success" : "error"}
                            label={diagnosis.healthStatus}
                            isPulsing={!diagnosis.isHealthy}
                          />
                          <Heading level={3}>{diagnosis.healthStatus}</Heading>
                        </HStack>
                        <Text type="supporting" color="secondary" hasTabularNumbers>
                          Confidence: {diagnosis.confidencePercent}%
                        </Text>
                      </HStack>
                      {diagnosis.summary && <Text type="body">{diagnosis.summary}</Text>}
                    </VStack>
                  </Section>

                  {(diagnosis.kvkReferral || diagnosis.confidencePercent < 60) && (
                    <Banner
                      status="warning"
                      title="Low-confidence scan — verify with KVK Agronomist"
                      description={`Call Kisan Call Centre Helpline ${diagnosis.helpline ?? "1800-180-1551"} or retake a sharp daylight close-up of the affected leaf.`}
                      icon={<PhoneCall className="w-4 h-4" />}
                    />
                  )}

                  {diagnosis.problems.length > 0 && (
                    <List
                      header={
                        <HStack gap={2} vAlign="center">
                          <ShieldAlert className="w-4 h-4 text-[var(--status-warning)]" />
                          <Text type="label" weight="semibold">
                            Detected issues
                          </Text>
                        </HStack>
                      }
                      hasDividers
                      edge="flush"
                    >
                      {diagnosis.problems.map((problem, idx) => (
                        <ListItem key={`prob-${idx}`} label={<Text type="body">{problem}</Text>} />
                      ))}
                    </List>
                  )}

                  {diagnosis.organicRemedies.length > 0 && (
                    <List
                      header={
                        <HStack gap={2} vAlign="center">
                          <Leaf className="w-4 h-4 text-[var(--status-good)]" />
                          <Text type="label" weight="semibold">
                            Organic & cultural remedies
                          </Text>
                        </HStack>
                      }
                      hasDividers
                      edge="flush"
                    >
                      {diagnosis.organicRemedies.map((remedy, idx) => (
                        <ListItem key={`org-${idx}`} label={<Text type="body">{remedy}</Text>} />
                      ))}
                    </List>
                  )}

                  {diagnosis.recommendedMedicines.length > 0 && (
                    <List
                      header={
                        <HStack gap={2} vAlign="center">
                          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                          <Text type="label" weight="semibold">
                            Recommended medicines (per-acre dosage)
                          </Text>
                        </HStack>
                      }
                      hasDividers
                      edge="flush"
                    >
                      {diagnosis.recommendedMedicines.map((med, idx) => (
                        <ListItem
                          key={`med-${idx}`}
                          label={med.name}
                          description={
                            <Text type="supporting" color="secondary" hasTabularNumbers>
                              Dosage: {med.dosagePerAcre} · Harvest wait: {med.harvestWaitDays} days
                            </Text>
                          }
                        />
                      ))}
                    </List>
                  )}

                  {diagnosis.spraySafetyNote && (
                    <Banner
                      status="info"
                      title="Spray & Field Safety"
                      description={diagnosis.spraySafetyNote}
                    />
                  )}
                </VStack>
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end" wrap="wrap">
              <Button
                label={t("common.close", "Close")}
                variant="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              />
              <Button
                label={isSubmitting ? "Inspecting leaf..." : "Analyze Leaf Photo"}
                variant="primary"
                onClick={() => void handleAnalyze()}
                loading={isSubmitting}
                disabled={!preparedImage || isSubmitting}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
