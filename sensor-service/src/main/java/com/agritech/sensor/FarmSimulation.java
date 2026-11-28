package com.agritech.sensor;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Simulated environment for one farm's sensor device. There is no hardware yet, so readings are
 * generated - but from a small physical model, not dice: air temperature follows a day/night
 * curve, humidity falls as it warms and jumps when it rains, light follows the sun, soil dries
 * through the day and recovers after rain, nutrients are slowly taken up, and a paddy's standing
 * water drains and is refilled.
 *
 * Pure: the same profile, time and previous reading always give the same next reading (each
 * day's weather is drawn from a seed of farm + date), so it is testable and two farms with
 * different seeds read differently. Real devices skip this class entirely and post to
 * /api/telemetry/ingest with the same fields.
 */
final class FarmSimulation {

    /** Optional measurements a device can have, beyond the always-present soil probe. */
    static final Set<String> CAPABILITIES =
            Set.of("air-temperature", "humidity", "light", "npk", "rainfall", "water-level");

    private static final ZoneId FARM_TIME = ZoneId.of("Asia/Kolkata");

    private FarmSimulation() {}

    /**
     * Crop-tuned targets for one farm, chosen by crop-service at setup. All plain numbers so they
     * travel as a flat JSON object.
     *
     * @param moisture   soil moisture the field tends to, %
     * @param tempMin    typical daily low / high air temperature, C
     * @param humidity   mean relative humidity, %
     * @param lightPeak  clear-sky midday light, lux
     * @param rainChance probability that a given day has a shower, 0-1
     * @param ponded     true for flooded paddy (standing water simulated)
     */
    record Profile(double moisture, double tempMin, double tempMax, double humidity, double ph,
                   double lightPeak, double nitrogen, double phosphorus, double potassium,
                   double rainChance, boolean ponded, long seed) {

        static Profile of(Map<String, Double> m) {
            return new Profile(
                    get(m, "moisture", 55), get(m, "tempMin", 20), get(m, "tempMax", 32),
                    get(m, "humidity", 60), get(m, "ph", 6.5), get(m, "lightPeak", 60000),
                    get(m, "nitrogen", 250), get(m, "phosphorus", 25), get(m, "potassium", 200),
                    get(m, "rainChance", 0.2), get(m, "ponded", 0) > 0, (long) get(m, "seed", 1));
        }

        private static double get(Map<String, Double> m, String key, double fallback) {
            Double v = m.get(key);
            return v == null || v.isNaN() || v.isInfinite() ? fallback : v;
        }
    }

    /** One day's weather for a farm: fixed for the whole day so a day reads as a coherent story. */
    record DayWeather(double tempShift, boolean rainy, double rainStartHour, double rainHours,
                      double rainMmPerHour, double cloud) {

        static DayWeather of(Profile p, long epochDay) {
            Random r = new Random(p.seed() * 1_000_003L + epochDay);
            boolean rainy = r.nextDouble() < p.rainChance();
            return new DayWeather(
                    r.nextGaussian() * 1.5,                 // a warmer or cooler day than usual
                    rainy,
                    13 + r.nextInt(6),                      // afternoon/evening showers
                    1 + r.nextInt(3),
                    2 + r.nextDouble() * 8,
                    rainy ? 0.45 + r.nextDouble() * 0.25 : 0.85 + r.nextDouble() * 0.15);
        }
    }

    /**
     * The reading at {@code at}, carrying state (soil moisture, standing water) on from
     * {@code previous}. {@code stepHours} is the time since the previous reading.
     */
    static TelemetryReading next(String deviceId, Profile p, Set<String> capabilities,
                                 TelemetryReading previous, Instant at, double stepHours,
                                 Double battery, Random noise) {
        ZonedDateTime local = at.atZone(FARM_TIME);
        double hour = local.getHour() + local.getMinute() / 60.0;
        long day = local.toLocalDate().toEpochDay();
        DayWeather w = DayWeather.of(p, day);
        double dt = Math.max(0, Math.min(stepHours, 6));

        // Air temperature: low near 05:00, high near 15:00. Rain flattens the swing.
        double mid = (p.tempMin() + p.tempMax()) / 2 + w.tempShift();
        double amp = (p.tempMax() - p.tempMin()) / 2 * (w.rainy() ? 0.6 : 1.0);
        double air = mid + amp * Math.sin(2 * Math.PI * (hour - 9) / 24) + gauss(noise, 0.3);

        boolean raining = w.rainy() && hour >= w.rainStartHour() && hour < w.rainStartHour() + w.rainHours();
        double rain = raining ? w.rainMmPerHour() * dt : 0;

        // Relative humidity falls as air warms (fixed moisture, warmer air) and jumps in rain.
        double humidity = clamp(p.humidity() - 2.0 * (air - mid) + (raining ? 20 : 0) + gauss(noise, 1.5), 10, 100);

        double sun = hour > 6 && hour < 18 ? Math.sin(Math.PI * (hour - 6) / 12) : 0;
        double light = Math.max(0, p.lightPeak() * sun * w.cloud() * (raining ? 0.4 : 1) + (sun > 0 ? gauss(noise, 800) : 0));

        // Soil temperature lags and damps the air temperature.
        double soilTemp = mid - 1 + 0.5 * amp * Math.sin(2 * Math.PI * (hour - 11) / 24) + gauss(noise, 0.2);

        // Soil moisture: dries with heat and sun, recovers with rain, and the farmer's watering
        // pulls it back towards the field's usual level.
        double prevMoisture = previous == null ? p.moisture() : previous.getSoilMoisture();
        double drying = 0.12 * Math.max(0, air - 10) / 10 * sun;
        double moisture = clamp(prevMoisture
                + dt * (0.04 * (p.moisture() - prevMoisture) - drying)
                + rain * 0.5 + gauss(noise, 0.25), 2, 100);

        double ph = clamp(p.ph() + gauss(noise, 0.03), 3, 10);

        // Nutrients are taken up over a ~30-day fertiliser cycle, then topped up.
        double cycle = Math.floorMod(day, 30) / 30.0;
        double nitrogen = Math.max(0, p.nitrogen() * (1 - 0.30 * cycle) + gauss(noise, 3));
        double phosphorus = Math.max(0, p.phosphorus() * (1 - 0.10 * cycle) + gauss(noise, 0.5));
        double potassium = Math.max(0, p.potassium() * (1 - 0.12 * cycle) + gauss(noise, 2));

        // Paddy (alternate wetting and drying): standing water drains, refilled below 20 mm.
        Double waterLevel = null;
        if (p.ponded()) {
            double prevLevel = previous == null || previous.getWaterLevelMm() == null ? 40 : previous.getWaterLevelMm();
            double level = prevLevel - dt * (0.25 + 0.35 * sun) + rain;
            waterLevel = clamp(level < 20 ? 50 : level, 0, 120);
        }

        TelemetryReading reading = new TelemetryReading(deviceId, at, round(moisture), round(soilTemp), round2(ph), battery);
        return reading.environment(
                has(capabilities, "air-temperature") ? round(air) : null,
                has(capabilities, "humidity") ? round(humidity) : null,
                has(capabilities, "light") ? (double) Math.round(light) : null,
                has(capabilities, "npk") ? round(nitrogen) : null,
                has(capabilities, "npk") ? round(phosphorus) : null,
                has(capabilities, "npk") ? round(potassium) : null,
                has(capabilities, "rainfall") ? round2(rain) : null,
                has(capabilities, "water-level") && waterLevel != null ? round(waterLevel) : null);
    }

    private static boolean has(Set<String> capabilities, String name) {
        return capabilities.contains(name);
    }

    private static double gauss(Random r, double spread) {
        return r.nextGaussian() * spread;
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private static double round(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
