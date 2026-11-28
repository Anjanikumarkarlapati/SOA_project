package com.agritech.crop;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
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

    public record CreateCropRequest(@NotBlank @Size(max = 80) String name, @NotBlank @Size(max = 60) String cropType,
                                    @Positive @Max(100000) Double areaHectares) {}

    /**
     * Any signed-in farmer adds a field and names its crop. The field gets that crop's optimal band,
     * a simulated soil sensor, and a first health analysis, so readings show up straight away.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CropView create(@Valid @RequestBody CreateCropRequest req, HttpServletRequest http) {
        String farmId = CallerContext.farmScope(http);
        if (farmId == null) {
            if (!CallerContext.isPrivileged(http)) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Missing tenant scope");
            }
            farmId = "FARM-001";
        }
        CropCatalog.Spec spec = CropCatalog.find(req.cropType())
                .orElseGet(() -> CropCatalog.generic(req.cropType().trim()));
        String cropId = Crop.newId();
        Crop crop = crops.save(Crop.of(cropId, farmId, req.name().trim(), spec,
                req.areaHectares() == null ? 1 : req.areaHectares()));
        // ponytail: best effort, no rollback; if sensor-service is down the field reads NO_DATA.
        if (sensors.provisionSensor(cropId, farmId)) {
            analysis.backfillHistory(crop);
            analysis.analyze(crop);
        }
        return view(crop, snapshots.findFirstByCropIdOrderByTimestampDesc(cropId).orElse(null));
    }

    private Crop require(String cropId, HttpServletRequest http) {
        Crop crop = crops.findById(cropId).orElseThrow(() -> ApiException.notFound("Crop", cropId));
        CallerContext.requireAccess(http, crop.getFarmId(), "Crop", cropId);
        return crop;
    }

    /**
     * Fields this caller may see: everything for an administrator or a peer service, this farm's
     * own fields for a farmer. This is what stops {@code GET /api/crops} from being a cross-tenant
     * dump.
     */
    private List<Crop> visibleCrops(HttpServletRequest http) {
        String scope = CallerContext.scopeListFilter(http, null);
        return scope == null ? crops.findAll() : crops.findByFarmId(scope);
    }

    @GetMapping
    public List<CropView> list(@RequestParam(required = false) String farmId, HttpServletRequest http) {
        // A farmer asking for someone else's farm is quietly narrowed to their own.
        String scope = CallerContext.scopeListFilter(http, farmId);
        List<Crop> all = scope == null ? crops.findAll() : crops.findByFarmId(scope);
        return all.stream()
                .map(c -> view(c, snapshots.findFirstByCropIdOrderByTimestampDesc(c.getCropId()).orElse(null)))
                .sorted(Comparator.comparing(CropView::cropId))
                .toList();
    }

    @GetMapping("/{cropId}")
    public CropView get(@PathVariable String cropId, HttpServletRequest http) {
        Crop crop = require(cropId, http);
        return view(crop, snapshots.findFirstByCropIdOrderByTimestampDesc(cropId).orElse(null));
    }

    /** FR-5: current health score (0-100). */
    @GetMapping("/{cropId}/health")
    public CropView health(@PathVariable String cropId, HttpServletRequest http) {
        Crop crop = require(cropId, http);
        return view(crop, analysis.currentHealth(crop).orElse(null));
    }

    /**
     * FR-5: soil moisture, temperature and pH trends, plus the health-score trend, with the crop's
     * optimal band so the chart can shade it.
     */
    @GetMapping("/{cropId}/metrics")
    public Map<String, Object> metrics(@PathVariable String cropId,
                                       @RequestParam(defaultValue = "7d") String range,
                                       HttpServletRequest http) {
        Crop crop = require(cropId, http);
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
    public Map<String, Object> analyze(@RequestBody(required = false) Map<String, String> body,
                                       HttpServletRequest http) {
        String cropId = body == null ? null : body.get("cropId");
        List<Crop> targets = cropId == null ? visibleCrops(http) : List.of(require(cropId, http));

        List<CropView> results = targets.stream()
                .map(c -> view(c, analysis.analyze(c).orElse(null)))
                .toList();
        return Map.of("analyzed", results.size(), "results", results, "timestamp", Instant.now().toString());
    }

    /** FR-6: deviations that need a farmer's attention, newest first. */
    @GetMapping("/alerts")
    public List<Map<String, Object>> alerts(HttpServletRequest http) {
        List<Map<String, Object>> alerts = new ArrayList<>();
        for (Crop crop : visibleCrops(http)) {
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
    public Map<String, Object> summary(HttpServletRequest http) {
        List<Crop> all = visibleCrops(http);
        long optimal = all.stream()
                .map(c -> snapshots.findFirstByCropIdOrderByTimestampDesc(c.getCropId()).orElse(null))
                .filter(s -> s != null && "OPTIMAL".equals(s.overallStatus()))
                .count();
        int percent = all.isEmpty() ? 0 : (int) Math.round(optimal * 100.0 / all.size());
        return Map.of("totalFields", all.size(), "optimalFields", optimal, "optimalPercent", percent);
    }

    /** Every field is optional; only the properties present are changed. */
    public record UpdateCropRequest(@Size(max = 80) String name, @Size(max = 60) String cropType,
                                    @Positive @Max(100000) Double areaHectares) {}

    /**
     * Update: rename a field, resize it, or replant it as another crop. Changing the crop type
     * re-points the field at that crop's optimal envelope, which is what the health score is
     * measured against, so a fresh analysis is taken straight after.
     */
    @PutMapping("/{cropId}")
    public CropView update(@PathVariable String cropId,
                           @Valid @RequestBody UpdateCropRequest req, HttpServletRequest http) {
        Crop crop = require(cropId, http);
        String name = req.name() == null || req.name().isBlank() ? crop.getName() : req.name().trim();
        double area = req.areaHectares() == null ? crop.getAreaHectares() : req.areaHectares();
        boolean replanted = req.cropType() != null && !req.cropType().isBlank()
                && !req.cropType().equals(crop.getCropType());
        if (replanted) {
            CropCatalog.Spec spec = CropCatalog.find(req.cropType())
                    .orElseGet(() -> CropCatalog.generic(req.cropType().trim()));
            crop.apply(name, spec, area);
        } else {
            crop.relabel(name, area);
        }
        crops.save(crop);
        // A new crop means a new optimal envelope, so the old score is meaningless: re-grade it.
        HealthSnapshot snap = replanted
                ? analysis.analyze(crop).orElse(null)
                : snapshots.findFirstByCropIdOrderByTimestampDesc(cropId).orElse(null);
        return view(crop, snap);
    }

    /**
     * Delete: remove the field, the health history recorded against it, and the soil sensor that
     * was provisioned for it, so nothing is left billing the farm for a field that is gone.
     */
    @DeleteMapping("/{cropId}")
    public Map<String, String> delete(@PathVariable String cropId, HttpServletRequest http) {
        Crop crop = require(cropId, http);
        sensors.removeSensor(cropId);
        snapshots.deleteByCropId(cropId);
        crops.delete(crop);
        return Map.of("status", "deleted", "cropId", cropId);
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
