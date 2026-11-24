import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LanguageProvider,
  SUPPORTED_LANGUAGES,
  translate,
  useLanguage,
  type LanguageCode,
} from "@/lib/i18n";

const NEW_M2_KEYS = [
  // Nav & Field Hub
  "nav.fieldHub",
  "nav.myFarms",
  "nav.climateAdvisory",
  "nav.sensorsSoil",
  "nav.irrigationValves",
  "nav.profileSettings",
  "nav.signOut",
  "fieldHub.title",
  "fieldHub.subtitle",
  "fieldHub.activeFarm",
  "fieldHub.switchFarm",
  "fieldHub.registerFarm",
  "fieldHub.noFarmTitle",
  "fieldHub.noFarmDesc",
  "fieldHub.kpiSensors",
  "fieldHub.kpiCropHealth",
  "fieldHub.kpiTemp",
  "fieldHub.kpiRainfall",
  "fieldHub.avg14Day",
  "fieldHub.total14Day",
  "fieldHub.aerialTitle",
  "fieldHub.mapTitle",
  // Sensors
  "sensors.title",
  "sensors.subtitle",
  "sensors.addSensor",
  "sensors.refresh",
  "sensors.total",
  "sensors.online",
  "sensors.offline",
  "sensors.lowBattery",
  "sensors.emptyTitle",
  "sensors.emptyDesc",
  "sensors.recommendedTitle",
  "sensors.deployOneClick",
  "sensors.deviceId",
  "sensors.sensorType",
  "sensors.fieldZone",
  "sensors.battery",
  "sensors.status",
  "sensors.remove",
  // Irrigation & ET0
  "irrigationMgmt.title",
  "irrigationMgmt.subtitle",
  "irrigationMgmt.valvesTitle",
  "irrigationMgmt.openValve",
  "irrigationMgmt.closeValve",
  "irrigationMgmt.emergencyStop",
  "irrigationMgmt.valveOpen",
  "irrigationMgmt.valveClosed",
  "irrigationMgmt.valveDeferred",
  "irrigationMgmt.budgetTitle",
  "irrigationMgmt.grossDemand",
  "irrigationMgmt.rainOffset",
  "irrigationMgmt.netDelivery",
  "irrigationMgmt.systemEfficiency",
  "irrigationMgmt.pumpRuntime",
  "irrigationMgmt.schedulesTitle",
  "irrigationMgmt.addSchedule",
  "irrigationMgmt.eventsTitle",
  "irrigationMgmt.waterSavedTotal",
  "irrigationMgmt.noSchedules",
  "irrigationMgmt.noEvents",
  "irrigationMgmt.hardwareBadgeLocal",
  "irrigationMgmt.hardwareBadgeLive",
  // Interlock
  "interlock.title",
  "interlock.subtitle",
  "interlock.safeBadge",
  "interlock.cautionBadge",
  "interlock.holdBadge",
  "interlock.estimatedWaste",
  "interlock.deferAction",
  "interlock.overrideAction",
  "interlock.overrideReasonLabel",
  "interlock.reasonSeedling",
  "interlock.reasonFertigation",
  "interlock.reasonSensorDrift",
  "interlock.reasonDryPatch",
  // Sync Outbox
  "sync.onlineSynced",
  "sync.offlineQueued",
  "sync.queuedCount",
  "sync.syncNow",
  "sync.syncing",
  "sync.outboxTitle",
  "sync.outboxEmpty",
  "sync.pendingLabel",
  "sync.failedLabel",
  "sync.clearSynced",
  // Shift Briefing
  "briefing.title",
  "briefing.subtitle",
  "briefing.farmLabel",
  "briefing.cropLabel",
  "briefing.priorityZone",
  "briefing.irrigationTarget",
  "briefing.irrigationHold",
  "briefing.runtimeLabel",
  "briefing.sprayStatus",
  "briefing.spraySafe",
  "briefing.sprayHold",
  "briefing.tasksHeading",
  "briefing.noTasks",
  "briefing.copyAction",
  "briefing.copied",
  "briefing.printAction",
  "briefing.dispatchAction",
  "briefing.dispatched",
];

function LanguageProbe() {
  const { language, setLanguage, isIndic, t } = useLanguage();
  return React.createElement(
    "div",
    null,
    React.createElement("span", { "data-testid": "lang" }, language),
    React.createElement("span", { "data-testid": "indic" }, String(isIndic)),
    React.createElement("span", { "data-testid": "label" }, t("nav.fieldHub")),
    React.createElement(
      "button",
      { type: "button", onClick: () => setLanguage("ta") },
      "Switch Tamil"
    )
  );
}

describe("i18n 11-language registry, translate() safety & SSR hydration", () => {
  const originalLocalStorageDesc = Object.getOwnPropertyDescriptor(window, "localStorage");

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
    delete document.documentElement.dataset.langScript;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (originalLocalStorageDesc) {
      Object.defineProperty(window, "localStorage", originalLocalStorageDesc);
    }
    localStorage.clear();
  });

  it("supports all 11 languages with symmetric translations for all new M2/M3 keys", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(["en", "hi", "pa", "mr", "te", "ta", "kn", "bn", "gu", "or", "ml"]);

    for (const key of NEW_M2_KEYS) {
      const enVal = translate("en", key);
      expect(enVal.length).toBeGreaterThan(0);
      expect(enVal).not.toBe(key);

      for (const code of codes) {
        const val = translate(code as LanguageCode, key);
        expect(val.length).toBeGreaterThan(0);
        expect(val).not.toBe(key);
        if (code !== "en") {
          expect(val).not.toBe(enVal);
        }
      }
    }
  });

  it("resolves fallback cleanly and ignores Object.prototype keys", () => {
    expect(translate("hi", "nonexistent.key", "Custom Fallback")).toBe("Custom Fallback");
    expect(translate("hi", "nonexistent.key", "")).toBe("");
    expect(translate("hi", "nonexistent.key")).toBe("nonexistent.key");
    expect(translate("en", "toString", "Safe Fallback")).toBe("Safe Fallback");
    expect(translate("en", "constructor")).toBe("constructor");
  });

  it("hydrates SSR 'en' markup to persisted 'hi' without React 19 hydration warnings", async () => {
    localStorage.setItem("agritech_lang", "hi");

    const ssrHtml = renderToString(
      React.createElement(LanguageProvider, null, React.createElement(LanguageProbe))
    );
    expect(ssrHtml).toContain("Field Hub");

    const container = document.createElement("div");
    container.innerHTML = ssrHtml;
    document.body.appendChild(container);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onRecoverableError = vi.fn();

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(
          container,
          React.createElement(LanguageProvider, null, React.createElement(LanguageProbe)),
          { onRecoverableError }
        );
      });

      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="lang"]')?.textContent).toBe("hi");
      expect(container.querySelector('[data-testid="label"]')?.textContent).toBe(
        translate("hi", "nav.fieldHub")
      );
      expect(document.documentElement.lang).toBe("hi");
      expect(document.documentElement.dataset.langScript).toBe("devanagari");
    } finally {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
  });

  it("persists language changes, falls back on invalid storage values, and handles SecurityError", () => {
    localStorage.setItem("agritech_lang", "xx-invalid");
    render(React.createElement(LanguageProvider, null, React.createElement(LanguageProbe)));
    expect(screen.getByTestId("lang").textContent).toBe("en");

    fireEvent.click(screen.getByText("Switch Tamil"));
    expect(screen.getByTestId("lang").textContent).toBe("ta");
    expect(screen.getByTestId("indic").textContent).toBe("true");
    expect(localStorage.getItem("agritech_lang")).toBe("ta");
    expect(document.documentElement.lang).toBe("ta");
    expect(document.documentElement.dataset.langScript).toBe("tamil");
    cleanup();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(() =>
      render(React.createElement(LanguageProvider, null, React.createElement(LanguageProbe)))
    ).not.toThrow();
    expect(() => fireEvent.click(screen.getByText("Switch Tamil"))).not.toThrow();
    expect(screen.getByTestId("lang").textContent).toBe("ta");
  });

  it("throws when useLanguage is called outside LanguageProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(React.createElement(LanguageProbe))).toThrow(
      "useLanguage must be used within a LanguageProvider"
    );
    spy.mockRestore();
  });
});
