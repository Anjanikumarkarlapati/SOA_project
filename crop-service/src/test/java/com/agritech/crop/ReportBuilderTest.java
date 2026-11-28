package com.agritech.crop;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ReportBuilderTest {

    private static final CropCatalog.Spec TOMATO = CropCatalog.find("tomato").orElseThrow();
    private static final LocalDate DAY = LocalDate.of(2026, 10, 3);

    private static ReportBuilder.FarmInfo farm(List<String> sensors) {
        return new ReportBuilder.FarmInfo("Ramesh Farm", 5, "ACRES", 2.02, TOMATO.name(), TOMATO.id(), "Warangal, Telangana", sensors);
    }

    /** n readings with the given values (light follows a crude day: 0 for the first half). */
    private static List<Map<String, Object>> readings(int n, Map<String, Double> values) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            Map<String, Object> r = new HashMap<>(values);
            if (values.containsKey("lightLux")) r.put("lightLux", i < n / 2 ? 0.0 : values.get("lightLux"));
            out.add(r);
        }
        return out;
    }

    private static Map<String, Double> healthyTomato() {
        Map<String, Double> v = new HashMap<>();
        v.put("soilMoisture", 70.0);   // 60-80
        v.put("soilTemperature", 24.0); // 18-30
        v.put("ph", 6.5);              // 6.0-7.0
        v.put("airTemperature", 25.0);
        v.put("humidity", 65.0);       // 55-80
        v.put("lightLux", 50000.0);    // 30000-70000
        v.put("nitrogen", 300.0);
        v.put("phosphorus", 40.0);
        v.put("potassium", 250.0);
        v.put("rainfallMm", 0.0);
        return v;
    }

    @Test
    void gradesByDistanceOutsideTheBand() {
        CropCatalog.Range r = new CropCatalog.Range(60, 80);   // width 20
        assertEquals("OPTIMAL", ReportBuilder.grade(70, r));
        assertEquals("OPTIMAL", ReportBuilder.grade(60, r));
        assertEquals("NORMAL", ReportBuilder.grade(58, r));    // 0.1 band out
        assertEquals("WARNING", ReportBuilder.grade(55, r));   // 0.25 band out
        assertEquals("CRITICAL", ReportBuilder.grade(50, r));  // 0.5 band out
        assertEquals("CRITICAL", ReportBuilder.grade(95, r));
        assertNull(ReportBuilder.grade(10, null));
    }

    @Test
    void healthyFarmIsOptimalWithMaintenanceAdvice() {
        var report = ReportBuilder.build(TOMATO, farm(FarmService.SENSORS), DAY, true, readings(96, healthyTomato()));
        assertEquals("OPTIMAL", report.condition());
        assertTrue(report.alerts().isEmpty());
        assertTrue(report.simulated());
        assertTrue(report.dataSource().startsWith("Simulated"));
        assertEquals("IRRIGATION", report.recommendations().get(0).category());
        assertTrue(report.recommendations().get(0).text().contains("on track"));
        assertTrue(report.summary().contains("optimal condition"), report.summary());
    }

    @Test
    void dryHumidFarmRaisesAlertsAndAdvice() {
        Map<String, Double> v = healthyTomato();
        v.put("soilMoisture", 45.0);   // well below 60
        v.put("humidity", 92.0);       // above 80, tomato is disease-prone
        var report = ReportBuilder.build(TOMATO, farm(FarmService.SENSORS), DAY, true, readings(96, v));

        assertEquals("CRITICAL", report.condition());
        var moisture = report.alerts().stream().filter(a -> a.metric().equals("soilMoisture")).findFirst().orElseThrow();
        assertEquals("CRITICAL", moisture.severity());
        assertTrue(moisture.message().contains("below the recommended 60-80%"), moisture.message());
        assertTrue(moisture.message().contains("irrigation may be required"), moisture.message());

        assertTrue(report.recommendations().stream().anyMatch(r -> r.category().equals("IRRIGATION")
                && r.text().startsWith("Irrigate within the next 24 hours")));
        assertTrue(report.recommendations().stream().anyMatch(r -> r.category().equals("DISEASE")
                && r.text().contains("fungal disease")));
        assertTrue(report.summary().contains("need attention"), report.summary());
    }

    @Test
    void lowNutrientsGetFertiliserAdvice() {
        Map<String, Double> v = healthyTomato();
        v.put("nitrogen", 100.0);
        v.put("potassium", 100.0);
        var report = ReportBuilder.build(TOMATO, farm(FarmService.SENSORS), DAY, true, readings(10, v));
        assertTrue(report.recommendations().stream().anyMatch(r -> r.text().contains("urea")));
        assertTrue(report.recommendations().stream().anyMatch(r -> r.text().contains("potash")));
    }

    @Test
    void everyNutrientAlertComesWithAdvice() {
        Map<String, Double> v = healthyTomato();
        v.put("phosphorus", 61.0);   // above 30-50: critical excess
        var report = ReportBuilder.build(TOMATO, farm(FarmService.SENSORS), DAY, true, readings(10, v));
        assertTrue(report.alerts().stream().anyMatch(a -> a.metric().equals("phosphorus")));
        assertTrue(report.recommendations().stream().anyMatch(r -> r.text().startsWith("Phosphorus is high")));
    }

    @Test
    void rainRelievesIrrigation() {
        Map<String, Double> v = healthyTomato();
        v.put("rainfallMm", 0.5);     // 0.5 mm in each of 40 readings = 20 mm for the day
        var report = ReportBuilder.build(TOMATO, farm(FarmService.SENSORS), DAY, true, readings(40, v));
        var rain = report.sensors().stream().filter(m -> m.key().equals("rainfallMm")).findFirst().orElseThrow();
        assertEquals("total", rain.basis());
        assertEquals(20.0, rain.value());
        assertTrue(report.recommendations().get(0).text().contains("Skip the next scheduled irrigation"));
    }

    @Test
    void lightIsGradedOnTheMiddayPeakNotTheNightAverage() {
        var report = ReportBuilder.build(TOMATO, farm(List.of("light")), DAY, true, readings(96, healthyTomato()));
        var light = report.sensors().stream().filter(m -> m.key().equals("lightLux")).findFirst().orElseThrow();
        assertEquals("peak", light.basis());
        assertEquals(50000.0, light.value());
        assertEquals("OPTIMAL", light.status());
    }

    @Test
    void onlyTheFarmsSensorsAppear() {
        var report = ReportBuilder.build(TOMATO, farm(List.of("humidity")), DAY, true, readings(10, healthyTomato()));
        assertEquals(List.of("soilMoisture", "soilTemperature", "ph", "humidity"),
                report.sensors().stream().map(ReportBuilder.MetricSummary::key).toList());
    }

    @Test
    void heatSpikeAlertsEvenWhenTheAverageIsFine() {
        List<Map<String, Object>> rows = readings(10, healthyTomato());
        rows.get(5).put("airTemperature", 38.0);   // tomato tolerates up to 30
        var report = ReportBuilder.build(TOMATO, farm(FarmService.SENSORS), DAY, true, rows);
        assertTrue(report.alerts().stream().anyMatch(a -> a.message().startsWith("Afternoon temperature peaked at 38")));
        assertEquals("NEEDS_ATTENTION", report.condition());
        assertTrue(report.summary().startsWith("Tomato on Ramesh Farm (5 acres) needed attention on 2026-10-03."), report.summary());

        var today = ReportBuilder.build(TOMATO, farm(FarmService.SENSORS), DAY, false, rows);
        assertTrue(today.summary().contains("needs attention so far today. "), today.summary());
        assertTrue(today.summary().contains("attention: Air temperature."), "labels keep their case: " + today.summary());
    }

    @Test
    void noReadingsIsNoDataNotAFakeOptimal() {
        var report = ReportBuilder.build(TOMATO, farm(FarmService.SENSORS), DAY, false, List.of());
        assertEquals("NO_DATA", report.condition());
        assertEquals(0, report.readings());
    }

    @Test
    void catalogCoversEveryCropTheSetupOffers() {
        assertEquals(48, CropCatalog.size());
        assertEquals("rice", CropCatalog.find("Rice (Paddy)").orElseThrow().id());
        assertEquals("rice", CropCatalog.find("rice").orElseThrow().id());
        assertTrue(CropCatalog.find("Rice").isPresent(), "short name matches");
        assertTrue(CropCatalog.find("rice").orElseThrow().ponded());
        assertNotNull(CropCatalog.find("rice").orElseThrow().waterLevel());
        assertEquals(4.5, CropCatalog.find("tea").orElseThrow().ph().min());
        assertTrue(CropCatalog.find("dragonfruit").isEmpty());
    }

    @Test
    void simulationTargetsDifferPerFarmButStayStable() {
        var a = FarmService.simProfile(TOMATO, "CROP-AAAA1111");
        assertEquals(a, FarmService.simProfile(TOMATO, "CROP-AAAA1111"));
        assertNotEquals(a, FarmService.simProfile(TOMATO, "CROP-BBBB2222"));
        assertEquals(0.0, a.get("ponded"));
        assertEquals(1.0, FarmService.simProfile(CropCatalog.find("rice").orElseThrow(), "CROP-X").get("ponded"));
        assertTrue(a.get("tempMin") < a.get("tempMax"));
    }
}
