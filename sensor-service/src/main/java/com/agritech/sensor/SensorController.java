package com.agritech.sensor;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import com.agritech.common.InternalAuth;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final DeviceSimulator simulator;
    private final ObjectMapper json;

    public SensorController(SensorDeviceRepository devices, DeviceSimulator simulator, ObjectMapper json) {
        this.devices = devices;
        this.simulator = simulator;
        this.json = json;
    }

    /**
     * @param capabilities optional measurements beyond the soil probe (FarmSimulation.CAPABILITIES)
     * @param simProfile   crop-tuned simulation targets; only crop-service (SERVICE) may set it
     */
    public record RegisterRequest(
            @NotBlank String deviceId,
            @NotBlank String farmId,
            @NotBlank String sensorType,
            String fieldId,
            Double latitude,
            Double longitude,
            List<String> capabilities,
            Map<String, Double> simProfile) {}

    public record UpdateRequest(String sensorType, String fieldId, Double latitude,
                                Double longitude, String status, List<String> capabilities,
                                Map<String, Double> simProfile) {}

    public record SensorView(String deviceId, String farmId, String sensorType, String fieldId,
                             Map<String, Double> location, Instant registered, String status,
                             String health, Double batteryPercent, Instant lastReadingAt,
                             List<String> capabilities, boolean simulated) {

        static SensorView of(SensorDevice d) {
            return new SensorView(d.getDeviceId(), d.getFarmId(), d.getSensorType(), d.getFieldId(),
                    Map.of("latitude", d.getLatitude(), "longitude", d.getLongitude()),
                    d.getRegistered(), d.getStatus(), d.health(), d.getBatteryPercent(), d.getLastReadingAt(),
                    DeviceSimulator.capabilitiesOf(d).stream().sorted().toList(), d.getSimProfile() != null);
        }
    }

    /** Validated, sorted, comma-joined; null when none. */
    private static String capabilities(List<String> requested) {
        if (requested == null || requested.isEmpty()) return null;
        for (String c : requested) {
            if (!FarmSimulation.CAPABILITIES.contains(c)) {
                throw ApiException.badRequest("Unknown sensor capability '" + c + "'. Allowed: "
                        + FarmSimulation.CAPABILITIES.stream().sorted().toList());
            }
        }
        return String.join(",", requested.stream().distinct().sorted().toList());
    }

    private String simProfile(Map<String, Double> profile, boolean fromService) {
        if (profile == null) return null;
        if (!fromService) throw ApiException.forbidden("Only the platform can attach a simulation profile");
        try {
            return json.writeValueAsString(profile);
        } catch (Exception e) {
            throw ApiException.badRequest("simProfile is not serialisable");
        }
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public SensorView register(@Valid @RequestBody RegisterRequest req, HttpServletRequest http) {
        // crop-service provisions a sensor when a farmer adds a field; that call is signed as SERVICE.
        boolean provisioned = InternalAuth.SERVICE_ROLE.equals(CallerContext.role(http));
        if (!provisioned) CallerContext.requireAdmin(http);
        if (devices.existsById(req.deviceId())) {
            throw new ApiException(HttpStatus.CONFLICT, "device_exists",
                    "Device '" + req.deviceId() + "' is already registered");
        }
        SensorDevice device = new SensorDevice(req.deviceId(), req.farmId(), req.sensorType(), req.fieldId(),
                req.latitude() == null ? 0 : req.latitude(),
                req.longitude() == null ? 0 : req.longitude());
        device.setCapabilities(capabilities(req.capabilities()));
        device.setSimProfile(simProfile(req.simProfile(), provisioned));
        audit.info("sensor.register by={} device={}", CallerContext.email(http), req.deviceId());
        device = devices.save(device);
        // ponytail: simulated history for auto-provisioned field sensors; a real device posts to /ingest instead.
        if (provisioned) simulator.backfill(List.of(device));
        return SensorView.of(device);
    }

    @GetMapping("/{deviceId}")
    public SensorView get(@PathVariable String deviceId, HttpServletRequest http) {
        SensorDevice device = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Sensor device", deviceId));
        CallerContext.requireAccess(http, device.getFarmId(), "Sensor device", deviceId);
        return SensorView.of(device);
    }

    @PutMapping("/{deviceId}")
    public SensorView update(@PathVariable String deviceId, @RequestBody UpdateRequest req,
                             HttpServletRequest http) {
        // crop-service updates a farm's device when the farmer changes crop or sensors.
        boolean fromService = InternalAuth.SERVICE_ROLE.equals(CallerContext.role(http));
        if (!fromService) CallerContext.requireAdmin(http);
        SensorDevice device = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Sensor device", deviceId));
        if (req.capabilities() != null) device.setCapabilities(capabilities(req.capabilities()));
        if (req.simProfile() != null) device.setSimProfile(simProfile(req.simProfile(), fromService));
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
        // crop-service removes auto-provisioned field sensors as SERVICE when a crop field is deleted.
        if (!CallerContext.isPrivileged(http)) CallerContext.requireAdmin(http);
        SensorDevice device = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Sensor device", deviceId));
        devices.delete(device);
        audit.info("sensor.deregister by={} device={}", CallerContext.email(http), deviceId);
        return Map.of("status", "deregistered", "deviceId", deviceId);
    }

    /**
     * The devices this caller may see: everything for an administrator or a peer service, and
     * this farm's own rows for everyone else. Keeping it in one place is what stops a new
     * endpoint from forgetting the tenant filter.
     */
    private List<SensorDevice> visibleTo(HttpServletRequest http) {
        String scope = CallerContext.scopeListFilter(http, null);
        return scope == null ? devices.findAll(Sort.by("deviceId"))
                : devices.findByFarmId(scope).stream()
                        .sorted(java.util.Comparator.comparing(SensorDevice::getDeviceId))
                        .toList();
    }

    /** FR-3: paginated listing, with the filters the sensor table exposes. */
    @GetMapping
    public Map<String, Object> list(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "25") int size,
                                    @RequestParam(required = false) String health,
                                    @RequestParam(required = false) String fieldId,
                                    @RequestParam(required = false) String q,
                                    HttpServletRequest http) {
        if (page < 0) throw ApiException.badRequest("page must be >= 0");
        if (size < 1 || size > 200) throw ApiException.badRequest("size must be between 1 and 200");
        String scope = CallerContext.scopeListFilter(http, null);
        List<SensorView> filtered = visibleTo(http).stream()
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
                "totalPages", (int) Math.ceil(filtered.size() / (double) size),
                "farmScope", scope == null ? "ALL" : scope);
    }

    /** Dashboard stat tile: sensors online / total, for the caller's own farm. */
    @GetMapping("/summary")
    public Map<String, Object> summary(HttpServletRequest http) {
        List<SensorDevice> all = visibleTo(http);
        long online = all.stream().filter(d -> "ONLINE".equals(d.health())).count();
        long offline = all.stream().filter(d -> "OFFLINE".equals(d.health())).count();
        long lowBattery = all.stream().filter(d -> "LOW_BATTERY".equals(d.health())).count();
        return Map.of("total", all.size(), "online", online, "offline", offline, "lowBattery", lowBattery);
    }
}
