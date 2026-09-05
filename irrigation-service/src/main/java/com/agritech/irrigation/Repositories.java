package com.agritech.irrigation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

interface ValveRepository extends JpaRepository<Valve, String> {
    List<Valve> findByState(String state);
}

interface ScheduleRepository extends JpaRepository<IrrigationSchedule, String> {
    List<IrrigationSchedule> findByActiveTrue();
}

interface EventRepository extends JpaRepository<IrrigationEvent, Long> {
    List<IrrigationEvent> findTop50ByOrderByTimestampDesc();
}
