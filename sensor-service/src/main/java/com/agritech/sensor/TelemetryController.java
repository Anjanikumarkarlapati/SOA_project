package com.agritech.sensor;

import com.agritech.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.DoubleStream;

/** FR-4: telemetry ingestion and historical queries. */
@RestController
@RequestMapping("/api/telemetry")
public class TelemetryController {

    private final TelemetryRepository readings;
    private final SensorDeviceRepository devices;
    private final DeviceSimulator simulator;

    public TelemetryController(TelemetryRepository readings, SensorDeviceRepository devices,
                               DeviceSimulator simulator) {
        this.readings = readings;
        this.devices = devices;
        this.simulator = simulator;
    }

    public record Reading(@NotBlank String deviceId, Instant timestamp, Double soilMoisture,
                          Double soilTemperature, Double ph, Double batteryPercent) {}

    public record IngestRequest(@NotEmpty(message = "at least one reading is required")
                                @Valid List<Reading> readings) {}

    /**
     * Bulk submission. Malformed or out-of-range readings are rejected individually so one bad
     * sample from a drifting sensor does not discard the whole batch.
     */
    @PostMapping("/ingest")
    @Transactional
    public Map<String, Object> ingest(@Valid @RequestBody IngestRequest req) {
        List<Map<String, String>> rejected = new ArrayList<>();
        int accepted = 0;

        for (Reading r : req.readings()) {
            if (r == null) {
                rejected.add(Map.of("deviceId", "null", "reason", "empty reading"));
                continue;
            }
            String problem = validate(r);
            if (problem != null) {
                rejected.add(Map.of("deviceId", String.valueOf(r.deviceId()), "reason", problem));
                continue;
            }
            SensorDevice device = devices.findById(r.deviceId()).orElse(null);
            if (device == null) {
                rejected.add(Map.of("deviceId", r.deviceId(), "reason", "device is not registered"));
                continue;
            }
            Instant at = r.timestamp() == null ? Instant.now() : r.timestamp();
            readings.save(new TelemetryReading(r.deviceId(), at, r.soilMoisture(),
                    r.soilTemperature(), r.ph(), r.batteryPercent()));
            device.recordReading(at, r.batteryPercent());
            devices.save(device);
            accepted++;
        }
        return Map.of("accepted", accepted, "rejected", rejected);
    }

    /** Range check per FR-4; missing values count as malformed. */
    private static String validate(Reading r) {
        if (r.soilMoisture() == null || r.soilTemperature() == null || r.ph() == null) {
            return "soilMoisture, soilTemperature and pH are all required";
        }
        if (r.soilMoisture() < 0 || r.soilMoisture() > 100) return "soilMoisture out of range (0-100)";
        if (r.soilTemperature() < -50 || r.soilTemperature() > 80) return "soilTemperature out of range (-50 to 80)";
        if (r.ph() < 0 || r.ph() > 14) return "pH out of range (0-14)";
        if (r.batteryPercent() != null && (r.batteryPercent() < 0 || r.batteryPercent() > 100)) {
            return "batteryPercent out of range (0-100)";
        }
        if (r.timestamp() != null && r.timestamp().isAfter(Instant.now().plus(Duration.ofMinutes(5)))) {
            return "timestamp is in the future";
        }
        return null;
    }

    /** Historical readings for the sensor detail chart. */
    @GetMapping("/{deviceId}")
    public List<TelemetryReading> history(@PathVariable String deviceId,
                                          @RequestParam(defaultValue = "24h") String range) {
        if (!devices.existsById(deviceId)) throw ApiException.notFound("Sensor device", deviceId);
        Instant from = Instant.now().minus(parseRange(range));
        return readings.findByDeviceIdAndTimestampBetweenOrderByTimestampAsc(deviceId, from, Instant.now());
    }

    @GetMapping("/{deviceId}/latest")
    public TelemetryReading latest(@PathVariable String deviceId) {
        return readings.findFirstByDeviceIdOrderByTimestampDesc(deviceId)
                .orElseThrow(() -> ApiException.notFound("Telemetry for device", deviceId));
    }

    /**
     * Field-level rollup consumed by the crop monitoring service (FR-9). Averages the most
     * recent reading from every device assigned to the field.
     */
    @GetMapping("/field/{fieldId}/latest")
    public Map<String, Object> fieldLatest(@PathVariable String fieldId) {
        List<SensorDevice> fieldDevices = devices.findAllByFieldId(fieldId);
        List<TelemetryReading> latest = fieldDevices.stream()
                .map(d -> readings.findFirstByDeviceIdOrderByTimestampDesc(d.getDeviceId()).orElse(null))
                .filter(Objects::nonNull)
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fieldId", fieldId);
        result.put("deviceCount", fieldDevices.size());
        result.put("reportingDevices", latest.size());
        if (latest.isEmpty()) return result;

        result.put("soilMoisture", avg(latest.stream().mapToDouble(TelemetryReading::getSoilMoisture)));
        result.put("soilTemperature", avg(latest.stream().mapToDouble(TelemetryReading::getSoilTemperature)));
        result.put("ph", avg(latest.stream().mapToDouble(TelemetryReading::getPh)));
        result.put("timestamp", latest.stream().map(TelemetryReading::getTimestamp)
                .max(Instant::compareTo).map(Instant::toString).orElse(null));
        return result;
    }

    /** Time series for a whole field, averaged into buckets so charts stay light. */
    @GetMapping("/field/{fieldId}/series")
    public List<Map<String, Object>> fieldSeries(@PathVariable String fieldId,
                                                 @RequestParam(defaultValue = "24h") String range) {
        Duration window = parseRange(range);
        Instant from = Instant.now().minus(window);
        List<TelemetryReading> all = devices.findAllByFieldId(fieldId).stream()
                .flatMap(d -> readings.findByDeviceIdAndTimestampBetweenOrderByTimestampAsc(
                        d.getDeviceId(), from, Instant.now()).stream())
                .toList();

        long bucketSeconds = Math.max(300, window.toSeconds() / 48);
        Map<Long, List<TelemetryReading>> buckets = new TreeMap<>();
        for (TelemetryReading r : all) {
            buckets.computeIfAbsent(r.getTimestamp().getEpochSecond() / bucketSeconds,
                    k -> new ArrayList<>()).add(r);
        }
        List<Map<String, Object>> series = new ArrayList<>();
        buckets.forEach((bucket, rows) -> {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("timestamp", Instant.ofEpochSecond(bucket * bucketSeconds).toString());
            point.put("soilMoisture", avg(rows.stream().mapToDouble(TelemetryReading::getSoilMoisture)));
            point.put("soilTemperature", avg(rows.stream().mapToDouble(TelemetryReading::getSoilTemperature)));
            point.put("ph", avg(rows.stream().mapToDouble(TelemetryReading::getPh)));
            series.add(point);
        });
        return series;
    }

    /**
     * Told by the irrigation service that a field is being watered, so simulated soil moisture
     * responds to valve state. A real deployment learns this from the sensors themselves and
     * this endpoint goes away.
     */
    @PostMapping("/field/{fieldId}/irrigation-event")
    public Map<String, String> irrigationEvent(@PathVariable String fieldId,
                                               @RequestParam String state,
                                               @RequestParam(defaultValue = "30") int durationMinutes) {
        if ("OPEN".equalsIgnoreCase(state)) {
            simulator.wateringStarted(fieldId, durationMinutes);
        } else {
            simulator.wateringStopped(fieldId);
        }
        return Map.of("fieldId", fieldId, "state", state.toUpperCase());
    }

    /** Ingestion volume, for the monitoring metrics in PRD 11.1. */
    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return Map.of(
                "readingsLastMinute", readings.countSince(Instant.now().minus(Duration.ofMinutes(1))),
                "readingsLastHour", readings.countSince(Instant.now().minus(Duration.ofHours(1))),
                "totalReadings", readings.count());
    }

    static Duration parseRange(String range) {
        return switch (range == null ? "24h" : range.toLowerCase()) {
            case "1h" -> Duration.ofHours(1);
            case "24h" -> Duration.ofHours(24);
            case "7d" -> Duration.ofDays(7);
            case "30d" -> Duration.ofDays(30);
            case "90d" -> Duration.ofDays(90);
            default -> throw ApiException.badRequest("range must be one of 1h, 24h, 7d, 30d, 90d");
        };
    }

    private static double avg(DoubleStream values) {
        return Math.round(values.average().orElse(0) * 10) / 10.0;
    }
}
