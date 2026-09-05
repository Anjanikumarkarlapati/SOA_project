package com.agritech.irrigation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Every valve state change goes through here - manual override, schedule, and emergency stop
 * alike - so the event log, the sensor notification and the safety check cannot be skipped by
 * whichever caller forgot about them.
 */
@Service
public class ValveService {

    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    private final ValveRepository valves;
    private final EventRepository events;
    private final FarmClient farm;

    public ValveService(ValveRepository valves, EventRepository events, FarmClient farm) {
        this.valves = valves;
        this.events = events;
        this.farm = farm;
    }

    /**
     * FR-8 emergency stop: refuse to open (or immediately close) a valve when the field is already
     * wetter than the crop's optimal band.
     */
    public boolean fieldIsSaturated(String cropId) {
        // Unreachable crop-service means "unknown", not "saturated" - a missing dependency must not
        // silently stop the farm from being watered.
        return farm.cropHealth(cropId).map(ValveService::aboveOptimal).orElse(false);
    }

    private static boolean aboveOptimal(Map<String, Object> health) {
        double moisture = FarmClient.moisture(health);
        Object optimal = health.get("optimal");
        if (Double.isNaN(moisture) || !(optimal instanceof Map<?, ?> bands)) return false;
        Object moistureBand = bands.get("moisture");
        if (!(moistureBand instanceof List<?> range) || range.size() < 2) return false;
        return range.get(1) instanceof Number max && moisture > max.doubleValue();
    }

    /** Opens a valve for a fixed run. Returns the rejection reason, or null when it opened. */
    public String open(Valve valve, int durationMinutes, String scheduleId, String actor) {
        if (fieldIsSaturated(valve.getCropId())) {
            record("WARNING", valve, "Open refused - " + valve.getCropId()
                    + " is already above its optimal moisture band");
            return "Field is already above its optimal moisture range";
        }
        valve.open(Instant.now().plus(Duration.ofMinutes(durationMinutes)), scheduleId);
        valves.save(valve);
        farm.notifyValveState(valve.getCropId(), "OPEN", durationMinutes);
        record("INFO", valve, String.format("%s opened for %d min (%s)",
                valve.getZoneName(), durationMinutes, scheduleId == null ? "manual" : scheduleId));
        audit.info("valve.open by={} valve={} minutes={}", actor, valve.getValveId(), durationMinutes);
        return null;
    }

    public void close(Valve valve, String reason, String actor) {
        valve.close();
        valves.save(valve);
        farm.notifyValveState(valve.getCropId(), "CLOSED", 0);
        record("INFO", valve, valve.getZoneName() + " closed - " + reason);
        audit.info("valve.close by={} valve={} reason={}", actor, valve.getValveId(), reason);
    }

    /** FR-8: close every open valve at once. */
    public int closeAll(String reason, String actor) {
        List<Valve> open = valves.findByState("OPEN");
        open.forEach(v -> close(v, reason, actor));
        if (!open.isEmpty()) {
            events.save(new IrrigationEvent("CRITICAL", "ALL", null,
                    "Emergency stop - " + open.size() + " valve(s) closed: " + reason));
        }
        audit.warn("valve.emergency_stop by={} closed={} reason={}", actor, open.size(), reason);
        return open.size();
    }

    void record(String severity, Valve valve, String message) {
        events.save(new IrrigationEvent(severity, valve.getValveId(), valve.getCropId(), message));
    }
}
