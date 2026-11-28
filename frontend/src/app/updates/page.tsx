"use client";

import React, { useState } from "react";
import { Heading } from "@astryxdesign/core/Heading";
import { Section } from "@astryxdesign/core/Section";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { LocationCascadeSelect } from "@/components/ui/LocationCascadeSelect";
import { CustomLinkVerifier } from "@/components/pulse/CustomLinkVerifier";
import { StateAgriPulse } from "@/components/pulse/StateAgriPulse";
import { useFarmStore } from "@/lib/property-store";
import { useI18n } from "@/lib/i18n";
import type { PulseFilter } from "@/app/api/state-pulse/feed/route";

type UpdatesViewTab = "all" | "official" | "social" | "verify";

export default function UpdatesPage() {
  const { t } = useI18n();
  const farmLocation = useFarmStore((s) => s.farmLocation);
  const [activeTab, setActiveTab] = useState<UpdatesViewTab>("all");

  const feedFilter: PulseFilter =
    activeTab === "official" || activeTab === "social" ? activeTab : "all";

  return (
    <ProtectedRoute>
      <AppLayout>
        <Section className="p-4 sm:p-6 max-w-5xl mx-auto">
          <Stack direction="vertical" gap={6}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="type-eyebrow" style={{ color: "var(--text-muted)" }}>
                  {t("updates.eyebrow", "State Agri-Pulse & Rumour Truth Shield")}
                </span>
                <Heading level={1} weight="normal" textWrap="balance" className="type-page-title mt-1">
                  {t("updates.title", "Regional Updates & Fact-Check")}
                </Heading>
                <Text type="supporting" className="type-lead mt-1 block">
                  Verified state agriculture bulletins, IMD spray alerts, and instant WhatsApp/social
                  link truth scoring for{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    {farmLocation.districtName}, {farmLocation.stateName}
                  </strong>
                  .
                </Text>
              </div>
            </div>

            <LocationCascadeSelect size="md" />

            <SegmentedControl
              value={activeTab}
              onChange={(val) => setActiveTab(val as UpdatesViewTab)}
              label="Agri-Pulse view filter"
              size="md"
              layout="hug"
            >
              <SegmentedControlItem value="all" label="All" />
              <SegmentedControlItem value="official" label="Official 85%+" />
              <SegmentedControlItem value="social" label="Social Pulse" />
              <SegmentedControlItem value="verify" label="Verify Link" />
            </SegmentedControl>

            {activeTab === "verify" ? (
              <CustomLinkVerifier
                stateCode={farmLocation.stateCode}
                stateName={farmLocation.stateName}
                districtName={farmLocation.districtName}
              />
            ) : (
              <Stack direction="vertical" gap={6}>
                <StateAgriPulse
                  stateCode={farmLocation.stateCode}
                  stateName={farmLocation.stateName}
                  districtName={farmLocation.districtName}
                  filter={feedFilter}
                />
                <CustomLinkVerifier
                  stateCode={farmLocation.stateCode}
                  stateName={farmLocation.stateName}
                  districtName={farmLocation.districtName}
                />
              </Stack>
            )}
          </Stack>
        </Section>
      </AppLayout>
    </ProtectedRoute>
  );
}
