package com.agritech.irrigation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

/** FR-7/FR-8: runs due schedules, closes finished runs, and enforces the moisture cut-out. */
@Component
public class IrrigationScheduler {

    private static final Logger log = LoggerFactory.getLogger(IrrigationScheduler.class);

    /** A schedule is picked up if the tick lands within this long after its start time. */
    private static final Duration START_GRACE = Duration.ofMinutes(5);

    private final ScheduleRepository schedules;
    private final ValveRepository valves;
    private final ValveService valveService;
    private final ZoneId zone = ZoneId.systemDefault();

    public IrrigationScheduler(ScheduleRepository schedules, ValveRepository valves, ValveService valveService) {
        this.schedules = schedules;
        this.valves = valves;
        this.valveService = valveService;
    }

    @Scheduled(fixedRateString = "${agritech.irrigation.tick-ms:30000}", initialDelay = 25000)
    public void tick() {
        closeFinishedRuns();
        enforceMoistureCutout();
        startDueSchedules();
    }

    private void closeFinishedRuns() {
        Instant now = Instant.now();
        for (Valve valve : valves.findByState("OPEN")) {
            if (valve.getOpenUntil() != null && !valve.getOpenUntil().isAfter(now)) {
                valveService.close(valve, "scheduled run complete", "system");
            }
        }
    }

    /** FR-8: a running zone that reaches saturation shuts itself off. */
    private void enforceMoistureCutout() {
        for (Valve valve : valves.findByState("OPEN")) {
            if (valveService.fieldIsSaturated(valve.getCropId())) {
                valveService.record("WARNING", valve,
                        valve.getZoneName() + " reached its optimal moisture ceiling - cutting off early");
                valveService.close(valve, "soil moisture above optimal", "system");
            }
        }
    }

    private void startDueSchedules() {
        LocalTime now = LocalTime.now(zone);
        LocalDate today = LocalDate.now(zone);

        for (IrrigationSchedule schedule : schedules.findByActiveTrue()) {
            if (!isDue(schedule, today, now)) continue;

            Valve valve = valves.findById(schedule.getValveId()).orElse(null);
            if (valve == null) {
                log.warn("Schedule {} points at unknown valve {}", schedule.getScheduleId(), schedule.getValveId());
                continue;
            }
            if (valve.isOpen()) continue;

            if (schedule.isSkipIfMoist() && valveService.fieldIsSaturated(schedule.getCropId())) {
                valveService.record("INFO", valve, schedule.getScheduleId()
                        + " skipped - soil already at or above optimal moisture");
                schedule.setLastRunAt(Instant.now());
                schedules.save(schedule);
                continue;
            }

            String refusal = valveService.open(valve, schedule.getDurationMinutes(),
                    schedule.getScheduleId(), "system");
            schedule.setLastRunAt(Instant.now());
            schedules.save(schedule);
            if (refusal != null) log.info("Schedule {} not started: {}", schedule.getScheduleId(), refusal);
        }
    }

    /**
     * Due when today matches the recurrence and the clock is inside the grace window after the
     * start time, and it has not already run today.
     */
    boolean isDue(IrrigationSchedule schedule, LocalDate today, LocalTime now) {
        if ("WEEKLY".equalsIgnoreCase(schedule.getRecurrence())
                && !schedule.days().contains(today.getDayOfWeek())) {
            return false;
        }
        // Compare minutes-of-day rather than adding to a LocalTime, which would wrap past midnight
        // and make a 23:58 schedule look due all the following morning.
        long minutesSinceStart = (now.toSecondOfDay() - schedule.getStartTime().toSecondOfDay()) / 60;
        if (minutesSinceStart < 0 || minutesSinceStart > START_GRACE.toMinutes()) return false;

        Instant lastRun = schedule.getLastRunAt();
        return lastRun == null || !lastRun.atZone(zone).toLocalDate().equals(today);
    }
}
