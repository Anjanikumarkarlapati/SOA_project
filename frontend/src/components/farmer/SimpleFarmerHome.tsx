"use client";

import React, { useRef, useState } from "react";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import {
  BookOpen,
  Camera,
  Droplets,
  Landmark,
  Mic,
  Newspaper,
  Store,
} from "lucide-react";
import { DailyActionCard } from "@/components/farmer/DailyActionCard";
import { LocationCascadeSelect } from "@/components/ui/LocationCascadeSelect";
import type {
  DailyActionBriefing,
  DailyBriefingMandiInput,
  DailyBriefingWeatherInput,
} from "@/lib/daily-briefing";
import type { FarmProperty } from "@/lib/property-store";

export interface SimpleFarmerHomeProps {
  property: FarmProperty | null;
  weather: DailyBriefingWeatherInput | null;
  topMandi?: DailyBriefingMandiInput | null;
  onOpenRoznamcha: () => void;
  onLogBriefing?: (briefing: DailyActionBriefing) => void;
}

export function SimpleFarmerHome({
  property,
  weather,
  topMandi,
  onOpenRoznamcha,
  onLogBriefing,
}: SimpleFarmerHomeProps) {
  const [waterHighlighted, setWaterHighlighted] = useState(false);
  const actionCardContainerRef = useRef<HTMLDivElement | null>(null);

  const focusTodayWater = () => {
    setWaterHighlighted(true);
    actionCardContainerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setTimeout(() => setWaterHighlighted(false), 1800);
  };

  const openCropDoctor = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("agritech:open-crop-doctor"));
    }
  };

  const openVoiceCompanion = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("agritech:open-voice-companion"));
    }
  };

  return (
    <VStack gap={5} data-testid="simple-farmer-home">
      <Section variant="transparent" padding={0}>
        <VStack gap={3}>
          <Heading level={2} weight="semibold" className="type-section-title">
            Your Field Location
          </Heading>
          <LocationCascadeSelect size="md" />
        </VStack>
      </Section>

      <div ref={actionCardContainerRef}>
        <DailyActionCard
          property={property}
          weather={weather}
          topMandi={topMandi}
          highlighted={waterHighlighted}
          onLogToRoznamcha={onLogBriefing}
        />
      </div>

      <VStack gap={3}>
        <Heading level={2} weight="semibold" className="type-section-title">
          Daily Kisan Actions
        </Heading>

        <Grid columns={{ minWidth: 165, max: 3 }} gap={3}>
          <ClickableCard
            label="Today's Water"
            onClick={focusTodayWater}
            padding={4}
            elevation="low"
          >
            <HStack gap={3} vAlign="center" className="min-h-[52px]">
              <Droplets className="w-6 h-6 shrink-0 text-[var(--status-info)]" />
              <VStack gap={0.5}>
                <Text type="body" weight="semibold">
                  Today&apos;s Water
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  6 AM irrigation &amp; spray verdict
                </Text>
              </VStack>
            </HStack>
          </ClickableCard>

          <ClickableCard
            label="Crop Photo Doctor"
            onClick={openCropDoctor}
            padding={4}
            elevation="low"
          >
            <HStack gap={3} vAlign="center" className="min-h-[52px]">
              <Camera className="w-6 h-6 shrink-0 text-[var(--accent)]" />
              <VStack gap={0.5}>
                <Text type="body" weight="semibold">
                  Crop Photo Doctor
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  Snap leaf for pest &amp; disease check
                </Text>
              </VStack>
            </HStack>
          </ClickableCard>

          <ClickableCard
            label="Ask by Voice"
            onClick={openVoiceCompanion}
            padding={4}
            elevation="low"
          >
            <HStack gap={3} vAlign="center" className="min-h-[52px]">
              <Mic className="w-6 h-6 shrink-0 text-[var(--accent)]" />
              <VStack gap={0.5}>
                <Text type="body" weight="semibold">
                  Ask by Voice
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  Speak in your local language
                </Text>
              </VStack>
            </HStack>
          </ClickableCard>

          <ClickableCard
            label="Mandi Rates"
            href="/mandi"
            padding={4}
            elevation="low"
          >
            <HStack gap={3} vAlign="center" className="min-h-[52px]">
              <Store className="w-6 h-6 shrink-0 text-[var(--status-good)]" />
              <VStack gap={0.5}>
                <Text type="body" weight="semibold">
                  Mandi Rates
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  APMC ₹/q &amp; break-even margin
                </Text>
              </VStack>
            </HStack>
          </ClickableCard>

          <ClickableCard
            label="State Updates"
            href="/updates"
            padding={4}
            elevation="low"
          >
            <HStack gap={3} vAlign="center" className="min-h-[52px]">
              <Newspaper className="w-6 h-6 shrink-0 text-[var(--status-warning)]" />
              <VStack gap={0.5}>
                <Text type="body" weight="semibold">
                  State Updates
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  Agri-Pulse &amp; link Truth Shield
                </Text>
              </VStack>
            </HStack>
          </ClickableCard>

          <ClickableCard
            label="Govt Schemes"
            href="/schemes"
            padding={4}
            elevation="low"
          >
            <HStack gap={3} vAlign="center" className="min-h-[52px]">
              <Landmark className="w-6 h-6 shrink-0 text-[var(--status-info)]" />
              <VStack gap={0.5}>
                <Text type="body" weight="semibold">
                  Govt Schemes
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  PMKSY drip &amp; 72-hr PMFBY locker
                </Text>
              </VStack>
            </HStack>
          </ClickableCard>

          <ClickableCard
            label="Kisan Roznamcha"
            onClick={onOpenRoznamcha}
            padding={4}
            elevation="low"
          >
            <HStack gap={3} vAlign="center" className="min-h-[52px]">
              <BookOpen className="w-6 h-6 shrink-0 text-[var(--accent)]" />
              <VStack gap={0.5}>
                <Text type="body" weight="semibold">
                  Kisan Roznamcha
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  Signed diary, PDF &amp; WhatsApp digest
                </Text>
              </VStack>
            </HStack>
          </ClickableCard>
        </Grid>
      </VStack>
    </VStack>
  );
}
