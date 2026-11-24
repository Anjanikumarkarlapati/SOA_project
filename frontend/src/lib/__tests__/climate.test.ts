import { describe, expect, it } from "vitest";
import { computeClimateStats, type ClimateData } from "@/lib/climate";

function makeClimateData(
  overrides: {
    tmax?: number[];
    tmin?: number[];
    precip?: number[] | null;
    windMax?: number[];
    et0?: number[];
    probMax?: number[];
  } = {}
): ClimateData {
  const days = overrides.tmax?.length ?? 3;
  const times = Array.from(
    { length: days },
    (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`
  );

  return {
    lat: 30.901,
    lon: 75.857,
    timezone: "Asia/Kolkata",
    provider: "Open-Meteo",
    sourceNote: "Test fixture",
    retrievedAt: "2026-11-23T00:00:00.000Z",
    current: {
      time: "2026-11-01T06:00",
      temperature_2m: 26,
      relative_humidity_2m: 60,
      apparent_temperature: 26,
      precipitation: 0,
      rain: 0,
      weather_code: 0,
      surface_pressure: 1013,
      wind_speed_10m: 8,
      wind_direction_10m: 180,
      uv_index: 5,
    },
    daily: {
      time: times,
      weather_code: Array(days).fill(0),
      temperature_2m_max: overrides.tmax ?? [30, 32, 28],
      temperature_2m_min: overrides.tmin ?? [18, 20, 16],
      apparent_temperature_max: Array(days).fill(30),
      apparent_temperature_min: Array(days).fill(18),
      precipitation_sum:
        overrides.precip === undefined
          ? Array(days).fill(0)
          : (overrides.precip as number[]),
      rain_sum: Array(days).fill(0),
      precipitation_hours: Array(days).fill(0),
      precipitation_probability_max: overrides.probMax ?? Array(days).fill(10),
      wind_speed_10m_max: overrides.windMax ?? Array(days).fill(12),
      wind_gusts_10m_max: Array(days).fill(18),
      wind_direction_10m_dominant: Array(days).fill(180),
      shortwave_radiation_sum: Array(days).fill(18),
      et0_fao_evapotranspiration: overrides.et0 ?? Array(days).fill(4),
      uv_index_max: Array(days).fill(6),
    },
    hourly: {
      time: ["2026-11-01T06:00"],
      temperature_2m: [26],
      relative_humidity_2m: [60],
      dew_point_2m: [15],
      precipitation_probability: [10],
      precipitation: [0],
      weather_code: [0],
      surface_pressure: [1013],
      soil_temperature_0cm: [24],
      soil_moisture_0_to_1cm: [0.3],
    },
  };
}

describe("computeClimateStats", () => {
  it("computes avgTempC and totalPrecipMm across multi-day arrays", () => {
    const data = makeClimateData({
      tmax: [30, 32, 28],
      tmin: [18, 20, 16],
      precip: [0, 12.5, 2.5],
    });

    const stats = computeClimateStats(data);

    expect(stats.avgTempC).toBeCloseTo(24, 5);
    expect(stats.totalPrecipMm).toBeCloseTo(15, 5);
    expect(stats.avgPrecipMm).toBeCloseTo(5, 5);
    expect(stats.dryDays).toBe(1);
    expect(stats.rainDays).toBe(2);
    expect(stats.todayRainMm).toBe(0);
  });

  it("handles an empty precipitation_sum array without NaN or false rain days", () => {
    const data = makeClimateData({
      tmax: [28, 30],
      tmin: [16, 18],
      precip: [],
    });

    const stats = computeClimateStats(data);

    expect(stats.avgTempC).toBeCloseTo(23, 5);
    expect(stats.totalPrecipMm).toBe(0);
    expect(stats.avgPrecipMm).toBe(0);
    expect(stats.dryDays).toBe(0);
    expect(stats.rainDays).toBe(0);
    expect(stats.todayRainMm).toBe(0);
  });

  it("handles a null precipitation_sum array without throwing", () => {
    const data = makeClimateData({
      tmax: [26, 28],
      tmin: [14, 16],
      precip: null,
    });

    const stats = computeClimateStats(data);

    expect(stats.avgTempC).toBeCloseTo(21, 5);
    expect(stats.totalPrecipMm).toBe(0);
    expect(stats.avgPrecipMm).toBe(0);
    expect(stats.dryDays).toBe(0);
    expect(stats.rainDays).toBe(0);
    expect(stats.todayRainMm).toBe(0);
  });

  it("handles null entries inside precipitation_sum and empty temperature arrays", () => {
    const data = makeClimateData({
      tmax: [],
      tmin: [],
      windMax: [],
      precip: [4, null as unknown as number, 6],
    });

    const stats = computeClimateStats(data);

    expect(stats.avgTempC).toBe(0);
    expect(stats.totalPrecipMm).toBeCloseTo(10, 5);
    expect(stats.avgPrecipMm).toBeCloseTo(10 / 3, 5);
  });

  it("computes per-series averages when daily arrays have mismatched lengths", () => {
    const data = makeClimateData({
      tmax: [],
      tmin: [10, 12, 14],
      precip: [2, 4, 6],
      windMax: [8, 12],
    });

    const stats = computeClimateStats(data);

    // avgMax = 0, avgMin = (10+12+14)/3 = 12 -> avgTempC = 6
    expect(stats.avgTempC).toBeCloseTo(6, 5);
    expect(stats.totalPrecipMm).toBeCloseTo(12, 5);
    expect(stats.avgPrecipMm).toBeCloseTo(4, 5);
    expect(stats.avgWindKmh).toBeCloseTo(10, 5);
  });
});
