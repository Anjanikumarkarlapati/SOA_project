package com.agritech.crop;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

interface CropRepository extends JpaRepository<Crop, String> {
    List<Crop> findByFarmId(String farmId);
}

interface HealthSnapshotRepository extends JpaRepository<HealthSnapshot, Long> {

    Optional<HealthSnapshot> findFirstByCropIdOrderByTimestampDesc(String cropId);

    List<HealthSnapshot> findByCropIdAndTimestampAfterOrderByTimestampAsc(String cropId, Instant after);
}
