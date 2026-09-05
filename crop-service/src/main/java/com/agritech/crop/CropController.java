package com.agritech.crop;

import com.agritech.common.ApiException;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/** FR-5/FR-6: crop health evaluation and environmental insights. */
@RestController
@RequestMapping("/api/crops")
public class CropController {

    private final CropRepository crops;
    private final HealthSnapshotRepository snapshots;
    private final CropAnalysisService analysis;
    private final SensorClient sensors;

    public CropController(CropRepository crops, HealthSnapshotRepository snapshots,
                          CropAnalysisService analysis, SensorClient sensors) {
        this.crops = crops;
        this.snapshots = snapshots;
        this.analysis = analysis;
        this.sensors = sensors;
    }

    public record CropView(String cropId, String farmId, String name, String cropType, String valveId,
                           double areaHectares, String plantedOn, Map<String, double[]> optimal,
                           Integer healthScore, String status, String moistureStatus,
                           String temperatureStatus, Double soilMoisture, Double soilTemperature,
                           Double ph, Double hoursToIrrigation, String lastUpdated,
                           List<String> recommendations) {}

    private CropView view(Crop crop, HealthSnapshot snap) {
        Map<String, double[]> optimal = new LinkedHashMap<>();
        optimal.put("moisture", new double[]{crop.getMoistureMin(), crop.getMoistureMax()});
        optimal.put("temperature", new double[]{crop.getTemperatureMin(), crop.getTemperatureMax()});
        optimal.put("ph", new double[]{crop.getPhMin(), crop.getPhMax()});

        return new CropView(crop.getCropId(), crop.getFarmId(), crop.getName(), crop.getCropType(),
                crop.getValveId(), crop.getAreaHectares(),
                crop.getPlantedOn() == null ? null : crop.getPlantedOn().toString(), optimal,
                snap == null ? null : snap.getHealthScore(),
                snap == null ? "NO_DATA" : snap.overallStatus(),
                snap == null ? null : snap.getMoistureStatus(),
                snap == null ? null : snap.getTemperatureStatus(),
                snap == null ? null : snap.getSoilMoisture(),
                snap == null ? null : snap.getSoilTemperature(),
                snap == null ? null : snap.getPh(),
                snap == null ? null : snap.getHoursToIrrigation(),
                snap == null ? null : snap.getTimestamp().toString(),
                snap == null ? List.of() : snap.getRecommendations());
    }

    private Crop require(String cropId) {
        return crops.findById(cropId).orElseThrow(() -> ApiException.notFound("Crop", cropId));
    }

    @GetMapping
    public List<CropView> list(@RequestParam(required = false) String farmId) {
        List<Crop> all = farmId == null ? crops.findAll() : crops.findByFarmId(farmId);
        return all.stream()
                .map(c -> view(c, snapshots.findFirstByCropIdOrderByTimestampDesc(c.getCropId()).orElse(null)))
                .sorted(Comparator.comparing(CropView::cropId))
                .toList();
    }

    @GetMapping("/{cropId}")
    public CropView get(@PathVariable String cropId) {
        Crop crop = require(cropId);
        return view(crop, snapshots.findFirstByCropIdOrderByTimestampDesc(cropId).orElse(null));
    }

    /** FR-5: current health score (0-100). */
    @GetMapping("/{cropId}/health")
    public CropView health(@PathVariable String cropId) {
        Crop crop = require(cropId);
        return view(crop, analysis.currentHealth(crop).orElse(null));
    }

    /**
     * FR-5: soil moisture, temperature and pH trends, plus the health-score trend, with the crop's
     * optimal band so the chart can shade it.
     */
    @GetMapping("/{cropId}/metrics")
    public Map<String, Object> metrics(@PathVariable String cropId,
                                       @RequestParam(defaultValue = "7d") String range) {
        Crop crop = require(cropId);
        Instant from = Instant.now().minus(parseRange(range));

        List<Map<String, Object>> healthTrend = snapshots
                .findByCropIdAndTimestampAfterOrderByTimestampAsc(cropId, from).stream()
                .map(s -> Map.<String, Object>of(
                        "timestamp", s.getTimestamp().toString(),
                        "healthScore", s.getHealthScore()))
                .toList();

        Map<String, Object> optimal = Map.of(
                "moisture", List.of(crop.getMoistureMin(), crop.getMoistureMax()),
                "temperature", List.of(crop.getTemperatureMin(), crop.getTemperatureMax()),
                "ph", List.of(crop.getPhMin(), crop.getPhMax()));

        return Map.of(
                "cropId", cropId,
                "range", range,
                "optimal", optimal,
                "environment", sensors.seriesForField(cropId, range),
                "healthTrend", healthTrend);
    }

    /** FR-5: trigger a manual analysis, for one crop or the whole farm. */
    @PostMapping("/analyze")
    public Map<String, Object> analyze(@RequestBody(required = false) Map<String, String> body) {
        String cropId = body == null ? null : body.get("cropId");
        List<Crop> targets = cropId == null ? crops.findAll() : List.of(require(cropId));

        List<CropView> results = targets.stream()
                .map(c -> view(c, analysis.analyze(c).orElse(null)))
                .toList();
        return Map.of("analyzed", results.size(), "results", results, "timestamp", Instant.now().toString());
    }

    /** FR-6: deviations that need a farmer's attention, newest first. */
    @GetMapping("/alerts")
    public List<Map<String, Object>> alerts() {
        List<Map<String, Object>> alerts = new ArrayList<>();
        for (Crop crop : crops.findAll()) {
            HealthSnapshot snap = snapshots.findFirstByCropIdOrderByTimestampDesc(crop.getCropId()).orElse(null);
            if (snap == null || "OPTIMAL".equals(snap.overallStatus())) continue;
            alerts.add(Map.of(
                    "id", "crop-" + crop.getCropId(),
                    "severity", "CRITICAL".equals(snap.overallStatus()) ? "CRITICAL" : "WARNING",
                    "source", crop.getName(),
                    "cropId", crop.getCropId(),
                    "message", snap.getRecommendations().isEmpty()
                            ? "Environmental readings outside optimal range"
                            : snap.getRecommendations().get(0),
                    "timestamp", snap.getTimestamp().toString()));
        }
        alerts.sort(Comparator.comparing(a -> String.valueOf(a.get("timestamp")), Comparator.reverseOrder()));
        return alerts;
    }

    /** Dashboard stat tile: share of fields currently reading optimal. */
    @GetMapping("/summary")
    public Map<String, Object> summary() {
        List<Crop> all = crops.findAll();
        long optimal = all.stream()
                .map(c -> snapshots.findFirstByCropIdOrderByTimestampDesc(c.getCropId()).orElse(null))
                .filter(s -> s != null && "OPTIMAL".equals(s.overallStatus()))
                .count();
        int percent = all.isEmpty() ? 0 : (int) Math.round(optimal * 100.0 / all.size());
        return Map.of("totalFields", all.size(), "optimalFields", optimal, "optimalPercent", percent);
    }

    private static Duration parseRange(String range) {
        return switch (range == null ? "7d" : range.toLowerCase()) {
            case "24h" -> Duration.ofHours(24);
            case "7d" -> Duration.ofDays(7);
            case "30d" -> Duration.ofDays(30);
            case "90d" -> Duration.ofDays(90);
            default -> throw ApiException.badRequest("range must be one of 24h, 7d, 30d, 90d");
        };
    }
}
