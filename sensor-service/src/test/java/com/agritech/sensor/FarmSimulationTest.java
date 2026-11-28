package com.agritech.sensor;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class FarmSimulationTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Set<String> ALL = FarmSimulation.CAPABILITIES;

    private static FarmSimulation.Profile rice(long seed) {
        return FarmSimulation.Profile.of(Map.ofEntries(
                Map.entry("moisture", 80.0), Map.entry("tempMin", 22.0), Map.entry("tempMax", 33.0),
                Map.entry("humidity", 75.0), Map.entry("ph", 6.2), Map.entry("lightPeak", 70000.0),
                Map.entry("nitrogen", 300.0), Map.entry("phosphorus", 30.0), Map.entry("potassium", 220.0),
                Map.entry("rainChance", 0.5), Map.entry("ponded", 1.0), Map.entry("seed", (double) seed)));
    }

    /** Three days of 15-minute readings, state carried forward like the live simulator does. */
    private static List<TelemetryReading> run(FarmSimulation.Profile p, Set<String> caps, long seed) {
        Random noise = new Random(seed);
        Instant start = LocalDate.of(2026, 10, 1).atStartOfDay(IST).toInstant();
        List<TelemetryReading> out = new ArrayList<>();
        TelemetryReading prev = null;
        for (int i = 0; i < 3 * 96; i++) {
            prev = FarmSimulation.next("D", p, caps, prev, start.plusSeconds(i * 900L), 0.25, 90.0, noise);
            out.add(prev);
        }
        return out;
    }

    private static int hourOf(TelemetryReading r) {
        return r.getTimestamp().atZone(IST).getHour();
    }

    @Test
    void readingsStayPhysicallyPlausible() {
        for (TelemetryReading r : run(rice(7), ALL, 7)) {
            assertTrue(r.getSoilMoisture() >= 2 && r.getSoilMoisture() <= 100, "moisture");
            assertTrue(r.getAirTemperature() > 10 && r.getAirTemperature() < 45, "air temp " + r.getAirTemperature());
            assertTrue(r.getHumidity() >= 10 && r.getHumidity() <= 100, "humidity");
            assertTrue(r.getPh() >= 3 && r.getPh() <= 10, "ph");
            assertTrue(r.getLightLux() >= 0 && r.getLightLux() <= 75000, "light");
            assertTrue(r.getRainfallMm() >= 0, "rain");
            assertTrue(r.getWaterLevelMm() >= 0 && r.getWaterLevelMm() <= 120, "paddy water");
            assertTrue(r.getNitrogen() > 0 && r.getPhosphorus() > 0 && r.getPotassium() > 0, "npk");
        }
    }

    @Test
    void followsTheDayNightCycle() {
        List<TelemetryReading> day = run(rice(7), ALL, 7);
        for (TelemetryReading r : day) {
            if (hourOf(r) < 6 || hourOf(r) >= 18) assertEquals(0.0, r.getLightLux(), "dark at night");
        }
        double nightTemp = day.stream().filter(r -> hourOf(r) == 4).mapToDouble(TelemetryReading::getAirTemperature).average().orElseThrow();
        double afternoonTemp = day.stream().filter(r -> hourOf(r) == 14).mapToDouble(TelemetryReading::getAirTemperature).average().orElseThrow();
        assertTrue(afternoonTemp > nightTemp + 3, "afternoon warmer than night");

        double nightHumidity = day.stream().filter(r -> hourOf(r) == 4).mapToDouble(TelemetryReading::getHumidity).average().orElseThrow();
        double afternoonHumidity = day.stream().filter(r -> hourOf(r) == 11).mapToDouble(TelemetryReading::getHumidity).average().orElseThrow();
        assertTrue(nightHumidity > afternoonHumidity, "humidity falls as it warms");
    }

    @Test
    void differentFarmsReadDifferently() {
        FarmSimulation.Profile wheat = FarmSimulation.Profile.of(Map.of(
                "moisture", 45.0, "tempMin", 10.0, "tempMax", 24.0, "humidity", 50.0, "seed", 99.0));
        double riceAvg = run(rice(7), ALL, 7).stream().mapToDouble(TelemetryReading::getAirTemperature).average().orElseThrow();
        double wheatAvg = run(wheat, ALL, 99).stream().mapToDouble(TelemetryReading::getAirTemperature).average().orElseThrow();
        assertTrue(riceAvg - wheatAvg > 5, "crop-tuned temperature: rice " + riceAvg + " vs wheat " + wheatAvg);
    }

    @Test
    void reportsOnlyTheSelectedSensors() {
        TelemetryReading r = run(rice(7), Set.of("humidity"), 7).get(50);
        assertNotNull(r.getHumidity());
        assertNull(r.getAirTemperature());
        assertNull(r.getLightLux());
        assertNull(r.getNitrogen());
        assertNull(r.getRainfallMm());
        assertNull(r.getWaterLevelMm());
        assertTrue(r.getSoilMoisture() > 0, "soil probe always present");
    }

    @Test
    void sameSeedSameWeather() {
        FarmSimulation.DayWeather a = FarmSimulation.DayWeather.of(rice(7), 20000);
        assertEquals(a, FarmSimulation.DayWeather.of(rice(7), 20000));
        assertNotEquals(a, FarmSimulation.DayWeather.of(rice(8), 20000));
    }
}
