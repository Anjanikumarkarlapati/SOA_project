package com.agritech.sensor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

interface SensorDeviceRepository extends JpaRepository<SensorDevice, String> {
    Page<SensorDevice> findByFarmId(String farmId, Pageable pageable);
    List<SensorDevice> findAllByFieldId(String fieldId);
}

interface TelemetryRepository extends JpaRepository<TelemetryReading, Long> {

    List<TelemetryReading> findByDeviceIdAndTimestampBetweenOrderByTimestampAsc(
            String deviceId, Instant from, Instant to);

    Optional<TelemetryReading> findFirstByDeviceIdOrderByTimestampDesc(String deviceId);

    @Query("select count(t) from TelemetryReading t where t.timestamp > :since")
    long countSince(Instant since);
}
