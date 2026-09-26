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

    /** Fraction of the gap to baseline closed per tick; a gentle exponential approach. */
    private static final double REVERSION_RATE = 0.02;

    /** Fastest the soil may dry per tick, so a soaked field eases down instead of snapping back. */
    private static final double MAX_DRY_RATE = -0.15;

    private final SensorDeviceRepository devices;
    private final TelemetryRepository readings;
    private final FieldWateringRepository watering;
    private final boolean enabled;

    public DeviceSimulator(SensorDeviceRepository devices, TelemetryRepository readings,
                           FieldWateringRepository watering,
                           @org.springframework.beans.factory.annotation.Value(
                                   "${agritech.simulator.enabled:true}") boolean enabled) {
        this.devices = devices;
        this.readings = readings;
        this.watering = watering;
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
    void backfill(List<SensorDevice> fleet) {
        if (!enabled) return;
        Instant now = Instant.now();
        List<TelemetryReading> batch = new ArrayList<>();
        for (SensorDevice d : fleet) {
            double[] base = baseline(d.getFieldId());
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
        setWatering(fieldId, Instant.now().plus(Duration.ofMinutes(Math.max(1, durationMinutes))));
    }

    public void wateringStopped(String fieldId) {
        setWatering(fieldId, null);
    }

    /** Kept in the DB, not in memory, so it works whichever sensor-service instance gets the call. */
    private void setWatering(String fieldId, Instant until) {
        if (until == null) watering.deleteById(fieldId);
        else watering.save(new FieldWatering(fieldId, until));
    }

    /** Live tick - one reading per active device, random-walking from its last value. */
    @Scheduled(fixedRateString = "${agritech.simulator.interval-ms:30000}", initialDelay = 20000)
    public void emit() {
        if (!enabled) return;
        Instant now = Instant.now();
        Map<String, Instant> wateredFields = new java.util.HashMap<>();
        watering.findAll().forEach(w -> wateredFields.put(w.getFieldId(), w.getUntil()));
        for (SensorDevice d : devices.findAll()) {
            if (!"ACTIVE".equals(d.getStatus()) || "SENSOR-FARM01-013".equals(d.getDeviceId())) continue;
            TelemetryReading last = readings.findFirstByDeviceIdOrderByTimestampDesc(d.getDeviceId()).orElse(null);
            double[] base = baseline(d.getFieldId());
            double moisture = last == null ? base[0] : last.getSoilMoisture();
            double temp = last == null ? base[1] : last.getSoilTemperature();
            double ph = last == null ? base[2] : last.getPh();

            Instant until = wateredFields.get(d.getFieldId());
            boolean watering = until != null && until.isAfter(now);

            // Watering pushes moisture up; otherwise it reverts toward this field's baseline.
            // The previous constant -0.15 drift looked right for a few minutes but bottomed every
            // field out after a few hours, so the whole farm eventually read CRITICAL and the
            // seeded mix of states was lost. Reverting to the baseline keeps each field in the
            // state it was seeded to demonstrate, while a watered field still visibly spikes and
            // then eases back down.
            double drift = watering
                    ? 1.4
                    : Math.max(MAX_DRY_RATE, (base[0] - moisture) * REVERSION_RATE);

            readings.save(new TelemetryReading(d.getDeviceId(), now,
                    clamp(moisture + noise(0.6) + drift, 0, 100),
                    clamp(temp + noise(0.3), -50, 80),
                    clamp(ph + noise(0.02), 0, 14),
                    d.getBatteryPercent()));
            d.recordReading(now, d.getBatteryPercent());
            devices.save(d);
        }
    }

    /**
     * Seeded fields keep their fixed baseline; a field a farmer adds later gets a random one, seeded
     * by its id so it stays stable across ticks and restarts (some come up dry, some moist).
     */
    static double[] baseline(String fieldId) {
        double[] fixed = FIELD_BASELINE.get(fieldId);
        if (fixed != null) return fixed;
        java.util.Random r = new java.util.Random(fieldId == null ? 0 : fieldId.hashCode());
        return new double[]{25 + r.nextDouble() * 55, 16 + r.nextDouble() * 14, 5.6 + r.nextDouble() * 1.8};
    }

    private static double noise(double spread) {
        return ThreadLocalRandom.current().nextDouble(-spread, spread);
    }

    private static double clamp(double value, double min, double max) {
        return Math.round(Math.max(min, Math.min(max, value)) * 10) / 10.0;
    }
}
