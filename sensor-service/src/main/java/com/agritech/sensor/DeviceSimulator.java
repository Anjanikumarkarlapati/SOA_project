package com.agritech.sensor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Stands in for the physical IoT fleet: seeds a pilot farm, backfills two days of history so the
 * charts have something to draw, and keeps pushing readings while the stack runs.
 *
 * ponytail: this is a simulator, not a protocol adapter. Real devices post to
 * POST /api/telemetry/ingest over HTTP (or an MQTT bridge that forwards to it) - that endpoint is
 * the actual contract, so deleting this class does not change the API surface.
 */
@Component
public class DeviceSimulator implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DeviceSimulator.class);

    /** fieldId -> baseline moisture. One field starts dry so the alerting path is visible on day one. */
    private static final Map<String, double[]> FIELD_BASELINE = Map.of(
            "CROP-FIELD-01", new double[]{62, 21.5, 6.6},
            "CROP-FIELD-02", new double[]{48, 24.0, 6.9},
            "CROP-FIELD-03", new double[]{28, 27.5, 6.2},
            "CROP-FIELD-04", new double[]{71, 19.8, 7.1});

    /** Fields currently being watered, so the simulated soil actually responds to the valves. */
    private final Map<String, Instant> wateringUntil = new ConcurrentHashMap<>();

    private final SensorDeviceRepository devices;
    private final TelemetryRepository readings;
    private final boolean enabled;

    public DeviceSimulator(SensorDeviceRepository devices, TelemetryRepository readings,
                           @org.springframework.beans.factory.annotation.Value(
                                   "${agritech.simulator.enabled:true}") boolean enabled) {
        this.devices = devices;
        this.readings = readings;
        this.enabled = enabled;
    }

    @Override
    public void run(String... args) {
        if (!enabled || devices.count() > 0) return;

        List<SensorDevice> fleet = new ArrayList<>();
        int n = 1;
        for (String fieldId : List.of("CROP-FIELD-01", "CROP-FIELD-02", "CROP-FIELD-03", "CROP-FIELD-04")) {
            for (int i = 0; i < 3; i++) {
                String id = String.format("SENSOR-FARM01-%03d", n++);
                SensorDevice d = new SensorDevice(id, "FARM-001", "soil-moisture-temperature", fieldId,
                        17.385 + ThreadLocalRandom.current().nextDouble(-0.02, 0.02),
                        78.486 + ThreadLocalRandom.current().nextDouble(-0.02, 0.02));
                d.setBatteryPercent(ThreadLocalRandom.current().nextDouble(35, 100));
                fleet.add(devices.save(d));
            }
        }
        // One device is deliberately left dark so the "Offline" state is exercised.
        SensorDevice dark = new SensorDevice("SENSOR-FARM01-013", "FARM-001", "weather-station",
                "CROP-FIELD-02", 17.39, 78.49);
        dark.setBatteryPercent(8.0);
        devices.save(dark);

        backfill(fleet);
        log.info("Seeded {} sensor devices with 48h of telemetry history", fleet.size() + 1);
    }

    /** Two days of 15-minute samples, so 24h/7d chart ranges are not empty on first launch. */
    private void backfill(List<SensorDevice> fleet) {
        Instant now = Instant.now();
        List<TelemetryReading> batch = new ArrayList<>();
        for (SensorDevice d : fleet) {
            double[] base = FIELD_BASELINE.get(d.getFieldId());
            for (int minutesAgo = 48 * 60; minutesAgo > 0; minutesAgo -= 15) {
                Instant at = now.minus(Duration.ofMinutes(minutesAgo));
                // Daily cycle: soil dries through the afternoon and recovers overnight.
                double phase = Math.sin((minutesAgo / 60.0) * Math.PI / 12);
                batch.add(new TelemetryReading(d.getDeviceId(), at,
                        clamp(base[0] + phase * 6 + noise(1.5), 0, 100),
                        clamp(base[1] - phase * 3 + noise(0.8), -50, 80),
                        clamp(base[2] + noise(0.1), 0, 14),
                        d.getBatteryPercent()));
            }
            d.recordReading(now.minus(Duration.ofMinutes(2)), d.getBatteryPercent());
            devices.save(d);
        }
        readings.saveAll(batch);
    }

    /** Called when the irrigation service opens a valve on this field. */
    public void wateringStarted(String fieldId, int durationMinutes) {
        wateringUntil.put(fieldId, Instant.now().plus(Duration.ofMinutes(Math.max(1, durationMinutes))));
    }

    public void wateringStopped(String fieldId) {
        wateringUntil.remove(fieldId);
    }

    /** Live tick - one reading per active device, random-walking from its last value. */
    @Scheduled(fixedRateString = "${agritech.simulator.interval-ms:30000}", initialDelay = 20000)
    public void emit() {
        if (!enabled) return;
        Instant now = Instant.now();
        for (SensorDevice d : devices.findAll()) {
            if (!"ACTIVE".equals(d.getStatus()) || "SENSOR-FARM01-013".equals(d.getDeviceId())) continue;
            TelemetryReading last = readings.findFirstByDeviceIdOrderByTimestampDesc(d.getDeviceId()).orElse(null);
            double[] base = FIELD_BASELINE.getOrDefault(d.getFieldId(), new double[]{55, 22, 6.8});
            double moisture = last == null ? base[0] : last.getSoilMoisture();
            double temp = last == null ? base[1] : last.getSoilTemperature();
            double ph = last == null ? base[2] : last.getPh();

            Instant until = wateringUntil.get(d.getFieldId());
            double drift = (until != null && until.isAfter(now)) ? 1.4 : -0.15;

            readings.save(new TelemetryReading(d.getDeviceId(), now,
                    clamp(moisture + noise(0.6) + drift, 0, 100),
                    clamp(temp + noise(0.3), -50, 80),
                    clamp(ph + noise(0.02), 0, 14),
                    d.getBatteryPercent()));
            d.recordReading(now, d.getBatteryPercent());
            devices.save(d);
        }
    }

    private static double noise(double spread) {
        return ThreadLocalRandom.current().nextDouble(-spread, spread);
    }

    private static double clamp(double value, double min, double max) {
        return Math.round(Math.max(min, Math.min(max, value)) * 10) / 10.0;
    }
}
