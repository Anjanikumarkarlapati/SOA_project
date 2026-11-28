package com.agritech.sensor;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import jakarta.servlet.http.HttpServletRequest;
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

    /** The soil probe fields are required; the environmental ones are optional per device. */
    public record Reading(@NotBlank String deviceId, Instant timestamp, Double soilMoisture,
                          Double soilTemperature, Double ph, Double batteryPercent,
                          Double airTemperature, Double humidity, Double lightLux,
                          Double nitrogen, Double phosphorus, Double potassium,
                          Double rainfallMm, Double waterLevelMm) {}

    public record IngestRequest(@NotEmpty(message = "at least one reading is required")
                                @Valid List<Reading> readings) {}

    /**
     * Bulk submission. Malformed or out-of-range readings are rejected individually so one bad
     * sample from a drifting sensor does not discard the whole batch.
     */
    @PostMapping("/ingest")
    @Transactional
    public Map<String, Object> ingest(@Valid @RequestBody IngestRequest req, HttpServletRequest http) {
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
            if (!canIngest(http, device)) {
                // Same shape as "not registered": the caller must not learn the device exists.
                rejected.add(Map.of("deviceId", r.deviceId(), "reason", "device is not registered"));
                continue;
            }
            Instant at = r.timestamp() == null ? Instant.now() : r.timestamp();
            readings.save(new TelemetryReading(r.deviceId(), at, r.soilMoisture(),
                    r.soilTemperature(), r.ph(), r.batteryPercent())
                    .environment(r.airTemperature(), r.humidity(), r.lightLux(), r.nitrogen(),
                            r.phosphorus(), r.potassium(), r.rainfallMm(), r.waterLevelMm()));
            device.recordReading(at, r.batteryPercent());
            devices.save(device);
            accepted++;
        }
        return Map.of("accepted", accepted, "rejected", rejected);
    }

    /**
     * Who may write to a device. Operators and peer services (the simulator, crop-service
     * provisioning) write anywhere; a farmer only ever writes to their own farm's probes, so a
     * guessed device id cannot be used to inject false moisture data into another tenant's
     * health score.
     */
    private static boolean canIngest(HttpServletRequest http, SensorDevice device) {
        return CallerContext.isPrivileged(http)
                || CallerContext.canAccess(http, device.getFarmId());
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
        String optional = firstOutOfRange(
                "airTemperature", r.airTemperature(), -50, 60,
                "humidity", r.humidity(), 0, 100,
                "lightLux", r.lightLux(), 0, 200_000,
                "nitrogen", r.nitrogen(), 0, 2000,
                "phosphorus", r.phosphorus(), 0, 2000,
                "potassium", r.potassium(), 0, 2000,
                "rainfallMm", r.rainfallMm(), 0, 500,
                "waterLevelMm", r.waterLevelMm(), 0, 500);
        if (optional != null) return optional;
        if (r.timestamp() != null && r.timestamp().isAfter(Instant.now().plus(Duration.ofMinutes(5)))) {
            return "timestamp is in the future";
        }
        return null;
    }

    /** Arguments come in (name, value, min, max) groups; null values are skipped. */
    private static String firstOutOfRange(Object... checks) {
        for (int i = 0; i < checks.length; i += 4) {
            Double value = (Double) checks[i + 1];
            if (value == null) continue;
            double min = ((Number) checks[i + 2]).doubleValue();
            double max = ((Number) checks[i + 3]).doubleValue();
            if (value.isNaN() || value < min || value > max) {
                return checks[i] + " out of range (" + checks[i + 2] + " to " + checks[i + 3] + ")";
            }
        }
        return null;
    }

    /**
     * Historical readings for the sensor detail chart, or for an absolute window
     * ({@code from}/{@code to}, ISO-8601) such as one calendar day for a daily report.
     */
    @GetMapping("/{deviceId}")
    public List<TelemetryReading> history(@PathVariable String deviceId,
                                          @RequestParam(defaultValue = "24h") String range,
                                          @RequestParam(required = false) Instant from,
                                          @RequestParam(required = false) Instant to,
                                          HttpServletRequest http) {
        SensorDevice device = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Sensor device", deviceId));
        CallerContext.requireAccess(http, device.getFarmId(), "Sensor device", deviceId);
        Instant end = to == null ? Instant.now() : to;
        Instant start = from == null ? end.minus(parseRange(range)) : from;
        if (!start.isBefore(end)) throw ApiException.badRequest("from must be before to");
        if (Duration.between(start, end).compareTo(Duration.ofDays(90)) > 0) {
            throw ApiException.badRequest("window is limited to 90 days");
        }
        return readings.findByDeviceIdAndTimestampBetweenOrderByTimestampAsc(deviceId, start, end);
    }

    @GetMapping("/{deviceId}/latest")
    public TelemetryReading latest(@PathVariable String deviceId, HttpServletRequest http) {
        SensorDevice device = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Telemetry for device", deviceId));
        CallerContext.requireAccess(http, device.getFarmId(), "Sensor device", deviceId);
        return readings.findFirstByDeviceIdOrderByTimestampDesc(deviceId)
                .orElseThrow(() -> ApiException.notFound("Telemetry for device", deviceId));
    }

    /**
     * A field's devices that this caller may see. Administrators and peer services get all of
     * them; a farmer gets only rows on their own farm, which makes another tenant's field read as
     * empty rather than as forbidden (no existence leak, no data leak).
     */
    private List<SensorDevice> visibleFieldDevices(String fieldId, HttpServletRequest http) {
        List<SensorDevice> fieldDevices = devices.findAllByFieldId(fieldId);
        if (CallerContext.isPrivileged(http)) return fieldDevices;
        return fieldDevices.stream().filter(d -> CallerContext.canAccess(http, d.getFarmId())).toList();
    }

    /**
     * Field-level rollup consumed by the crop monitoring service (FR-9). Averages the most
     * recent reading from every device assigned to the field.
     */
    @GetMapping("/field/{fieldId}/latest")
    public Map<String, Object> fieldLatest(@PathVariable String fieldId, HttpServletRequest http) {
        List<SensorDevice> fieldDevices = visibleFieldDevices(fieldId, http);
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
                                                 @RequestParam(defaultValue = "24h") String range,
                                                 HttpServletRequest http) {
        Duration window = parseRange(range);
        Instant from = Instant.now().minus(window);
        List<TelemetryReading> all = visibleFieldDevices(fieldId, http).stream()
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
                                               @RequestParam(defaultValue = "30") int durationMinutes,
                                               HttpServletRequest http) {
        // irrigation-service arrives as SERVICE and is unaffected; a farmer may only water a field
        // that has devices of their own, so this cannot toggle another tenant's simulation.
        if (!CallerContext.isPrivileged(http) && visibleFieldDevices(fieldId, http).isEmpty()) {
            throw ApiException.notFound("Field", fieldId);
        }
        if (durationMinutes < 1 || durationMinutes > 240) {
            throw ApiException.badRequest("durationMinutes must be between 1 and 240");
        }
        if ("OPEN".equalsIgnoreCase(state)) {
            simulator.wateringStarted(fieldId, durationMinutes);
        } else {
            simulator.wateringStopped(fieldId);
        }
        return Map.of("fieldId", fieldId, "state", state.toUpperCase());
    }

    /** Ingestion volume, for the monitoring metrics in PRD 11.1, scoped to the caller's farms. */
    @GetMapping("/stats")
    public Map<String, Object> stats(HttpServletRequest http) {
        Instant now = Instant.now();
        if (CallerContext.isPrivileged(http)) {
            return Map.of(
                    "readingsLastMinute", readings.countSince(now.minus(Duration.ofMinutes(1))),
                    "readingsLastHour", readings.countSince(now.minus(Duration.ofHours(1))),
                    "totalReadings", readings.count());
        }
        List<String> mine = visibleDeviceIds(http);
        if (mine.isEmpty()) {
            // An empty IN () is invalid SQL on PostgreSQL, and "no devices" is genuinely zero rows.
            return Map.of("readingsLastMinute", 0L, "readingsLastHour", 0L, "totalReadings", 0L);
        }
        return Map.of(
                "readingsLastMinute", readings.countByDeviceIdInAndTimestampAfter(mine, now.minus(Duration.ofMinutes(1))),
                "readingsLastHour", readings.countByDeviceIdInAndTimestampAfter(mine, now.minus(Duration.ofHours(1))),
                "totalReadings", readings.countByDeviceIdIn(mine));
    }

    /** Every device id belonging to this caller; empty list means an empty (but valid) scope. */
    private List<String> visibleDeviceIds(HttpServletRequest http) {
        String scope = CallerContext.scopeListFilter(http, null);
        return scope == null ? List.of()
                : devices.findByFarmId(scope).stream().map(SensorDevice::getDeviceId).toList();
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
