package com.agritech.crop;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

interface FarmPropertyRepository extends JpaRepository<FarmProperty, String> {
    List<FarmProperty> findByOwnerEmailOrderByDefaultPropertyDescCreatedAtAsc(String ownerEmail);
    Optional<FarmProperty> findByOwnerEmailAndPropertyId(String ownerEmail, String propertyId);
}

interface CropRepository extends JpaRepository<Crop, String> {
    List<Crop> findByFarmId(String farmId);
}

interface HealthSnapshotRepository extends JpaRepository<HealthSnapshot, Long> {

    Optional<HealthSnapshot> findFirstByCropIdOrderByTimestampDesc(String cropId);

    List<HealthSnapshot> findByCropIdAndTimestampAfterOrderByTimestampAsc(String cropId, Instant after);

    /** Deleting a field deletes its recorded history; needs its own transaction. */
    @Transactional
    void deleteByCropId(String cropId);
}

interface FarmProfileRepository extends JpaRepository<FarmProfile, String> {}

interface DailyReportRepository extends JpaRepository<DailyReport, Long> {

    Optional<DailyReport> findByOwnerEmailAndReportDate(String ownerEmail, java.time.LocalDate reportDate);

    List<DailyReport> findTop90ByOwnerEmailOrderByReportDateDesc(String ownerEmail);

    void deleteByOwnerEmailAndReportDate(String ownerEmail, java.time.LocalDate reportDate);

    void deleteByOwnerEmail(String ownerEmail);
}
