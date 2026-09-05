package com.agritech.crop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** FR-5/FR-6: turns raw telemetry into a health score, a status, and plain-language advice. */
@Service
public class CropAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(CropAnalysisService.class);

    /** Window used to estimate how fast the soil is drying. */
    private static final Duration TREND_WINDOW = Duration.ofHours(6);

    private final CropRepository crops;
    private final HealthSnapshotRepository snapshots;
    private final SensorClient sensors;

    public CropAnalysisService(CropRepository crops, HealthSnapshotRepository snapshots, SensorClient sensors) {
        this.crops = crops;
        this.snapshots = snapshots;
        this.sensors = sensors;
    }

    /** PRD 5.1: crop health metrics refreshed every 5 minutes. */
    @Scheduled(fixedRateString = "${agritech.analysis.interval-ms:300000}", initialDelay = 15000)
    public void analyzeAll() {
        for (Crop crop : crops.findAll()) {
            try {
                if (snapshots.findFirstByCropIdOrderByTimestampDesc(crop.getCropId()).isEmpty()) {
                    backfillHistory(crop);
                }
                analyze(crop);
            } catch (Exception e) {
                log.warn("Analysis failed for {}: {}", crop.getCropId(), e.getMessage());
            }
        }
    }

    /**
     * Evaluates one crop against its latest field telemetry. Returns empty when no sensor in the
     * field is reporting - a stale score is worse than an honest gap.
     */
    public Optional<HealthSnapshot> analyze(Crop crop) {
        Map<String, Object> latest = sensors.latestForField(crop.getCropId());
        if (!latest.containsKey("soilMoisture")) return Optional.empty();

        double moisture = SensorClient.asDouble(latest.get("soilMoisture"), 0);
        double temperature = SensorClient.asDouble(latest.get("soilTemperature"), 0);
        double ph = SensorClient.asDouble(latest.get("ph"), 7);

        HealthScore.Result result = HealthScore.evaluate(crop, moisture, temperature, ph,
                moistureSlopePerHour(crop.getCropId()));

        HealthSnapshot snapshot = new HealthSnapshot(crop.getCropId(), Instant.now(), result.score(),
                result.moistureStatus(), result.temperatureStatus(), result.phStatus(),
                moisture, temperature, ph, result.hoursToIrrigation(), result.recommendations());
        return Optional.of(snapshots.save(snapshot));
    }

    /**
     * Change in soil moisture per hour over the trend window, from the sensor service's own
     * bucketed series. Positive means wetting, negative means drying.
     */
    private double moistureSlopePerHour(String cropId) {
        List<Map<String, Object>> series = sensors.seriesForField(cropId, "24h");
        Instant cutoff = Instant.now().minus(TREND_WINDOW);
        List<Map<String, Object>> recent = series.stream()
                .filter(p -> Instant.parse(String.valueOf(p.get("timestamp"))).isAfter(cutoff))
                .toList();
        if (recent.size() < 2) return 0;

        Map<String, Object> first = recent.get(0);
        Map<String, Object> last = recent.get(recent.size() - 1);
        double hours = Duration.between(
                Instant.parse(String.valueOf(first.get("timestamp"))),
                Instant.parse(String.valueOf(last.get("timestamp")))).toMinutes() / 60.0;
        if (hours <= 0) return 0;

        return (SensorClient.asDouble(last.get("soilMoisture"), 0)
                - SensorClient.asDouble(first.get("soilMoisture"), 0)) / hours;
    }

    /**
     * First time we see a crop, replay the sensor service's stored history through the same scoring
     * function so the trend charts and sparklines are not empty until the next few days of ticks.
     */
    void backfillHistory(Crop crop) {
        List<Map<String, Object>> series = sensors.seriesForField(crop.getCropId(), "7d");
        if (series.size() < 2) return;

        List<HealthSnapshot> history = new java.util.ArrayList<>();
        for (int i = 1; i < series.size(); i++) {
            Map<String, Object> point = series.get(i);
            Instant at = Instant.parse(String.valueOf(point.get("timestamp")));
            double moisture = SensorClient.asDouble(point.get("soilMoisture"), 0);
            double previous = SensorClient.asDouble(series.get(i - 1).get("soilMoisture"), moisture);
            double hours = Duration.between(
                    Instant.parse(String.valueOf(series.get(i - 1).get("timestamp"))), at).toMinutes() / 60.0;
            double slope = hours > 0 ? (moisture - previous) / hours : 0;

            HealthScore.Result r = HealthScore.evaluate(crop, moisture,
                    SensorClient.asDouble(point.get("soilTemperature"), 0),
                    SensorClient.asDouble(point.get("ph"), 7), slope);
            history.add(new HealthSnapshot(crop.getCropId(), at, r.score(), r.moistureStatus(),
                    r.temperatureStatus(), r.phStatus(), moisture,
                    SensorClient.asDouble(point.get("soilTemperature"), 0),
                    SensorClient.asDouble(point.get("ph"), 7), r.hoursToIrrigation(), r.recommendations()));
        }
        snapshots.saveAll(history);
        log.info("Backfilled {} health snapshots for {}", history.size(), crop.getCropId());
    }

    /** Latest snapshot, computing one on demand if none exists yet. */
    public Optional<HealthSnapshot> currentHealth(Crop crop) {
        Optional<HealthSnapshot> latest = snapshots.findFirstByCropIdOrderByTimestampDesc(crop.getCropId());
        return latest.isPresent() ? latest : analyze(crop);
    }
}
