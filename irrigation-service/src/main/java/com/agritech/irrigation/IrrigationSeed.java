package com.agritech.irrigation;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalTime;

/** One valve per field, plus the starting schedules. */
@Component
public class IrrigationSeed implements CommandLineRunner {

    private final ValveRepository valves;
    private final ScheduleRepository schedules;

    public IrrigationSeed(ValveRepository valves, ScheduleRepository schedules) {
        this.valves = valves;
        this.schedules = schedules;
    }

    @Override
    public void run(String... args) {
        if (valves.count() > 0) return;

        valves.save(new Valve("VALVE-FIELD-01", "FARM-001", "CROP-FIELD-01", "North Field", 120));
        valves.save(new Valve("VALVE-FIELD-02", "FARM-001", "CROP-FIELD-02", "River Paddock", 90));
        valves.save(new Valve("VALVE-FIELD-03", "FARM-001", "CROP-FIELD-03", "South Terrace", 60));
        valves.save(new Valve("VALVE-FIELD-04", "FARM-001", "CROP-FIELD-04", "West Block", 150));

        schedules.save(new IrrigationSchedule("SCHEDULE-001", "FARM-001", "CROP-FIELD-01",
                "VALVE-FIELD-01", "DAILY", null, LocalTime.of(6, 0), 30, true));
        schedules.save(new IrrigationSchedule("SCHEDULE-002", "FARM-001", "CROP-FIELD-03",
                "VALVE-FIELD-03", "DAILY", null, LocalTime.of(5, 30), 45, true));
        schedules.save(new IrrigationSchedule("SCHEDULE-003", "FARM-001", "CROP-FIELD-02",
                "VALVE-FIELD-02", "WEEKLY", "MONDAY,THURSDAY", LocalTime.of(6, 30), 25, true));
        schedules.save(new IrrigationSchedule("SCHEDULE-004", "FARM-001", "CROP-FIELD-04",
                "VALVE-FIELD-04", "DAILY", null, LocalTime.of(18, 0), 20, true));
    }
}
