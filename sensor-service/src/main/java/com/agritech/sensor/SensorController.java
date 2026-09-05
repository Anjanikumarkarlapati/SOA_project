package com.agritech.sensor;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** FR-3: sensor device management. */
@RestController
@RequestMapping("/api/sensors")
public class SensorController {

    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    private final SensorDeviceRepository devices;

    public SensorController(SensorDeviceRepository devices) { this.devices = devices; }

    public record RegisterRequest(
            @NotBlank String deviceId,
            @NotBlank String farmId,
            @NotBlank String sensorType,
            String fieldId,
            Double latitude,
            Double longitude) {}

    public record UpdateRequest(String sensorType, String fieldId, Double latitude,
                                Double longitude, String status) {}

    public record SensorView(String deviceId, String farmId, String sensorType, String fieldId,
                             Map<String, Double> location, Instant registered, String status,
                             String health, Double batteryPercent, Instant lastReadingAt) {

        static SensorView of(SensorDevice d) {
            return new SensorView(d.getDeviceId(), d.getFarmId(), d.getSensorType(), d.getFieldId(),
                    Map.of("latitude", d.getLatitude(), "longitude", d.getLongitude()),
                    d.getRegistered(), d.getStatus(), d.health(), d.getBatteryPercent(), d.getLastReadingAt());
        }
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public SensorView register(@Valid @RequestBody RegisterRequest req, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        if (devices.existsById(req.deviceId())) {
            throw new ApiException(HttpStatus.CONFLICT, "device_exists",
                    "Device '" + req.deviceId() + "' is already registered");
        }
        SensorDevice device = new SensorDevice(req.deviceId(), req.farmId(), req.sensorType(), req.fieldId(),
                req.latitude() == null ? 0 : req.latitude(),
                req.longitude() == null ? 0 : req.longitude());
        audit.info("sensor.register by={} device={}", CallerContext.email(http), req.deviceId());
        return SensorView.of(devices.save(device));
    }

    @GetMapping("/{deviceId}")
    public SensorView get(@PathVariable String deviceId) {
        return SensorView.of(devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Sensor device", deviceId)));
    }

    @PutMapping("/{deviceId}")
    public SensorView update(@PathVariable String deviceId, @RequestBody UpdateRequest req,
                             HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        SensorDevice device = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Sensor device", deviceId));
        if (req.sensorType() != null) device.setSensorType(req.sensorType());
        if (req.fieldId() != null) device.setFieldId(req.fieldId());
        if (req.latitude() != null) device.setLatitude(req.latitude());
        if (req.longitude() != null) device.setLongitude(req.longitude());
        if (req.status() != null) device.setStatus(req.status().toUpperCase());
        audit.info("sensor.update by={} device={}", CallerContext.email(http), deviceId);
        return SensorView.of(devices.save(device));
    }

    @DeleteMapping("/{deviceId}")
    public Map<String, String> deregister(@PathVariable String deviceId, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        SensorDevice device = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Sensor device", deviceId));
        devices.delete(device);
        audit.info("sensor.deregister by={} device={}", CallerContext.email(http), deviceId);
        return Map.of("status", "deregistered", "deviceId", deviceId);
    }

    /** FR-3: paginated listing, with the filters the sensor table exposes. */
    @GetMapping
    public Map<String, Object> list(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "25") int size,
                                    @RequestParam(required = false) String health,
                                    @RequestParam(required = false) String fieldId,
                                    @RequestParam(required = false) String q) {
        if (size < 1 || size > 200) throw ApiException.badRequest("size must be between 1 and 200");
        List<SensorView> filtered = devices.findAll(Sort.by("deviceId")).stream()
                .filter(d -> health == null || health.isBlank() || d.health().equalsIgnoreCase(health))
                .filter(d -> fieldId == null || fieldId.isBlank() || fieldId.equals(d.getFieldId()))
                .filter(d -> q == null || q.isBlank() || d.getDeviceId().toLowerCase().contains(q.toLowerCase()))
                .map(SensorView::of)
                .toList();
        int from = Math.min(page * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        return Map.of(
                "content", filtered.subList(from, to),
                "page", page,
                "size", size,
                "totalElements", filtered.size(),
                "totalPages", (int) Math.ceil(filtered.size() / (double) size));
    }

    /** Dashboard stat tile: sensors online / total. */
    @GetMapping("/summary")
    public Map<String, Object> summary() {
        List<SensorDevice> all = devices.findAll();
        long online = all.stream().filter(d -> "ONLINE".equals(d.health())).count();
        long offline = all.stream().filter(d -> "OFFLINE".equals(d.health())).count();
        long lowBattery = all.stream().filter(d -> "LOW_BATTERY".equals(d.health())).count();
        return Map.of("total", all.size(), "online", online, "offline", offline, "lowBattery", lowBattery);
    }
}
