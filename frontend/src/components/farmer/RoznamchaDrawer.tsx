"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { ButtonGroup } from "@astryxdesign/core/ButtonGroup";
import { Divider } from "@astryxdesign/core/Divider";
import { Drawer, DrawerHeader } from "@astryxdesign/core/Drawer";
import { Heading } from "@astryxdesign/core/Heading";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector, type SelectorOptionData } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import {
  Check,
  CloudRain,
  Droplets,
  FileText,
  Plus,
  Printer,
  Share2,
  Sprout,
  Store,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { FarmProperty } from "@/lib/property-store";
import {
  appendRoznamchaEntry,
  buildRoznamchaWhatsAppDigest,
  exportRoznamchaPrintHtml,
  loadRoznamchaEntries,
  type RoznamchaCategory,
  type RoznamchaEntry,
} from "@/lib/roznamcha";

const CATEGORY_OPTIONS: SelectorOptionData[] = [
  { value: "irrigation", label: "Irrigation / Valve" },
  { value: "spray", label: "Crop Spray" },
  { value: "soil", label: "Soil Moisture" },
  { value: "weather", label: "Weather / Rain Hold" },
  { value: "market", label: "Mandi Sale" },
  { value: "note", label: "Field Note" },
];

function categoryIcon(category: RoznamchaCategory) {
  switch (category) {
    case "irrigation":
      return <Droplets className="w-4 h-4 text-[var(--status-info)]" />;
    case "spray":
      return <Wind className="w-4 h-4 text-[var(--accent)]" />;
    case "weather":
      return <CloudRain className="w-4 h-4 text-[var(--status-warning)]" />;
    case "market":
      return <Store className="w-4 h-4 text-[var(--status-good)]" />;
    case "soil":
      return <Sprout className="w-4 h-4 text-[var(--status-good)]" />;
    default:
      return <FileText className="w-4 h-4 text-[var(--text-secondary)]" />;
  }
}

export interface RoznamchaDrawerProps {
  open: boolean;
  onClose: () => void;
  property?: Pick<
    FarmProperty,
    "id" | "name" | "address" | "selectedCropId" | "areaHa"
  > | null;
}

const emptySubscribe = () => () => {};

export function RoznamchaDrawer({
  open,
  onClose,
  property,
}: RoznamchaDrawerProps) {
  const farmId = property?.id || "farm-default";
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [version, setVersion] = useState(0);
  const [category, setCategory] = useState<RoznamchaCategory>("irrigation");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [copied, setCopied] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsNarrowScreen(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUpdated = () => setVersion((v) => v + 1);
    window.addEventListener("storage", onUpdated);
    window.addEventListener("agritech:roznamcha-updated", onUpdated);
    return () => {
      window.removeEventListener("storage", onUpdated);
      window.removeEventListener("agritech:roznamcha-updated", onUpdated);
    };
  }, []);

  const entries: RoznamchaEntry[] = useMemo(() => {
    void version;
    if (!isClient || !open) return [];
    return loadRoznamchaEntries(farmId);
  }, [isClient, open, farmId, version]);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanDetails = details.trim();
    if (!cleanTitle) return;

    appendRoznamchaEntry({
      farmId,
      category,
      title: cleanTitle,
      details: cleanDetails || "Logged offline in Kisan Roznamcha",
    });
    setVersion((v) => v + 1);
    setTitle("");
    setDetails("");
  };

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    const html = exportRoznamchaPrintHtml(entries, property);
    const popup = typeof window.open === "function" ? window.open("", "_blank") : null;
    if (popup && popup.document) {
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus?.();
      popup.print?.();
      return;
    }
    window.print?.();
  };

  const handleWhatsAppDigest = async () => {
    const digest = buildRoznamchaWhatsAppDigest(entries, property);
    try {
      await navigator.clipboard?.writeText(digest);
    } catch {
      // Ignore clipboard failures
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (typeof window !== "undefined") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(digest)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) onClose();
  };

  const body = (
    <Layout
      height="fill"
      header={
        <DrawerHeader
          title="Kisan Roznamcha"
          subtitle={property?.name || "Offline-signed field ledger"}
          onOpenChange={handleOpenChange}
          hasDivider
        />
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            <form onSubmit={handleAddEntry} className="space-y-3">
              <Selector
                label="Entry Category"
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={(val) => setCategory(val as RoznamchaCategory)}
                width="100%"
                presentation="adaptive"
              />
              <TextInput
                label="Entry Title"
                value={title}
                onChange={(val) => setTitle(val)}
                placeholder="e.g. Morning drip run or spray check"
                width="100%"
                isRequired
                hasAutoFocus
              />
              <TextArea
                label="Field Details & Readings"
                value={details}
                onChange={(val) => setDetails(val)}
                placeholder="Water litres, soil moisture %, or crop observation"
                rows={2}
                width="100%"
              />
              <Button
                type="submit"
                label="Add Signed Entry"
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                disabled={!title.trim()}
              />
            </form>

            <Divider variant="subtle" />

            <List
              density="balanced"
              hasDividers
              header={
                <Heading level={3} weight="semibold" className="type-card-title">
                  Signed Ledger ({entries.length})
                </Heading>
              }
            >
              {entries.length === 0 ? (
                <ListItem
                  itemKey="empty-roznamcha"
                  label="No entries logged yet"
                  description="Add an irrigation, spray, or moisture entry above to generate tamper-evident proof."
                  startContent={<FileText className="w-4 h-4 text-[var(--text-muted)]" />}
                />
              ) : (
                entries.map((entry) => (
                  <ListItem
                    key={entry.id}
                    itemKey={entry.id}
                    align="start"
                    label={entry.title}
                    description={entry.details}
                    startContent={categoryIcon(entry.category)}
                    endContent={
                      <VStack gap={0.5} hAlign="end">
                        <Timestamp value={entry.timestamp} format="relative_short" />
                        <Text type="code" size="2xs" color="secondary">
                          {entry.sig}
                        </Text>
                      </VStack>
                    }
                  />
                ))
              )}
            </List>
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter hasDivider>
          <HStack hAlign="end" wrap="wrap">
            <ButtonGroup label="Roznamcha export actions" size="sm">
              <Button
                label="Print PDF"
                variant="secondary"
                size="sm"
                tooltip="Print or save PDF copy of Kisan Roznamcha"
                icon={<Printer className="w-4 h-4" />}
                onClick={handlePrint}
              />
              <Button
                label={copied ? "Copied Digest" : "WhatsApp Digest"}
                variant="secondary"
                size="sm"
                tooltip={
                  copied
                    ? "Roznamcha digest copied to clipboard"
                    : "Copy and share Roznamcha digest on WhatsApp"
                }
                icon={
                  copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />
                }
                onClick={() => void handleWhatsAppDigest()}
              />
            </ButtonGroup>
          </HStack>
        </LayoutFooter>
      }
    />
  );

  if (isNarrowScreen) {
    return (
      <BottomSheet
        isOpen={open}
        onOpenChange={handleOpenChange}
        label="Kisan Roznamcha"
        height="tall"
        purpose="form"
      >
        {body}
      </BottomSheet>
    );
  }

  return (
    <Drawer
      isOpen={open}
      onOpenChange={handleOpenChange}
      label="Kisan Roznamcha"
      side="end"
      width={460}
      purpose="form"
    >
      {body}
    </Drawer>
  );
}
