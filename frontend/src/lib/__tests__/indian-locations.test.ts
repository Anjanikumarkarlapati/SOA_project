import { describe, expect, it } from "vitest";
import {
  DEFAULT_FARM_LOCATION,
  INDIAN_STATES,
  getDistrictsForState,
  getMandalsForDistrict,
} from "@/lib/indian-locations";

describe("indian-locations", () => {
  it("includes OD, AP, and all major Indian agricultural states", () => {
    const codes = INDIAN_STATES.map((s) => s.code);
    for (const required of [
      "OD",
      "AP",
      "PB",
      "MH",
      "UP",
      "MP",
      "TN",
      "KA",
      "GJ",
      "WB",
      "KL",
      "RJ",
      "HR",
      "BR",
      "TS",
    ]) {
      expect(codes).toContain(required);
    }
  });

  it("provides Cuttack for OD and Guntur for AP with valid mandals", () => {
    const odDistricts = getDistrictsForState("OD").map((d) => d.name);
    expect(odDistricts).toContain("Cuttack");
    const cuttackMandals = getMandalsForDistrict("OD", "Cuttack");
    expect(cuttackMandals.length).toBeGreaterThan(0);

    const apDistricts = getDistrictsForState("AP").map((d) => d.name);
    expect(apDistricts).toContain("Guntur");
    const gunturMandals = getMandalsForDistrict("AP", "Guntur");
    expect(gunturMandals.length).toBeGreaterThan(0);
  });

  it("provides non-empty districts and mandals for every configured state and handles unknown inputs safely", () => {
    for (const state of INDIAN_STATES) {
      const districts = getDistrictsForState(state.code);
      expect(districts.length).toBeGreaterThan(0);
      for (const district of districts) {
        const mandals = getMandalsForDistrict(state.code, district.name);
        expect(mandals.length).toBeGreaterThan(0);
      }
    }
    expect(getDistrictsForState("XX")).toEqual([]);
    expect(getMandalsForDistrict("OD", "UnknownDistrict")).toEqual([]);
  });

  it("exports a valid DEFAULT_FARM_LOCATION", () => {
    expect(DEFAULT_FARM_LOCATION.stateCode).toBeTruthy();
    expect(DEFAULT_FARM_LOCATION.stateName).toBeTruthy();
    expect(DEFAULT_FARM_LOCATION.districtName).toBeTruthy();
    expect(DEFAULT_FARM_LOCATION.mandalOrBlock).toBeTruthy();
    expect(getDistrictsForState(DEFAULT_FARM_LOCATION.stateCode).map((d) => d.name)).toContain(
      DEFAULT_FARM_LOCATION.districtName
    );
  });
});
