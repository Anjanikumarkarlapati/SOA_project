package com.agritech.sensor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

interface SensorDeviceRepository extends JpaRepository<SensorDevice, String> {
    Page<SensorDevice> findByFarmId(String farmId, Pageable pageable);

    /** Tenant scoping: a farmer may only ever see the devices registered to their own farm. */
    List<SensorDevice> findByFarmId(String farmId);

    List<SensorDevice> findAllByFieldId(String fieldId);

    /**
     * Updates lastReadingAt in place only if the row still exists, so a background simulator tick
     * cannot overwrite concurrent PUT edits or resurrect a concurrently deregistered sensor.
     */
    @Modifying
    @Transactional
    @Query("""
            update SensorDevice d
            set d.lastReadingAt = case
                when d.lastReadingAt is null or d.lastReadingAt < :at then :at
                else d.lastReadingAt
            end
            where d.deviceId = :id
            """)
    int touchReadingIfPresent(@Param("id") String id, @Param("at") Instant at);
}

interface TelemetryRepository extends JpaRepository<TelemetryReading, Long> {

    List<TelemetryReading> findByDeviceIdAndTimestampBetweenOrderByTimestampAsc(
            String deviceId, Instant from, Instant to);

    Optional<TelemetryReading> findFirstByDeviceIdOrderByTimestampDesc(String deviceId);

    @Query("select count(t) from TelemetryReading t where t.timestamp > :since")
    long countSince(Instant since);

    /** Tenant-scoped variants of {@link #countSince} for /stats. */
    long countByDeviceIdIn(Collection<String> deviceIds);

    long countByDeviceIdInAndTimestampAfter(Collection<String> deviceIds, Instant since);
}

interface FieldWateringRepository extends JpaRepository<FieldWatering, String> {}
