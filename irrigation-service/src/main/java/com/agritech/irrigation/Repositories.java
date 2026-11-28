package com.agritech.irrigation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

interface ValveRepository extends JpaRepository<Valve, String> {
    List<Valve> findByState(String state);

    /** Tenant scoping: a farmer only ever sees the zones on their own farm. */
    List<Valve> findByFarmId(String farmId);
}

interface ScheduleRepository extends JpaRepository<IrrigationSchedule, String> {
    List<IrrigationSchedule> findByActiveTrue();

    /** Tenant scoping, as for valves. */
    List<IrrigationSchedule> findByFarmId(String farmId);
}

interface EventRepository extends JpaRepository<IrrigationEvent, Long> {
    List<IrrigationEvent> findTop50ByOrderByTimestampDesc();

    /** Over-fetch window for the tenant-filtered feed: most rows belong to other farms. */
    List<IrrigationEvent> findTop500ByOrderByTimestampDesc();
}
