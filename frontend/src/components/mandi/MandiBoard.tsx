"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Selector, type SelectorOptionData } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Table, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import {
  CheckCircle2,
  Clock,
  PauseCircle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LocationCascadeSelect } from "@/components/ui/LocationCascadeSelect";
import {
  MSP_BENCHMARKS_2025_26,
  calculateBreakEven,
  formatInr,
  getMandiRatesForLocation,
  type BreakEvenVerdict,
  type MandiRateRow,
} from "@/lib/mandi-data";
import { getActiveProperty, useFarmStore } from "@/lib/property-store";
import { useI18n } from "@/lib/i18n";

interface MandiTableRow extends MandiRateRow {
  breakEvenPerQuintal: number;
  netModalPerQuintal: number;
  profitPerQuintal: number;
  marginPercent: number;
  verdict: BreakEvenVerdict;
}

const CROP_OPTIONS: SelectorOptionData[] = [
  { value: "ALL", label: "All Major Crops (11)" },
  ...MSP_BENCHMARKS_2025_26.map((b) => ({
    value: b.crop,
    label: b.mspInr ? `${b.crop} (MSP ${formatInr(b.mspInr)}/q)` : `${b.crop} (Market)`,
  })),
];

function verdictMeta(verdict: BreakEvenVerdict): {
  label: string;
  dotVariant: "success" | "warning" | "error";
  progressVariant: "success" | "warning" | "error";
  icon: React.ReactNode;
} {
  if (verdict === "SELL_NOW") {
    return {
      label: "SELL NOW",
      dotVariant: "success",
      progressVariant: "success",
      icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
    };
  }
  if (verdict === "WATCH") {
    return {
      label: "WATCH",
      dotVariant: "warning",
      progressVariant: "warning",
      icon: <Clock className="h-3 w-3" aria-hidden="true" />,
    };
  }
  return {
    label: "HOLD",
    dotVariant: "error",
    progressVariant: "error",
    icon: <PauseCircle className="h-3 w-3" aria-hidden="true" />,
  };
}

export function MandiBoard() {
  const { t } = useI18n();
  const farmLocation = useFarmStore((s) => s.farmLocation);
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const activeFarm = getActiveProperty({ properties, activePropertyId });

  const [selectedCrop, setSelectedCrop] = useState<string>("ALL");
  const [inputCostPerAcre, setInputCostPerAcre] = useState<number>(22_000);
  const [expectedYieldQuintals, setExpectedYieldQuintals] = useState<number>(18);
  const [transportPerQuintal, setTransportPerQuintal] = useState<number>(110);
  const [rates, setRates] = useState<MandiRateRow[]>(() =>
    getMandiRatesForLocation(farmLocation.stateCode, farmLocation.districtName)
  );
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [offlineFallback, setOfflineFallback] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function loadMandi() {
      setLoading(true);
      const localRows = getMandiRatesForLocation(
        farmLocation.stateCode,
        farmLocation.districtName,
        selectedCrop === "ALL" ? undefined : selectedCrop
      );
      try {
        const params = new URLSearchParams({
          stateCode: farmLocation.stateCode,
          district: farmLocation.districtName,
        });
        if (selectedCrop !== "ALL") {
          params.set("crop", selectedCrop);
        }
        const res = await fetch(`/api/mandi?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          rates?: MandiRateRow[];
          updatedAt?: string;
        };
        if (cancelled) return;
        setRates(Array.isArray(json.rates) && json.rates.length > 0 ? json.rates : localRows);
        setUpdatedAt(json.updatedAt ?? "");
        setOfflineFallback(false);
      } catch {
        if (cancelled) return;
        setRates(localRows);
        setOfflineFallback(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMandi();
    return () => {
      cancelled = true;
    };
  }, [farmLocation.stateCode, farmLocation.districtName, selectedCrop, reloadNonce]);

  const enrichedRows: MandiTableRow[] = useMemo(
    () =>
      rates.map((row) => {
        const calc = calculateBreakEven(
          inputCostPerAcre,
          expectedYieldQuintals,
          row.modalPriceInr,
          transportPerQuintal
        );
        return {
          ...row,
          ...calc,
        };
      }),
    [rates, inputCostPerAcre, expectedYieldQuintals, transportPerQuintal]
  );

  const benchmarkRow = enrichedRows[0];
  const summaryBreakEven = useMemo(
    () =>
      calculateBreakEven(
        inputCostPerAcre,
        expectedYieldQuintals,
        benchmarkRow?.modalPriceInr ?? 2420,
        transportPerQuintal
      ),
    [inputCostPerAcre, expectedYieldQuintals, benchmarkRow?.modalPriceInr, transportPerQuintal]
  );

  const summaryMeta = verdictMeta(summaryBreakEven.verdict);
  const progressValue = Math.max(0, Math.min(100, Math.round(summaryBreakEven.marginPercent + 25)));

  const columns: TableColumn<MandiTableRow>[] = useMemo(
    () => [
      {
        key: "mandiName",
        header: "Mandi & Source",
        width: proportional(1.5, { minWidth: 165 }),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text type="label" weight="semibold">
              {row.mandiName}
            </Text>
            <Text type="supporting" color="secondary">
              {row.source} · {row.distanceKm} km · {row.arrivalTonnes}t arrivals
            </Text>
          </VStack>
        ),
      },
      {
        key: "crop",
        header: "Crop & Variety",
        width: proportional(1.1, { minWidth: 120 }),
        renderCell: (row) => (
          <VStack gap={0.5}>
            <Text type="label" weight="semibold">
              {row.crop}
            </Text>
            <Text type="supporting" color="secondary" maxLines={1}>
              {row.variety}
            </Text>
          </VStack>
        ),
      },
      {
        key: "modalPriceInr",
        header: "Modal (Min–Max)",
        align: "end",
        width: proportional(1.2, { minWidth: 135 }),
        renderCell: (row) => (
          <VStack gap={0.5} hAlign="end">
            <Text type="label" weight="semibold" hasTabularNumbers>
              {formatInr(row.modalPriceInr)}/q
            </Text>
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {formatInr(row.minPriceInr)}–{formatInr(row.maxPriceInr)}
            </Text>
          </VStack>
        ),
      },
      {
        key: "mspDeltaInr",
        header: "2025-26 MSP Delta",
        align: "end",
        width: proportional(1.1, { minWidth: 125 }),
        renderCell: (row) => {
          if (row.mspInr === null || row.mspDeltaInr === null) {
            return (
              <Text type="supporting" color="secondary">
                Market-linked
              </Text>
            );
          }
          const sign = row.mspDeltaInr >= 0 ? "+" : "";
          return (
            <VStack gap={0.5} hAlign="end">
              <Text
                type="label"
                weight="semibold"
                color={row.mspDeltaInr >= 0 ? "accent" : "primary"}
                hasTabularNumbers
              >
                {sign}
                {formatInr(row.mspDeltaInr)}/q
              </Text>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                MSP {formatInr(row.mspInr)}
              </Text>
            </VStack>
          );
        },
      },
      {
        key: "profitPerQuintal",
        header: "Net Profit / q",
        align: "end",
        width: proportional(1.1, { minWidth: 120 }),
        renderCell: (row) => (
          <VStack gap={0.5} hAlign="end">
            <Text type="label" weight="semibold" hasTabularNumbers>
              {formatInr(row.profitPerQuintal)}/q
            </Text>
            <Text type="supporting" color="secondary" hasTabularNumbers>
              Net {formatInr(row.netModalPerQuintal)}
            </Text>
          </VStack>
        ),
      },
      {
        key: "verdict",
        header: "Signal",
        width: proportional(1, { minWidth: 115 }),
        renderCell: (row) => {
          const meta = verdictMeta(row.verdict);
          return (
            <HStack gap={2} vAlign="center">
              <StatusDot variant={meta.dotVariant} label={meta.label} icon={meta.icon} />
              <Text type="label" weight="semibold">
                {meta.label}
              </Text>
            </HStack>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <HStack gap={3} hAlign="between" vAlign="start" wrap="wrap">
        <VStack gap={1}>
          <Text type="supporting" color="accent" weight="semibold">
            {t("mandi.eyebrow", "MANDI & MSP INTELLIGENCE · 2025–26 BENCHMARKS")}
          </Text>
          <Heading level={1} weight="normal" className="type-page-title">
            {t("mandi.title", "Mandi Rates & Personal Break-Even Board")}
          </Heading>
          <Text type="body" color="secondary">
            Compare live APMC &amp; e-NAM yards against 2025-26 MSP and your own input + transport cost for{" "}
            {farmLocation.districtName}, {farmLocation.stateName}
            {activeFarm ? ` · ${activeFarm.name}` : ""}.
          </Text>
        </VStack>
        <Button
          label={loading ? "Refreshing..." : "Refresh Rates"}
          variant="outline"
          size="md"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => setReloadNonce((n) => n + 1)}
          disabled={loading}
        />
      </HStack>

      {offlineFallback && (
        <Banner
          status="info"
          title="Showing offline APMC & MSP ledger"
          description="Live mandi feed is unreachable; rates are served from the local district cache."
        />
      )}

      <VStack gap={3}>
        <LocationCascadeSelect />
        <div className="max-w-sm">
          <Selector
            label="Filter Crop"
            options={CROP_OPTIONS}
            value={selectedCrop}
            onChange={setSelectedCrop}
            width="100%"
            presentation="adaptive"
          />
        </div>
      </VStack>

      <Card padding={5}>
        <VStack gap={4}>
          <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
            <HStack gap={2} vAlign="center">
              <TrendingUp className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
              <VStack gap={0.5}>
                <Heading level={2} className="type-section-title">
                  Personal Break-Even Cost Bar
                </Heading>
                <Text type="supporting" color="secondary">
                  Benchmark crop: {benchmarkRow?.crop ?? "Paddy"} at {benchmarkRow?.mandiName ?? "local APMC"} (
                  {formatInr(benchmarkRow?.modalPriceInr ?? 2420)}/q modal)
                </Text>
              </VStack>
            </HStack>
            <HStack gap={2} vAlign="center">
              <StatusDot
                variant={summaryMeta.dotVariant}
                label={`Market verdict: ${summaryMeta.label}`}
                icon={summaryMeta.icon}
              />
              <Text type="label" weight="semibold">
                {summaryMeta.label} · {summaryBreakEven.marginPercent}% margin
              </Text>
            </HStack>
          </HStack>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberInput
              label="Input Cost per Acre"
              value={inputCostPerAcre}
              onChange={(v) => setInputCostPerAcre(Number.isFinite(v) ? v : 0)}
              min={0}
              max={500_000}
              step={500}
              units="₹/acre"
              isWheelEnabled={false}
              width="100%"
            />
            <NumberInput
              label="Expected Yield"
              value={expectedYieldQuintals}
              onChange={(v) => setExpectedYieldQuintals(Number.isFinite(v) ? v : 0)}
              min={0}
              max={200}
              step={1}
              units="q/acre"
              isWheelEnabled={false}
              width="100%"
            />
            <NumberInput
              label="Transport & Mandi Fee"
              value={transportPerQuintal}
              onChange={(v) => setTransportPerQuintal(Number.isFinite(v) ? v : 0)}
              min={0}
              max={5000}
              step={10}
              units="₹/q"
              isWheelEnabled={false}
              width="100%"
            />
          </div>

          <Divider />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <VStack gap={0.5}>
              <Text type="supporting" color="secondary">
                Break-Even Floor
              </Text>
              <Text type="large" weight="semibold" hasTabularNumbers>
                {formatInr(summaryBreakEven.breakEvenPerQuintal)}/q
              </Text>
            </VStack>
            <VStack gap={0.5}>
              <Text type="supporting" color="secondary">
                Net Realization (after transport)
              </Text>
              <Text type="large" weight="semibold" hasTabularNumbers>
                {formatInr(summaryBreakEven.netModalPerQuintal)}/q
              </Text>
            </VStack>
            <VStack gap={0.5}>
              <Text type="supporting" color="secondary">
                Net Profit per Quintal
              </Text>
              <Text type="large" weight="semibold" hasTabularNumbers>
                {formatInr(summaryBreakEven.profitPerQuintal)}/q
              </Text>
            </VStack>
          </div>

          <ProgressBar
            label="Net margin headroom above break-even"
            value={progressValue}
            max={100}
            variant={summaryMeta.progressVariant}
            hasValueLabel
            formatValueLabel={() => `${summaryBreakEven.marginPercent}% vs cost`}
          />
        </VStack>
      </Card>

      <VStack gap={2}>
        <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
          <Heading level={2} className="type-section-title">
            Nearby APMC &amp; e-NAM Yards ({enrichedRows.length})
          </Heading>
          {updatedAt && (
            <Text type="supporting" color="secondary" hasTabularNumbers>
              Updated {updatedAt.slice(0, 10)} · {farmLocation.stateCode}
            </Text>
          )}
        </HStack>

        <Table
          data={enrichedRows}
          columns={columns}
          idKey="id"
          density="balanced"
          dividers="rows"
          hasHover
          emptyState={
            <EmptyState
              title="No mandi rows match this crop"
              description="Switch the crop filter back to All Major Crops to inspect all regional yards."
              actions={
                <Button
                  label="Show All Crops"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedCrop("ALL")}
                />
              }
            />
          }
        />
      </VStack>
    </div>
  );
}
