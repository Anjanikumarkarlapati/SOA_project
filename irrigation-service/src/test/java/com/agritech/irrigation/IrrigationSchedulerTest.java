package com.agritech.irrigation;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IrrigationSchedulerTest {

    private final IrrigationScheduler scheduler = new IrrigationScheduler(null, null, null);
    private final LocalDate monday = LocalDate.of(2026, 9, 7);

    private IrrigationSchedule daily(LocalTime start) {
        return new IrrigationSchedule("SCHEDULE-TEST", "FARM-001", "CROP-FIELD-01", "VALVE-FIELD-01",
                "DAILY", null, start, 30, true);
    }

    @Test
    void firesInsideTheGraceWindowAndNotBeforeOrAfter() {
        IrrigationSchedule schedule = daily(LocalTime.of(6, 0));

        assertTrue(scheduler.isDue(schedule, monday, LocalTime.of(6, 0)));
        assertTrue(scheduler.isDue(schedule, monday, LocalTime.of(6, 4)));
        assertFalse(scheduler.isDue(schedule, monday, LocalTime.of(5, 59)));
        assertFalse(scheduler.isDue(schedule, monday, LocalTime.of(6, 6)));
    }

    @Test
    void aLateNightScheduleDoesNotLeakIntoTheNextMorning() {
        // The grace window must not wrap past midnight.
        IrrigationSchedule schedule = daily(LocalTime.of(23, 58));

        assertTrue(scheduler.isDue(schedule, monday, LocalTime.of(23, 59)));
        assertFalse(scheduler.isDue(schedule, monday, LocalTime.of(0, 1)));
        assertFalse(scheduler.isDue(schedule, monday, LocalTime.of(9, 0)));
    }

    @Test
    void weeklySchedulesOnlyFireOnTheirDays() {
        IrrigationSchedule weekly = new IrrigationSchedule("SCHEDULE-W", "FARM-001", "CROP-FIELD-02",
                "VALVE-FIELD-02", "WEEKLY", "MONDAY,THURSDAY", LocalTime.of(6, 30), 25, true);

        assertTrue(scheduler.isDue(weekly, monday, LocalTime.of(6, 30)));
        assertFalse(scheduler.isDue(weekly, monday.plusDays(1), LocalTime.of(6, 30)));
    }

    @Test
    void doesNotRunTwiceInOneDay() {
        IrrigationSchedule schedule = daily(LocalTime.of(6, 0));
        schedule.setLastRunAt(monday.atTime(6, 1).atZone(ZoneId.systemDefault()).toInstant());

        assertFalse(scheduler.isDue(schedule, monday, LocalTime.of(6, 3)));

        // ...but it is due again tomorrow.
        assertTrue(scheduler.isDue(schedule, monday.plusDays(1), LocalTime.of(6, 3)));
    }

}
