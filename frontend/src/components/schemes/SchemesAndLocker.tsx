"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector, type SelectorOptionData } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Timer } from "@astryxdesign/core/Timer";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  ExternalLink,
  MapPin,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { CropImagePicker } from "@/components/media/CropImagePicker";
import { Button } from "@/components/ui/Button";
import { LocationCascadeSelect } from "@/components/ui/LocationCascadeSelect";
import type { PreparedImageResult } from "@/lib/image-prep";
import { formatInr } from "@/lib/mandi-data";
import { getDefaultMediaStore } from "@/lib/media-queue";
import { getActiveProperty, useFarmStore } from "@/lib/property-store";
import { useI18n } from "@/lib/i18n";
import {
  AGRISTACK_CHECKLIST_ITEMS,
  computePmfbyDeadline,
  estimatePmksySubsidy,
  getSchemesCatalog,
  loadPmfbyPacks,
  savePmfbyPack,
  type AgriSchemeEntry,
  type FarmerCategory,
  type PmfbyLossEvidencePack,
} from "@/lib/schemes-data";

type SchemeTab = "income" | "water" | "agristack" | "locker";

const CROP_OPTIONS: SelectorOptionData[] = [
  { value: "Paddy", label: "Paddy / Rice" },
  { value: "Wheat", label: "Wheat" },
  { value: "Cotton", label: "Cotton" },
  { value: "Groundnut", label: "Groundnut" },
  { value: "Soybean", label: "Soybean" },
  { value: "Maize", label: "Maize" },
  { value: "Tur/Arhar", label: "Tur / Arhar" },
  { value: "Onion", label: "Onion" },
];

const LOSS_CAUSE_OPTIONS: SelectorOptionData[] = [
  { value: "Inundation / Flood", label: "Inundation / Standing Flood" },
  { value: "Hailstorm", label: "Hailstorm" },
  { value: "Cyclone / Unseasonal Rain", label: "Cyclone / Unseasonal Rain" },
  { value: "Landslide / Cloudburst", label: "Landslide / Cloudburst" },
  { value: "Post-Harvest Rain Damage", label: "Post-Harvest Rain Damage" },
];

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRemainingCountdown(remainingMs: number, isExpired: boolean): string {
  if (isExpired || remainingMs <= 0) return "00h 00m 00s (Window Closed)";
  const totalSec = Math.floor(remainingMs / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s remaining`;
}

function SchemeListRows({ items }: { items: AgriSchemeEntry[] }) {
  return (
    <List header="Eligible Schemes & Official Portals" hasDividers edge="flush">
      {items.map((scheme) => (
        <ListItem
          key={scheme.id}
          itemKey={scheme.id}
          align="start"
          label={`${scheme.name} (${scheme.scope === "state" ? scheme.stateCode : "Central"})`}
          description={
            <VStack gap={1}>
              <Text type="supporting" color="primary">
                {scheme.benefitSummary}
              </Text>
              <Text type="supporting" color="secondary">
                Eligibility: {scheme.eligibility} · Helpline: {scheme.helpline}
              </Text>
            </VStack>
          }
          endContent={
            <a
              href={scheme.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[var(--border-default)] px-3 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-wash)]"
            >
              <span>Portal</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          }
        />
      ))}
    </List>
  );
}

export function SchemesAndLocker() {
  const { t } = useI18n();
  const farmLocation = useFarmStore((s) => s.farmLocation);
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const checklistByFarm = useFarmStore((s) => s.checklistByFarm);
  const toggleChecklistTask = useFarmStore((s) => s.toggleChecklistTask);
  const activeFarm = getActiveProperty({ properties, activePropertyId });

  const farmId = activeFarm?.id ?? `loc-${farmLocation.stateCode}`;
  const checklistKey = activeFarm?.id ?? "agristack-default";

  const [activeTab, setActiveTab] = useState<SchemeTab>("income");
  const [schemes, setSchemes] = useState<AgriSchemeEntry[]>(() =>
    getSchemesCatalog(farmLocation.stateCode)
  );

  // PMKSY estimator state
  const [landAcres, setLandAcres] = useState<number>(2);
  const [farmerCategory, setFarmerCategory] = useState<FarmerCategory>("small_marginal");

  // 72-Hr PMFBY Evidence Locker state
  const [lossCrop, setLossCrop] = useState<string>("Paddy");
  const [lossCause, setLossCause] = useState<string>("Inundation / Flood");
  const [incidentIso, setIncidentIso] = useState<string>(() =>
    new Date(Date.now() - 4 * 3600_000).toISOString()
  );
  const [lat, setLat] = useState<number>(activeFarm?.lat ?? farmLocation.lat ?? 20.4625);
  const [lon, setLon] = useState<number>(activeFarm?.lon ?? farmLocation.lon ?? 85.883);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [preparedPhoto, setPreparedPhoto] = useState<PreparedImageResult | null>(null);
  const [savedPacks, setSavedPacks] = useState<PmfbyLossEvidencePack[]>(() => loadPmfbyPacks());
  const [savingPack, setSavingPack] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      const localCatalog = getSchemesCatalog(farmLocation.stateCode);
      try {
        const res = await fetch(
          `/api/schemes?stateCode=${encodeURIComponent(farmLocation.stateCode)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { schemes?: AgriSchemeEntry[] };
        if (!cancelled) {
          setSchemes(
            Array.isArray(json.schemes) && json.schemes.length > 0 ? json.schemes : localCatalog
          );
        }
      } catch {
        if (!cancelled) setSchemes(localCatalog);
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [farmLocation.stateCode]);

  const pmksy = useMemo(
    () => estimatePmksySubsidy(landAcres, farmerCategory, farmLocation.stateCode),
    [landAcres, farmerCategory, farmLocation.stateCode]
  );

  const deadline = useMemo(
    () => computePmfbyDeadline(incidentIso, nowMs),
    [incidentIso, nowMs]
  );

  const checkedTaskMap = useMemo(
    () => checklistByFarm[checklistKey] ?? {},
    [checklistByFarm, checklistKey]
  );

  const checkedValues = useMemo(
    () => AGRISTACK_CHECKLIST_ITEMS.filter((item) => checkedTaskMap[item.id]).map((i) => i.id),
    [checkedTaskMap]
  );

  const handleChecklistChange = (nextValues: string[]) => {
    const nextSet = new Set(nextValues);
    for (const item of AGRISTACK_CHECKLIST_ITEMS) {
      const wasChecked = Boolean(checkedTaskMap[item.id]);
      const isChecked = nextSet.has(item.id);
      if (wasChecked !== isChecked) {
        toggleChecklistTask(checklistKey, item.id);
      }
    }
  };

  const handleCaptureGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("Geolocation unavailable in this browser; using farm coordinates.");
      return;
    }
    setGpsStatus("Reading device GPS...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLon(Number(pos.coords.longitude.toFixed(5)));
        setGpsStatus(`GPS locked (±${Math.round(pos.coords.accuracy)} m)`);
      },
      () => {
        setGpsStatus("GPS permission declined or timed out; enter/keep parcel coordinates below.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSaveEvidencePack = async () => {
    setSavingPack(true);
    setSaveBanner(null);
    try {
      const packId = `PMFBY-${Date.now().toString(36).toUpperCase()}`;
      const mediaIds: string[] = [];

      if (preparedPhoto?.blob) {
        const mediaId = `PMFBY-MEDIA-${Date.now().toString(36).toUpperCase()}`;
        await getDefaultMediaStore().put(mediaId, preparedPhoto.blob);
        mediaIds.push(mediaId);
      }

      const pack: PmfbyLossEvidencePack = {
        id: packId,
        farmId,
        cropName: lossCrop,
        lossCause,
        incidentIso,
        lat,
        lon,
        mediaIds,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        synced: false,
      };

      const nextPacks = savePmfbyPack(pack);
      setSavedPacks(nextPacks);

      setPreparedPhoto(null);
      setNotes("");
      setSaveBanner(
        `Evidence pack ${pack.id} locked offline (${mediaIds.length} photo(s) in IndexedDB).`
      );
    } finally {
      setSavingPack(false);
    }
  };

  const incomeSchemes = useMemo(
    () => schemes.filter((s) => s.category === "income_insurance"),
    [schemes]
  );
  const waterSchemes = useMemo(
    () => schemes.filter((s) => s.category === "water_soil"),
    [schemes]
  );
  const creditSchemes = useMemo(
    () => schemes.filter((s) => s.category === "agristack_credit"),
    [schemes]
  );

  const incidentStartMs = Number.isFinite(Date.parse(incidentIso))
    ? Date.parse(incidentIso)
    : nowMs;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <HStack gap={3} hAlign="between" vAlign="start" wrap="wrap">
        <VStack gap={1}>
          <Text type="supporting" color="accent" weight="semibold">
            {t("schemes.eyebrow", "GOVT SCHEMES · AGRISTACK · 72-HR PMFBY LOCKER")}
          </Text>
          <Heading level={1} weight="normal" className="type-page-title">
            {t("schemes.title", "Schemes, Subsidy Estimator & Loss Evidence")}
          </Heading>
          <Text type="body" color="secondary">
            Central &amp; {farmLocation.stateName} programs, PMKSY 45%/55% drip calculator, 11-digit Farmer ID checklist, and offline PMFBY loss proof.
          </Text>
        </VStack>
        <Button
          label="Print Sheet"
          variant="outline"
          size="md"
          icon={<Printer className="h-4 w-4" />}
          onClick={() => window.print()}
          className="no-print"
        />
      </HStack>

      <div className="no-print">
        <LocationCascadeSelect />
      </div>

      <TabList
        value={activeTab}
        onChange={(v) => setActiveTab(v as SchemeTab)}
        role="tablist"
        aria-label="Government schemes and loss locker sections"
        hasDivider
      >
        <Tab value="income" label="Income & Insurance" panelId="panel-income" />
        <Tab value="water" label="Water & Soil" panelId="panel-water" />
        <Tab value="agristack" label="AgriStack & Credit" panelId="panel-agristack" />
        <Tab value="locker" label="72-Hr Loss Locker" panelId="panel-locker" />
      </TabList>

      <div id="panel-income" role="tabpanel" hidden={activeTab !== "income"}>
        <VStack gap={4}>
          <Banner
            status="info"
            title={`Active state filter: ${farmLocation.stateName} (${farmLocation.stateCode})`}
            description="PM-KISAN ₹6,000/yr + PMFBY crop cover + state-specific farmer income transfers are listed below."
          />
          <SchemeListRows items={incomeSchemes} />
        </VStack>
      </div>

      <div id="panel-water" role="tabpanel" hidden={activeTab !== "water"}>
        <VStack gap={5}>
          <Card padding={5}>
            <VStack gap={4}>
              <HStack gap={2} vAlign="center">
                <Droplets className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
                <Heading level={2} className="type-section-title">
                  PMKSY Drip &amp; Sprinkler Subsidy Estimator (45% / 55%)
                </Heading>
              </HStack>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberInput
                  label="Parcel Area"
                  value={landAcres}
                  onChange={(v) => setLandAcres(Number.isFinite(v) ? v : 0)}
                  min={0.5}
                  max={100}
                  step={0.5}
                  units="acres"
                  isWheelEnabled={false}
                  width="100%"
                />
                <VStack gap={1.5}>
                  <Text type="label" weight="semibold">
                    Farmer Category
                  </Text>
                  <SegmentedControl
                    label="PMKSY farmer category"
                    value={farmerCategory}
                    onChange={(v) => setFarmerCategory(v as FarmerCategory)}
                    layout="fill"
                  >
                    <SegmentedControlItem value="small_marginal" label="Small / Marginal (55%)" />
                    <SegmentedControlItem value="other" label="Other (45%)" />
                  </SegmentedControl>
                </VStack>
              </div>

              <ProgressBar
                label={`Combined ${farmLocation.stateCode} PMKSY Subsidy`}
                value={pmksy.subsidyPercent}
                max={100}
                variant="success"
                hasValueLabel
                formatValueLabel={(v) => `${v}% (${pmksy.centralSharePercent}% Central + ${pmksy.stateTopUpPercent}% State)`}
              />

              <Divider />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <VStack gap={0.5}>
                  <Text type="supporting" color="secondary">
                    Indicative System Cost
                  </Text>
                  <Text type="large" weight="semibold" hasTabularNumbers>
                    {formatInr(pmksy.baseSystemCostInr)}
                  </Text>
                </VStack>
                <VStack gap={0.5}>
                  <Text type="supporting" color="secondary">
                    Total Govt Subsidy ({pmksy.subsidyPercent}%)
                  </Text>
                  <Text type="large" weight="semibold" color="accent" hasTabularNumbers>
                    {formatInr(pmksy.subsidyAmountInr)}
                  </Text>
                </VStack>
                <VStack gap={0.5}>
                  <Text type="supporting" color="secondary">
                    Net Farmer Share
                  </Text>
                  <Text type="large" weight="semibold" hasTabularNumbers>
                    {formatInr(pmksy.netFarmerCostInr)}
                  </Text>
                </VStack>
              </div>
            </VStack>
          </Card>

          <SchemeListRows items={waterSchemes} />
        </VStack>
      </div>

      <div id="panel-agristack" role="tabpanel" hidden={activeTab !== "agristack"}>
        <VStack gap={5}>
          <ProgressBar
            label="AgriStack 11-Digit Farmer ID Readiness"
            value={checkedValues.length}
            max={AGRISTACK_CHECKLIST_ITEMS.length}
            variant="accent"
            hasValueLabel
            formatValueLabel={(v, max) => `${v}/${max} steps ready`}
          />

          <CheckboxList
            label="11-digit Farmer ID & Digital Registry Checklist (Saved Offline)"
            description="Complete these steps so KCC 4% loans, MSP procurement, and PM-KISAN DBT settle without manual desk visits."
            value={checkedValues}
            onChange={handleChecklistChange}
            hasDividers
          >
            {AGRISTACK_CHECKLIST_ITEMS.map((item) => (
              <CheckboxListItem
                key={item.id}
                value={item.id}
                label={item.title}
                description={
                  <Text type="supporting" color="secondary">
                    {item.description} · Doc: {item.requiredDoc}
                  </Text>
                }
              />
            ))}
          </CheckboxList>

          <SchemeListRows items={creditSchemes} />
        </VStack>
      </div>

      <div id="panel-locker" role="tabpanel" hidden={activeTab !== "locker"}>
        <VStack gap={5}>
          {saveBanner && (
            <Banner
              status="success"
              title="PMFBY loss evidence saved locally"
              description={saveBanner}
              isDismissable
              onDismiss={() => setSaveBanner(null)}
            />
          )}

          <Card padding={5}>
            <VStack gap={4}>
              <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
                <HStack gap={2} vAlign="center">
                  <ShieldCheck className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
                  <Heading level={2} className="type-section-title">
                    72-Hr PMFBY Localized Loss Evidence Locker
                  </Heading>
                </HStack>

                <HStack gap={2} vAlign="center">
                  <StatusDot
                    variant={
                      deadline.isExpired ? "error" : deadline.isUrgent ? "warning" : "success"
                    }
                    label={
                      deadline.isExpired
                        ? "72-hour window expired"
                        : deadline.isUrgent
                          ? "Urgent under 24 hours"
                          : "Within 72-hour reporting window"
                    }
                    icon={
                      deadline.isExpired ? (
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      ) : deadline.isUrgent ? (
                        <Clock className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      )
                    }
                    isPulsing={deadline.isUrgent}
                  />
                  <Text type="label" weight="semibold" hasTabularNumbers>
                    {formatRemainingCountdown(deadline.remainingMs, deadline.isExpired)}
                  </Text>
                </HStack>
              </HStack>

              <HStack gap={3} vAlign="center" wrap="wrap">
                <Text type="supporting" color="secondary">
                  Elapsed since incident:{" "}
                  <Timer startTime={incidentStartMs} format="clock" type="inherit" color="primary" weight="semibold" />
                </Text>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  · Deadline: {new Date(deadline.deadlineIso).toLocaleString("en-IN")}
                </Text>
              </HStack>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Selector
                  label="Affected Crop"
                  options={CROP_OPTIONS}
                  value={lossCrop}
                  onChange={setLossCrop}
                  width="100%"
                  presentation="adaptive"
                />
                <Selector
                  label="Loss Cause"
                  options={LOSS_CAUSE_OPTIONS}
                  value={lossCause}
                  onChange={setLossCause}
                  width="100%"
                  presentation="adaptive"
                />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="pmfby-incident-time"
                    className="text-sm font-medium text-[var(--text-primary)]"
                  >
                    Incident Date &amp; Time
                  </label>
                  <input
                    id="pmfby-incident-time"
                    type="datetime-local"
                    value={toLocalDateTimeInput(incidentIso)}
                    onChange={(e) => {
                      const parsed = new Date(e.target.value);
                      if (!Number.isNaN(parsed.getTime())) {
                        setIncidentIso(parsed.toISOString());
                      }
                    }}
                    className="min-h-[44px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <NumberInput
                  label="Parcel Latitude"
                  value={lat}
                  onChange={(v) => setLat(Number.isFinite(v) ? v : 0)}
                  step={0.0001}
                  isWheelEnabled={false}
                  width="100%"
                />
                <NumberInput
                  label="Parcel Longitude"
                  value={lon}
                  onChange={(v) => setLon(Number.isFinite(v) ? v : 0)}
                  step={0.0001}
                  isWheelEnabled={false}
                  width="100%"
                />
                <div className="flex flex-col justify-end gap-1">
                  <Button
                    label="Capture Device GPS"
                    variant="outline"
                    size="md"
                    icon={<MapPin className="h-4 w-4" />}
                    onClick={handleCaptureGps}
                    fullWidth
                  />
                  {gpsStatus && (
                    <Text type="supporting" color="secondary">
                      {gpsStatus}
                    </Text>
                  )}
                </div>
              </div>

              <VStack gap={1.5}>
                <Text type="label" weight="semibold">
                  Field Damage Photo (Stored in IndexedDB, never localStorage)
                </Text>
                <CropImagePicker
                  value={preparedPhoto}
                  onImageReady={setPreparedPhoto}
                  onClear={() => setPreparedPhoto(null)}
                />
              </VStack>

              <TextArea
                label="Damage Notes (Plot / Water Depth / Stage)"
                value={notes}
                onChange={(val) => setNotes(val)}
                placeholder="e.g. 25 cm standing rainwater in east paddy bund after overnight squall"
              />

              <HStack gap={3} wrap="wrap">
                <Button
                  label={savingPack ? "Locking Evidence..." : "Lock 72-Hr PMFBY Evidence Pack"}
                  variant="primary"
                  size="lg"
                  onClick={() => void handleSaveEvidencePack()}
                  loading={savingPack}
                  disabled={savingPack}
                />
              </HStack>
            </VStack>
          </Card>

          <List header={`Locked PMFBY Evidence Packs (${savedPacks.length})`} hasDividers edge="flush">
            {savedPacks.length === 0 ? (
              <ListItem
                itemKey="empty-pmfby"
                label="No loss evidence packs locked yet"
                description="Capture photo + GPS above within 72 hours of localized hail, flood, or cyclone damage."
              />
            ) : (
              savedPacks.map((pack) => {
                const packDeadline = computePmfbyDeadline(pack.incidentIso, nowMs);
                return (
                  <ListItem
                    key={pack.id}
                    itemKey={pack.id}
                    align="start"
                    startContent={
                      <StatusDot
                        variant={
                          packDeadline.isExpired
                            ? "error"
                            : packDeadline.isUrgent
                              ? "warning"
                              : "success"
                        }
                        label={packDeadline.isExpired ? "Expired" : "Locked"}
                      />
                    }
                    label={`${pack.id} · ${pack.cropName} — ${pack.lossCause}`}
                    description={
                      <VStack gap={0.5}>
                        <Text type="supporting" color="secondary" hasTabularNumbers>
                          GPS {pack.lat.toFixed(4)}, {pack.lon.toFixed(4)} · {pack.mediaIds.length} photo(s) in IndexedDB · {formatRemainingCountdown(packDeadline.remainingMs, packDeadline.isExpired)}
                        </Text>
                        {pack.notes && (
                          <Text type="supporting" color="primary">
                            {pack.notes}
                          </Text>
                        )}
                      </VStack>
                    }
                  />
                );
              })
            )}
          </List>
        </VStack>
      </div>
    </div>
  );
}
