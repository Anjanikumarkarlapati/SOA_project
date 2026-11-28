"use client";

import React, { useMemo, useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { ButtonGroup } from "@astryxdesign/core/ButtonGroup";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Table, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  buildDemoFpoClusterParcels,
  buildFpoBroadcastSummary,
  type FpoResolvedParcel,
} from "@/lib/fpo-broadcast";
import { useI18n } from "@/lib/i18n";
import { useFarmStore } from "@/lib/property-store";

interface FpoTableRow extends Record<string, unknown> {
  id: string;
  farmerName: string;
  village: string;
  cropName: string;
  areaHa: number;
  waterSavedLitres: number;
  soilMoisturePct: number;
  windKmh: number;
  rainProbPct: number;
  resolvedStatus: FpoResolvedParcel["resolvedStatus"];
  resolvedReason: string;
}

export function FpoBroadcastPanel() {
  const { language, t } = useI18n();
  const properties = useFarmStore((s) => s.properties);
  const [filterMode, setFilterMode] = useState<"all" | "anomalies">("all");
  const [copied, setCopied] = useState(false);
  const [sharedWhatsApp, setSharedWhatsApp] = useState(false);

  const summary = useMemo(() => {
    const parcels = buildDemoFpoClusterParcels(properties, 50);
    return buildFpoBroadcastSummary(parcels, language);
  }, [language, properties]);

  const rows: FpoTableRow[] = useMemo(() => {
    const source =
      filterMode === "anomalies"
        ? summary.parcels.filter((p) => p.resolvedStatus !== "SAFE")
        : summary.parcels;

    return source.map((p) => ({
      id: p.id,
      farmerName: p.farmerName,
      village: p.village,
      cropName: p.cropName,
      areaHa: p.areaHa,
      waterSavedLitres: p.waterSavedLitres,
      soilMoisturePct: p.soilMoisturePct,
      windKmh: p.windKmh,
      rainProbPct: p.rainProbPct,
      resolvedStatus: p.resolvedStatus,
      resolvedReason: p.resolvedReason,
    }));
  }, [filterMode, summary.parcels]);

  const columns: TableColumn<FpoTableRow>[] = useMemo(
    () => [
      {
        key: "farmerName",
        header: t("fpo.colMember", "Member / Parcel"),
        width: proportional(1.5, { minWidth: 140 }),
        renderCell: (row) => (
          <VStack gap={0}>
            <Text type="label" weight="semibold" maxLines={1}>
              {row.farmerName}
            </Text>
            <Text type="supporting" color="secondary" maxLines={1}>
              {row.village} · {row.cropName}
            </Text>
          </VStack>
        ),
      },
      {
        key: "telemetry",
        header: t("fpo.colTelemetry", "Telemetry"),
        width: proportional(1.2, { minWidth: 120 }),
        renderCell: (row) => (
          <Text type="supporting" hasTabularNumbers>
            {Math.round(row.soilMoisturePct)}% soil · {Math.round(row.windKmh)} km/h ·{" "}
            {Math.round(row.rainProbPct)}% rain
          </Text>
        ),
      },
      {
        key: "waterSavedLitres",
        header: t("fpo.colSaved", "Water Saved"),
        align: "end",
        width: proportional(0.9, { minWidth: 96 }),
        renderCell: (row) => (
          <Text type="label" hasTabularNumbers>
            {row.waterSavedLitres.toLocaleString("en-IN")} L
          </Text>
        ),
      },
      {
        key: "resolvedStatus",
        header: t("fpo.colStatus", "FieldShield"),
        width: proportional(1.4, { minWidth: 130 }),
        renderCell: (row) => {
          const variant =
            row.resolvedStatus === "HOLD"
              ? "error"
              : row.resolvedStatus === "CAUTION"
                ? "warning"
                : "success";
          return (
            <VStack gap={0}>
              <HStack gap={1} vAlign="center">
                <StatusDot
                  variant={variant}
                  label={row.resolvedStatus}
                  isPulsing={row.resolvedStatus === "HOLD"}
                />
                <Text type="label" weight="semibold">
                  {row.resolvedStatus}
                </Text>
              </HStack>
              <Text type="supporting" color="secondary" maxLines={1}>
                {row.resolvedReason}
              </Text>
            </VStack>
          );
        },
      },
    ],
    [t]
  );

  const handleCopyBroadcast = async () => {
    try {
      await navigator.clipboard.writeText(summary.whatsappBroadcastText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(summary.whatsappBroadcastText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSharedWhatsApp(true);
    setTimeout(() => setSharedWhatsApp(false), 2500);
  };

  return (
    <Card>
      <VStack gap={4}>
        <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
          <VStack gap={1}>
            <Text type="supporting" color="secondary">
              FPO 1-to-50 Broadcast Command Center
            </Text>
            <Heading level={2}>
              {summary.parcelCount} Member Parcels ({summary.totalAreaHa.toLocaleString("en-IN")} ha)
            </Heading>
          </VStack>

          <VStack gap={0} hAlign="end">
            <Text type="supporting" color="secondary">
              Pooled Water Saved
            </Text>
            <Heading level={3} className="type-kpi">
              {summary.totalWaterSavedLitres.toLocaleString("en-IN")} L
            </Heading>
          </VStack>
        </HStack>

        <HStack gap={4} vAlign="center" hAlign="between" wrap="wrap">
          <HStack gap={4} vAlign="center" wrap="wrap">
            <HStack gap={1} vAlign="center">
              <StatusDot variant="success" label="SAFE" />
              <Text type="label" hasTabularNumbers>
                SAFE: {summary.healthyCount}
              </Text>
            </HStack>
            <HStack gap={1} vAlign="center">
              <StatusDot variant="warning" label="CAUTION" />
              <Text type="label" hasTabularNumbers>
                CAUTION: {summary.cautionCount}
              </Text>
            </HStack>
            <HStack gap={1} vAlign="center">
              <StatusDot variant="error" label="HOLD" isPulsing={summary.holdCount > 0} />
              <Text type="label" hasTabularNumbers>
                HOLD: {summary.holdCount}
              </Text>
            </HStack>
          </HStack>

          <SegmentedControl
            label="Filter FPO parcels"
            value={filterMode}
            onChange={(v) => setFilterMode(v === "anomalies" ? "anomalies" : "all")}
            size="sm"
          >
            <SegmentedControlItem value="all" label={`All (${summary.parcelCount})`} />
            <SegmentedControlItem
              value="anomalies"
              label={`Anomalies (${summary.anomalies.length})`}
            />
          </SegmentedControl>
        </HStack>

        {summary.anomalies.length > 0 && (
          <Banner
            status={summary.holdCount > 0 ? "warning" : "info"}
            title={`${summary.anomalies.length} parcel anomalies flagged for morning crew`}
            description={summary.anomalies
              .slice(0, 3)
              .map((a) => `${a.farmerName} (${a.status}): ${a.reason}`)
              .join(" · ")}
          />
        )}

        <div className="max-h-[380px] overflow-y-auto rounded-xl border border-[var(--border-default)]">
          <Table
            data={rows}
            columns={columns}
            idKey="id"
            density="compact"
            dividers="rows"
            hasHover
          />
        </div>

        <HStack hAlign="end" wrap="wrap">
          <ButtonGroup label="FPO broadcast actions" size="sm">
            <Button
              label={copied ? "Copied Broadcast" : "Copy Broadcast"}
              variant="secondary"
              size="sm"
              tooltip={
                copied
                  ? "Broadcast text copied to clipboard"
                  : "Copy 50-parcel morning broadcast text"
              }
              icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              onClick={() => void handleCopyBroadcast()}
            />
            <Button
              label={sharedWhatsApp ? "Opened WhatsApp" : "Share on WhatsApp"}
              variant="secondary"
              size="sm"
              tooltip="Open WhatsApp with 50-parcel morning crew broadcast"
              icon={sharedWhatsApp ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              onClick={handleShareWhatsApp}
            />
          </ButtonGroup>
        </HStack>
      </VStack>
    </Card>
  );
}
