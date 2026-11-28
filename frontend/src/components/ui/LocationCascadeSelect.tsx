"use client";

import React, { useMemo } from "react";
import { Selector, type SelectorOptionData } from "@astryxdesign/core/Selector";
import { Stack } from "@astryxdesign/core/Stack";
import {
  INDIAN_STATES,
  getDistrictsForState,
  getMandalsForDistrict,
  type FarmLocationProfile,
} from "@/lib/indian-locations";
import { useFarmStore } from "@/lib/property-store";

export interface LocationCascadeSelectProps {
  value?: FarmLocationProfile;
  onChange?: (next: FarmLocationProfile) => void;
  direction?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
}

export function LocationCascadeSelect({
  value,
  onChange,
  direction = "horizontal",
  size = "md",
}: LocationCascadeSelectProps) {
  const storeLocation = useFarmStore((s) => s.farmLocation);
  const setStoreLocation = useFarmStore((s) => s.setFarmLocation);

  const current = value ?? storeLocation;
  const commit = onChange ?? setStoreLocation;

  const stateOptions: SelectorOptionData[] = useMemo(
    () => INDIAN_STATES.map((s) => ({ value: s.code, label: s.name })),
    []
  );

  const districts = useMemo(
    () => getDistrictsForState(current.stateCode),
    [current.stateCode]
  );

  const districtOptions: SelectorOptionData[] = useMemo(
    () => districts.map((d) => ({ value: d.name, label: d.name })),
    [districts]
  );

  const mandals = useMemo(
    () => getMandalsForDistrict(current.stateCode, current.districtName),
    [current.stateCode, current.districtName]
  );

  const mandalOptions: SelectorOptionData[] = useMemo(
    () => mandals.map((m) => ({ value: m, label: m })),
    [mandals]
  );

  const handleStateChange = (nextStateCode: string) => {
    const stateObj = INDIAN_STATES.find((s) => s.code === nextStateCode);
    const firstDistrict = stateObj?.districts[0];
    const firstMandal = firstDistrict?.mandals[0] ?? "";
    commit({
      stateCode: nextStateCode,
      stateName: stateObj?.name ?? nextStateCode,
      districtName: firstDistrict?.name ?? "",
      mandalOrBlock: firstMandal,
      lat: firstDistrict?.lat,
      lon: firstDistrict?.lon,
    });
  };

  const handleDistrictChange = (nextDistrictName: string) => {
    const districtObj = districts.find((d) => d.name === nextDistrictName);
    const firstMandal = districtObj?.mandals[0] ?? "";
    commit({
      ...current,
      districtName: nextDistrictName,
      mandalOrBlock: firstMandal,
      lat: districtObj?.lat ?? current.lat,
      lon: districtObj?.lon ?? current.lon,
    });
  };

  const handleMandalChange = (nextMandal: string) => {
    commit({
      ...current,
      mandalOrBlock: nextMandal,
    });
  };

  return (
    <Stack direction={direction} gap={3} wrap="wrap" width="100%">
      <div className="min-w-[160px] flex-1">
        <Selector
          label="State"
          options={stateOptions}
          value={current.stateCode}
          onChange={handleStateChange}
          size={size}
          width="100%"
          presentation="adaptive"
          placeholder="Select state..."
        />
      </div>
      <div className="min-w-[160px] flex-1">
        <Selector
          label="District"
          options={districtOptions}
          value={current.districtName}
          onChange={handleDistrictChange}
          size={size}
          width="100%"
          presentation="adaptive"
          placeholder="Select district..."
          isDisabled={districtOptions.length === 0}
        />
      </div>
      <div className="min-w-[160px] flex-1">
        <Selector
          label="Mandal / Block"
          options={mandalOptions}
          value={current.mandalOrBlock}
          onChange={handleMandalChange}
          size={size}
          width="100%"
          presentation="adaptive"
          placeholder="Select mandal..."
          isDisabled={mandalOptions.length === 0}
        />
      </div>
    </Stack>
  );
}
